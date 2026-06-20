// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AvaSettle SettlementVault
/// @notice On-chain payout rail: authorized operators pay institutional
///         beneficiaries from a funder treasury, individually or in atomic
///         batches, with attributable on-chain events.
/// @dev Pull-based, non-custodial: the vault never holds funds. It moves tokens
///      straight from `funder` (the institution's treasury, which approves the
///      vault) to each beneficiary via transferFrom. Splitting the privileged
///      payout role (operators) from fund custody (the funder key) lets an
///      institution run payouts with a hot operator key while the treasury key
///      only ever grants an allowance.
///
///      Each payout is uniquely identified by:
///          payoutId = keccak256(abi.encode(payoutRef, token, to, amount))
///      and can only execute once, so a retried request never double-pays.
///
///      IMPORTANT: whitelist only non-rebasing, non-fee-on-transfer ERC-20s.
///      For fee-on-transfer tokens the beneficiary would receive less than the
///      `amount` recorded in {PayoutExecuted}, breaking reconciliation. USDC and
///      USDT on Avalanche C-Chain satisfy this.
contract SettlementVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Hard cap on batch size to bound gas and avoid unexecutable batches.
    uint256 public constant MAX_BATCH = 256;

    // ─── Errors ──────────────────────────────────────────────────────────────

    error InvalidFunder();
    error InvalidToken();
    error UnsupportedToken(address token);
    error InvalidReference();
    error InvalidAmount();
    error InvalidBeneficiary();
    error InvalidOperator();
    error NotOperator(address caller);
    error PayoutAlreadyExecuted(bytes32 payoutId);
    error BatchAlreadyExecuted(bytes32 batchId);
    error EmptyBatch();
    error BatchTooLarge(uint256 size, uint256 max);
    error LengthMismatch(uint256 recipients, uint256 amounts);

    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Treasury the vault pulls funds from (must approve the vault).
    address public funder;
    mapping(address operator => bool allowed) public operators;
    mapping(address token => bool supported) public supportedTokens;
    mapping(bytes32 payoutId => bool executed) public payoutExecuted;
    mapping(bytes32 batchId => bool executed) public batchExecuted;

    // ─── Events ──────────────────────────────────────────────────────────────

    event FunderUpdated(address indexed previousFunder, address indexed newFunder);
    event OperatorUpdated(address indexed operator, bool allowed);
    event TokenSupportUpdated(address indexed token, bool supported);
    event PayoutExecuted(
        bytes32 indexed payoutId,
        bytes32 indexed batchId,
        address indexed token,
        bytes32 payoutRef,
        address funder,
        address to,
        uint256 amount,
        bytes metadata
    );
    event BatchExecuted(bytes32 indexed batchId, address indexed token, bytes32 batchRef, uint256 count, uint256 total);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address initialOwner, address initialFunder) Ownable(initialOwner) {
        if (initialFunder == address(0)) revert InvalidFunder();
        funder = initialFunder;
        emit FunderUpdated(address(0), initialFunder);
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyOperator() {
        if (!operators[msg.sender]) revert NotOperator(msg.sender);
        _;
    }

    // ─── Owner administration ─────────────────────────────────────────────────

    function setFunder(address newFunder) external onlyOwner {
        if (newFunder == address(0)) revert InvalidFunder();
        address previous = funder;
        funder = newFunder;
        emit FunderUpdated(previous, newFunder);
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert InvalidOperator();
        operators[operator] = allowed;
        emit OperatorUpdated(operator, allowed);
    }

    function setTokenSupported(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function computePayoutId(bytes32 payoutRef, address token, address to, uint256 amount)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(payoutRef, token, to, amount));
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /// @notice Execute a single payout from the funder to `to`.
    /// @return payoutId The keccak256(payoutRef, token, to, amount) marked executed.
    function payout(bytes32 payoutRef, IERC20 token, address to, uint256 amount, bytes calldata metadata)
        external
        onlyOperator
        nonReentrant
        whenNotPaused
        returns (bytes32 payoutId)
    {
        if (!supportedTokens[address(token)]) revert UnsupportedToken(address(token));
        payoutId = _execute(bytes32(0), payoutRef, token, to, amount, metadata);
    }

    /// @notice Execute many payouts of a single token atomically. If any leg
    ///         reverts (e.g. insufficient allowance) the whole batch reverts.
    /// @param batchRef  Unique reference for the batch; prevents batch replay.
    /// @return batchId  keccak256(batchRef, token) marked executed.
    function payoutBatch(
        bytes32 batchRef,
        IERC20 token,
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes calldata metadata
    ) external onlyOperator nonReentrant whenNotPaused returns (bytes32 batchId) {
        if (batchRef == bytes32(0)) revert InvalidReference();
        if (!supportedTokens[address(token)]) revert UnsupportedToken(address(token));
        if (recipients.length != amounts.length) revert LengthMismatch(recipients.length, amounts.length);
        if (recipients.length == 0) revert EmptyBatch();
        if (recipients.length > MAX_BATCH) revert BatchTooLarge(recipients.length, MAX_BATCH);

        batchId = keccak256(abi.encode(batchRef, address(token)));
        if (batchExecuted[batchId]) revert BatchAlreadyExecuted(batchId);
        batchExecuted[batchId] = true;

        uint256 total;
        uint256 n = recipients.length;
        for (uint256 i = 0; i < n;) {
            // Per-leg ref keeps each PayoutExecuted id unique within the batch.
            bytes32 legRef = keccak256(abi.encode(batchRef, i));
            _execute(batchId, legRef, token, recipients[i], amounts[i], metadata);
            // `total` stays checked (amounts are attacker-supplied); only the
            // loop counter is unchecked — it is bounded by MAX_BATCH and cannot
            // overflow.
            total += amounts[i];
            unchecked {
                ++i;
            }
        }

        emit BatchExecuted(batchId, address(token), batchRef, recipients.length, total);
    }

    /// @dev Shared payout leg. Callers MUST carry onlyOperator + nonReentrant +
    ///      whenNotPaused. Token support is validated by the entry points.
    function _execute(
        bytes32 batchId,
        bytes32 payoutRef,
        IERC20 token,
        address to,
        uint256 amount,
        bytes calldata metadata
    ) private returns (bytes32 payoutId) {
        if (payoutRef == bytes32(0)) revert InvalidReference();
        if (to == address(0)) revert InvalidBeneficiary();
        if (amount == 0) revert InvalidAmount();

        payoutId = computePayoutId(payoutRef, address(token), to, amount);
        if (payoutExecuted[payoutId]) revert PayoutAlreadyExecuted(payoutId);

        // Effects before interactions (CEI).
        payoutExecuted[payoutId] = true;

        address from = funder;
        token.safeTransferFrom(from, to, amount);

        emit PayoutExecuted(payoutId, batchId, address(token), payoutRef, from, to, amount, metadata);
    }
}

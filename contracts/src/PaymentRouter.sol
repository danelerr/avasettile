// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AvaSettle PaymentRouter
/// @notice Programmable invoice router for Avalanche C-Chain stablecoin pay-ins.
/// @dev Funds move from payer to treasury in one transaction.
///
///      An invoice is uniquely identified on-chain by:
///          invoiceId = keccak256(abi.encode(invoiceRef, token, amount))
///      so the (token, amount) pair is *cryptographically bound* to the payment.
///      A payer cannot consume someone else's invoiceRef by paying a different
///      amount or a different token — that simply produces a different invoiceId.
///      The only way to mark a given invoiceId as paid is to pay it exactly,
///      which eliminates the "underpay / wrong-token" invoice-locking griefing.
///
///      Each invoiceId can only be paid once — multi-part payments must use
///      distinct invoice references.
///
///      IMPORTANT: Only non-rebasing, non-fee-on-transfer ERC-20 tokens must be
///      whitelisted via {setTokenSupported}. For fee-on-transfer tokens the
///      amount credited to the treasury would be less than the `amount` recorded
///      in {InvoicePaid}, breaking off-chain reconciliation. USDC and USDT on
///      Avalanche C-Chain satisfy this requirement.
contract PaymentRouter is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ──────────────────────────────────────────────────────────────

    error InvalidTreasury();
    error InvalidToken();
    error UnsupportedToken(address token);
    error InvalidReference();
    error InvalidAmount();
    error AmountBelowMinimum(address token, uint256 amount, uint256 minimum);
    error InvoiceAlreadyPaid(bytes32 invoiceId);
    error InvoiceExpired(uint256 deadline);

    // ─── State ───────────────────────────────────────────────────────────────

    address public treasury;
    mapping(address token => bool supported) public supportedTokens;
    mapping(address token => uint256 minimum) public minAmount;
    mapping(bytes32 invoiceId => bool paid) public invoicePaid;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event TokenSupportUpdated(address indexed token, bool supported);
    event MinAmountUpdated(address indexed token, uint256 minAmount);
    event InvoicePaid(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed token,
        bytes32 invoiceRef,
        uint256 amount,
        address treasury,
        bytes metadata
    );
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address initialOwner, address initialTreasury) Ownable(initialOwner) {
        if (initialTreasury == address(0)) revert InvalidTreasury();
        treasury = initialTreasury;
        emit TreasuryUpdated(address(0), initialTreasury);
    }

    // ─── Owner administration ─────────────────────────────────────────────────

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address previousTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
    }

    /// @param minimum Minimum accepted atomic amount (0 = no minimum).
    function setTokenSupported(address token, bool supported, uint256 minimum) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        supportedTokens[token] = supported;
        minAmount[token] = minimum;
        emit TokenSupportUpdated(token, supported);
        emit MinAmountUpdated(token, minimum);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Recover tokens sent to this contract by mistake.
    /// @dev Funds never rest in this contract during normal operation (pay-ins
    ///      move straight to the treasury), so this only sweeps stray transfers.
    ///      Only callable by owner. Emits {EmergencyWithdraw}.
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        if (to == address(0)) revert InvalidTreasury();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, to, amount);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice Deterministically derive the on-chain invoiceId for a payment.
    /// @dev Off-chain services use this to filter {InvoicePaid} logs.
    function computeInvoiceId(bytes32 invoiceRef, address token, uint256 amount) public pure returns (bytes32) {
        return keccak256(abi.encode(invoiceRef, token, amount));
    }

    /// @notice Whether the invoice for (invoiceRef, token, amount) has been paid.
    function isInvoicePaid(bytes32 invoiceRef, address token, uint256 amount) external view returns (bool) {
        return invoicePaid[computeInvoiceId(invoiceRef, token, amount)];
    }

    /// @notice invoiceId for an invoice that carries an on-chain expiry.
    /// @dev Distinct from {computeInvoiceId}: the `deadline` is bound into the id
    ///      so a payer cannot strip the expiry by paying with a different one —
    ///      that produces a different invoice. `deadline` is a unix timestamp;
    ///      0 means "no expiry" (equivalent intent to {computeInvoiceId} but a
    ///      different id, since the preimage arity differs).
    function computeInvoiceIdWithExpiry(bytes32 invoiceRef, address token, uint256 amount, uint256 deadline)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(invoiceRef, token, amount, deadline));
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /// @notice Pay an invoice, pulling `amount` of `token` from the caller to the treasury.
    /// @param invoiceRef Caller-supplied salt that uniquely identifies the invoice
    ///        (e.g. keccak256 of the merchant external id). Bound into the invoiceId.
    /// @param token      Supported ERC-20 stablecoin to pay with.
    /// @param amount     Exact atomic amount to pay (must be >= the token minimum).
    /// @param metadata   Opaque bytes echoed in {InvoicePaid} for off-chain context.
    /// @return invoiceId The keccak256(invoiceRef, token, amount) identifier marked paid.
    function payInvoice(bytes32 invoiceRef, IERC20 token, uint256 amount, bytes calldata metadata)
        external
        nonReentrant
        whenNotPaused
        returns (bytes32 invoiceId)
    {
        return _payInvoice(invoiceRef, token, amount, metadata);
    }

    /// @notice Pay an invoice in a single transaction using an EIP-2612 permit
    ///         signature, so the payer never needs a separate `approve` call.
    /// @dev The permit is wrapped in try/catch: if a front-runner already
    ///      submitted the same signature (consuming the nonce) the allowance is
    ///      still in place, so the payment proceeds instead of bricking. Any
    ///      genuine allowance shortfall still reverts in the transferFrom below.
    /// @param deadline EIP-2612 signature deadline (unix seconds).
    /// @param v,r,s    Components of the payer's permit signature.
    function payInvoiceWithPermit(
        bytes32 invoiceRef,
        IERC20 token,
        uint256 amount,
        bytes calldata metadata,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenNotPaused returns (bytes32 invoiceId) {
        try IERC20Permit(address(token)).permit(msg.sender, address(this), amount, deadline, v, r, s) {} catch {}
        return _payInvoice(invoiceRef, token, amount, metadata);
    }

    /// @notice Pay an invoice that expires on-chain at `deadline` (unix seconds).
    /// @dev Additive over {payInvoice}: the `deadline` is bound into the invoiceId
    ///      (see {computeInvoiceIdWithExpiry}) and enforced here, so a payment
    ///      submitted after the deadline reverts on-chain instead of relying on
    ///      off-chain checks. `deadline == 0` records no expiry. Backward
    ///      compatible — {payInvoice} and {computeInvoiceId} are unchanged.
    /// @return invoiceId keccak256(invoiceRef, token, amount, deadline) marked paid.
    function payInvoiceWithExpiry(
        bytes32 invoiceRef,
        IERC20 token,
        uint256 amount,
        uint256 deadline,
        bytes calldata metadata
    ) external nonReentrant whenNotPaused returns (bytes32 invoiceId) {
        if (deadline != 0 && block.timestamp > deadline) revert InvoiceExpired(deadline);
        bytes32 id = computeInvoiceIdWithExpiry(invoiceRef, address(token), amount, deadline);
        return _settle(id, invoiceRef, token, amount, metadata);
    }

    /// @dev Settles the canonical (no-expiry) invoiceId.
    function _payInvoice(bytes32 invoiceRef, IERC20 token, uint256 amount, bytes calldata metadata)
        private
        returns (bytes32 invoiceId)
    {
        return _settle(computeInvoiceId(invoiceRef, address(token), amount), invoiceRef, token, amount, metadata);
    }

    /// @dev Shared settlement body. Validates the invoice, marks `invoiceId`
    ///      paid (CEI) and pulls funds to the treasury. Callers MUST carry
    ///      `nonReentrant` + `whenNotPaused` and pass the invoiceId they derived.
    function _settle(bytes32 invoiceId, bytes32 invoiceRef, IERC20 token, uint256 amount, bytes calldata metadata)
        private
        returns (bytes32)
    {
        if (invoiceRef == bytes32(0)) revert InvalidReference();
        if (address(token) == address(0)) revert InvalidToken();
        if (!supportedTokens[address(token)]) revert UnsupportedToken(address(token));
        if (amount == 0) revert InvalidAmount();

        uint256 minimum = minAmount[address(token)];
        if (minimum > 0 && amount < minimum) revert AmountBelowMinimum(address(token), amount, minimum);

        if (invoicePaid[invoiceId]) revert InvoiceAlreadyPaid(invoiceId);

        // Effects before interactions (CEI): the invoice is consumed before funds move.
        invoicePaid[invoiceId] = true;

        // Snapshot the treasury at call time so a concurrent setTreasury cannot
        // retarget an in-flight payment, and the event reflects where funds went.
        address settledTreasury = treasury;
        token.safeTransferFrom(msg.sender, settledTreasury, amount);

        emit InvoicePaid(invoiceId, msg.sender, address(token), invoiceRef, amount, settledTreasury, metadata);
        return invoiceId;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AvaSettle PaymentRouter
/// @notice Programmable invoice router for Avalanche stablecoin pay-ins.
/// @dev Funds move from payer to treasury in one transaction.
///      Each invoiceId can only be paid once — multi-part payments must use separate IDs.
contract PaymentRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Errors ──────────────────────────────────────────────────────────────

    error InvalidTreasury();
    error InvalidToken();
    error UnsupportedToken(address token);
    error InvalidInvoiceId();
    error InvalidAmount();
    error AmountBelowMinimum(address token, uint256 amount, uint256 minimum);
    error InvoiceAlreadyPaid(bytes32 invoiceId);

    // ─── State ───────────────────────────────────────────────────────────────

    address public treasury;
    mapping(address token => bool supported)   public supportedTokens;
    mapping(address token => uint256 minimum)  public minAmount;
    mapping(bytes32 invoiceId => bool paid)    public invoicePaid;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event TokenSupportUpdated(address indexed token, bool supported);
    event MinAmountUpdated(address indexed token, uint256 minAmount);
    event InvoicePaid(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed token,
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

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Recover tokens sent to this contract by mistake or stuck due to failed invoices.
    /// @dev Only callable by owner. Emits EmergencyWithdraw.
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        if (to == address(0)) revert InvalidTreasury();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, to, amount);
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    function payInvoice(bytes32 invoiceId, IERC20 token, uint256 amount, bytes calldata metadata)
        external
        nonReentrant
        whenNotPaused
    {
        if (invoiceId == bytes32(0)) revert InvalidInvoiceId();
        if (address(token) == address(0)) revert InvalidToken();
        if (!supportedTokens[address(token)]) revert UnsupportedToken(address(token));
        if (amount == 0) revert InvalidAmount();

        uint256 minimum = minAmount[address(token)];
        if (minimum > 0 && amount < minimum) revert AmountBelowMinimum(address(token), amount, minimum);

        if (invoicePaid[invoiceId]) revert InvoiceAlreadyPaid(invoiceId);

        invoicePaid[invoiceId] = true;
        token.safeTransferFrom(msg.sender, treasury, amount);

        emit InvoicePaid(invoiceId, msg.sender, address(token), amount, treasury, metadata);
    }
}

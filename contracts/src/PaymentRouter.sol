// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AvaSettle PaymentRouter
/// @notice Minimal programmable invoice router for Avalanche stablecoin pay-ins.
/// @dev Funds move from payer to treasury in the same transaction; the router
///      emits invoice-level events for backend reconciliation.
contract PaymentRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error InvalidTreasury();
    error InvalidToken();
    error UnsupportedToken(address token);
    error InvalidInvoiceId();
    error InvalidAmount();

    address public treasury;
    mapping(address token => bool supported) public supportedTokens;

    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event TokenSupportUpdated(address indexed token, bool supported);
    event InvoicePaid(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed token,
        uint256 amount,
        address treasury,
        bytes metadata
    );

    constructor(address initialOwner, address initialTreasury) Ownable(initialOwner) {
        if (initialTreasury == address(0)) revert InvalidTreasury();
        treasury = initialTreasury;
        emit TreasuryUpdated(address(0), initialTreasury);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address previousTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previousTreasury, newTreasury);
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

    function payInvoice(bytes32 invoiceId, IERC20 token, uint256 amount, bytes calldata metadata)
        external
        nonReentrant
        whenNotPaused
    {
        if (invoiceId == bytes32(0)) revert InvalidInvoiceId();
        if (address(token) == address(0)) revert InvalidToken();
        if (!supportedTokens[address(token)]) revert UnsupportedToken(address(token));
        if (amount == 0) revert InvalidAmount();

        token.safeTransferFrom(msg.sender, treasury, amount);

        emit InvoicePaid(invoiceId, msg.sender, address(token), amount, treasury, metadata);
    }
}

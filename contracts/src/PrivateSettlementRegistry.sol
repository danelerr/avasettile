// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title AvaSettle PrivateSettlementRegistry
/// @notice Records institutional settlements as hash commitments so the amount
///         and counterparty stay off the public ledger, while a designated
///         auditor can still verify them on demand.
/// @dev EXPERIMENTAL — this is the first step of AvaSettle's private settlement
///      roadmap toward eERC (encrypted ERC-20). It provides *confidentiality
///      with selective auditability* via commitments, NOT zero-knowledge
///      transfers: tokens are not moved or shielded here. A settlement is
///      published as
///          commitment = keccak256(abi.encode(amount, asset, counterparty, nonce))
///      Only the commitment is on-chain. A party holding the preimage (the
///      institution, or an auditor it discloses to) can prove what a record
///      represents via {verifyCommitment}; nobody else can recover the amount
///      or counterparty from the commitment. The random `nonce` blinds the
///      commitment against dictionary attacks on small/!guessable amounts.
///
///      Migration path: when AvaSettle integrates a true eERC token, the same
///      record ids and audit roles carry over; {recordSettlement} gains an
///      on-chain encrypted-transfer reference instead of a bare commitment.
contract PrivateSettlementRegistry is Ownable2Step {
    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotRegistrar(address caller);
    error NotAuditor(address caller);
    error InvalidReference();
    error InvalidCommitment();
    error InvalidAccount();
    error SettlementAlreadyRecorded(bytes32 settlementId);
    error UnknownSettlement(bytes32 settlementId);
    error CommitmentMismatch(bytes32 settlementId);

    // ─── Types ───────────────────────────────────────────────────────────────

    enum Status {
        None,
        Recorded,
        Revealed
    }

    struct Record {
        bytes32 commitment;
        Status status;
        uint64 recordedAt;
        address registrar;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address registrar => bool allowed) public registrars;
    mapping(address auditor => bool allowed) public auditors;
    mapping(bytes32 settlementId => Record) public records;

    // ─── Events ──────────────────────────────────────────────────────────────

    event RegistrarUpdated(address indexed registrar, bool allowed);
    event AuditorUpdated(address indexed auditor, bool allowed);
    event PrivateSettlementRecorded(
        bytes32 indexed settlementId,
        bytes32 indexed settlementRef,
        address indexed registrar,
        bytes32 commitment,
        bytes publicMetadata
    );
    /// @dev Emitted when an auditor verifies a record's preimage on-chain,
    ///      leaving an immutable attestation that the disclosure happened.
    event PrivateSettlementRevealed(bytes32 indexed settlementId, address indexed auditor);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyRegistrar() {
        if (!registrars[msg.sender]) revert NotRegistrar(msg.sender);
        _;
    }

    modifier onlyAuditor() {
        if (!auditors[msg.sender]) revert NotAuditor(msg.sender);
        _;
    }

    // ─── Owner administration ─────────────────────────────────────────────────

    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        if (registrar == address(0)) revert InvalidAccount();
        registrars[registrar] = allowed;
        emit RegistrarUpdated(registrar, allowed);
    }

    function setAuditor(address auditor, bool allowed) external onlyOwner {
        if (auditor == address(0)) revert InvalidAccount();
        auditors[auditor] = allowed;
        emit AuditorUpdated(auditor, allowed);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice Off-chain helper mirrored on-chain: the commitment a settlement
    ///         preimage must hash to. `nonce` is the secret blinding factor.
    function computeCommitment(uint256 amount, address asset, address counterparty, bytes32 nonce)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(amount, asset, counterparty, nonce));
    }

    /// @notice True if the preimage matches the stored commitment for `settlementId`.
    /// @dev View-only: anyone holding the preimage can check a record without
    ///      changing state (e.g. an auditor reconciling off-chain).
    function verifyCommitment(bytes32 settlementId, uint256 amount, address asset, address counterparty, bytes32 nonce)
        public
        view
        returns (bool)
    {
        Record storage rec = records[settlementId];
        if (rec.status == Status.None) revert UnknownSettlement(settlementId);
        return rec.commitment == computeCommitment(amount, asset, counterparty, nonce);
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /// @notice Record a private settlement commitment.
    /// @param settlementRef  Unique reference (e.g. keccak256 of the internal id).
    /// @param commitment     keccak256(amount, asset, counterparty, nonce), built off-chain.
    /// @param publicMetadata Opaque, non-sensitive context echoed in the event.
    /// @return settlementId  keccak256(settlementRef) marked recorded.
    function recordSettlement(bytes32 settlementRef, bytes32 commitment, bytes calldata publicMetadata)
        external
        onlyRegistrar
        returns (bytes32 settlementId)
    {
        if (settlementRef == bytes32(0)) revert InvalidReference();
        if (commitment == bytes32(0)) revert InvalidCommitment();

        settlementId = keccak256(abi.encode(settlementRef));
        if (records[settlementId].status != Status.None) revert SettlementAlreadyRecorded(settlementId);

        records[settlementId] = Record({
            commitment: commitment, status: Status.Recorded, recordedAt: uint64(block.timestamp), registrar: msg.sender
        });

        emit PrivateSettlementRecorded(settlementId, settlementRef, msg.sender, commitment, publicMetadata);
    }

    /// @notice Auditor attests on-chain that a record's preimage is valid.
    /// @dev Reverts unless the preimage matches, so a {PrivateSettlementRevealed}
    ///      log is proof the disclosed values are the ones that were committed.
    function revealForAudit(bytes32 settlementId, uint256 amount, address asset, address counterparty, bytes32 nonce)
        external
        onlyAuditor
    {
        if (!verifyCommitment(settlementId, amount, asset, counterparty, nonce)) {
            revert CommitmentMismatch(settlementId);
        }
        records[settlementId].status = Status.Revealed;
        emit PrivateSettlementRevealed(settlementId, msg.sender);
    }
}

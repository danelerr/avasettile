// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PrivateSettlementRegistry} from "../src/PrivateSettlementRegistry.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PrivateSettlementRegistryTest is Test {
    PrivateSettlementRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal registrar = makeAddr("registrar");
    address internal auditor = makeAddr("auditor");
    address internal stranger = makeAddr("stranger");

    // Sample private settlement preimage.
    uint256 internal constant AMOUNT = 123_456_789;
    address internal asset = makeAddr("usdc");
    address internal counterparty = makeAddr("merchant");
    bytes32 internal nonce = keccak256("blinding-nonce");

    event PrivateSettlementRecorded(
        bytes32 indexed settlementId,
        bytes32 indexed settlementRef,
        address indexed registrar,
        bytes32 commitment,
        bytes publicMetadata
    );
    event PrivateSettlementRevealed(bytes32 indexed settlementId, address indexed auditor);

    function setUp() public {
        vm.prank(owner);
        registry = new PrivateSettlementRegistry(owner);

        vm.startPrank(owner);
        registry.setRegistrar(registrar, true);
        registry.setAuditor(auditor, true);
        vm.stopPrank();
    }

    function _ref(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    /// Computed locally (mirrors computeCommitment) so it never makes an
    /// external call that would consume a pending vm.prank.
    function _commit() internal view returns (bytes32) {
        return keccak256(abi.encode(AMOUNT, asset, counterparty, nonce));
    }

    // ── Access control ─────────────────────────────────────────────────────────

    function test_setRegistrar_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        registry.setRegistrar(stranger, true);
    }

    function test_recordSettlement_onlyRegistrar() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PrivateSettlementRegistry.NotRegistrar.selector, stranger));
        registry.recordSettlement(_ref("s1"), _commit(), "");
    }

    function test_revealForAudit_onlyAuditor() public {
        bytes32 ref = _ref("s-audit-auth");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(PrivateSettlementRegistry.NotAuditor.selector, stranger));
        registry.revealForAudit(id, AMOUNT, asset, counterparty, nonce);
    }

    // ── Recording ──────────────────────────────────────────────────────────────

    function test_recordSettlement_storesCommitmentAndEmits() public {
        bytes32 ref = _ref("s-rec");
        bytes32 commitment = _commit();
        bytes32 id = keccak256(abi.encode(ref));

        vm.expectEmit(true, true, true, true);
        emit PrivateSettlementRecorded(id, ref, registrar, commitment, hex"c0");

        vm.prank(registrar);
        bytes32 got = registry.recordSettlement(ref, commitment, hex"c0");

        assertEq(got, id);
        (bytes32 storedCommit, PrivateSettlementRegistry.Status status,, address reg) = registry.records(id);
        assertEq(storedCommit, commitment);
        assertEq(uint8(status), uint8(PrivateSettlementRegistry.Status.Recorded));
        assertEq(reg, registrar);
    }

    function test_recordSettlement_revertsOnZeroRef() public {
        vm.prank(registrar);
        vm.expectRevert(PrivateSettlementRegistry.InvalidReference.selector);
        registry.recordSettlement(bytes32(0), _commit(), "");
    }

    function test_recordSettlement_revertsOnZeroCommitment() public {
        vm.prank(registrar);
        vm.expectRevert(PrivateSettlementRegistry.InvalidCommitment.selector);
        registry.recordSettlement(_ref("s"), bytes32(0), "");
    }

    function test_recordSettlement_revertsOnReplay() public {
        bytes32 ref = _ref("s-replay");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(PrivateSettlementRegistry.SettlementAlreadyRecorded.selector, id));
        registry.recordSettlement(ref, _commit(), "");
    }

    // ── Privacy / verification ───────────────────────────────────────────────

    function test_verifyCommitment_trueForCorrectPreimage() public {
        bytes32 ref = _ref("s-verify");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");
        assertTrue(registry.verifyCommitment(id, AMOUNT, asset, counterparty, nonce));
    }

    function test_verifyCommitment_falseForWrongAmount() public {
        bytes32 ref = _ref("s-verify-2");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");
        assertFalse(registry.verifyCommitment(id, AMOUNT + 1, asset, counterparty, nonce));
    }

    /// Without the secret nonce, a guessed preimage does not match — the nonce
    /// blinds the commitment against brute-forcing small amounts.
    function test_verifyCommitment_falseWithoutNonce() public {
        bytes32 ref = _ref("s-verify-3");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");
        assertFalse(registry.verifyCommitment(id, AMOUNT, asset, counterparty, bytes32(0)));
    }

    function test_verifyCommitment_revertsForUnknownId() public {
        vm.expectRevert(abi.encodeWithSelector(PrivateSettlementRegistry.UnknownSettlement.selector, bytes32("nope")));
        registry.verifyCommitment(bytes32("nope"), AMOUNT, asset, counterparty, nonce);
    }

    // ── Audit reveal ───────────────────────────────────────────────────────────

    function test_revealForAudit_marksRevealedOnMatch() public {
        bytes32 ref = _ref("s-reveal");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");

        vm.expectEmit(true, true, false, false);
        emit PrivateSettlementRevealed(id, auditor);
        vm.prank(auditor);
        registry.revealForAudit(id, AMOUNT, asset, counterparty, nonce);

        (, PrivateSettlementRegistry.Status status,,) = registry.records(id);
        assertEq(uint8(status), uint8(PrivateSettlementRegistry.Status.Revealed));
    }

    function test_revealForAudit_revertsOnMismatch() public {
        bytes32 ref = _ref("s-reveal-bad");
        vm.prank(registrar);
        bytes32 id = registry.recordSettlement(ref, _commit(), "");
        vm.prank(auditor);
        vm.expectRevert(abi.encodeWithSelector(PrivateSettlementRegistry.CommitmentMismatch.selector, id));
        registry.revealForAudit(id, AMOUNT + 1, asset, counterparty, nonce);
    }

    // ── Fuzz: distinct preimages never collide ────────────────────────────────

    function testFuzz_commitmentBindsAllFields(uint256 amount, address ct, bytes32 n) public view {
        bytes32 base = registry.computeCommitment(AMOUNT, asset, counterparty, nonce);
        bytes32 other = registry.computeCommitment(amount, asset, ct, n);
        if (amount == AMOUNT && ct == counterparty && n == nonce) {
            assertEq(base, other);
        } else {
            assertTrue(base != other);
        }
    }
}

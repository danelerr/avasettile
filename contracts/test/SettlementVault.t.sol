// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSD is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) {
        _decimals = d;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SettlementVaultTest is Test {
    SettlementVault internal vault;
    MockUSD internal usdc;

    address internal owner = makeAddr("owner");
    address internal funder = makeAddr("funder");
    address internal operator = makeAddr("operator");
    address internal stranger = makeAddr("stranger");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant U = 1_000_000; // 1.00 (6 dp)

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

    function setUp() public {
        vm.prank(owner);
        vault = new SettlementVault(owner, funder);

        usdc = new MockUSD("USD Coin", "USDC", 6);

        vm.startPrank(owner);
        vault.setOperator(operator, true);
        vault.setTokenSupported(address(usdc), true);
        vm.stopPrank();

        usdc.mint(funder, 1_000_000 * U);
        // Funder grants the vault an allowance (treasury key only ever approves).
        vm.prank(funder);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _ref(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    // ── Constructor / admin ────────────────────────────────────────────────────

    function test_constructor_setsOwnerAndFunder() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.funder(), funder);
    }

    function test_constructor_revertsOnZeroFunder() public {
        vm.expectRevert(SettlementVault.InvalidFunder.selector);
        new SettlementVault(owner, address(0));
    }

    function test_setOperator_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vault.setOperator(stranger, true);
    }

    function test_setOperator_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(SettlementVault.InvalidOperator.selector);
        vault.setOperator(address(0), true);
    }

    function test_setFunder_updatesAndEmits() public {
        address next = makeAddr("next");
        vm.prank(owner);
        vault.setFunder(next);
        assertEq(vault.funder(), next);
    }

    // ── Single payout ───────────────────────────────────────────────────────────

    function test_payout_movesFundsAndEmits() public {
        bytes32 ref = _ref("po-1");
        uint256 amount = 100 * U;
        bytes32 id = vault.computePayoutId(ref, address(usdc), alice, amount);

        vm.expectEmit(true, true, true, true);
        emit PayoutExecuted(id, bytes32(0), address(usdc), ref, funder, alice, amount, hex"ab");

        vm.prank(operator);
        bytes32 got = vault.payout(ref, IERC20(address(usdc)), alice, amount, hex"ab");

        assertEq(got, id);
        assertTrue(vault.payoutExecuted(id));
        assertEq(usdc.balanceOf(alice), amount);
        assertEq(usdc.balanceOf(funder), 1_000_000 * U - amount);
    }

    function test_payout_onlyOperator() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(SettlementVault.NotOperator.selector, stranger));
        vault.payout(_ref("x"), IERC20(address(usdc)), alice, U, "");
    }

    function test_payout_revertsOnUnsupportedToken() public {
        MockUSD other = new MockUSD("O", "O", 6);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementVault.UnsupportedToken.selector, address(other)));
        vault.payout(_ref("x"), IERC20(address(other)), alice, U, "");
    }

    function test_payout_revertsOnZeroBeneficiary() public {
        vm.prank(operator);
        vm.expectRevert(SettlementVault.InvalidBeneficiary.selector);
        vault.payout(_ref("x"), IERC20(address(usdc)), address(0), U, "");
    }

    function test_payout_revertsOnZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert(SettlementVault.InvalidAmount.selector);
        vault.payout(_ref("x"), IERC20(address(usdc)), alice, 0, "");
    }

    function test_payout_revertsOnReplay() public {
        bytes32 ref = _ref("po-replay");
        uint256 amount = 5 * U;
        vm.prank(operator);
        bytes32 id = vault.payout(ref, IERC20(address(usdc)), alice, amount, "");

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementVault.PayoutAlreadyExecuted.selector, id));
        vault.payout(ref, IERC20(address(usdc)), alice, amount, "");
    }

    function test_payout_blockedWhenPaused() public {
        vm.prank(owner);
        vault.pause();
        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.payout(_ref("x"), IERC20(address(usdc)), alice, U, "");
    }

    // ── Batch payout ──────────────────────────────────────────────────────────

    function test_payoutBatch_paysAllAtomically() public {
        address[] memory to = new address[](2);
        uint256[] memory amt = new uint256[](2);
        to[0] = alice;
        to[1] = bob;
        amt[0] = 10 * U;
        amt[1] = 25 * U;

        bytes32 batchRef = _ref("batch-1");
        bytes32 batchId = keccak256(abi.encode(batchRef, address(usdc)));

        vm.expectEmit(true, true, false, true);
        emit BatchExecuted(batchId, address(usdc), batchRef, 2, 35 * U);

        vm.prank(operator);
        vault.payoutBatch(batchRef, IERC20(address(usdc)), to, amt, "");

        assertEq(usdc.balanceOf(alice), 10 * U);
        assertEq(usdc.balanceOf(bob), 25 * U);
        assertTrue(vault.batchExecuted(batchId));
    }

    function test_payoutBatch_revertsOnLengthMismatch() public {
        address[] memory to = new address[](2);
        uint256[] memory amt = new uint256[](1);
        to[0] = alice;
        to[1] = bob;
        amt[0] = U;
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementVault.LengthMismatch.selector, 2, 1));
        vault.payoutBatch(_ref("b"), IERC20(address(usdc)), to, amt, "");
    }

    function test_payoutBatch_revertsOnEmpty() public {
        address[] memory to = new address[](0);
        uint256[] memory amt = new uint256[](0);
        vm.prank(operator);
        vm.expectRevert(SettlementVault.EmptyBatch.selector);
        vault.payoutBatch(_ref("b"), IERC20(address(usdc)), to, amt, "");
    }

    function test_payoutBatch_revertsOnReplay() public {
        address[] memory to = new address[](1);
        uint256[] memory amt = new uint256[](1);
        to[0] = alice;
        amt[0] = U;
        bytes32 batchRef = _ref("batch-replay");

        vm.prank(operator);
        vault.payoutBatch(batchRef, IERC20(address(usdc)), to, amt, "");

        bytes32 batchId = keccak256(abi.encode(batchRef, address(usdc)));
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementVault.BatchAlreadyExecuted.selector, batchId));
        vault.payoutBatch(batchRef, IERC20(address(usdc)), to, amt, "");
    }

    /// If one leg exceeds the allowance/balance, the whole batch reverts (atomic).
    function test_payoutBatch_isAtomicOnLegFailure() public {
        address[] memory to = new address[](2);
        uint256[] memory amt = new uint256[](2);
        to[0] = alice;
        to[1] = bob;
        amt[0] = 10 * U;
        amt[1] = 2_000_000 * U; // exceeds funder balance

        vm.prank(operator);
        vm.expectRevert();
        vault.payoutBatch(_ref("batch-atomic"), IERC20(address(usdc)), to, amt, "");

        // Nothing moved — alice did not receive her leg.
        assertEq(usdc.balanceOf(alice), 0);
    }

    function test_payoutBatch_revertsAboveMaxBatch() public {
        // Read the cap up front: calling vault.MAX_BATCH() inside expectRevert
        // would consume the vm.prank before payoutBatch runs.
        uint256 max = vault.MAX_BATCH();
        uint256 n = max + 1;
        address[] memory to = new address[](n);
        uint256[] memory amt = new uint256[](n);
        for (uint256 i = 0; i < n; ++i) {
            to[i] = address(uint160(i + 1));
            amt[i] = U;
        }
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementVault.BatchTooLarge.selector, n, max));
        vault.payoutBatch(_ref("big"), IERC20(address(usdc)), to, amt, "");
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────

    function testFuzz_payout_paysExactAmount(bytes32 ref, uint96 raw) public {
        vm.assume(ref != bytes32(0));
        uint256 amount = bound(uint256(raw), 1, 1_000_000 * U);

        vm.prank(operator);
        vault.payout(ref, IERC20(address(usdc)), alice, amount, "");
        assertEq(usdc.balanceOf(alice), amount);
    }
}

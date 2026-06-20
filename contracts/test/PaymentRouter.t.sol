// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ── Test doubles ──────────────────────────────────────────────────────────────

contract MockUSD is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name, string memory symbol, uint8 dec) ERC20(name, symbol) {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Token that burns a fixed bps fee on every transfer (fee-on-transfer).
contract FeeToken is ERC20 {
    uint256 public constant FEE_BPS = 100; // 1%

    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * FEE_BPS) / 10_000;
        super._update(from, address(0xdead), fee);
        super._update(from, to, value - fee);
    }
}

/// Token that attempts to re-enter payInvoice during transferFrom.
contract ReentrantToken is ERC20 {
    PaymentRouter public router;
    bytes32 public reentryRef;
    uint256 public reentryAmount;
    bool private _armed;

    constructor() ERC20("Re", "RE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(PaymentRouter r, bytes32 ref, uint256 amount) external {
        router = r;
        reentryRef = ref;
        reentryAmount = amount;
        _armed = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (_armed) {
            _armed = false;
            // Re-enter: the nonReentrant guard must make this revert.
            router.payInvoice(reentryRef, IERC20(address(this)), reentryAmount, "");
        }
        return super.transferFrom(from, to, value);
    }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

contract PaymentRouterTest is Test {
    PaymentRouter internal router;
    MockUSD internal usdc;
    MockUSD internal usdt;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal payer = makeAddr("payer");
    address internal griefer = makeAddr("griefer");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant MIN = 1_000_000; // 1.00 (6 dp)

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

    function setUp() public {
        vm.prank(owner);
        router = new PaymentRouter(owner, treasury);

        usdc = new MockUSD("USD Coin", "USDC", 6);
        usdt = new MockUSD("Tether", "USDT", 6);

        vm.startPrank(owner);
        router.setTokenSupported(address(usdc), true, MIN);
        router.setTokenSupported(address(usdt), true, MIN);
        vm.stopPrank();

        usdc.mint(payer, 1_000 * MIN);
        usdt.mint(payer, 1_000 * MIN);
        usdc.mint(griefer, 1_000 * MIN);
        usdt.mint(griefer, 1_000 * MIN);

        vm.prank(payer);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(payer);
        usdt.approve(address(router), type(uint256).max);
        vm.prank(griefer);
        usdc.approve(address(router), type(uint256).max);
        vm.prank(griefer);
        usdt.approve(address(router), type(uint256).max);
    }

    function _ref(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    // ── Constructor ──────────────────────────────────────────────────────────

    function test_constructor_setsOwnerAndTreasury() public view {
        assertEq(router.owner(), owner);
        assertEq(router.treasury(), treasury);
    }

    function test_constructor_revertsOnZeroTreasury() public {
        vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
        new PaymentRouter(owner, address(0));
    }

    function test_constructor_revertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new PaymentRouter(address(0), treasury);
    }

    // ── Access control ─────────────────────────────────────────────────────────

    function test_setTreasury_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.setTreasury(stranger);
    }

    function test_setTokenSupported_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.setTokenSupported(address(usdc), false, 0);
    }

    function test_pause_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.pause();
    }

    function test_emergencyWithdraw_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.emergencyWithdraw(address(usdc), stranger, 1);
    }

    // ── setTreasury ──────────────────────────────────────────────────────────

    function test_setTreasury_updatesAndEmits() public {
        address next = makeAddr("next");
        vm.expectEmit(true, true, false, false);
        emit TreasuryUpdated(treasury, next);
        vm.prank(owner);
        router.setTreasury(next);
        assertEq(router.treasury(), next);
    }

    function test_setTreasury_revertsOnZero() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
        router.setTreasury(address(0));
    }

    // ── setTokenSupported ──────────────────────────────────────────────────────

    function test_setTokenSupported_revertsOnZeroToken() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.InvalidToken.selector);
        router.setTokenSupported(address(0), true, 0);
    }

    function test_setTokenSupported_canDisable() public {
        vm.prank(owner);
        router.setTokenSupported(address(usdc), false, 0);
        assertFalse(router.supportedTokens(address(usdc)));

        bytes32 ref = _ref("inv-disabled");
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.UnsupportedToken.selector, address(usdc)));
        router.payInvoice(ref, IERC20(address(usdc)), MIN, "");
    }

    // ── payInvoice: happy path ─────────────────────────────────────────────────

    function test_payInvoice_movesFundsAndMarksPaid() public {
        bytes32 ref = _ref("inv-1");
        uint256 amount = 25 * MIN;
        bytes32 expectedId = router.computeInvoiceId(ref, address(usdc), amount);

        vm.expectEmit(true, true, true, true);
        emit InvoicePaid(expectedId, payer, address(usdc), ref, amount, treasury, hex"beef");

        vm.prank(payer);
        bytes32 id = router.payInvoice(ref, IERC20(address(usdc)), amount, hex"beef");

        assertEq(id, expectedId);
        assertTrue(router.invoicePaid(expectedId));
        assertTrue(router.isInvoicePaid(ref, address(usdc), amount));
        assertEq(usdc.balanceOf(treasury), amount);
        assertEq(usdc.balanceOf(payer), 1_000 * MIN - amount);
    }

    function test_payInvoice_atExactMinimum() public {
        bytes32 ref = _ref("inv-min");
        vm.prank(payer);
        router.payInvoice(ref, IERC20(address(usdc)), MIN, "");
        assertEq(usdc.balanceOf(treasury), MIN);
    }

    // ── payInvoice: input validation ───────────────────────────────────────────

    function test_payInvoice_revertsOnZeroRef() public {
        vm.prank(payer);
        vm.expectRevert(PaymentRouter.InvalidReference.selector);
        router.payInvoice(bytes32(0), IERC20(address(usdc)), MIN, "");
    }

    function test_payInvoice_revertsOnZeroToken() public {
        vm.prank(payer);
        vm.expectRevert(PaymentRouter.InvalidToken.selector);
        router.payInvoice(_ref("x"), IERC20(address(0)), MIN, "");
    }

    function test_payInvoice_revertsOnUnsupportedToken() public {
        MockUSD other = new MockUSD("Other", "OTH", 6);
        other.mint(payer, MIN);
        vm.prank(payer);
        other.approve(address(router), MIN);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.UnsupportedToken.selector, address(other)));
        router.payInvoice(_ref("x"), IERC20(address(other)), MIN, "");
    }

    function test_payInvoice_revertsOnZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(PaymentRouter.InvalidAmount.selector);
        router.payInvoice(_ref("x"), IERC20(address(usdc)), 0, "");
    }

    function test_payInvoice_revertsBelowMinimum() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.AmountBelowMinimum.selector, address(usdc), MIN - 1, MIN));
        router.payInvoice(_ref("x"), IERC20(address(usdc)), MIN - 1, "");
    }

    function test_payInvoice_revertsOnReplay() public {
        bytes32 ref = _ref("inv-replay");
        uint256 amount = 10 * MIN;
        vm.prank(payer);
        bytes32 id = router.payInvoice(ref, IERC20(address(usdc)), amount, "");

        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvoiceAlreadyPaid.selector, id));
        router.payInvoice(ref, IERC20(address(usdc)), amount, "");
    }

    // ── H1 regression: invoice-locking griefing must be impossible ──────────────

    /// A griefer paying the same ref with a *smaller* amount cannot lock the
    /// real invoice: the legitimate exact-amount payment still succeeds.
    function test_griefing_underpaySameRef_doesNotLockInvoice() public {
        bytes32 ref = _ref("order-42");
        uint256 expected = 1_000 * MIN;

        // Griefer pays 1.00 against the same ref.
        vm.prank(griefer);
        router.payInvoice(ref, IERC20(address(usdc)), MIN, "");

        // The real invoice (ref, usdc, expected) is still unpaid and payable.
        assertFalse(router.isInvoicePaid(ref, address(usdc), expected));
        vm.prank(payer);
        router.payInvoice(ref, IERC20(address(usdc)), expected, "");
        assertTrue(router.isInvoicePaid(ref, address(usdc), expected));
    }

    /// A griefer paying the same ref with a *different token* cannot lock it.
    function test_griefing_wrongTokenSameRef_doesNotLockInvoice() public {
        bytes32 ref = _ref("order-43");
        uint256 expected = 500 * MIN;

        vm.prank(griefer);
        router.payInvoice(ref, IERC20(address(usdt)), expected, "");

        // USDC invoice for the same ref/amount is untouched.
        assertFalse(router.isInvoicePaid(ref, address(usdc), expected));
        vm.prank(payer);
        router.payInvoice(ref, IERC20(address(usdc)), expected, "");
        assertTrue(router.isInvoicePaid(ref, address(usdc), expected));
    }

    /// A front-runner can only consume the invoice by paying it correctly,
    /// which still credits the treasury — so it is a donation, not griefing.
    function test_frontRun_exactPayment_creditsTreasury() public {
        bytes32 ref = _ref("order-44");
        uint256 expected = 100 * MIN;

        vm.prank(griefer);
        router.payInvoice(ref, IERC20(address(usdc)), expected, "");
        assertEq(usdc.balanceOf(treasury), expected);

        // Payer's later exact payment now reverts as already-paid, but the
        // treasury already holds the full expected amount.
        bytes32 id = router.computeInvoiceId(ref, address(usdc), expected);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvoiceAlreadyPaid.selector, id));
        router.payInvoice(ref, IERC20(address(usdc)), expected, "");
    }

    // ── Pausable ───────────────────────────────────────────────────────────────

    function test_pause_blocksPayInvoice() public {
        vm.prank(owner);
        router.pause();
        vm.prank(payer);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        router.payInvoice(_ref("x"), IERC20(address(usdc)), MIN, "");
    }

    function test_unpause_restoresPayInvoice() public {
        vm.prank(owner);
        router.pause();
        vm.prank(owner);
        router.unpause();
        vm.prank(payer);
        router.payInvoice(_ref("inv-unpause"), IERC20(address(usdc)), MIN, "");
        assertEq(usdc.balanceOf(treasury), MIN);
    }

    // ── emergencyWithdraw ──────────────────────────────────────────────────────

    function test_emergencyWithdraw_sweepsStrayTokens() public {
        usdc.mint(address(router), 5 * MIN);
        vm.expectEmit(true, true, false, true);
        emit EmergencyWithdraw(address(usdc), owner, 5 * MIN);
        vm.prank(owner);
        router.emergencyWithdraw(address(usdc), owner, 5 * MIN);
        assertEq(usdc.balanceOf(owner), 5 * MIN);
    }

    function test_emergencyWithdraw_revertsOnZeroDest() public {
        vm.prank(owner);
        vm.expectRevert(PaymentRouter.InvalidTreasury.selector);
        router.emergencyWithdraw(address(usdc), address(0), 1);
    }

    // ── Ownable2Step ────────────────────────────────────────────────────────────

    function test_ownership_isTwoStep() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        router.transferOwnership(newOwner);
        // Not transferred until accepted.
        assertEq(router.owner(), owner);
        assertEq(router.pendingOwner(), newOwner);

        vm.prank(newOwner);
        router.acceptOwnership();
        assertEq(router.owner(), newOwner);
    }

    function test_ownership_strangerCannotAccept() public {
        address newOwner = makeAddr("newOwner");
        vm.prank(owner);
        router.transferOwnership(newOwner);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        router.acceptOwnership();
    }

    // ── Reentrancy ──────────────────────────────────────────────────────────────

    function test_reentrancy_isBlocked() public {
        ReentrantToken evil = new ReentrantToken();
        vm.prank(owner);
        router.setTokenSupported(address(evil), true, 0);
        evil.mint(payer, 100 * MIN);
        vm.prank(payer);
        evil.approve(address(router), type(uint256).max);

        bytes32 ref = _ref("reentry");
        evil.arm(router, _ref("reentry-2"), MIN);

        vm.prank(payer);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        router.payInvoice(ref, IERC20(address(evil)), MIN, "");
    }

    // ── Fee-on-transfer documentation guard ─────────────────────────────────────

    /// Documents the M2 caveat: with a fee-on-transfer token the treasury
    /// receives less than the recorded amount. Such tokens must NOT be supported.
    function test_feeOnTransfer_treasuryReceivesLessThanRecorded() public {
        FeeToken fee = new FeeToken();
        vm.prank(owner);
        router.setTokenSupported(address(fee), true, 0);
        fee.mint(payer, 100 * MIN);
        vm.prank(payer);
        fee.approve(address(router), type(uint256).max);

        uint256 amount = 100 * MIN;
        vm.prank(payer);
        router.payInvoice(_ref("fee"), IERC20(address(fee)), amount, "");

        uint256 received = fee.balanceOf(treasury);
        assertLt(received, amount); // treasury got 99%, event claims 100%
    }

    // ── computeInvoiceId correctness ─────────────────────────────────────────────

    function test_computeInvoiceId_matchesAbiEncode() public view {
        bytes32 ref = _ref("inv-hash");
        uint256 amount = 7 * MIN;
        assertEq(router.computeInvoiceId(ref, address(usdc), amount), keccak256(abi.encode(ref, address(usdc), amount)));
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────

    function testFuzz_payInvoice_bindsAmount(bytes32 ref, uint96 rawAmount) public {
        vm.assume(ref != bytes32(0));
        // bound() maps the raw fuzz input into range instead of rejecting it,
        // which vm.assume would do for ~all uint96 values outside [MIN, 1000*MIN].
        uint256 amount = bound(uint256(rawAmount), MIN, 1_000 * MIN);

        bytes32 id = router.computeInvoiceId(ref, address(usdc), amount);

        vm.prank(payer);
        bytes32 returned = router.payInvoice(ref, IERC20(address(usdc)), amount, "");
        assertEq(returned, id);
        assertTrue(router.invoicePaid(id));
        assertEq(usdc.balanceOf(treasury), amount);
    }

    /// Distinct (ref, amount) pairs never collide into the same invoiceId, so a
    /// payment for one can never mark another as paid.
    function testFuzz_distinctInvoicesDoNotCollide(bytes32 refA, uint96 amtA, bytes32 refB, uint96 amtB) public view {
        vm.assume(refA != bytes32(0) && refB != bytes32(0));
        uint256 a = bound(uint256(amtA), MIN, 1_000 * MIN);
        uint256 b = bound(uint256(amtB), MIN, 1_000 * MIN);
        vm.assume(refA != refB || a != b);

        bytes32 idA = router.computeInvoiceId(refA, address(usdc), a);
        bytes32 idB = router.computeInvoiceId(refB, address(usdc), b);
        assertTrue(idA != idB);
    }
}

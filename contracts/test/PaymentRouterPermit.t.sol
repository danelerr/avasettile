// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// EIP-2612 stablecoin mock (USDC/USDT on Avalanche support permit).
contract MockUSDPermit is ERC20, ERC20Permit {
    uint8 private immutable _decimals;

    constructor(string memory name, string memory symbol, uint8 dec) ERC20(name, symbol) ERC20Permit(name) {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PaymentRouterPermitTest is Test {
    PaymentRouter internal router;
    MockUSDPermit internal usdc;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal payer;
    uint256 internal payerPk;

    uint256 internal constant MIN = 1_000_000; // 1.00 (6 dp)

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function setUp() public {
        (payer, payerPk) = makeAddrAndKey("payer");

        vm.prank(owner);
        router = new PaymentRouter(owner, treasury);

        usdc = new MockUSDPermit("USD Coin", "USDC", 6);
        vm.prank(owner);
        router.setTokenSupported(address(usdc), true, MIN);

        usdc.mint(payer, 1_000 * MIN);
    }

    function _ref(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    /// Build an EIP-2612 signature from `payer` for (spender, value, deadline).
    function _signPermit(address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, payer, spender, value, usdc.nonces(payer), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(payerPk, digest);
    }

    // ── Happy path: pay with no prior approve ────────────────────────────────

    function test_payInvoiceWithPermit_singleTxNoApprove() public {
        bytes32 ref = _ref("permit-inv-1");
        uint256 amount = 50 * MIN;
        uint256 deadline = block.timestamp + 1 hours;

        // Payer has NOT approved the router — only the signature authorizes it.
        assertEq(usdc.allowance(payer, address(router)), 0);

        (uint8 v, bytes32 r, bytes32 s) = _signPermit(address(router), amount, deadline);

        vm.prank(payer);
        bytes32 id = router.payInvoiceWithPermit(ref, IERC20(address(usdc)), amount, hex"01", deadline, v, r, s);

        assertEq(id, router.computeInvoiceId(ref, address(usdc), amount));
        assertTrue(router.invoicePaid(id));
        assertEq(usdc.balanceOf(treasury), amount);
        assertEq(usdc.balanceOf(payer), 1_000 * MIN - amount);
    }

    // ── Front-run resilience: permit nonce already consumed, allowance present ─

    function test_payInvoiceWithPermit_succeedsIfPermitAlreadyConsumed() public {
        bytes32 ref = _ref("permit-inv-2");
        uint256 amount = 20 * MIN;
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(address(router), amount, deadline);

        // A front-runner submits the permit directly, consuming the nonce.
        usdc.permit(payer, address(router), amount, deadline, v, r, s);
        assertEq(usdc.allowance(payer, address(router)), amount);

        // The payment still goes through (try/catch swallows the now-stale permit).
        vm.prank(payer);
        router.payInvoiceWithPermit(ref, IERC20(address(usdc)), amount, "", deadline, v, r, s);
        assertEq(usdc.balanceOf(treasury), amount);
    }

    // ── Expired permit with no allowance must revert (no silent success) ──────

    function test_payInvoiceWithPermit_revertsWhenExpiredAndNoAllowance() public {
        bytes32 ref = _ref("permit-inv-3");
        uint256 amount = 10 * MIN;
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(address(router), amount, deadline);

        // Warp past the deadline: permit() reverts (caught), allowance stays 0,
        // so the transferFrom must revert — funds never move on a bad signature.
        vm.warp(deadline + 1);

        vm.prank(payer);
        vm.expectRevert();
        router.payInvoiceWithPermit(ref, IERC20(address(usdc)), amount, "", deadline, v, r, s);

        assertEq(usdc.balanceOf(treasury), 0);
        assertFalse(router.isInvoicePaid(ref, address(usdc), amount));
    }

    // ── Permit path still enforces invoice rules (replay) ─────────────────────

    function test_payInvoiceWithPermit_revertsOnReplay() public {
        bytes32 ref = _ref("permit-inv-4");
        uint256 amount = 15 * MIN;
        uint256 deadline = block.timestamp + 1 hours;

        (uint8 v1, bytes32 r1, bytes32 s1) = _signPermit(address(router), amount, deadline);
        vm.prank(payer);
        bytes32 id = router.payInvoiceWithPermit(ref, IERC20(address(usdc)), amount, "", deadline, v1, r1, s1);

        // Fresh signature (new nonce), same invoice → must hit InvoiceAlreadyPaid.
        (uint8 v2, bytes32 r2, bytes32 s2) = _signPermit(address(router), amount, deadline);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvoiceAlreadyPaid.selector, id));
        router.payInvoiceWithPermit(ref, IERC20(address(usdc)), amount, "", deadline, v2, r2, s2);
    }
}

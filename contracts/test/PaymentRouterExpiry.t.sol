// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSD is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PaymentRouterExpiryTest is Test {
    PaymentRouter internal router;
    MockUSD internal usdc;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal payer = makeAddr("payer");

    uint256 internal constant MIN = 1_000_000;

    function setUp() public {
        vm.prank(owner);
        router = new PaymentRouter(owner, treasury);
        usdc = new MockUSD();
        vm.prank(owner);
        router.setTokenSupported(address(usdc), true, MIN);
        usdc.mint(payer, 1_000 * MIN);
        vm.prank(payer);
        usdc.approve(address(router), type(uint256).max);
    }

    function _ref(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    function test_payInvoiceWithExpiry_succeedsBeforeDeadline() public {
        bytes32 ref = _ref("exp-1");
        uint256 amount = 10 * MIN;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 expectedId = router.computeInvoiceIdWithExpiry(ref, address(usdc), amount, deadline);

        vm.prank(payer);
        bytes32 id = router.payInvoiceWithExpiry(ref, IERC20(address(usdc)), amount, deadline, "");

        assertEq(id, expectedId);
        assertTrue(router.invoicePaid(expectedId));
        assertEq(usdc.balanceOf(treasury), amount);
    }

    function test_payInvoiceWithExpiry_revertsAfterDeadline() public {
        bytes32 ref = _ref("exp-2");
        uint256 amount = 10 * MIN;
        uint256 deadline = block.timestamp + 1 hours;

        vm.warp(deadline + 1);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvoiceExpired.selector, deadline));
        router.payInvoiceWithExpiry(ref, IERC20(address(usdc)), amount, deadline, "");
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_payInvoiceWithExpiry_zeroDeadlineNeverExpires() public {
        bytes32 ref = _ref("exp-3");
        uint256 amount = 5 * MIN;
        vm.warp(10_000 days);
        vm.prank(payer);
        router.payInvoiceWithExpiry(ref, IERC20(address(usdc)), amount, 0, "");
        assertEq(usdc.balanceOf(treasury), amount);
    }

    /// The deadline is bound into the id: the same ref/token/amount with a
    /// different deadline is a *different* invoice, so the expiry cannot be
    /// stripped by a payer choosing their own.
    function test_expiry_isBoundIntoInvoiceId() public view {
        bytes32 ref = _ref("exp-4");
        uint256 amount = 7 * MIN;
        bytes32 a = router.computeInvoiceIdWithExpiry(ref, address(usdc), amount, 1000);
        bytes32 b = router.computeInvoiceIdWithExpiry(ref, address(usdc), amount, 2000);
        assertTrue(a != b);
        // And distinct from the canonical no-expiry id (different preimage arity).
        assertTrue(a != router.computeInvoiceId(ref, address(usdc), amount));
    }

    function test_payInvoiceWithExpiry_stillEnforcesReplay() public {
        bytes32 ref = _ref("exp-5");
        uint256 amount = 3 * MIN;
        uint256 deadline = block.timestamp + 1 hours;
        vm.prank(payer);
        bytes32 id = router.payInvoiceWithExpiry(ref, IERC20(address(usdc)), amount, deadline, "");
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PaymentRouter.InvoiceAlreadyPaid.selector, id));
        router.payInvoiceWithExpiry(ref, IERC20(address(usdc)), amount, deadline, "");
    }

    /// The legacy 3-arg path is untouched: a no-expiry pay still works and
    /// produces the canonical id (backward compatibility with the v1 mainnet
    /// router and the existing backend).
    function test_legacyPayInvoice_unchanged() public {
        bytes32 ref = _ref("exp-6");
        uint256 amount = 4 * MIN;
        vm.prank(payer);
        bytes32 id = router.payInvoice(ref, IERC20(address(usdc)), amount, "");
        assertEq(id, router.computeInvoiceId(ref, address(usdc), amount));
    }
}

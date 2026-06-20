// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/// @notice Forked integration tests against the REAL stablecoins on Avalanche
///         Fuji C-Chain — no mocks. Validates that PaymentRouter behaves against
///         Circle's actual USDC bytecode (proxy, permit version, decimals) that
///         a unit-test mock cannot reproduce.
/// @dev Opt-in (network-dependent): run with
///         RUN_FORK_TESTS=1 forge test --match-contract PaymentRouterForkTest
///      Override the RPC with AVALANCHE_FUJI_RPC_URL. Skipped by default so the
///      main CI run stays hermetic.
contract PaymentRouterForkTest is Test {
    // Real Fuji C-Chain tokens.
    address internal constant USDC_FUJI = 0x5425890298aed601595a70AB815c96711a31Bc65;
    address internal constant USDT_FUJI = 0x82dcbE9FC2c7BE89E9E0c72E6e20aa5Ad41fc55b;
    uint256 internal constant FUJI_CHAIN_ID = 43113;

    bytes32 private constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    PaymentRouter internal router;
    IERC20 internal usdc;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal payer;
    uint256 internal payerPk;

    uint256 internal constant MIN = 1_000_000; // 1.00 USDC (6 dp)

    bool internal active;

    function setUp() public {
        if (vm.envOr("RUN_FORK_TESTS", uint256(0)) == 0) {
            return; // opt-in only; tests below early-return when inactive
        }

        string memory rpc = vm.envOr("AVALANCHE_FUJI_RPC_URL", string("https://api.avax-test.network/ext/bc/C/rpc"));
        vm.createSelectFork(rpc);
        require(block.chainid == FUJI_CHAIN_ID, "not on Fuji");
        active = true;

        (payer, payerPk) = makeAddrAndKey("fork-payer");

        vm.prank(owner);
        router = new PaymentRouter(owner, treasury);
        usdc = IERC20(USDC_FUJI);
        vm.prank(owner);
        router.setTokenSupported(USDC_FUJI, true, MIN);

        // Fund the payer with real USDC via foundry's balance cheat.
        deal(USDC_FUJI, payer, 1_000 * MIN);
    }

    function _ref(string memory s) internal pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    // ── Plain pay-in against real USDC ────────────────────────────────────────

    function test_fork_payInvoice_realUSDC() public {
        if (!active) return;

        bytes32 ref = _ref("fork-1");
        uint256 amount = 25 * MIN;

        vm.prank(payer);
        usdc.approve(address(router), amount);

        vm.prank(payer);
        bytes32 id = router.payInvoice(ref, usdc, amount, "");

        assertEq(id, router.computeInvoiceId(ref, USDC_FUJI, amount));
        assertTrue(router.invoicePaid(id));
        assertEq(usdc.balanceOf(treasury), amount);
    }

    // ── Expiry path against real USDC ─────────────────────────────────────────

    function test_fork_payInvoiceWithExpiry_realUSDC() public {
        if (!active) return;

        bytes32 ref = _ref("fork-2");
        uint256 amount = 10 * MIN;
        uint256 deadline = block.timestamp + 1 hours;

        vm.prank(payer);
        usdc.approve(address(router), amount);

        vm.prank(payer);
        router.payInvoiceWithExpiry(ref, usdc, amount, deadline, "");
        assertEq(usdc.balanceOf(treasury), amount);
    }

    // ── EIP-2612 permit against the REAL USDC domain separator ────────────────

    function test_fork_payInvoiceWithPermit_realUSDC() public {
        if (!active) return;

        bytes32 ref = _ref("fork-3");
        uint256 amount = 15 * MIN;
        uint256 deadline = block.timestamp + 1 hours;

        // Sign the permit against the real token's on-chain DOMAIN_SEPARATOR.
        uint256 nonce = IERC20Permit(USDC_FUJI).nonces(payer);
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, payer, address(router), amount, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", IERC20Permit(USDC_FUJI).DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(payerPk, digest);

        // No prior approve — the signature alone authorizes the pull.
        assertEq(usdc.allowance(payer, address(router)), 0);

        vm.prank(payer);
        router.payInvoiceWithPermit(ref, usdc, amount, "", deadline, v, r, s);

        assertEq(usdc.balanceOf(treasury), amount);
    }
}

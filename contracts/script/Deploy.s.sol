// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

/**
 * Deploy PaymentRouter to Avalanche C-Chain (Fuji testnet or mainnet).
 *
 * Prerequisites:
 *   forge install foundry-rs/forge-std  (run once inside contracts/)
 *
 * Fuji C-Chain testnet:
 *   DEPLOYER_PK=<pk> TREASURY=<addr> [OWNER=<multisig>] \
 *   forge script script/Deploy.s.sol --rpc-url avalanche_fuji \
 *     --broadcast --verify
 *
 * Mainnet C-Chain:
 *   DEPLOYER_PK=<pk> TREASURY=<addr> [OWNER=<multisig>] \
 *   forge script script/Deploy.s.sol --rpc-url avalanche \
 *     --broadcast --verify
 *
 * If OWNER is set and differs from the deployer, ownership transfer is
 * *initiated* (Ownable2Step) — the multisig must call acceptOwnership() to
 * finalize. Token support is still configured by the deployer before handover.
 *
 * After deployment, set AVASETTLE_PAYMENT_ROUTER_ADDRESS in your .env or
 * config/avasettle.json.
 */
contract Deploy is Script {
    // USDC on Avalanche Fuji C-Chain testnet
    address constant USDC_FUJI = 0x5425890298aed601595a70AB815c96711a31Bc65;
    // USDT on Avalanche Fuji C-Chain testnet
    address constant USDT_FUJI = 0x82dcbE9FC2c7BE89E9E0c72E6e20aa5Ad41fc55b;

    // USDC on Avalanche C-Chain mainnet (native USDC)
    address constant USDC_MAINNET = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    // USDT on Avalanche C-Chain mainnet
    address constant USDT_MAINNET = 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7;

    // Avalanche C-Chain ids.
    uint256 constant FUJI_CHAIN_ID = 43113;
    uint256 constant MAINNET_CHAIN_ID = 43114;

    // Minimum USDC/USDT amount: 1.00 (6 decimals -> 1_000_000 atomic)
    uint256 constant MIN_AMOUNT = 1_000_000;

    function run() external {
        address treasury = vm.envAddress("TREASURY");
        address newOwner = vm.envOr("OWNER", address(0));

        require(treasury != address(0), "TREASURY env var not set");

        // Broadcasts with the CLI-selected signer (--account keystore or
        // --private-key). `msg.sender` resolves to --sender during broadcast.
        vm.startBroadcast();
        address deployerAddr = msg.sender;

        PaymentRouter router = new PaymentRouter(deployerAddr, treasury);

        // Detect network by chainId.
        uint256 chainId = block.chainid;
        if (chainId == FUJI_CHAIN_ID) {
            router.setTokenSupported(USDC_FUJI, true, MIN_AMOUNT);
            router.setTokenSupported(USDT_FUJI, true, MIN_AMOUNT);
            console.log("Configured for Avalanche Fuji C-Chain testnet");
        } else if (chainId == MAINNET_CHAIN_ID) {
            router.setTokenSupported(USDC_MAINNET, true, MIN_AMOUNT);
            router.setTokenSupported(USDT_MAINNET, true, MIN_AMOUNT);
            console.log("Configured for Avalanche C-Chain mainnet");
        } else {
            console.log("Unknown chainId - token support NOT configured. Call setTokenSupported manually.");
        }

        // Optional: hand ownership to a multisig (Ownable2Step, two-phase).
        if (newOwner != address(0) && newOwner != deployerAddr) {
            router.transferOwnership(newOwner);
            console.log("Ownership transfer INITIATED to:", newOwner);
            console.log("  -> new owner must call acceptOwnership() to finalize.");
        }

        vm.stopBroadcast();

        console.log("PaymentRouter deployed at:", address(router));
        console.log("Treasury:                 ", treasury);
        console.log("Owner:                    ", router.owner());
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set AVASETTLE_PAYMENT_ROUTER_ADDRESS =", address(router));
        console.log("  2. Verify: forge verify-contract <addr> src/PaymentRouter.sol:PaymentRouter");
    }
}

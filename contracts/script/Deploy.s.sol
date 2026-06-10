// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PaymentRouter} from "../src/PaymentRouter.sol";

/**
 * Deploy PaymentRouter to Avalanche Fuji or Mainnet.
 *
 * Prerequisites:
 *   forge install foundry-rs/forge-std  (run once inside contracts/)
 *
 * Fuji testnet:
 *   DEPLOYER_PK=<pk> TREASURY=<addr> \
 *   forge script script/Deploy.s.sol --rpc-url avalanche_fuji \
 *     --broadcast --verify --profile fuji
 *
 * Mainnet:
 *   DEPLOYER_PK=<pk> TREASURY=<addr> \
 *   forge script script/Deploy.s.sol --rpc-url avalanche \
 *     --broadcast --verify --profile mainnet
 *
 * After deployment, set AVASETTLE_PAYMENT_ROUTER_ADDRESS in your .env or
 * config/avasettle.json and call setTokenSupported() for each stablecoin.
 */
contract Deploy is Script {
    // USDC on Avalanche Fuji testnet
    address constant USDC_FUJI    = 0x5425890298aed601595a70AB815c96711a31Bc65;
    // USDT on Avalanche Fuji testnet
    address constant USDT_FUJI    = 0x82dCbE9Fc2c7Be89E9e0C72e6E20aA5aD41fc55B;

    // USDC on Avalanche mainnet (native USDC)
    address constant USDC_MAINNET = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    // USDT on Avalanche mainnet
    address constant USDT_MAINNET = 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7;

    // Minimum USDC/USDT amount: 1.00 (6 decimals → 1_000_000 atomic)
    uint256 constant MIN_AMOUNT = 1_000_000;

    function run() external {
        uint256 deployerPk  = vm.envUint("DEPLOYER_PK");
        address treasury    = vm.envAddress("TREASURY");
        address deployerAddr = vm.addr(deployerPk);

        require(treasury != address(0), "TREASURY env var not set");

        vm.startBroadcast(deployerPk);

        PaymentRouter router = new PaymentRouter(deployerAddr, treasury);

        // Detect network by chainId
        uint256 chainId = block.chainid;
        if (chainId == 43113) {
            // Fuji testnet
            router.setTokenSupported(USDC_FUJI, true, MIN_AMOUNT);
            router.setTokenSupported(USDT_FUJI, true, MIN_AMOUNT);
            console.log("Configured for Fuji testnet");
        } else if (chainId == 43114) {
            // Avalanche mainnet
            router.setTokenSupported(USDC_MAINNET, true, MIN_AMOUNT);
            router.setTokenSupported(USDT_MAINNET, true, MIN_AMOUNT);
            console.log("Configured for Avalanche mainnet");
        } else {
            console.log("Unknown chainId — token support NOT configured. Call setTokenSupported manually.");
        }

        vm.stopBroadcast();

        console.log("PaymentRouter deployed at:", address(router));
        console.log("Treasury:                 ", treasury);
        console.log("Owner:                    ", deployerAddr);
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set AVASETTLE_PAYMENT_ROUTER_ADDRESS =", address(router));
        console.log("  2. Verify: forge verify-contract <addr> src/PaymentRouter.sol:PaymentRouter");
    }
}

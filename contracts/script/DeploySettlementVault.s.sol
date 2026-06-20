// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SettlementVault} from "../src/SettlementVault.sol";

/**
 * Deploy SettlementVault to Avalanche C-Chain (Fuji testnet or mainnet).
 *
 *   FUNDER=<treasury addr> OPERATOR=<backend signer addr> [OWNER=<multisig>] \
 *   forge script script/DeploySettlementVault.s.sol --rpc-url avalanche_fuji \
 *     --account <keystore> --sender <deployer addr> --broadcast --verify
 *
 * FUNDER is the treasury that approves the vault and from which payouts pull.
 * OPERATOR is the backend address allowed to execute payouts (defaults to the
 * deployer if unset). If OWNER differs from the deployer, ownership transfer is
 * initiated (Ownable2Step) — the multisig must call acceptOwnership().
 *
 * After deployment: FUNDER must `approve(vault, allowance)` on each token, and
 * set AVASETTLE_SETTLEMENT_VAULT_ADDRESS in config.
 */
contract DeploySettlementVault is Script {
    address constant USDC_FUJI = 0x5425890298aed601595a70AB815c96711a31Bc65;
    address constant USDT_FUJI = 0x82dcbE9FC2c7BE89E9E0c72E6e20aa5Ad41fc55b;
    address constant USDC_MAINNET = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    address constant USDT_MAINNET = 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7;

    uint256 constant FUJI_CHAIN_ID = 43113;
    uint256 constant MAINNET_CHAIN_ID = 43114;

    function run() external {
        address funder = vm.envAddress("FUNDER");
        address newOwner = vm.envOr("OWNER", address(0));

        require(funder != address(0), "FUNDER env var not set");

        // Broadcasts with the CLI-selected signer (--account keystore or
        // --private-key). `msg.sender` resolves to --sender during broadcast.
        vm.startBroadcast();
        address deployerAddr = msg.sender;
        address operator = vm.envOr("OPERATOR", deployerAddr);

        SettlementVault vault = new SettlementVault(deployerAddr, funder);
        vault.setOperator(operator, true);

        uint256 chainId = block.chainid;
        if (chainId == FUJI_CHAIN_ID) {
            vault.setTokenSupported(USDC_FUJI, true);
            vault.setTokenSupported(USDT_FUJI, true);
            console.log("Configured for Avalanche Fuji C-Chain testnet");
        } else if (chainId == MAINNET_CHAIN_ID) {
            vault.setTokenSupported(USDC_MAINNET, true);
            vault.setTokenSupported(USDT_MAINNET, true);
            console.log("Configured for Avalanche C-Chain mainnet");
        } else {
            console.log("Unknown chainId - token support NOT configured. Call setTokenSupported manually.");
        }

        if (newOwner != address(0) && newOwner != deployerAddr) {
            vault.transferOwnership(newOwner);
            console.log("Ownership transfer INITIATED to:", newOwner);
            console.log("  -> new owner must call acceptOwnership() to finalize.");
        }

        vm.stopBroadcast();

        console.log("SettlementVault deployed at:", address(vault));
        console.log("Funder:                    ", funder);
        console.log("Operator:                  ", operator);
        console.log("Owner:                     ", vault.owner());
        console.log("");
        console.log("Next steps:");
        console.log("  1. Set AVASETTLE_SETTLEMENT_VAULT_ADDRESS =", address(vault));
        console.log("  2. From FUNDER, approve(vault, allowance) on each stablecoin.");
    }
}

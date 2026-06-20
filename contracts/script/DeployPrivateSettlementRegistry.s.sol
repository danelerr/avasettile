// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PrivateSettlementRegistry} from "../src/PrivateSettlementRegistry.sol";

/**
 * Deploy PrivateSettlementRegistry (experimental eERC roadmap step) to
 * Avalanche C-Chain.
 *
 *   REGISTRAR=<backend addr> [AUDITOR=<addr>] [OWNER=<multisig>] \
 *   forge script script/DeployPrivateSettlementRegistry.s.sol \
 *     --rpc-url avalanche_fuji --account <keystore> --sender <deployer addr> \
 *     --broadcast --verify
 *
 * REGISTRAR is the backend address allowed to record commitments (defaults to
 * the deployer). AUDITOR, if set, is granted the audit-reveal role. If OWNER
 * differs from the deployer, ownership transfer is initiated (Ownable2Step).
 *
 * After deployment, set AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS in config.
 */
contract DeployPrivateSettlementRegistry is Script {
    function run() external {
        address auditor = vm.envOr("AUDITOR", address(0));
        address newOwner = vm.envOr("OWNER", address(0));

        // Broadcasts with the CLI-selected signer (--account keystore or
        // --private-key). `msg.sender` resolves to --sender during broadcast.
        vm.startBroadcast();
        address deployerAddr = msg.sender;
        address registrar = vm.envOr("REGISTRAR", deployerAddr);

        PrivateSettlementRegistry registry = new PrivateSettlementRegistry(deployerAddr);
        registry.setRegistrar(registrar, true);
        if (auditor != address(0)) {
            registry.setAuditor(auditor, true);
        }

        if (newOwner != address(0) && newOwner != deployerAddr) {
            registry.transferOwnership(newOwner);
            console.log("Ownership transfer INITIATED to:", newOwner);
            console.log("  -> new owner must call acceptOwnership() to finalize.");
        }

        vm.stopBroadcast();

        console.log("PrivateSettlementRegistry deployed at:", address(registry));
        console.log("Registrar:                           ", registrar);
        console.log("Auditor:                             ", auditor);
        console.log("Owner:                               ", registry.owner());
        console.log("");
        console.log("Set AVASETTLE_PRIVATE_SETTLEMENT_REGISTRY_ADDRESS =", address(registry));
    }
}

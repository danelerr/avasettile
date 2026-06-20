// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * Initiate the Ownable2Step handover of a deployed AvaSettle contract
 * (PaymentRouter, SettlementVault, PrivateSettlementRegistry) to a new owner —
 * typically a Gnosis Safe multisig or a TimelockController.
 *
 *   CONTRACT=<deployed addr> NEW_OWNER=<multisig/timelock> \
 *   forge script script/TransferOwnership.s.sol --rpc-url avalanche \
 *     --account <keystore> --sender <current owner> --broadcast
 *
 * This only *initiates* the transfer. The new owner must then call
 * acceptOwnership() (via the Safe UI, or AcceptOwnership.s.sol if it is an EOA)
 * to finalize — so a wrong address can never brick ownership.
 */
contract TransferOwnership is Script {
    function run() external {
        address target = vm.envAddress("CONTRACT");
        address newOwner = vm.envAddress("NEW_OWNER");
        require(target != address(0), "CONTRACT not set");
        require(newOwner != address(0), "NEW_OWNER not set");

        vm.startBroadcast();
        Ownable2Step(target).transferOwnership(newOwner);
        vm.stopBroadcast();

        console.log("transferOwnership initiated");
        console.log("  contract:      ", target);
        console.log("  current owner: ", Ownable2Step(target).owner());
        console.log("  pending owner: ", Ownable2Step(target).pendingOwner());
        console.log("Next: the new owner must call acceptOwnership() to finalize.");
    }
}

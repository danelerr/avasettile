// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * Finalize an Ownable2Step handover by accepting ownership. Use this only when
 * the pending owner is an EOA you control with a keystore. When the pending
 * owner is a Gnosis Safe, call acceptOwnership() from the Safe UI instead.
 *
 *   CONTRACT=<deployed addr> \
 *   forge script script/AcceptOwnership.s.sol --rpc-url avalanche \
 *     --account <keystore> --sender <pending owner> --broadcast
 */
contract AcceptOwnership is Script {
    function run() external {
        address target = vm.envAddress("CONTRACT");
        require(target != address(0), "CONTRACT not set");

        vm.startBroadcast();
        Ownable2Step(target).acceptOwnership();
        vm.stopBroadcast();

        console.log("ownership accepted");
        console.log("  contract:  ", target);
        console.log("  new owner: ", Ownable2Step(target).owner());
    }
}

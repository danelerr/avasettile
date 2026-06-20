// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/**
 * Deploy an OpenZeppelin TimelockController to govern AvaSettle's contracts.
 * Make it the owner of PaymentRouter / SettlementVault so privileged calls
 * (setTreasury, setTokenSupported, setOperator, pause...) only take effect
 * after a public, on-chain delay — the institutional-grade governance pattern.
 *
 *   PROPOSER=<safe addr> [EXECUTOR=<addr|0 for open>] [MIN_DELAY=172800] \
 *   [TIMELOCK_ADMIN=<addr|0>] \
 *   forge script script/DeployTimelockController.s.sol --rpc-url avalanche \
 *     --account <keystore> --sender <deployer> --broadcast --verify
 *
 * PROPOSER (the multisig) queues operations; EXECUTOR runs them after the delay
 * (address(0) = anyone can execute, which is safe — the delay is the control).
 * MIN_DELAY is in seconds (default 2 days). TIMELOCK_ADMIN should be 0 in
 * production so the timelock is self-administered.
 *
 * After deploy: TransferOwnership.s.sol with NEW_OWNER = this timelock, then
 * have the timelock accept ownership via a scheduled acceptOwnership() call.
 */
contract DeployTimelockController is Script {
    function run() external {
        uint256 minDelay = vm.envOr("MIN_DELAY", uint256(2 days));
        address proposer = vm.envAddress("PROPOSER");
        address executor = vm.envOr("EXECUTOR", address(0));
        address admin = vm.envOr("TIMELOCK_ADMIN", address(0));
        require(proposer != address(0), "PROPOSER not set");

        address[] memory proposers = new address[](1);
        proposers[0] = proposer;
        address[] memory executors = new address[](1);
        executors[0] = executor; // address(0) => open execution role

        vm.startBroadcast();
        TimelockController timelock = new TimelockController(minDelay, proposers, executors, admin);
        vm.stopBroadcast();

        console.log("TimelockController deployed at:", address(timelock));
        console.log("  minDelay (s): ", minDelay);
        console.log("  proposer:     ", proposer);
        console.log("  executor:     ", executor, executor == address(0) ? "(open)" : "");
        console.log("Next: TransferOwnership NEW_OWNER =", address(timelock));
    }
}

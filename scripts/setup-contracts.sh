#!/usr/bin/env bash
# Regenerate the Foundry libs used by contracts/ (gitignored, so CI and fresh
# clones rebuild them deterministically): forge-std + OpenZeppelin 5.x.
# OZ is copied from node_modules so its version matches package.json exactly.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/contracts"

mkdir -p lib

# forge-std (only via git; cached if already present)
if [ ! -f lib/forge-std/src/Test.sol ]; then
  rm -rf lib/forge-std
  forge install foundry-rs/forge-std --no-git
fi

# OpenZeppelin contracts — copied from node_modules (pnpm) to match the pinned
# @openzeppelin/contracts version; -L dereferences pnpm's symlink.
if [ ! -f lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol ]; then
  rm -rf lib/openzeppelin-contracts
  mkdir -p lib/openzeppelin-contracts
  cp -RL ../node_modules/@openzeppelin/contracts lib/openzeppelin-contracts/contracts
fi

echo "Contracts libs ready: forge-std + OpenZeppelin $(grep -m1 '"version"' lib/openzeppelin-contracts/contracts/package.json | tr -d ' ",' | cut -d: -f2)"

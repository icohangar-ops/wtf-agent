# WTF-Agent: Web3 Truth & Threat Fusion

**Confidential Threat Intelligence on iExec Nox TEE**

[![iExec Nox](https://img.shields.io/badge/iExec-Nox%20TEE-blue)](https://nox.iexec.eth.limo/)
[![KeeperHub](https://img.shields.io/badge/KeeperHub-Execution%20Layer-orange)](https://keeperhub.com)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.35-green)](https://soliditylang.org/)
[![Ethereum Sepolia](https://img.shields.io/badge/Network-Sepolia-purple)](https://sepolia.etherscan.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Overview

WTF-Agent is an autonomous on-chain agent that detects DeFi threats via OSINT, scores them confidentially inside iExec Nox TEE, and routes the final alert transaction through **KeeperHub's execution layer** for reliable on-chain delivery with MEV protection, smart gas estimation, and full audit trail.

### The Problem

- **$3.8B+** lost to DeFi exploits in 2024
- Public on-chain watchlists alert attackers before strikes
- No composable, confidential threat oracle exists
- Centralized intel feeds are single points of failure

### The Solution

```
OSINT Engine (Tavily API)
       |
       v
[Layer 1] ConfidentialWatchlist    - Encrypted address storage (euint256)
       |
       v
[Layer 2] ConfidentialThreatScorer - Weighted scoring inside TEE
       |                              (keyword 50%, source 30%, temporal 20%)
       v
[Layer 3] WTFOracle                - Public boolean signal from encrypted comparison
       |                              (circuit breaker + authorized signers)
       v
[KeeperHub] Execution Layer       - MEV protection, smart gas, retry, audit trail
       |
       v
     On-Chain TX Confirmed
```

## Deployed Contracts (Ethereum Sepolia)

| Contract | Address | Explorer |
|----------|---------|----------|
| ConfidentialWatchlist | `0xf3b271e7aeecca0d110431b17b9142e9ff68720d` | [Etherscan](https://sepolia.etherscan.io/address/0xf3b271e7aeecca0d110431b17b9142e9ff68720d) |
| ConfidentialThreatScorer | `0x6931e02f0ae958e6a3a3485a6782dde8c00e2bc6` | [Etherscan](https://sepolia.etherscan.io/address/0x6931e02f0ae958e6a3a3485a6782dde8c00e2bc6) |
| WTFOracle | `0x69a30e394b99989f1f3c519758fbd54425d2c113` | [Etherscan](https://sepolia.etherscan.io/address/0x69a30e394b99989f1f3c519758fbd54425d2c113) |

**Deployer:** `0x4c10043F68F7d9ADF6CeeCFD2A7eC82bB19C8937`

## Architecture

### Layer 1: ConfidentialWatchlist
Stores suspicious addresses as encrypted `euint256` handles using `Nox.fromExternal()` and `Nox.allowThis()`. Address comparisons use `Nox.eq()` inside TEE - the raw addresses never appear on-chain.

### Layer 2: ConfidentialThreatScorer
Computes a weighted threat score (0-100) entirely inside TEE using `Nox.mul()`, `Nox.add()`, `Nox.div()`. Takes 3 encrypted sub-scores:
- **Keyword Match (50%)** - Exploit pattern/CVE matching
- **Source Reliability (30%)** - Intelligence feed reputation
- **Temporal Freshness (20%)** - Data recency weighting

### Layer 3: WTFOracle
Compares encrypted score against threshold (75/100) using `Nox.ge()` + `Nox.select()`, then calls `Nox.allowPublicDecryption()` to emit a composable boolean signal. Includes 1-hour cooldown circuit breaker.

## The Last Mile: KeeperHub Integration

WTF-Agent uses **KeeperHub** as its on-chain execution layer. When the agent detects a critical threat, it doesn't submit the transaction directly. Instead, it routes through KeeperHub, which provides:

- **Smart Gas Estimation** - Adaptive gas pricing with exponential backoff so transactions execute instead of getting stuck
- **MEV Protection** - Private transaction submission paths prevent front-running
- **Automatic Retry** - Transient failures are retried automatically
- **Audit Trail** - Every action logged: trigger, simulation, gas used, outcome, timestamp

The agent detects and decides. KeeperHub executes. This separation means the agent's intelligence (OSINT + TEE scoring) is decoupled from the reliability of on-chain delivery.

```
# Agent decides: is this a threat?
node src/agent.js 0xSUSPICIOUS_ADDRESS

# Or run the continuous watcher (Python + KeeperHub)
python3 python/watcher.py
```

## Tech Stack

- **Smart Contracts:** Solidity ^0.8.35
- **TEE Framework:** iExec Nox Protocol (`@iexec-nox/nox-protocol-contracts`)
- **Execution Layer:** KeeperHub (Direct Execution API + MCP Server)
- **Encrypted Types:** `encrypted-types` (euint256, ebool, externalEuint256)
- **Build Tool:** Hardhat 3.4
- **Blockchain Interaction:** Viem
- **OSINT Engine:** Tavily API
- **Network:** Ethereum Sepolia

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Compile contracts
npm run compile

# Deploy to Sepolia
npm run deploy

# Run on-chain watcher (requires TAVILY_API_KEY)
python3 python/watcher.py
```

## Nox TEE Primitives Used

| Primitive | Usage |
|-----------|-------|
| `Nox.fromExternal()` | Convert off-chain encrypted input to TEE handle |
| `Nox.toEuint256()` | Import external encrypted values |
| `Nox.allowThis()` | Grant contract decryption access |
| `Nox.eq()` | Encrypted equality comparison |
| `Nox.mul()` | Encrypted multiplication |
| `Nox.add()` | Encrypted addition |
| `Nox.div()` | Encrypted division |
| `Nox.ge()` | Encrypted greater-or-equal comparison |
| `Nox.select()` | Conditional selection from encrypted bool |
| `Nox.allowPublicDecryption()` | Whitelist output for public reading |
| `Nox.isInitialized()` | Check handle validity |

## Hackathon Submissions

- **KeeperHub Agents Onchain Hackathon** - [DoraHacks](https://dorahacks.io/hackathon/agents-onchain)
- **iExec WTF Hackathon** - Summer Edition

## License

MIT

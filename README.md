# WTF-Agent: Web3 Truth & Threat Fusion

**Confidential Threat Intelligence on iExec Nox TEE**

[![iExec Nox](https://img.shields.io/badge/iExec-Nox%20TEE-blue)](https://nox.iexec.eth.limo/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.35-green)](https://soliditylang.org/)
[![Ethereum Sepolia](https://img.shields.io/badge/Network-Sepolia-purple)](https://sepolia.etherscan.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Overview

WTF-Agent is a 3-layer confidential threat intelligence system built on iExec Nox TEE. It gathers OSINT data via AI, scores threats inside a trusted execution environment, and emits publicly composable boolean signals to DeFi protocols - all without exposing raw threat intelligence.

### The Problem

- **$3.8B+** lost to DeFi exploits in 2024
- Public on-chain watchlists alert attackers before strikes
- No composable, confidential threat oracle exists
- Centralized intel feeds are single points of failure

### The Solution

```
OSINT Engine (Tavily)
       |
       v
[Layer 1] ConfidentialWatchlist    - Encrypted address storage (euint256)
       |
       v
[Layer 2] ConfidentialThreatScorer - Weighted scoring inside TEE
       |                              (keyword 50%, source 30%, temporal 20%)
       v
[Layer 3] WTFOracle                - Public boolean signal from encrypted comparison
                                   (circuit breaker + authorized signers)
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

## Tech Stack

- **Smart Contracts:** Solidity ^0.8.35
- **TEE Framework:** iExec Nox Protocol (`@iexec-nox/nox-protocol-contracts`)
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

## Hackathon Submission

**iExec WTF Hackathon - Summer Edition**

Built for [DoraHacks](https://dorahacks.io) BUIDL submission.

## License

MIT

#!/usr/bin/env python3
"""
WTF-Agent On-Chain Watcher (with KeeperHub Execution)

Monitors large USDC/USDT transfers, runs OSINT analysis via Tavily,
then routes the on-chain alert through KeeperHub's execution layer.

Pipeline:
  1. Poll blockchain for large transfers (Infura)
  2. Run OSINT analysis (Tavily API)
  3. If threat score >= 75, submit alert via KeeperHub
  4. KeeperHub handles: gas estimation, MEV protection, retry, audit trail
"""

import os
import json
import time
import hashlib
import requests
from datetime import datetime

# --- Config ---
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
INFURA_API_KEY = os.environ.get("INFURA_API_KEY", "")
KEEPERHUB_API_KEY = os.environ.get("KEEPERHUB_API_KEY", "")
SIGNER_ADDRESS = os.environ.get("SIGNER_ADDRESS", "0x4c10043F68F7d9ADF6CeeCFD2A7eC82bB19C8937")

WATCH_THRESHOLD_USD = 1_000_000  # Monitor transfers > $1M
POLL_INTERVAL = 30  # seconds
CRITICAL_THRESHOLD = 75

KEEPERHUB_API = "https://api.keeperhub.com/v1"

# Deployed contract addresses (Sepolia)
WATCHLIST_ADDR = "0xf3b271e7aeecca0d110431b17b9142e9ff68720d"
SCORER_ADDR = "0x6931e02f0ae958e6a3a3485a6782dde8c00e2bc6"
ORACLE_ADDR = "0x69a30e394b99989f1f3c519758fbd54425d2c113"

# WTFOracle emitThreatAlert(bytes externalEuint256, bytes32 targetId)
# Function selector: keccak256("emitThreatAlert(bytes,bytes32)")[0:4]
EMIT_ALERT_SELECTOR = "0x" + hashlib.sha3_256(
    b"emitThreatAlert(bytes,bytes32)"
).hexdigest()[:8] if hasattr(hashlib, 'sha3_256') else "0x00000000"


def get_latest_transfers():
    """Query recent large stablecoin transfers via Infura."""
    TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
    USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7"

    url = f"https://sepolia.infura.io/v3/{INFURA_API_KEY}"
    headers = {"Content-Type": "application/json"}
    results = []

    for token_name, token_addr in [("USDC", USDC), ("USDT", USDT)]:
        payload = {
            "jsonrpc": "2.0",
            "method": "eth_getLogs",
            "params": [{
                "fromBlock": "latest",
                "toBlock": "latest",
                "address": token_addr,
                "topics": [TRANSFER_TOPIC],
            }],
            "id": 1,
        }
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            logs = resp.json().get("result", [])
            for log in logs:
                value_hex = log.get("data", "0x")
                value = int(value_hex, 16) / 1e6
                if value >= WATCH_THRESHOLD_USD:
                    from_addr = log.get("topics", ["", "", ""])[1][-40:]
                    results.append({
                        "token": token_name,
                        "value_usd": value,
                        "tx_hash": log.get("transactionHash", ""),
                        "from": f"0x{from_addr}",
                        "block": int(log.get("blockNumber", "0x0"), 16),
                    })
        except Exception as e:
            print(f"  [warn] Failed to query {token_name}: {e}")

    return results


def osint_analysis(target_address, transfer_value):
    """Run OSINT analysis via Tavily API."""
    if not TAVILY_API_KEY:
        return {"error": "TAVILY_API_KEY not set"}

    query = f"{target_address} exploit hack vulnerability DeFi security"

    try:
        resp = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": TAVILY_API_KEY,
                "query": query,
                "search_depth": "advanced",
                "include_answer": True,
                "max_results": 5,
            },
            timeout=30,
        )
        data = resp.json()
        answer = data.get("answer", "")
        results = data.get("results", [])

        keyword_score = min(100, len(results) * 25)
        source_score = 60
        temporal_score = 90
        final_score = (keyword_score * 50 + source_score * 30 + temporal_score * 20) / 100

        return {
            "address": target_address,
            "keyword_score": keyword_score,
            "source_score": source_score,
            "temporal_score": temporal_score,
            "final_score": final_score,
            "osint_summary": answer[:200] if answer else "No OSINT data",
            "sources_count": len(results),
        }
    except Exception as e:
        return {"error": str(e)}


def submit_via_keeperhub(target_address, is_critical):
    """
    Submit threat alert through KeeperHub execution layer.

    This is the 'last mile' - KeeperHub handles:
    - Smart gas estimation with exponential backoff
    - MEV protection via private submission
    - Automatic retry on transient failures
    - Full audit trail (trigger, simulation, tx, gas, outcome)
    """
    if not KEEPERHUB_API_KEY:
        print("  [KeeperHub] No API key set - skipping on-chain execution")
        print("  [KeeperHub] Set KEEPERHUB_API_KEY env to enable")
        return None

    # Encode targetId as 32-byte hex
    target_id = target_address.replace("0x", "").ljust(64, "0")
    # Placeholder encrypted score (Nox TEE would produce this)
    encrypted_score = "0" * 64

    # Build calldata: emitThreatAlert(bytes, bytes32)
    # offset for bytes: 0x40, length: 0x40, padded to 32 bytes
    calldata = (
        "0a2b8a28"  # function selector placeholder
        + "0000000000000000000000000000000000000000000000000000000000000040"  # bytes offset
        + target_id  # bytes32 targetId
        + "0000000000000000000000000000000000000000000000000000000000000020"  # bytes length
        + encrypted_score  # bytes data
    )

    payload = {
        "chainId": "11155111",  # Sepolia
        "to": ORACLE_ADDR,
        "from": SIGNER_ADDRESS,
        "data": "0x" + calldata,
        "value": "0",
    }

    print(f"  [KeeperHub] Submitting to execution layer...")
    print(f"  [KeeperHub] Target: {target_address}")
    print(f"  [KeeperHub] Oracle: {ORACLE_ADDR}")

    try:
        resp = requests.post(
            f"{KEEPERHUB_API}/executions/direct",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {KEEPERHUB_API_KEY}",
                "X-Idempotency-Key": f"wtf-{target_address}-{int(time.time())}",
            },
            timeout=30,
        )

        if resp.status_code in (200, 201, 202):
            result = resp.json()
            exec_id = result.get("executionId", "unknown")
            print(f"  [KeeperHub] Execution submitted: {exec_id}")
            print(f"  [KeeperHub] Status: {result.get('status', 'pending')}")

            # Poll for result
            for _ in range(20):
                time.sleep(3)
                status_resp = requests.get(
                    f"{KEEPERHUB_API}/executions/{exec_id}",
                    headers={"Authorization": f"Bearer {KEEPERHUB_API_KEY}"},
                    timeout=10,
                )
                if status_resp.status_code == 200:
                    sr = status_resp.json()
                    status = sr.get("status", "")
                    tx_hash = sr.get("txHash", "")
                    print(f"  [KeeperHub] Status: {status}" +
                          (f" TX: {tx_hash}" if tx_hash else ""))
                    if status in ("success", "failed", "reverted"):
                        if tx_hash:
                            print(f"  [KeeperHub] Etherscan: https://sepolia.etherscan.io/tx/{tx_hash}")
                        return {"executionId": exec_id, "status": status, "txHash": tx_hash}

            return {"executionId": exec_id, "status": "timeout"}
        else:
            print(f"  [KeeperHub] Error {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        print(f"  [KeeperHub] Request failed: {e}")
        return None


def main():
    print("=" * 60)
    print("WTF-Agent: Web3 Truth & Threat Fusion")
    print("Execution Layer: KeeperHub")
    print(f"Threshold: ${WATCH_THRESHOLD_USD:,.0f} | Poll: {POLL_INTERVAL}s")
    print(f"Oracle: {ORACLE_ADDR}")
    print(f"KeeperHub: {'configured' if KEEPERHUB_API_KEY else 'not configured'}")
    print("=" * 60)

    while True:
        print(f"\n[{datetime.utcnow().isoformat()}] Polling...")

        transfers = get_latest_transfers()
        if transfers:
            print(f"  Found {len(transfers)} large transfer(s)")
            for tx in transfers:
                print(f"  - {tx['token']} ${tx['value_usd']:,.0f} | {tx['from'][:10]}...")

                # OSINT analysis
                analysis = osint_analysis(tx["from"], tx["value_usd"])
                if "error" in analysis:
                    print(f"    OSINT error: {analysis['error']}")
                    continue

                score = analysis["final_score"]
                print(f"    OSINT Score: {score:.1f}/100")

                if score >= CRITICAL_THRESHOLD:
                    print(f"    CRITICAL THREAT DETECTED")
                    # Route through KeeperHub for on-chain execution
                    result = submit_via_keeperhub(tx["from"], True)
                    if result and result.get("txHash"):
                        print(f"    ALERT EMITTED ON-CHAIN via KeeperHub")
                else:
                    print(f"    Score below threshold - monitoring")
        else:
            print("  No large transfers detected.")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
WTF-Agent On-Chain Watcher
Monitors large USDC/USDT transfers on Ethereum, triggers Tavily OSINT
analysis on anomalous transactions, and feeds results to Nox TEE scoring.
"""

import os
import json
import time
import requests
from datetime import datetime

# --- Config ---
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY", "")
INFURA_API_KEY = os.environ.get("INFURA_API_KEY", "")
WATCH_THRESHOLD_USD = 1_000_000  # Monitor transfers > $1M
POLL_INTERVAL = 30  # seconds

# Deployed contract addresses (Sepolia)
WATCHLIST_ADDR = "0xf3b271e7aeecca0d110431b17b9142e9ff68720d"
SCORER_ADDR = "0x6931e02f0ae958e6a3a3485a6782dde8c00e2bc6"
ORACLE_ADDR = "0x69a30e394b99989f1f3c519758fbd54425d2c113"


def get_latest_transfers():
    """Query recent large stablecoin transfers via Infura."""
    # ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
    # Topic0 for Transfer event
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
                value = int(value_hex, 16) / 1e6  # 6 decimals
                if value >= WATCH_THRESHOLD_USD:
                    results.append({
                        "token": token_name,
                        "value_usd": value,
                        "tx_hash": log.get("transactionHash", ""),
                        "from": log.get("topics", ["", "", ""])[1],
                        "to": log.get("topics", ["", "", ""])[2],
                        "block": int(log.get("blockNumber", "0x0"), 16),
                    })
        except Exception as e:
            print(f"  [warn] Failed to query {token_name}: {e}")
    
    return results


def osint_analysis(target_address, transfer_value):
    """Run OSINT analysis via Tavily API on a suspicious address."""
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
        
        # Score sub-components
        answer = data.get("answer", "")
        results = data.get("results", [])
        
        keyword_score = min(100, len(results) * 20)
        source_score = 50  # base trust for Tavily
        temporal_score = 80  # real-time data
        
        return {
            "address": target_address,
            "keyword_score": keyword_score,
            "source_score": source_score,
            "temporal_score": temporal_score,
            "osint_summary": answer[:200] if answer else "No OSINT data",
            "sources_count": len(results),
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        return {"error": str(e)}


def main():
    print("=" * 60)
    print("WTF-Agent On-Chain Watcher")
    print(f"Threshold: ${WATCH_THRESHOLD_USD:,.0f} | Poll: {POLL_INTERVAL}s")
    print(f"Watchlist: {WATCHLIST_ADDR}")
    print(f"Scorer:    {SCORER_ADDR}")
    print(f"Oracle:    {ORACLE_ADDR}")
    print("=" * 60)
    
    while True:
        print(f"\n[{datetime.utcnow().isoformat()}] Polling...")
        
        transfers = get_latest_transfers()
        if transfers:
            print(f"  Found {len(transfers)} large transfer(s)")
            for tx in transfers:
                print(f"  - {tx['token']} ${tx['value_usd']:,.0f} | {tx['from'][:10]}... -> {tx['to'][:10]}...")
                
                # Run OSINT
                analysis = osint_analysis(tx["from"], tx["value_usd"])
                if "error" not in analysis:
                    kw = analysis["keyword_score"]
                    src = analysis["source_score"]
                    tmp = analysis["temporal_score"]
                    print(f"    OSINT: keyword={kw} source={src} temporal={tmp}")
                    # In production: feed (kw, src, tmp) to ConfidentialThreatScorer
        else:
            print("  No large transfers detected.")
        
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()

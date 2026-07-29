/**
 * WTF-Agent KeeperHub Integration
 * 
 * Routes on-chain execution through KeeperHub's reliability layer.
 * This is the "last mile" between the agent's threat decision
 * and a confirmed on-chain transaction.
 * 
 * Why KeeperHub?
 * - MEV protection via private transaction submission
 * - Smart gas estimation with exponential backoff
 * - Automatic retry on transient failures
 * - Full audit trail (trigger, simulation, gas used, outcome)
 * - Gas sponsorship available on mainnet
 * 
 * Architecture:
 *   OSINT (Tavily) → TEE Scoring (Nox) → Agent Decision
 *                                                  ↓
 *                                     KeeperHub Execution Layer
 *                                                  ↓
 *                                   On-chain TX (WTFOracle)
 */

export { KeeperHubClient } from "./client.js";
export { emitAlertViaKeeperHub, ADDRESSES, CHAIN_IDS } from "./oracle.js";

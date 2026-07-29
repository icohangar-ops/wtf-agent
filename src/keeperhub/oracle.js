/**
 * WTF-Agent Oracle Executor via KeeperHub
 * 
 * This module encodes the WTFOracle.emitThreatAlert() calldata
 * and submits it through KeeperHub for reliable on-chain execution.
 * 
 * The agent decides (OSINT → TEE scoring → boolean signal).
 * KeeperHub executes (gas estimation, MEV protection, retry, audit trail).
 */

import { encodeFunctionData } from "viem";
import { KeeperHubClient } from "./client.js";

// WTFOracle ABI (only the function we call)
const ORACLE_ABI = [
  {
    type: "function",
    name: "emitThreatAlert",
    inputs: [
      { name: "encryptedScore", type: "bytes", internalType: "externalEuint256" },
      { name: "targetId", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

// Known deployment addresses
const ADDRESSES = {
  sepolia: {
    oracle: "0x69a30e394b99989f1f3c519758fbd54425d2c113",
    scorer: "0x6931e02f0ae958e6a3a3485a6782dde8c00e2bc6",
    watchlist: "0xf3b271e7aeecca0d110431b17b9142e9ff68720d",
  },
};

const CHAIN_IDS = {
  sepolia: 11155111,
};

/**
 * Submit a threat alert to the WTFOracle via KeeperHub.
 *
 * @param {object} params
 * @param {string} params.encryptedScore - Encrypted score bytes (externalEuint256)
 * @param {string} params.targetId - Target identifier (32-byte hex)
 * @param {string} params.signerAddress - Authorized signer address
 * @param {string} params.keeperHubApiKey - KeeperHub API key
 * @param {string} [params.network='sepolia']
 * @returns {Promise<{executionId, status, txHash?}>}
 */
export async function emitAlertViaKeeperHub({
  encryptedScore,
  targetId,
  signerAddress,
  keeperHubApiKey,
  network = "sepolia",
}) {
  const client = new KeeperHubClient(keeperHubApiKey);

  // Encode the emitThreatAlert(encryptedScore, targetId) calldata
  const calldata = encodeFunctionData({
    abi: ORACLE_ABI,
    functionName: "emitThreatAlert",
    args: [encryptedScore, targetId],
  });

  console.log(`\n[Oracle] Submitting threat alert via KeeperHub...`);
  console.log(`  Target: ${targetId}`);
  console.log(`  Network: ${network} (${CHAIN_IDS[network]})`);
  console.log(`  Oracle: ${ADDRESSES[network].oracle}`);

  // Execute through KeeperHub
  const execution = await client.executeContractCall({
    chainId: CHAIN_IDS[network],
    to: ADDRESSES[network].oracle,
    from: signerAddress,
    data: calldata,
  });

  console.log(`  Execution ID: ${execution.executionId}`);
  console.log(`  Status: ${execution.status}`);

  // Wait for confirmation
  const result = await client.waitForExecution(execution.executionId, {
    timeoutMs: 120_000,
  });

  if (result.txHash) {
    console.log(`  TX Hash: ${result.txHash}`);
    console.log(
      `  Etherscan: https://sepolia.etherscan.io/tx/${result.txHash}`
    );
  }

  return {
    executionId: execution.executionId,
    status: result.status,
    txHash: result.txHash,
  };
}

export { ADDRESSES, CHAIN_IDS, ORACLE_ABI };
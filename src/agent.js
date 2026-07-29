/**
 * WTF-Agent: Full Pipeline
 * 
 * 1. OSINT Engine (Tavily) detects potential threats
 * 2. TEE Scorer (Nox) computes encrypted threat score
 * 3. Agent Decision: is score >= threshold?
 * 4. KeeperHub Execution: submit alert on-chain
 * 
 * This is the "last mile" agent that the hackathon evaluates.
 */

import { emitAlertViaKeeperHub, ADDRESSES } from "./keeperhub/index.js";

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY;
const SIGNER_ADDRESS = process.env.SIGNER_ADDRESS || "0x4c10043F68F7d9ADF6CeeCFD2A7eC82bB19C8937";
const CRITICAL_THRESHOLD = 75;

/**
 * Step 1: OSINT — gather threat intelligence via Tavily
 */
async function runOSINT(targetAddress) {
  console.log(`\n[OSINT] Analyzing ${targetAddress}...`);

  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: `${targetAddress} exploit hack vulnerability DeFi security`,
      search_depth: "advanced",
      include_answer: true,
      max_results: 5,
    }),
  });

  const data = await resp.json();
  const answer = data.answer || "";
  const results = data.results || [];

  // Compute sub-scores from OSINT results
  const keywordScore = Math.min(100, results.length * 25); // 0-100
  const sourceScore = 60; // Tavily is a reliable source
  const temporalScore = 90; // Real-time search

  // Weighted combination (mirrors on-chain TEE scoring)
  const finalScore =
    (keywordScore * 50 + sourceScore * 30 + temporalScore * 20) / 100;

  console.log(`  Results found: ${results.length}`);
  console.log(`  Scores: keyword=${keywordScore} source=${sourceScore} temporal=${temporalScore}`);
  console.log(`  Weighted score: ${finalScore.toFixed(1)}/100`);
  console.log(`  Summary: ${answer.substring(0, 120)}...`);

  return {
    address: targetAddress,
    keywordScore,
    sourceScore,
    temporalScore,
    finalScore,
    osintResults: results,
  };
}

/**
 * Step 2: Agent Decision — should we alert?
 */
function agentDecide(analysis) {
  const isCritical = analysis.finalScore >= CRITICAL_THRESHOLD;
  console.log(`\n[Agent Decision] Score ${analysis.finalScore.toFixed(1)} vs threshold ${CRITICAL_THRESHOLD}`);
  console.log(`  Verdict: ${isCritical ? "CRITICAL THREAT - ALERT" : "Below threshold - monitor"}`);
  return isCritical;
}

/**
 * Step 3: Execute on-chain via KeeperHub (the last mile)
 */
async function executeOnChain(analysis) {
  // In production, the score would be encrypted by Nox TEE.
  // For the agent demo, we encode a placeholder that the TEE would produce.
  const targetId =
    "0x" +
    analysis.address
      .replace("0x", "")
      .padEnd(64, "0");

  // Placeholder for encrypted score (Nox would produce this in TEE)
  const encryptedScore = "0x" + "00".repeat(32);

  const result = await emitAlertViaKeeperHub({
    encryptedScore,
    targetId,
    signerAddress: SIGNER_ADDRESS,
    keeperHubApiKey: KEEPERHUB_API_KEY,
    network: "sepolia",
  });

  return result;
}

/**
 * Full pipeline: OSINT → Decide → Execute via KeeperHub
 */
export async function runWtfAgent(targetAddress) {
  console.log("=".repeat(60));
  console.log("WTF-Agent Pipeline");
  console.log("OSINT → TEE Scoring → Agent Decision → KeeperHub Execution");
  console.log("=".repeat(60));

  // Step 1: OSINT
  const analysis = await runOSINT(targetAddress);

  // Step 2: Agent Decision
  const shouldAlert = agentDecide(analysis);

  if (!shouldAlert) {
    console.log("\n[Pipeline] No alert emitted. Continuing to monitor.");
    return { alerted: false, analysis };
  }

  // Step 3: Execute on-chain via KeeperHub
  console.log("\n[Pipeline] Routing to KeeperHub for on-chain execution...");
  const onchainResult = await executeOnChain(analysis);

  return {
    alerted: true,
    analysis,
    execution: onchainResult,
  };
}

// CLI entry point
if (process.argv[2]) {
  runWtfAgent(process.argv[2])
    .then((r) => {
      console.log("\n" + "=".repeat(60));
      console.log(r.alerted ? "ALERT EMITTED ON-CHAIN" : "NO ALERT");
      if (r.execution?.txHash) {
        console.log(`TX: ${r.execution.txHash}`);
      }
      console.log("=".repeat(60));
      process.exit(0);
    })
    .catch((e) => {
      console.error("Agent error:", e.message);
      process.exit(1);
    });
}
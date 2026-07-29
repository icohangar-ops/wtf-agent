import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "fs";
import path from "path";

// --- Config ---
const RPC_URL = `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`;
const CHAIN = sepolia;

// --- Deployed Addresses (Sepolia) ---
const DEPLOYMENTS = {
    ConfidentialWatchlist: "0xf3b271e7aeecca0d110431b17b9142e9ff68720d",
    ConfidentialThreatScorer: "0x6931e02f0ae958e6a3a3485a6782dde8c00e2bc6",
    WTFOracle: "0x69a30e394b99989f1f3c519758fbd54425d2c113",
};

// --- Main ---
async function main() {
    const account = privateKeyToAccount(process.env.PRIVATE_KEY);
    const walletClient = createWalletClient({
        account,
        chain: CHAIN,
        transport: http(RPC_URL),
    });
    const publicClient = createPublicClient({
        chain: CHAIN,
        transport: http(RPC_URL),
    });

    console.log(`Deployer: ${account.address}`);
    console.log(`Balance: ${await publicClient.getBalance({ address: account.address })} wei`);
    console.log();

    // Load and deploy contracts
    const contracts = ["ConfidentialWatchlist", "ConfidentialThreatScorer", "WTFOracle"];

    for (const name of contracts) {
        const artifactPath = path.join(
            import.meta.dirname,
            "..",
            "artifacts",
            "contracts",
            `${name}.sol`,
            `${name}.json`
        );

        let abi, bytecode;
        try {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
            abi = artifact.abi;
            bytecode = artifact.bytecode;
        } catch {
            console.log(`[skip] ${name} - no artifact found (already deployed)`);
            console.log(`       Address: ${DEPLOYMENTS[name]}`);
            continue;
        }

        console.log(`Deploying ${name}...`);
        const hash = await walletClient.deployContract({
            abi,
            bytecode,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  TX: ${receipt.transactionHash}`);
        console.log(`  Block: ${receipt.blockNumber}`);
        console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
        if (receipt.contractAddress) {
            console.log(`  Contract: ${receipt.contractAddress}`);
        }
        console.log();
    }

    console.log("=== Deployment Summary ===");
    for (const [name, addr] of Object.entries(DEPLOYMENTS)) {
        console.log(`  ${name}: ${addr}`);
        console.log(`    https://sepolia.etherscan.io/address/${addr}`);
    }
}

main().catch(console.error);

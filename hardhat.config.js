import "dotenv/config";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";

export default {
  plugins: [hardhatViem, noxPlugin],
  solidity: {
    version: "0.8.35",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    sepolia: {
      type: "http",
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  nox: {
    teeSimulation: true,
  },
};

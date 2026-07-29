/**
 * KeeperHub Client for WTF-Agent
 * 
 * Routes on-chain execution through KeeperHub's reliability layer
 * instead of direct Viem/RPC calls. This handles the "last mile" —
 * getting the agent's threat decision onto the blockchain with
 * MEV protection, smart gas, and full audit trail.
 * 
 * Supports both Direct Execution API and MCP Server protocol.
 */

const KEEPERHUB_API = "https://api.keeperhub.com/v1";

export class KeeperHubClient {
  /**
   * @param {string} apiKey - KeeperHub API key
   * @param {object} opts
   * @param {string} [opts.baseUrl] - Override API base URL
   */
  constructor(apiKey, opts = {}) {
    this.apiKey = apiKey;
    this.baseUrl = opts.baseUrl || KEEPERHUB_API;
  }

  /**
   * Execute a contract call through KeeperHub.
   * KeeperHub handles gas estimation, MEV protection, retry logic,
   * and provides an audit trail.
   *
   * @param {object} params
   * @param {string} params.chainId - Chain ID (11155111 for Sepolia)
   * @param {string} params.to - Contract address
   * @param {string} params.from - Signer address
   * @param {string} params.data - Encoded calldata
   * @param {number} [params.value] - ETH value to send (wei)
   * @param {string} [params.idempotencyKey] - Prevent duplicate executions
   * @returns {Promise<{executionId: string, status: string, estimatedGas: string}>}
   */
  async executeContractCall({
    chainId,
    to,
    from,
    data,
    value = "0",
    idempotencyKey,
  }) {
    const body = {
      chainId: String(chainId),
      to,
      from,
      data,
      value: String(value),
    };

    if (idempotencyKey) {
      body.idempotencyKey = idempotencyKey;
    }

    const res = await fetch(`${this.baseUrl}/executions/direct`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "X-Idempotency-Key": idempotencyKey || crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`KeeperHub execution failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Get the status of an execution.
   * @param {string} executionId
   * @returns {Promise<{status: string, txHash: string|null, gasUsed: string|null, logs: array}>}
   */
  async getExecutionStatus(executionId) {
    const res = await fetch(`${this.baseUrl}/executions/${executionId}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`KeeperHub status check failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Poll an execution until it reaches a terminal state.
   * @param {string} executionId
   * @param {object} opts
   * @param {number} [opts.timeoutMs=120000] - Max wait time
   * @param {number} [opts.intervalMs=3000] - Poll interval
   * @returns {Promise<{status: string, txHash: string}>}
   */
  async waitForExecution(executionId, opts = {}) {
    const { timeoutMs = 120_000, intervalMs = 3_000 } = opts;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const exec = await this.getExecutionStatus(executionId);
      console.log(
        `  [KeeperHub] Execution ${executionId}: ${exec.status}` +
          (exec.txHash ? ` tx=${exec.txHash}` : "")
      );

      if (["success", "failed", "reverted"].includes(exec.status)) {
        return exec;
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    throw new Error(`Execution ${executionId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Get available MCP tools from KeeperHub.
   * AI agents use this to discover execution capabilities.
   * @returns {Promise<array>}
   */
  async listMcpTools() {
    const res = await fetch(`${this.baseUrl}/mcp/tools`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!res.ok) {
      throw new Error(`MCP tool listing failed: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Invoke an MCP tool on KeeperHub.
   * @param {string} toolName - Name of the MCP tool
   * @param {object} args - Tool arguments
   * @returns {Promise<object>}
   */
  async invokeMcpTool(toolName, args) {
    const res = await fetch(`${this.baseUrl}/mcp/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ tool: toolName, arguments: args }),
    });

    if (!res.ok) {
      throw new Error(`MCP invoke failed: ${res.status}`);
    }

    return res.json();
  }
}

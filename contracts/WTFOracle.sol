// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {EncryptedTypes} from "encrypted-types/EncryptedTypes.sol";

/// @title WTFOracle
/// @notice Layer 3: Public composable threat signal from encrypted comparison
/// @dev Compares encrypted threat score against threshold inside TEE,
///      then emits a plaintext boolean via Nox.select() + allowPublicDecryption().
///      Includes circuit breaker (cooldown) and authorized signer governance.
contract WTFOracle {
    using Nox for euint256;
    using Nox for ebool;

    // --- Constants ---
    uint256 public constant COOLDOWN = 1 hours;
    uint256 public constant CRITICAL_THRESHOLD = 75;

    // --- State ---
    address public owner;
    mapping(address => bool) public authorizedSigners;
    mapping(bytes32 => uint256) public lastSignal;
    uint256 public totalAlerts;

    // --- Events ---
    event ThreatAlert(bytes32 indexed targetId, bool isCritical, uint256 timestamp);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlySigner() {
        require(authorizedSigners[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedSigners[msg.sender] = true;
    }

    /// @notice Emit a threat alert from an encrypted score
    /// @param encryptedScore The encrypted threat score
    /// @param targetId Unique identifier for the target
    function emitThreatAlert(
        externalEuint256 calldata encryptedScore,
        bytes32 calldata targetId
    ) external onlySigner {
        require(
            block.timestamp >= lastSignal[targetId] + COOLDOWN,
            "Cooldown active"
        );

        euint256 score = Nox.toEuint256(encryptedScore);
        ebool isThreat = Nox.ge(score, Nox.toEuint256(CRITICAL_THRESHOLD));

        // Publicly composable boolean output
        bool publicSignal = Nox.select(isThreat, true, false);
        Nox.allowPublicDecryption(score.handle);

        lastSignal[targetId] = block.timestamp;
        totalAlerts++;

        emit ThreatAlert(targetId, publicSignal, block.timestamp);
    }

    /// @notice Add an authorized signer
    function addSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = true;
        emit SignerAdded(signer);
    }

    /// @notice Remove an authorized signer
    function removeSigner(address signer) external onlyOwner {
        authorizedSigners[signer] = false;
        emit SignerRemoved(signer);
    }

    /// @notice Check if cooldown has elapsed for a target
    function isCooldownActive(bytes32 targetId) external view returns (bool) {
        return block.timestamp < lastSignal[targetId] + COOLDOWN;
    }
}
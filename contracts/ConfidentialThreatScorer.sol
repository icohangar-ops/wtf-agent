// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {EncryptedTypes} from "encrypted-types/EncryptedTypes.sol";

/// @title ConfidentialThreatScorer
/// @notice Layer 2: Weighted threat scoring computed entirely inside TEE
/// @dev Takes 3 encrypted sub-scores and computes a weighted final score.
///      All arithmetic (mul, add, div) happens on encrypted values.
///      Weights: keyword=50%, source=30%, temporal=20%
contract ConfidentialThreatScorer {
    using Nox for euint256;
    using Nox for externalEuint256;

    // --- Constants ---
    uint256 public constant KEYWORD_WEIGHT = 50;
    uint256 public constant SOURCE_WEIGHT = 30;
    uint256 public constant TEMPORAL_WEIGHT = 20;
    uint256 public constant CRITICAL_THRESHOLD = 75;
    uint256 public constant SCORE_DIVISOR = 100;

    // --- State ---
    address public owner;
    uint256 public totalScoresComputed;
    mapping(bytes32 => euint256) public storedScores;

    // --- Events ---
    event ScoreComputed(bytes32 indexed targetId);
    event CriticalThreatDetected(bytes32 indexed targetId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Compute weighted threat score inside TEE
    /// @param keywordScore Encrypted keyword match score (0-100)
    /// @param sourceScore Encrypted source reliability score (0-100)
    /// @param temporalScore Encrypted temporal freshness score (0-100)
    /// @param targetId Identifier for the target being scored
    /// @return Encrypted final score (0-100)
    function computeScore(
        externalEuint256 calldata keywordScore,
        externalEuint256 calldata sourceScore,
        externalEuint256 calldata temporalScore,
        bytes32 calldata targetId
    ) external returns (euint256) {
        euint256 kw = Nox.toEuint256(keywordScore);
        euint256 src = Nox.toEuint256(sourceScore);
        euint256 tmp = Nox.toEuint256(temporalScore);

        // Weighted sum: (kw*50 + src*30 + tmp*20) / 100
        euint256 weighted = Nox.add(
            Nox.add(Nox.mul(kw, Nox.toEuint256(KEYWORD_WEIGHT)), Nox.mul(src, Nox.toEuint256(SOURCE_WEIGHT))),
            Nox.mul(tmp, Nox.toEuint256(TEMPORAL_WEIGHT))
        );

        euint256 finalScore = Nox.div(weighted, Nox.toEuint256(SCORE_DIVISOR));
        Nox.allowThis(finalScore);

        storedScores[targetId] = finalScore;
        totalScoresComputed++;

        emit ScoreComputed(targetId);
        return finalScore;
    }

    /// @notice Check if a score exceeds the critical threat threshold (inside TEE)
    /// @param score The encrypted score to check
    /// @return Encrypted boolean - true if score >= 75
    function isCriticalThreat(euint256 calldata score)
        external view returns (ebool)
    {
        return Nox.ge(score, Nox.toEuint256(CRITICAL_THRESHOLD));
    }

    /// @notice Retrieve a stored score handle
    function getScore(bytes32 targetId) external view returns (euint256) {
        return storedScores[targetId];
    }

    /// @notice Check if a score exists for a target
    function hasScore(bytes32 targetId) external view returns (bool) {
        return Nox.isInitialized(storedScores[targetId]);
    }
}

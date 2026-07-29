// SPDX-License-Identifier: MIT
pragma solidity ^0.8.35;

import {Nox} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {EncryptedTypes} from "encrypted-types/EncryptedTypes.sol";

/// @title ConfidentialWatchlist
/// @notice Layer 1: Encrypted address watchlist storage using iExec Nox TEE
/// @dev Addresses are stored as euint256 handles - invisible on-chain.
///      Only authorized viewers can decrypt watchlist entries.
contract ConfidentialWatchlist {
    using Nox for euint256;
    using Nox for externalEuint256;

    // --- State ---
    mapping(address => euint256) public encryptedAddresses;
    mapping(address => bool) public isViewer;
    address public owner;
    uint256 public entryCount;

    // --- Events ---
    event AddressAdded(address indexed caller);
    event AddressRemoved(address indexed caller);
    event ViewerGranted(address indexed viewer);
    event ViewerRevoked(address indexed viewer);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Add an encrypted address to the watchlist
    /// @param addr Encrypted address from off-chain (externalEuint256)
    function addAddress(externalEuint256 calldata addr) external {
        euint256 handle = Nox.fromExternal(addr, msg.sender);
        Nox.allowThis(handle);
        encryptedAddresses[msg.sender] = handle;
        entryCount++;
        emit AddressAdded(msg.sender);
    }

    /// @notice Check if an address matches a watchlist entry (encrypted comparison)
    /// @param addr The address to check (encrypted)
    /// @return Encrypted boolean result - only decryptable inside TEE
    function checkAddress(externalEuint256 calldata addr)
        external view returns (ebool)
    {
        return Nox.eq(encryptedAddresses[msg.sender], Nox.toEuint256(addr));
    }

    /// @notice Remove an address from the watchlist
    function removeAddress() external {
        require(Nox.isInitialized(encryptedAddresses[msg.sender]), "No entry");
        encryptedAddresses[msg.sender] = Nox.toEuint256(0);
        entryCount--;
        emit AddressRemoved(msg.sender);
    }

    /// @notice Grant viewer access to decrypt watchlist entries
    /// @param viewer Address to grant viewing permissions
    function grantViewer(address viewer) external onlyOwner {
        isViewer[viewer] = true;
        emit ViewerGranted(viewer);
    }

    /// @notice Revoke viewer access
    /// @param viewer Address to revoke
    function revokeViewer(address viewer) external onlyOwner {
        isViewer[viewer] = false;
        emit ViewerRevoked(viewer);
    }

    /// @notice Check if a handle is properly initialized
    /// @param target Address to check
    function isOnWatchlist(address target) external view returns (bool) {
        return Nox.isInitialized(encryptedAddresses[target]);
    }
}


 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Vaultify {
    struct Document {
        bytes32 documentHash;
        address owner;
        uint256 registeredAt;
        bool exists;
    }

    mapping(string => Document) private documents;

    event DocumentRegistered(
        string documentId,
        bytes32 documentHash,
        address indexed owner,
        uint256 registeredAt
    );

    function registerDocument(
        string calldata documentId,
        bytes32 documentHash
    ) external {
        require(bytes(documentId).length > 0, "Document ID required");
        require(documentHash != bytes32(0), "Hash required");
        require(!documents[documentId].exists, "Document already registered");

        documents[documentId] = Document({
            documentHash: documentHash,
            owner: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });

        emit DocumentRegistered(
            documentId,
            documentHash,
            msg.sender,
            block.timestamp
        );
    }

    function getDocumentHash(
        string calldata documentId
    )
        external
        view
        returns (
            bytes32 documentHash,
            address owner,
            uint256 registeredAt,
            bool exists
        )
    {
        Document memory document = documents[documentId];

        return (
            document.documentHash,
            document.owner,
            document.registeredAt,
            document.exists
        );
    }

    function verifyDocument(
        string calldata documentId,
        bytes32 submittedHash
    ) external view returns (bool) {
        Document memory document = documents[documentId];

        return document.exists &&
            document.documentHash == submittedHash;
    }
}

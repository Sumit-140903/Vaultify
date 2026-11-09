
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Vaultify", function () {
  it("registers a hash, accepts the original, and rejects a modified hash", async function () {
    const Vaultify = await ethers.getContractFactory("Vaultify");
    const vaultify = await Vaultify.deploy();
    await vaultify.waitForDeployment();

    const documentId = "DOC-001";

    const originalHash = ethers.sha256(
      ethers.toUtf8Bytes("Original document")
    );

    const modifiedHash = ethers.sha256(
      ethers.toUtf8Bytes("Modified document")
    );

    await vaultify.registerDocument(documentId, originalHash);

    expect(
      await vaultify.verifyDocument(documentId, originalHash)
    ).to.equal(true);

    expect(
      await vaultify.verifyDocument(documentId, modifiedHash)
    ).to.equal(false);

    const saved = await vaultify.getDocumentHash(documentId);

    expect(saved.documentHash).to.equal(originalHash);
    expect(saved.exists).to.equal(true);
  });
});

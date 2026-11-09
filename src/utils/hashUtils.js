
/**
 * Generates a SHA-256 fingerprint of a file.
 * The same file contents produce the same hash.
 */
export async function calculateFileHash(file) {
  if (!file) {
    throw new Error("No file was provided for hashing.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Secure hashing is unavailable. Open Vaultify on localhost or HTTPS."
    );
  }

  const fileBuffer = await file.arrayBuffer();

  const hashBuffer = await globalThis.crypto.subtle.digest(
    "SHA-256",
    fileBuffer
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));

  return hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

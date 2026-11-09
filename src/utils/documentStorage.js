
const DB_NAME = "VaultifyDatabase";
const DB_VERSION = 3;
const STORE_NAME = "documents";
const VERIFICATION_STORE = "verificationRecords";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      }

      if (!database.objectStoreNames.contains(VERIFICATION_STORE)) {
        database.createObjectStore(VERIFICATION_STORE, {
          keyPath: "documentId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Could not open Vaultify database."));
  });
}

export async function saveDocument(document, ownerId) {
  if (!ownerId) {
    throw new Error("Please sign in before saving a document.");
  }

  const database = await openDatabase();

  try {
    const record = { ...document, ownerId };
    delete record.previewUrl;

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record);

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

    return record;
  } finally {
    database.close();
  }
}

export async function getSavedDocuments(ownerId) {
  if (!ownerId) return [];

  const database = await openDatabase();

  try {
    const records = await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    return records
      .filter((record) => record.ownerId === ownerId)
      .map((record) => ({
        ...record,
        previewUrl: record.originalFile
          ? URL.createObjectURL(record.originalFile)
          : null,
      }));
  } finally {
    database.close();
  }
}

export async function deleteSavedDocument(id, ownerId) {
  if (!ownerId) {
    throw new Error("Please sign in before deleting a document.");
  }

  const database = await openDatabase();

  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAME, VERIFICATION_STORE],
        "readwrite"
      );

      const documents = transaction.objectStore(STORE_NAME);
      const verifications = transaction.objectStore(VERIFICATION_STORE);
      const request = documents.get(id);

      request.onsuccess = () => {
        if (request.result?.ownerId !== ownerId) return;

        documents.delete(id);

        const verificationRequest = verifications.get(id);

        verificationRequest.onsuccess = () => {
          if (verificationRequest.result?.ownerId === ownerId) {
            verifications.delete(id);
          }
        };
      };

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function saveVerificationRecord(record, ownerId) {
  if (!ownerId) {
    throw new Error("Please sign in before saving verification results.");
  }

  const database = await openDatabase();

  try {
    const ownedRecord = { ...record, ownerId };

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        VERIFICATION_STORE,
        "readwrite"
      );

      transaction.objectStore(VERIFICATION_STORE).put(ownedRecord);

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

    return ownedRecord;
  } finally {
    database.close();
  }
}

export async function getVerificationRecord(documentId, ownerId) {
  if (!ownerId) return null;

  const database = await openDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        VERIFICATION_STORE,
        "readonly"
      );

      const request = transaction
        .objectStore(VERIFICATION_STORE)
        .get(documentId);

      request.onsuccess = () => {
        const record = request.result;

        resolve(record?.ownerId === ownerId ? record : null);
      };

      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

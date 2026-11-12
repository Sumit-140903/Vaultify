import { calculateFileHash } from "./utils/hashUtils";

import {
  connectWallet as connectWalletToSepolia,
  registerDocumentHash,
  getDocumentRecordFromChain,
} from "./utils/vaultifyContract";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  // Keep your existing icons
  UserRound,
} from "lucide-react";

import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Files,
  ShieldCheck,
  Bell,
  Settings,
  Search,
  Plus,
  Upload,
  Menu,
  X,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  FileText,
  FileImage,
  FileArchive,
  Clock3,
  CheckCircle2,
  CircleAlert,
  Shield,
  LockKeyhole,
  Fingerprint,
  Wallet,
  ArrowRight,
  Eye,
  Trash2,
  Download,
  Check,
  Activity,
  Database,
  Copy,
} from "lucide-react";
import "./Dashboard.css";

const initialRequests = [
  {
    id: "REQ-001",
    requester: "University Verification Office",
    email: "verification@example.edu",
    document: "University Marksheet",
    date: "Oct 24, 2026",
    status: "Pending",
  },
  {
    id: "REQ-002",
    requester: "Recruitment Team",
    email: "recruitment@example.com",
    document: "Internship Certificate",
    date: "Oct 23, 2026",
    status: "Pending",
  },
  {
    id: "REQ-003",
    requester: "Document Review Team",
    email: "review@example.org",
    document: "Aadhaar Card",
    date: "Oct 22, 2026",
    status: "Approved",
  },
];

const initialNotifications = [
  {
    id: 1,
    title: "Access request received",
    description: "University Verification Office requested access to your marksheet.",
    time: "12 minutes ago",
    unread: true,
    type: "request",
  },
  {
    id: 2,
    title: "Document ready",
    description: "Your Aadhaar Card is listed as verified in the demo.",
    time: "2 hours ago",
    unread: true,
    type: "verified",
  },
  {
    id: 3,
    title: "Welcome to Vaultify",
    description: "Explore your digital document dashboard.",
    time: "Yesterday",
    unread: false,
    type: "welcome",
  },
];

const navigation = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "My Documents", icon: Files },
  { label: "Verification", icon: ShieldCheck },
  { label: "Access Requests", icon: LockKeyhole },
  { label: "Notifications", icon: Bell },
];

function VaultifyMark() {
  return (
    <svg viewBox="0 0 64 72" fill="none" className="dash-logo">
      <defs>
        <linearGradient id="dashShieldGradient" x1="5" y1="3" x2="59" y2="68">
          <stop stopColor="#60E9FF" />
          <stop offset=".48" stopColor="#2678FF" />
          <stop offset="1" stopColor="#965BFF" />
        </linearGradient>
      </defs>
      <path
        d="M32 3 59 16 55 43 32 68 9 43 5 16 32 3Z"
        stroke="url(#dashShieldGradient)"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M15 19 32 28 49 19 32 48 15 19Z"
        fill="url(#dashShieldGradient)"
      />
      <path
        d="M32 28V61"
        stroke="#74DBFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconButton({ icon: Icon, label, onClick, className = "" }) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon size={18} />
    </button>
  );
}

function StatusBadge({ status }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`status-badge status-${normalized}`}>
      <span className="status-dot-small" />
      {status}
    </span>
  );
}

function DocumentIcon({ document }) {
  const Icon =
    document.icon === "image"
      ? FileImage
      : document.icon === "archive"
        ? FileArchive
        : FileText;

  return (
    <span className={`document-icon ${document.color}`}>
      <Icon size={23} />
    </span>
  );
}
function mapBackendDocument(record) {
  const originalName = record.originalName || record.name || "document";
  const sizeInBytes = Number(record.size) || 0;

  const fileExtension = originalName.includes(".")
    ? originalName.split(".").pop().toUpperCase()
    : "FILE";

  const formattedSize =
    sizeInBytes >= 1024 * 1024
      ? `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;

  const uploadedAt = new Date(record.createdAt || Date.now());

  return {
    id: record.id,
    name: originalName.replace(/\.[^/.]+$/, ""),
    category: record.category || "Other",
    type: fileExtension,
    size: formattedSize,
    date: uploadedAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    status: record.status || "Pending",
    icon: record.mimeType?.startsWith("image/") ? "image" : "file",
    color: "blue",
    hash: record.hash || "",
    mimeType: record.mimeType || "",
    originalFile: null,
    originalFileName: originalName,
    previewUrl: null,
    serverBacked: true,
  };
}

function App() {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [authContext] = useState(() => {
  const getContext = (storage) => {
    const token = storage.getItem("vaultifyToken");
    const savedUser = storage.getItem("vaultifyUser");

    if (!token || !savedUser) return null;

    try {
      const user = JSON.parse(savedUser);

      if (!user?.id) return null;

      return { token, user };
    } catch {
      return null;
    }
  };

  return (
    getContext(window.localStorage) ||
    getContext(window.sessionStorage) ||
    { token: null, user: null }
  );
});

const [verifiedUser, setVerifiedUser] = useState(null);
const currentUser = verifiedUser;
const authToken = authContext.token;

const [documents, setDocuments] = useState([]);

useEffect(() => {
  let cancelled = false;

  if (!authToken) {
    window.location.replace("/");
    return;
  }

  async function verifySession() {
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    try {
      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Your session is invalid or expired.");
      }

      const result = await response.json();

      if (!result.user?.id) {
        throw new Error("Invalid user profile.");
      }

      if (cancelled) return;

      setVerifiedUser(result.user);

      const storage =
        window.localStorage.getItem("vaultifyToken") === authToken
          ? window.localStorage
          : window.sessionStorage;

      storage.setItem("vaultifyUser", JSON.stringify(result.user));
    } catch (error) {
      console.error("Session verification failed:", error);

      if (cancelled) return;

      window.localStorage.removeItem("vaultifyToken");
      window.localStorage.removeItem("vaultifyUser");
      window.sessionStorage.removeItem("vaultifyToken");
      window.sessionStorage.removeItem("vaultifyUser");

      window.location.replace("/");
    }
  }

  verifySession();

  return () => {
    cancelled = true;
  };
}, [authToken]);
useEffect(() => {
  let cancelled = false;

  if (!currentUser?.id || !authToken) {
    return () => {
      cancelled = true;
    };
  }

  async function loadDocuments() {
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    try {
      const response = await fetch(`${apiBase}/api/documents`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to load your documents."
        );
      }

      const backendDocuments = Array.isArray(result.documents)
        ? result.documents.map(mapBackendDocument)
        : [];

      if (cancelled) return;

      setDocuments(backendDocuments);
    } catch (error) {
      console.error("Could not load backend documents:", error);

      if (!cancelled) {
        notify(error.message || "Could not load your documents.");
      }
    }
  }

  loadDocuments();

  return () => {
    cancelled = true;
  };
}, [currentUser?.id, authToken]);

  const [requests, setRequests] = useState(initialRequests);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedUploadCategory, setSelectedUploadCategory] =
  useState("Identity");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
 
const [walletAddress, setWalletAddress] = useState("");
const [walletChainId, setWalletChainId] = useState("");
const [walletBusy, setWalletBusy] = useState(false);

// Load the actual MetaMask connection, not just the saved wallet.
useEffect(() => {
  let cancelled = false;

  const userId = currentUser?.id;

  if (!userId) {
    return;
  }

  const connectionPreferenceKey = `vaultifyWalletConnection:${userId}`;

// Migrate an older disconnect preference, if one exists.
const oldDisconnectKey = `vaultifyWalletDisconnected:${userId}`;

if (
  localStorage.getItem(connectionPreferenceKey) === null &&
  sessionStorage.getItem(oldDisconnectKey) === "true"
) {
  localStorage.setItem(connectionPreferenceKey, "disconnected");
}

  async function syncWallet(accountsFromEvent, chainFromEvent) {
    // Respect a disconnect initiated inside Vaultify.
    if (
  localStorage.getItem(connectionPreferenceKey) === "disconnected"
) {
      if (!cancelled) {
        setWalletAddress("");
        setWalletChainId("");
      }
      return;
    }

    if (!window.ethereum) {
      if (!cancelled) {
        setWalletAddress("");
        setWalletChainId("");
      }
      return;
    }

    try {
      const accounts = Array.isArray(accountsFromEvent)
        ? accountsFromEvent
        : await window.ethereum.request({
            method: "eth_accounts",
          });

      const chainId =
        chainFromEvent ||
        await window.ethereum.request({
          method: "eth_chainId",
        });

      if (cancelled) return;

      // The first address is the account currently exposed first
      // by MetaMask to this website.
      setWalletAddress(accounts?.[0] || "");
      setWalletChainId(chainId || "");
    } catch (error) {
      console.error("MetaMask state detection failed:", error);

      if (!cancelled) {
        setWalletAddress("");
        setWalletChainId("");
      }
    }
  }

  const handleAccountsChanged = (accounts) => {
    syncWallet(accounts);
  };

  const handleChainChanged = (chainId) => {
    syncWallet(undefined, chainId);
  };

  syncWallet();

  window.ethereum?.on?.(
    "accountsChanged",
    handleAccountsChanged
  );

  window.ethereum?.on?.(
    "chainChanged",
    handleChainChanged
  );

  return () => {
    cancelled = true;

    window.ethereum?.removeListener?.(
      "accountsChanged",
      handleAccountsChanged
    );

    window.ethereum?.removeListener?.(
      "chainChanged",
      handleChainChanged
    );
  };
}, [currentUser?.id]);

// Persistent wallet association comes from the authenticated profile.
const associatedWalletAddress = currentUser?.walletAddress || "";

// A wallet is considered connected only when its account matches
// the saved association and the active network is Sepolia.
const isWalletConnected = Boolean(
  associatedWalletAddress &&
  walletAddress &&
  associatedWalletAddress.toLowerCase() === walletAddress.toLowerCase() &&
  walletChainId === "0xaa36a7"
);

const walletConnectionStatus = !associatedWalletAddress
  ? "Not associated"
  : !walletAddress
    ? "Disconnected"
    : associatedWalletAddress.toLowerCase() !== walletAddress.toLowerCase()
      ? "Wrong account"
      : walletChainId !== "0xaa36a7"
        ? "Wrong network"
        : "Connected";

  const [verificationDocument, setVerificationDocument] = useState("DOC-001");
  const [verificationResult, setVerificationResult] = useState(null);
  const [fileToVerify, setFileToVerify] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState([]);
const [historyLoading, setHistoryLoading] = useState(false);
const [historyError, setHistoryError] = useState("");
  

useEffect(() => {
  let cancelled = false;

  if (!currentUser?.id || !authToken) {
    return () => {
      cancelled = true;
    };
  }

  async function loadVerificationHistory() {
    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(
        `${apiBase}/api/verifications`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to load verification history."
        );
      }

      if (!cancelled) {
        setVerificationHistory(
          Array.isArray(result.verifications)
            ? result.verifications
            : []
        );
      }
    } catch (error) {
      console.error("Verification history loading failed:", error);

      if (!cancelled) {
        setHistoryError(error.message);
      }
    } finally {
      if (!cancelled) {
        setHistoryLoading(false);
      }
    }
  }

  loadVerificationHistory();

  return () => {
    cancelled = true;
  };
}, [currentUser?.id, authToken]);
  const fileInputRef = useRef(null);
  const unreadCount = notifications.filter((item) => item.unread).length;
  const pendingCount = requests.filter((item) => item.status === "Pending").length;
  const verifiedCount = documents.filter((item) => item.status === "Verified").length;

  
const filteredDocuments = useMemo(() => {
  return documents.filter((document) => {
    const matchesSearch =
      document.name.toLowerCase().includes(search.toLowerCase()) ||
      document.category.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filter === "All" || document.status === filter;

    const matchesCategory =
      categoryFilter === "All" ||
      document.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });
}, [documents, search, filter, categoryFilter]);


  function notify(message) {
    setToast(message);
  }

  function navigate(page) {
    setActivePage(page);
    setSidebarOpen(false);
    setSearch("");
    setFilter("All");
    setSelectedDocument(null);
    setVerificationResult(null);

    if (page === "Notifications") {
      setNotifications((current) =>
        current.map((item) => ({ ...item, unread: false }))
      );
    }
  }


function disconnectWallet() {
  if (!currentUser?.id) {
    notify("Please sign in again.");
    return;
  }

  const connectionPreferenceKey =
    `vaultifyWalletConnection:${currentUser.id}`;

  // Persist the disconnect preference across browser restarts.
  localStorage.setItem(
    connectionPreferenceKey,
    "disconnected"
  );

  // Clear only the active wallet connection.
  // Preserve the MongoDB association.
  setWalletAddress("");
  setWalletChainId("");
  setShowProfileMenu(false);
  setShowWalletMenu(false);

  notify(
    "Wallet disconnected from Vaultify. Your verified wallet association is preserved."
  );
}

async function connectWallet() {
  if (!authToken || !currentUser?.id) {
    notify("Please sign in to Vaultify first.");
    return;
  }

  if (!window.ethereum) {
    notify("MetaMask was not detected.");
    return;
  }

  try {
    setWalletBusy(true);

    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    // 1. Connect MetaMask and check the Sepolia network.
    const address = await connectWalletToSepolia();

    // Do not allow another wallet to replace an existing association.
    if (
      currentUser.walletAddress &&
      currentUser.walletAddress.toLowerCase() !==
        address.toLowerCase()
    ) {
      throw new Error(
        "This Vaultify account is already associated with another wallet. Switch MetaMask to the verified wallet."
      );
    }

    // 2. Request a signed-message challenge from our backend.
    const challengeResponse = await fetch(
      `${apiBase}/api/wallet/challenge`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          walletAddress: address,
        }),
      }
    );

    const challengeResult = await challengeResponse
      .json()
      .catch(() => ({}));

    if (!challengeResponse.ok) {
      throw new Error(
        challengeResult.message ||
          "Unable to create wallet verification challenge."
      );
    }

    // 3. Ask MetaMask to sign the exact backend-generated message.
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [
        challengeResult.challenge,
        address,
      ],
    });

    // 4. Confirm MetaMask still uses the same account and network.
    const currentAccounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    const currentChainId = await window.ethereum.request({
      method: "eth_chainId",
    });

    if (
      !currentAccounts.length ||
      currentAccounts[0].toLowerCase() !== address.toLowerCase()
    ) {
      throw new Error(
        "MetaMask account changed during verification. Please try again."
      );
    }

    if (Number(currentChainId) !== 11155111) {
      throw new Error(
        "Please switch MetaMask back to Ethereum Sepolia."
      );
    }

    // 5. Submit the signature for backend verification.
    const verifyResponse = await fetch(
      `${apiBase}/api/wallet/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          walletAddress: address,
          signature,
        }),
      }
    );

    const verifyResult = await verifyResponse
      .json()
      .catch(() => ({}));

    if (!verifyResponse.ok) {
      throw new Error(
        verifyResult.message ||
          "Wallet ownership verification failed."
      );
    }

    const verifiedAddress = verifyResult.walletAddress;

// Confirm the network after wallet verification.
const verifiedChainId = await window.ethereum.request({
  method: "eth_chainId",
});

if (BigInt(verifiedChainId) !== 11155111n) {
  throw new Error(
    "MetaMask network changed. Please switch to Ethereum Sepolia."
  );
}

// Update both live connection states.
// Persist connection preference for this Vaultify account.
const connectionPreferenceKey =
  `vaultifyWalletConnection:${currentUser.id}`;

localStorage.setItem(
  connectionPreferenceKey,
  "connected"
);

// Remove the old session-only disconnect preference.
sessionStorage.removeItem(
  `vaultifyWalletDisconnected:${currentUser.id}`
);

// Update live connection states.
setWalletAddress(verifiedAddress);
setWalletChainId(verifiedChainId);

// 6. Update the saved login profile.
    const updatedUser = {
      ...currentUser,
      walletAddress: verifiedAddress,
    };

    setVerifiedUser(updatedUser);

    const storage =
      window.localStorage.getItem("vaultifyToken") === authToken
        ? window.localStorage
        : window.sessionStorage;

    storage.setItem("vaultifyUser", JSON.stringify(updatedUser));

    notify("Wallet ownership verified and associated successfully.");

  } catch (error) {
    console.error("Wallet association failed:", error);

    notify(
      error.code === 4001
        ? "Wallet signature was cancelled."
        : error.message || "Unable to verify wallet ownership."
    );
  } finally {
    setWalletBusy(false);
  }
}


  




async function handleFileSelection(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";

  if (!files.length) return;

  if (!authToken || !currentUser?.id) {
    notify("Please sign in before uploading documents.");
    return;
  }

  const allowedTypes = new Set([
  // PDF
  "application/pdf",

  // Images
  "image/jpeg",
  "image/png",
  "image/webp",

  // Microsoft Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // Microsoft Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  // Microsoft PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Text documents
  "text/plain",
  "text/csv",
]);

  const accepted = files.filter((file) => {
    if (!allowedTypes.has(file.type)) {
      notify(
  `${file.name}: choose a supported PDF, image, Word, Excel, PowerPoint, CSV, or text file.`
);
      return false;
    }

    if (file.size === 0) {
      notify(`${file.name}: the file is empty.`);
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      notify(`${file.name}: file must be 10 MB or smaller.`);
      return false;
    }

    return true;
  });

  if (!accepted.length) return;

  setUploading(true);

  const additions = [];

  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  try {
    for (const file of accepted) {
      let uploadPathname = null;
      let completionRequestStarted = false;

      try {
        // Step 1: Request a short-lived, authenticated upload authorization.
        const intentResponse = await fetch(
          `${apiBase}/api/documents/upload-intents`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              originalName: file.name,
              mimeType: file.type,
              size: file.size,
              category: selectedUploadCategory,
              purpose: "document",
            }),
          }
        );

        const intentResult = await intentResponse.json().catch(() => ({}));

        if (!intentResponse.ok) {
          throw new Error(
            intentResult.message ||
              `Unable to authorize upload for ${file.name}.`
          );
        }

        const uploadUrl = intentResult.upload?.url;
        uploadPathname = intentResult.upload?.pathname;

        if (
          typeof uploadUrl !== "string" ||
          typeof uploadPathname !== "string"
        ) {
          throw new Error("The server returned an invalid upload authorization.");
        }

        // Step 2: Send the file directly to private Vercel Blob storage.
        const blobResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!blobResponse.ok) {
          throw new Error(
            `Storage upload failed for ${file.name}. Please try again.`
          );
        }

        // Step 3: Ask the backend to validate the stored bytes,
        // calculate SHA-256, and create the MongoDB document record.
        completionRequestStarted = true;

        const completionResponse = await fetch(
          `${apiBase}/api/documents/complete-upload`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pathname: uploadPathname,
            }),
          }
        );

        const result = await completionResponse.json().catch(() => ({}));

        if (!completionResponse.ok) {
          throw new Error(
            result.message || `Unable to complete upload for ${file.name}.`
          );
        }

        if (!result.document?.id) {
          throw new Error("The server returned an invalid document record.");
        }

        // Preserve the existing dashboard document format.
        const document = mapBackendDocument(result.document);

        // Retain immediate local preview and existing verification behaviour.
        document.originalFile = file;
        document.previewUrl = URL.createObjectURL(file);

        additions.push(document);
      } catch (fileError) {
        // Cancel only when completion has not started.
        // Once completion is sent, its outcome may be uncertain if
        // the network fails, so do not risk deleting a saved document.
        if (uploadPathname && !completionRequestStarted) {
          try {
            await fetch(`${apiBase}/api/documents/upload-intents`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                pathname: uploadPathname,
              }),
            });
          } catch (cleanupError) {
            console.error("Incomplete upload cleanup failed:", cleanupError);
          }
        }

        throw fileError;
      }
    }

    setDocuments((current) => [...additions, ...current]);
    setActivePage("My Documents");

    notify(
      `${additions.length} document(s) uploaded successfully to Vaultify.`
    );
  } catch (error) {
    console.error("Private Blob document upload failed:", error);

    // Preserve files that were successfully completed before a later
    // file in a multiple-file selection failed.
    if (additions.length > 0) {
      setDocuments((current) => [...additions, ...current]);
      setActivePage("My Documents");
    }

    notify(error.message || "Document upload failed.");
  } finally {
    setUploading(false);
  }
}




  function updateRequest(id, status) {
    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, status } : request
      )
    );

    setNotifications((current) => [
      {
        id: Date.now(),
        title: `Request ${status.toLowerCase()}`,
        description: `A document access request was ${status.toLowerCase()} in the demo.`,
        time: "Just now",
        unread: true,
        type: status === "Approved" ? "verified" : "request",
      },
      ...current,
    ]);

    notify(`Request ${status.toLowerCase()} in the demo.`);
  }

  


async function runVerification() {
  const document = documents.find(
    (item) => item.id === verificationDocument
  );

  if (!document) {
    setVerificationResult({
      success: false,
      message: "Choose the original document first.",
    });
    return;
  }

  if (!document.serverBacked) {
    setVerificationResult({
      success: false,
      message:
        "This document is not stored on the server. Please upload it again.",
    });
    return;
  }

  if (!authToken || !currentUser?.id) {
    setVerificationResult({
      success: false,
      message: "Please sign in again to verify this document.",
    });
    return;
  }

  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  let comparisonPathname = null;
  let comparisonCompletionStarted = false;

  try {

    let response;

    if (fileToVerify) {
      if (
        fileToVerify.size < 1 ||
        fileToVerify.size > 10 * 1024 * 1024
      ) {
        throw new Error("Comparison file must be greater than 0 and no larger than 10 MB.");
      }

      // Step 1: Authorize a temporary comparison upload for this document.
      const intentResponse = await fetch(
        `${apiBase}/api/documents/upload-intents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            originalName: fileToVerify.name,
            mimeType: fileToVerify.type,
            size: fileToVerify.size,
            purpose: "comparison",
            documentId: document.id,
          }),
        }
      );

      const intentResult = await intentResponse.json().catch(() => ({}));

      if (!intentResponse.ok) {
        throw new Error(
          intentResult.message || "Unable to authorize comparison upload."
        );
      }

      const uploadUrl = intentResult.upload?.url;
      comparisonPathname = intentResult.upload?.pathname;

      if (
        typeof uploadUrl !== "string" ||
        typeof comparisonPathname !== "string"
      ) {
        throw new Error("The server returned an invalid comparison upload authorization.");
      }

      // Step 2: Upload comparison bytes directly to private Blob storage.
      const blobResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": fileToVerify.type,
        },
        body: fileToVerify,
      });

      if (!blobResponse.ok) {
        throw new Error("Comparison file upload failed. Please try again.");
      }

      // Step 3: Backend retrieves, validates, hashes, records and deletes it.
      comparisonCompletionStarted = true;

      response = await fetch(
        `${apiBase}/api/verifications/${encodeURIComponent(
          document.id
        )}/verify-blob`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pathname: comparisonPathname,
          }),
        }
      );
    } else {
      // No comparison file: verify the original document already in storage.
      response = await fetch(
        `${apiBase}/api/verifications/${encodeURIComponent(
          document.id
        )}/verify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message || "Unable to verify the document."
      );
    }

    const verification = result.verification;

    if (!verification) {
      throw new Error("Invalid verification response from server.");
    }

    setVerificationHistory((current) => [
      {
        ...verification,
        message: result.message || verification.message,
      },
      ...current.filter(
        (item) => item.id !== verification.id
      ),
    ].slice(0, 100));

    // Update document status only when the stored original was verified.
    if (verification.source === "stored" && result.document) {
      const updatedDocument = {
        ...document,
        status: result.document.status,
      };

      setDocuments((current) =>
        current.map((item) =>
          item.id === document.id ? updatedDocument : item
        )
      );
    }

    setVerificationResult({
      success: verification.success,
      message: result.message || verification.message,
      hash: verification.calculatedHash,
      storedHash: verification.storedHash,
      verifiedAt: verification.verifiedAt,
    });

    notify(
      verification.success
        ? "Integrity check passed."
        : "Integrity check failed: hash mismatch."
    );
  } catch (error) {
    console.error("Verification failed:", error);

    // Cancel a comparison upload only if completion was never submitted.
    if (comparisonPathname && !comparisonCompletionStarted) {
      try {
        await fetch(`${apiBase}/api/documents/upload-intents`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pathname: comparisonPathname,
          }),
        });
      } catch (cleanupError) {
        console.error("Comparison upload cleanup failed:", cleanupError);
      }
    }

    setVerificationResult({
      success: false,
      message: error.message || "Verification failed. Please try again.",
    });
  }
}

async function removeDocument(id) {
  const documentToRemove = documents.find(
    (document) => document.id === id
  );

  if (!documentToRemove) {
    notify("Document not found.");
    return;
  }

  if (!authToken || !currentUser?.id) {
    notify("Please sign in again before deleting documents.");
    return;
  }

  if (!documentToRemove.serverBacked) {
    notify("This document is not stored in backend storage.");
    return;
  }

  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(
      `${apiBase}/api/documents/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message || "Unable to delete the document."
      );
    }

    // Remove the temporary browser preview URL, if one exists.
    if (documentToRemove.previewUrl) {
      URL.revokeObjectURL(documentToRemove.previewUrl);
    }

    // Update the dashboard only after backend deletion succeeds.
    setDocuments((current) =>
      current.filter((document) => document.id !== id)
    );

    setSelectedDocument(null);

    notify(result.message || "Document deleted successfully.");
  } catch (error) {
    console.error("Backend document deletion failed:", error);

    notify(error.message || "Could not delete the document.");
  }
}




  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      notify("Copied to clipboard.");
    } catch {
      notify("Clipboard access is unavailable in this browser.");
    }
  }

// Ensure blockchain operations use the wallet verified for this Vaultify account.
async function assertAssociatedWalletSelected() {
  const associatedWallet = currentUser?.walletAddress;

  if (!associatedWallet) {
    throw new Error(
      "Associate and verify a MetaMask wallet with your Vaultify account first."
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(associatedWallet)) {
    throw new Error("The saved wallet address is invalid.");
  }

  if (!window.ethereum) {
    throw new Error("MetaMask is not available.");
  }

  const [accounts, chainId] = await Promise.all([
    window.ethereum.request({ method: "eth_accounts" }),
    window.ethereum.request({ method: "eth_chainId" }),
  ]);

  if (!accounts?.length) {
    throw new Error("Connect your verified MetaMask wallet first.");
  }

  if (
    accounts[0].toLowerCase() !== associatedWallet.toLowerCase()
  ) {
    throw new Error(
      "Your selected MetaMask account does not match your verified Vaultify wallet."
    );
  }

  if (Number(chainId) !== 11155111) {
    throw new Error("Please switch MetaMask to Ethereum Sepolia.");
  }

  return associatedWallet;
}


async function handleRegisterOnBlockchain() {
  try {
    const associatedWallet = await assertAssociatedWalletSelected();

    const document = documents.find(
      (item) => item.id === verificationDocument
    );

    if (!document) {
      notify("Select a document first.");
      return;
    }

    if (!document.serverBacked) {
      notify("This document has not been uploaded to backend storage.");
      return;
    }

    if (!/^[a-f0-9]{64}$/i.test(document.hash || "")) {
      notify("The document does not have a valid SHA-256 hash.");
      return;
    }

    setWalletBusy(true);

    const txHash = await registerDocumentHash(
      document.id,
      document.hash,
      associatedWallet
    );

    notify(`Registered on Sepolia. Transaction: ${txHash}`);
  } catch (error) {
    console.error("Blockchain registration failed:", error);

    notify(
      error.reason ||
      error.shortMessage ||
      error.message ||
      "Blockchain registration failed."
    );
  } finally {
    setWalletBusy(false);
  }
}





async function runOnChainVerification() {
  const document = documents.find(
    (item) => item.id === verificationDocument
  );

  

  if (!document) {
    notify("Select a document first.");
    return;
  }

  if (!document.serverBacked && !document.originalFile) {
    notify("Select a real uploaded document.");
    return;
  }

  if (!authToken) {
    notify("Your session has expired. Please sign in again.");
    return;
  }

  try {
  setWalletBusy(true);

  // Allow MetaMask state detection again for this user.
  sessionStorage.removeItem(
    `vaultifyWalletDisconnected:${currentUser.id}`
  );

  await assertAssociatedWalletSelected();

    let fileToCheck = fileToVerify;

    // Retrieve the original file from private backend storage
    // when the user hasn't selected an external comparison file.
    if (!fileToCheck && document.serverBacked) {
      const apiBase = (
        import.meta.env.VITE_API_URL || "http://localhost:3000"
      ).replace(/\/+$/, "");

      const response = await fetch(
        `${apiBase}/api/documents/${encodeURIComponent(document.id)}/download`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));

        throw new Error(
          result.message || "Unable to retrieve the original document."
        );
      }

      const blob = await response.blob();

      fileToCheck = new File(
        [blob],
        document.originalFileName || document.name,
        {
          type: document.mimeType || blob.type,
        }
      );
    }

    // Support older browser-stored documents during migration.
    if (!fileToCheck) {
      fileToCheck = document.originalFile;
    }

    if (!fileToCheck) {
      notify("Unable to retrieve the document for verification.");
      return;
    }

    // Calculate SHA-256 from the actual document bytes.
    const currentHash = await calculateFileHash(fileToCheck);

    // Retrieve the registered hash from the Sepolia contract.
    const record = await getDocumentRecordFromChain(document.id);

    const registeredHash = String(
      record.documentHash || ""
    ).replace(/^0x/i, "").toLowerCase();

    const matches =
      record.exists &&
      registeredHash === currentHash.toLowerCase();

    const verifiedAt = new Date().toISOString();

    const message = !record.exists
      ? "This document ID is not registered on Sepolia."
      : matches
        ? "On-chain integrity check passed. The file hash matches the registered hash."
        : "On-chain integrity check failed. The file hash does not match the registered hash.";

    setVerificationResult({
      success: matches,
      message,
      hash: currentHash,
      storedHash: record.exists
        ? record.documentHash
        : "No registered hash found",
      verifiedAt,
    });

    notify(
      matches
        ? "On-chain verification passed."
        : "On-chain verification failed."
    );
  } catch (error) {
    console.error("On-chain verification failed:", error);

    notify(
      error.reason ||
      error.shortMessage ||
      error.message ||
      "On-chain verification failed."
    );
  } finally {
    setWalletBusy(false);
  }
}



  function renderOverview() {
    return (
      <>
        <div className="welcome-row">
          <div>
            <p className="eyebrow-dash">YOUR PERSONAL VAULT</p>
            <h1>Welcome back<span className="heading-dot">.</span></h1>
            <p className="muted">
              Here's what's happening with your documents today.
            </p>
          </div>

          <button
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Plus size={18} />
            {uploading ? "Adding files..." : "Upload document"}
          </button>
        </div>

        <div className="stats-grid">
          <StatCard
            title="Total documents"
            value={documents.length}
            note="In your document list"
            icon={Files}
            color="blue"
            trend="+2 this week"
            trendIcon={ArrowUpRight}
          />

          <StatCard
            title="Verified documents"
            value={verifiedCount}
            note="Marked verified in demo"
            icon={ShieldCheck}
            color="green"
            trend="Integrity status"
            trendIcon={CheckCircle2}
          />

          <StatCard
            title="Pending requests"
            value={pendingCount}
            note="Awaiting your decision"
            icon={Clock3}
            color="orange"
            trend="Needs attention"
            trendIcon={ArrowDownRight}
          />

          <StatCard
            title="Wallet status"
            value={walletAddress ? "Connected" : "Not connected"}
            note={
              walletAddress
                ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
                : "Connect MetaMask"
            }
            icon={Wallet}
            color="purple"
            trend={walletAddress ? "Account detected" : "Optional"}
            trendIcon={Shield}
            compact
          />
        </div>

        <div className="overview-grid">
          <section className="content-card documents-card">
            <div className="section-heading">
              <div>
                <h2>Recent documents</h2>
                <p>Your latest document activity</p>
              </div>
              <button
                className="text-link"
                onClick={() => navigate("My Documents")}
              >
                View all <ArrowRight size={15} />
              </button>
            </div>

            <div className="recent-list">
              {documents.slice(0, 4).map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  onClick={() => setSelectedDocument(document)}
                />
              ))}
            </div>
          </section>

          <section className="content-card activity-card">
            <div className="section-heading">
              <div>
                <h2>Recent activity</h2>
                <p>Updates from your vault</p>
              </div>
              <Activity size={19} className="subtle-icon" />
            </div>

            <div className="activity-list">
              <ActivityItem
                icon={Upload}
                title="Document workspace ready"
                description="Upload a file to start exploring."
                time="Today"
                color="blue"
              />
              <ActivityItem
                icon={ShieldCheck}
                title="Verification preview available"
                description="Try the verification simulation."
                time="Today"
                color="green"
              />
              <ActivityItem
                icon={LockKeyhole}
                title="Access requests"
                description={`${pendingCount} request(s) awaiting review.`}
                time="Today"
                color="purple"
              />
            </div>
          </section>
        </div>

        <section className="content-card quick-actions">
          <div className="section-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Jump into your most-used tools</p>
            </div>
          </div>

          <div className="quick-grid">
            <QuickAction
              icon={Upload}
              title="Upload a document"
              description="Add a PDF or image"
              onClick={() => fileInputRef.current?.click()}
            />
            <QuickAction
              icon={ShieldCheck}
              title="Verify a document"
              description="Explore the verification UI"
              onClick={() => navigate("Verification")}
            />
            <QuickAction
              icon={LockKeyhole}
              title="Review requests"
              description={`${pendingCount} pending`}
              onClick={() => navigate("Access Requests")}
            />
          </div>
        </section>
      </>
    );
  }

  

function renderDocuments() {
  return (
    <>
      <PageHeading
        eyebrow="DOCUMENT MANAGEMENT"
        title="My Documents"
        description="Organize your digital records in one place."
        action={
          <button
            className="primary-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload size={17} />
            {uploading ? "Adding files..." : "Upload document"}
          </button>
        }
      />

      <section className="content-card">
        <div className="document-toolbar">
          {/* Search documents */}
          <label className="search-box">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
            />
          </label>

          {/* Select category for new uploads */}
          <select
            className="filter-select"
            value={selectedUploadCategory}
            onChange={(event) =>
              setSelectedUploadCategory(event.target.value)
            }
            aria-label="Choose category for new uploads"
          >
            <option value="Identity">Upload as: Identity</option>
            <option value="Education">Upload as: Education</option>
            <option value="Finance">Upload as: Finance</option>
            <option value="Medical">Upload as: Medical</option>
            <option value="Other">Upload as: Other</option>
          </select>

          {/* Filter by verification status */}
          <select
            className="filter-select"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label="Filter documents by status"
          >
            <option value="All">All statuses</option>
            <option value="Verified">Verified</option>
            <option value="Pending">Pending</option>
          </select>

          {/* Filter existing documents by category */}
          <select
            className="filter-select"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filter documents by category"
          >
            <option value="All">All categories</option>
            <option value="Identity">Identity</option>
            <option value="Education">Education</option>
            <option value="Finance">Finance</option>
            <option value="Medical">Medical</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Document cards */}
        {filteredDocuments.length > 0 ? (
          <div className="document-grid">
            {filteredDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onOpen={() => setSelectedDocument(document)}
                onRemove={() => removeDocument(document.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Files}
            title="No documents found"
            description="Try changing your search, status, or category filter."
          />
        )}

        <p className="demo-notice">
          <CircleAlert size={15} />
          Demo only: files are held in browser memory and are not
          uploaded to a server or IPFS.
        </p>
      </section>
    </>
  );
}



  
function renderVerification() {
  return (
    <>
      <PageHeading
        eyebrow="DOCUMENT INTEGRITY"
        title="Verification Center"
        description="Verify a document against its original stored SHA-256 hash."
      />

      <div className="verification-layout">
        <section className="content-card verify-form">
          <div className="verify-icon">
            <Fingerprint size={30} />
          </div>

          <h2>Verify a document</h2>
          <p className="muted">
            Select an original Vaultify document, then optionally choose
            a file from your Mac to compare against its stored hash.
          </p>

          <label className="field-label" htmlFor="verify-document">
            Select original document
          </label>

          <select
            id="verify-document"
            className="full-select"
            value={verificationDocument}
            onChange={(event) => {
              setVerificationDocument(event.target.value);
              setVerificationResult(null);
              setFileToVerify(null);
            }}
          >
            <option value="">Choose an original document</option>

            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.name}
              </option>
            ))}
          </select>

          <div className="verify-file-picker" style={{ marginTop: 18 }}>
            <label
              className="field-label"
              htmlFor="file-to-verify"
            >
              Choose file to verify (optional)
            </label>

            <input
              id="file-to-verify"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
              onChange={(event) => {
                setFileToVerify(event.target.files?.[0] || null);
                setVerificationResult(null);
              }}
            />

            <p className="muted" style={{ fontSize: 13 }}>
              Leave this empty to verify the original uploaded file.
              Choose a modified copy to test for tampering.
            </p>

            {fileToVerify && (
              <p style={{ overflowWrap: "anywhere" }}>
                Selected file: <strong>{fileToVerify.name}</strong>
              </p>
            )}
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            
<button
  type="button"
  className="secondary-button full-button"
  onClick={connectWallet}
  disabled={walletBusy}
>
  <Wallet size={18} />
  {walletBusy
    ? "Please wait..."
    : isWalletConnected
      ? `Connected: ${associatedWalletAddress.slice(0, 6)}...${associatedWalletAddress.slice(-4)}`
      : associatedWalletAddress
        ? walletConnectionStatus
        : "Connect MetaMask to Sepolia"}
</button>

<button
  type="button"
  className="primary-button full-button"
  onClick={handleRegisterOnBlockchain}
  disabled={
    walletBusy ||
    !isWalletConnected ||
    !verificationDocument
  }
>
  <Database size={18} />
  Register document hash on blockchain
</button>

<button
  type="button"
  className="secondary-button full-button"
  onClick={runOnChainVerification}
  disabled={
    walletBusy ||
    !isWalletConnected ||
    !verificationDocument
  }
>
  <ShieldCheck size={18} />
  Verify against blockchain
</button>

          </div>

          <button
            className="primary-button full-button"
            onClick={runVerification}
            disabled={!documents.length || !verificationDocument}
            style={{ marginTop: 18 }}
          >
            <ShieldCheck size={18} />
            Verify document integrity
          </button>

          {verificationResult && (
            <motion.div
              className={`verification-result ${
                verificationResult.success ? "success" : "error"
              }`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {verificationResult.success ? (
                <CheckCircle2 size={20} />
              ) : (
                <CircleAlert size={20} />
              )}

              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>
                  {verificationResult.success
                    ? "Integrity check passed"
                    : "Integrity check failed"}
                </strong>

                <p>{verificationResult.message}</p>

                {verificationResult.hash && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Calculated file hash</strong>
                    <code
                      style={{
                        display: "block",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        marginTop: 6,
                      }}
                    >
                      {verificationResult.hash}
                    </code>
                  </div>
                )}

                {verificationResult.storedHash && (
                  <div style={{ marginTop: 12 }}>
                    <strong>Original stored hash</strong>
                    <code
                      style={{
                        display: "block",
                        overflowWrap: "anywhere",
                        wordBreak: "break-word",
                        marginTop: 6,
                      }}
                    >
                      {verificationResult.storedHash}
                    </code>
                  </div>
                )}

                {verificationResult.verifiedAt && (
                  <p style={{ marginTop: 10, fontSize: 12 }}>
                    Checked at:{" "}
                    {new Date(
                      verificationResult.verifiedAt
                    ).toLocaleString()}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <h2>Verification History</h2>
              <p>Your document integrity checks stored securely in Vaultify</p>
            </div>

            <span className="muted">
              {verificationHistory.length} records
            </span>
          </div>

          {historyLoading ? (
            <p className="muted" style={{ marginTop: 18 }}>
              Loading verification history...
            </p>
          ) : historyError ? (
            <p style={{ color: "#dc2626", marginTop: 18 }}>
              {historyError}
            </p>
          ) : verificationHistory.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 18 }}>
              <ShieldCheck size={30} />
              <p>No verification records yet.</p>
              <span className="muted">
                Your completed document checks will appear here.
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 18,
              }}
            >
              {verificationHistory.map((record) => (
                <div
                  key={record.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      color: record.success ? "#16a34a" : "#dc2626",
                      flexShrink: 0,
                    }}
                  >
                    {record.success ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <CircleAlert size={24} />
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <strong style={{ overflowWrap: "anywhere" }}>
                        {record.documentName}
                      </strong>

                      <strong
                        style={{
                          color: record.success ? "#16a34a" : "#dc2626",
                          fontSize: 13,
                        }}
                      >
                        {record.success ? "PASSED" : "FAILED"}
                      </strong>
                    </div>

                    <p
                      className="muted"
                      style={{ fontSize: 13, marginTop: 7 }}
                    >
                      {record.source === "comparison"
                        ? "Comparison file"
                        : "Original stored file"}
                    </p>

                    <p style={{ fontSize: 13, marginTop: 7 }}>
                      {record.message}
                    </p>

                    <p
                      className="muted"
                      style={{ fontSize: 12, marginTop: 8 }}
                    >
                      {record.verifiedAt
                        ? new Date(record.verifiedAt).toLocaleString()
                        : "Date unavailable"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

              <h2>Verification workflow</h2>
              <p>How Vaultify checks document integrity</p>
            </div>
          </div>

          <div className="workflow-list">
            <WorkflowStep
              number="01"
              title="Select the original document"
              description="Choose the Vaultify record containing the reference hash."
              icon={Files}
            />

            <WorkflowStep
              number="02"
              title="Choose a file to test"
              description="Use the original file or select a copy from your Mac."
              icon={Fingerprint}
            />

            <WorkflowStep
              number="03"
              title="Calculate and compare hashes"
              description="Vaultify calculates SHA-256 and compares it with the original stored hash."
              icon={Database}
            />

            <WorkflowStep
              number="04"
              title="Display the result"
              description="Matching hashes pass; different hashes fail."
              icon={ShieldCheck}
            />
          </div>

          <p className="demo-notice">
  <ShieldCheck size={15} />
  Document integrity verification is performed by the Vaultify backend
  using the original SHA-256 hash stored in MongoDB. Blockchain verification
  separately checks the document hash registered on Sepolia.
</p>
        </section>
      </div>
    </>
  );
}


  function renderRequests() {
    return (
      <>
        <PageHeading
          eyebrow="PERMISSIONS"
          title="Access Requests"
          description="Review simulated requests to access your documents."
        />

        <section className="content-card">
          <div className="section-heading">
            <div>
              <h2>Incoming requests</h2>
              <p>{pendingCount} requests need your attention</p>
            </div>
          </div>

          <div className="request-list">
            {requests.map((request) => (
              <div className="request-item" key={request.id}>
                <div className="request-avatar">
                  <ShieldCheck size={22} />
                </div>

                <div className="request-main">
                  <strong>{request.requester}</strong>
                  <span>{request.email}</span>
                  <p>
                    Requested access to <b>{request.document}</b>
                  </p>
                  <small>{request.date}</small>
                </div>

                <div className="request-actions">
                  <StatusBadge status={request.status} />

                  {request.status === "Pending" && (
                    <div className="request-buttons">
                      <button
                        className="approve-button"
                        onClick={() => updateRequest(request.id, "Approved")}
                      >
                        <Check size={15} /> Approve
                      </button>
                      <button
                        className="reject-button"
                        onClick={() => updateRequest(request.id, "Rejected")}
                      >
                        <X size={15} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!requests.length && (
              <EmptyState
                icon={LockKeyhole}
                title="No access requests"
                description="New requests will appear here in this demo."
              />
            )}
          </div>

          <p className="demo-notice">
            <CircleAlert size={15} />
            Approvals change only the local demo state. They do not grant or revoke real permissions.
          </p>
        </section>
      </>
    );
  }

  function renderNotifications() {
    return (
      <>
        <PageHeading
          eyebrow="ACTIVITY CENTER"
          title="Notifications"
          description="Updates and events from your Vaultify demo."
          action={
            <button
              className="secondary-button"
              onClick={() =>
                setNotifications((current) =>
                  current.map((item) => ({ ...item, unread: false }))
                )
              }
            >
              Mark all as read
            </button>
          }
        />

        <section className="content-card notification-list">
          {notifications.map((item) => (
            <div
              className={`notification-item ${item.unread ? "unread" : ""}`}
              key={item.id}
            >
              <div className={`notification-icon ${item.type}`}>
                {item.type === "verified" ? (
                  <CheckCircle2 size={20} />
                ) : item.type === "request" ? (
                  <LockKeyhole size={20} />
                ) : (
                  <ShieldCheck size={20} />
                )}
              </div>

              <div className="notification-content">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <small>{item.time}</small>
              </div>

              {item.unread && <span className="unread-dot" />}
            </div>
          ))}

          {!notifications.length && (
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="There are no notifications to display."
            />
          )}
        </section>
      </>
    );
  }

  function renderSettings() {
    return (
      <>
        <PageHeading
          eyebrow="PREFERENCES"
          title="Settings"
          description="Review your local demo profile and wallet connection."
        />

        <section className="content-card settings-card">
          <div className="settings-section">
            <div className="settings-icon"><UserRound /></div>
            <div className="settings-main">
              <h3>Profile</h3>
              <p>{currentUser?.email || "Account"}</p>
              <span className="settings-value">
  {currentUser?.name || "Vaultify User"}
</span>
            </div>
          </div>

         
<div className="settings-section">
  <div className="settings-icon">
    <Wallet />
  </div>

  <div className="settings-main">
    <h3>MetaMask wallet</h3>
    <p>Manage your verified Vaultify wallet connection.</p>

    {associatedWalletAddress ? (
      <>
        <code>{associatedWalletAddress}</code>
        <span className="settings-value">
          Wallet status: {walletConnectionStatus}
        </span>
      </>
    ) : (
      <span className="settings-value">
        No wallet associated with this account.
      </span>
    )}
  </div>

  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    <button
      type="button"
      className="secondary-button"
      onClick={connectWallet}
      disabled={walletBusy}
    >
      {walletBusy
        ? "Please wait..."
        : isWalletConnected
          ? "Reconnect wallet"
          : associatedWalletAddress
            ? "Connect associated wallet"
            : "Connect & verify wallet"}
    </button>

    {isWalletConnected && (
      <button
        type="button"
        className="secondary-button"
        onClick={disconnectWallet}
        disabled={walletBusy}
      >
        Disconnect
      </button>
    )}
  </div>
</div>


          <div className="settings-section">
            <div className="settings-icon"><ShieldCheck /></div>
            <div className="settings-main">
              <h3>Security status</h3>
              <p>Backend authentication and blockchain checks are not configured.</p>
              <span className="settings-value">Frontend demo</span>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <div className="dashboard-app">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <VaultifyMark />
          <span>Vault<span className="brand-accent">ify</span></span>
          <button
            className="mobile-close"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                className={`nav-item ${
                  activePage === item.label ? "nav-active" : ""
                }`}
                onClick={() => navigate(item.label)}
              >
                <Icon size={19} />
                <span>{item.label}</span>

                {item.label === "Notifications" && unreadCount > 0 && (
                  <span className="nav-count">{unreadCount}</span>
                )}

                {item.label === "Access Requests" && pendingCount > 0 && (
                  <span className="nav-count">{pendingCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="network-card">
            <div className="network-heading">
              <span className="network-dot" />
              <span>DEMO ENVIRONMENT</span>
            </div>
            <p>Frontend workspace</p>
            <small>Sepolia testnet transactions available.</small>
          </div>

          <button
            className={`nav-item ${activePage === "Settings" ? "nav-active" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>

          <div className="sidebar-user">
            <div className="user-avatar">
  {(currentUser?.name || "VU")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()}
</div>
            <div className="user-details">
              <strong>{currentUser?.name || "Vaultify User"}</strong>
              <small>Personal workspace</small>
            </div>
            <button
              className="profile-menu-button"
              aria-label="Open profile menu"
              onClick={() => {
  setShowProfileMenu((current) => !current);
  setShowWalletMenu(false);
}}
            >
              <MoreHorizontal size={20} />
            </button>

            {showProfileMenu && (
              <div className="profile-popover">
                <button onClick={() => navigate("Settings")}>
                  <Settings size={15} /> Settings
                </button>
                {isWalletConnected && (
  <button onClick={disconnectWallet}>
    <Wallet size={15} /> Disconnect from Vaultify
  </button>
)}
                <button
  onClick={() => {
    window.localStorage.removeItem("vaultifyToken");
    window.localStorage.removeItem("vaultifyUser");
    window.sessionStorage.removeItem("vaultifyToken");
    window.sessionStorage.removeItem("vaultifyUser");

    setWalletAddress("");
    setShowProfileMenu(false);

    window.location.replace("/");
  }}
>
  Sign out
</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">
            <label className="global-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (activePage !== "My Documents") {
                    setActivePage("My Documents");
                  }
                }}
                placeholder="Search documents..."
                aria-label="Search documents"
              />
              <kbd>⌘ K</kbd>
            </label>

            <IconButton
              icon={Bell}
              label={`Notifications (${unreadCount} unread)`}
              onClick={() => navigate("Notifications")}
              className="notification-trigger"
            />

            {unreadCount > 0 && (
              <span className="topbar-notification-dot" />
            )}

            <div className="topbar-divider" />

            <div className="wallet-menu-wrap">
  <button
    type="button"
    className="wallet-connect-button"
    aria-haspopup="true"
    aria-expanded={showWalletMenu}
    onClick={() => {
      if (isWalletConnected) {
        setShowProfileMenu(false);
        setShowWalletMenu((current) => !current);
      } else {
        setShowWalletMenu(false);
        connectWallet();
      }
    }}
    disabled={walletBusy}
  >
    <Wallet size={16} />
    {walletBusy
      ? "Connecting..."
      : isWalletConnected
        ? `${associatedWalletAddress.slice(0, 6)}...${associatedWalletAddress.slice(-4)}`
        : associatedWalletAddress
          ? "Reconnect wallet"
          : "Connect wallet"}
  </button>

  {showWalletMenu && (
    <div className="wallet-popover" role="dialog" aria-label="Wallet details">
      <div className="wallet-popover-heading">
        <strong>Wallet details</strong>
        <span className={isWalletConnected ? "wallet-status-connected" : "wallet-status-disconnected"}>
          {walletConnectionStatus}
        </span>
      </div>

      <div className="wallet-detail-group">
        <span className="wallet-detail-label">Associated wallet</span>
        <strong className="wallet-address-value">
          {associatedWalletAddress || "No wallet associated"}
        </strong>
      </div>

      <button
        type="button"
        className="wallet-copy-button"
        disabled={!associatedWalletAddress}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(associatedWalletAddress);
            notify("Wallet address copied.");
          } catch (error) {
            notify("Unable to copy wallet address.");
          }
        }}
      >
        Copy wallet address
      </button>

      <div className="wallet-detail-group">
        <span className="wallet-detail-label">Network</span>
        <strong>
          {walletChainId === "0xaa36a7"
            ? "Ethereum Sepolia Testnet"
            : walletChainId
              ? `Unsupported network (${walletChainId})`
              : "Not connected"}
        </strong>
      </div>

      {isWalletConnected && (
        <button
          type="button"
          className="wallet-disconnect-button"
          onClick={disconnectWallet}
        >
          <Wallet size={15} />
          Disconnect from Vaultify
        </button>
      )}

      <button
        type="button"
        className="wallet-close-button"
        onClick={() => setShowWalletMenu(false)}
      >
        Close
      </button>
    </div>
  )}
</div>
          </div>
        </header>

        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
          multiple
          onChange={handleFileSelection}
        />

        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              className="page-transition"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
            >
              {activePage === "Overview" && renderOverview()}
              {activePage === "My Documents" && renderDocuments()}
              {activePage === "Verification" && renderVerification()}
              {activePage === "Access Requests" && renderRequests()}
              {activePage === "Notifications" && renderNotifications()}
              {activePage === "Settings" && renderSettings()}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="dashboard-footer">
          <span>© 2026 Vaultify</span>
          <span><ShieldCheck size={14} /> Vaultify · Sepolia blockchain integration</span>
        </footer>
      </main>

      <AnimatePresence>
        {selectedDocument && (
          <DocumentModal
            key={selectedDocument.id}
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
            onCopy={() => copyText(selectedDocument.hash)}
            onRemove={() => removeDocument(selectedDocument.id)}
            authToken={authToken}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <CheckCircle2 size={18} />
            <span>{toast}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setToast("")}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({
  title,
  value,
  note,
  icon: Icon,
  color,
  trend,
  trendIcon: TrendIcon,
  compact = false,
}) {
  return (
    <motion.section
      className="stat-card"
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
    >
      <div className="stat-top">
        <span className={`stat-icon ${color}`}>
          <Icon size={21} />
        </span>
        <MoreHorizontal size={19} className="subtle-icon" />
      </div>

      <p className="stat-title">{title}</p>

      <div className={`stat-value ${compact ? "compact-value" : ""}`}>
        {value}
      </div>

      <div className="stat-bottom">
        <span className={`stat-trend ${color}`}>
          <TrendIcon size={14} />
          {trend}
        </span>
        <span className="stat-note">{note}</span>
      </div>
    </motion.section>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow-dash">{eyebrow}</p>
        <h1>{title}<span className="heading-dot">.</span></h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function DocumentRow({ document, onClick }) {
  return (
    <button className="document-row" onClick={onClick}>
      <DocumentIcon document={document} />

      <span className="document-row-main">
        <strong>{document.name}</strong>
        <small>{document.category} · {document.size}</small>
      </span>

      <StatusBadge status={document.status} />
      <ArrowUpRight size={17} className="row-arrow" />
    </button>
  );
}

function DocumentCard({ document, onOpen, onRemove }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.article
      className="document-card"
      layout
      whileHover={{ y: -3 }}
    >
      <div className="document-card-top">
        <DocumentIcon document={document} />

        <div className="document-menu-wrap">
          <button
            className="icon-button"
            aria-label={`More actions for ${document.name}`}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <MoreHorizontal size={19} />
          </button>

          {menuOpen && (
            <div className="document-popover">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpen();
                }}
              >
                <Eye size={15} /> View details
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onRemove();
                }}
              >
                <Trash2 size={15} /> Remove from demo
              </button>
            </div>
          )}
        </div>
      </div>

      <button className="document-card-title" onClick={onOpen}>
        {document.name}
      </button>

      <p className="document-category">{document.category}</p>

      <div className="document-card-meta">
        <span>{document.type}</span>
        <span>{document.size}</span>
      </div>

      <div className="document-card-footer">
        <StatusBadge status={document.status} />
        <button
          className="open-document-button"
          aria-label={`Open ${document.name}`}
          onClick={onOpen}
        >
          <ArrowUpRight size={17} />
        </button>
      </div>
    </motion.article>
  );
}

function ActivityItem({ icon: Icon, title, description, time, color }) {
  return (
    <div className="activity-item">
      <span className={`activity-icon ${color}`}>
        <Icon size={17} />
      </span>

      <div className="activity-copy">
        <strong>{title}</strong>
        <p>{description}</p>
        <small>{time}</small>
      </div>
    </div>
  );
}

function QuickAction({ icon: Icon, title, description, onClick }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span className="quick-action-icon"><Icon size={21} /></span>
      <span className="quick-action-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ArrowRight size={17} className="quick-arrow" />
    </button>
  );
}

function WorkflowStep({ number, title, description, icon: Icon }) {
  return (
    <div className="workflow-step">
      <span className="workflow-number">{number}</span>
      <span className="workflow-icon"><Icon size={19} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="empty-state">
      <span><Icon size={26} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}


function DocumentModal({
  document,
  onClose,
  onCopy,
  onRemove,
  authToken,
}) {

const [previewUrl, setPreviewUrl] = useState(() =>
  document.serverBacked ? null : document.previewUrl || null
);
const [previewLoading, setPreviewLoading] = useState(false);
const [previewError, setPreviewError] = useState("");

useEffect(() => {
  let active = true;
  let createdUrl = null;

  // Older browser-stored documents already have their preview URL
  // in the initial state. No fetch is required for those documents.
  if (!document.serverBacked) {
    return () => {
      active = false;
    };
  }

  async function loadDocumentPreview() {
    if (!authToken) {
      setPreviewError("Please sign in to preview this document.");
      return;
    }

    const apiBase = (
      import.meta.env.VITE_API_URL || "http://localhost:3000"
    ).replace(/\/+$/, "");

    setPreviewLoading(true);

    try {
      const response = await fetch(
        `${apiBase}/api/documents/${encodeURIComponent(document.id)}/download`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.message || "Unable to retrieve this document."
        );
      }

      const fileBlob = await response.blob();

      createdUrl = URL.createObjectURL(fileBlob);

      if (active) {
        setPreviewUrl(createdUrl);
      }
    } catch (error) {
      console.error("Document preview failed:", error);

      if (active) {
        setPreviewError(
          error.message || "Unable to load document preview."
        );
      }
    } finally {
      if (active) {
        setPreviewLoading(false);
      }
    }
  }

  loadDocumentPreview();

  return () => {
    active = false;

    if (createdUrl) {
      URL.revokeObjectURL(createdUrl);
    }
  };
}, [document.id, document.serverBacked, document.previewUrl, authToken]);

  function downloadDocument() {
  if (!previewUrl) {
    return;
  }

  const link = window.document.createElement("a");

  link.href = previewUrl;
  link.download =
    document.originalFileName ||
    document.originalFile?.name ||
    document.name ||
    "document";

  window.document.body.appendChild(link);
  link.click();
  link.remove();
}

  const isPdf =
    document.mimeType === "application/pdf" ||
    document.type?.toUpperCase() === "PDF";

  const isImage =
    document.mimeType?.startsWith("image/") ||
    document.icon === "image";

  const hasUploadedFile = Boolean(previewUrl);

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.section
        className="document-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Document details"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow-dash">DOCUMENT DETAILS</p>
            <h2>{document.name}</h2>
          </div>

          <IconButton
            icon={X}
            label="Close dialog"
            onClick={onClose}
          />
        </div>

        <div className="modal-document-preview">
          <DocumentIcon document={document} />

          <div>
            <strong>{document.name}</strong>
            <p>{document.type} · {document.size}</p>
          </div>

          <StatusBadge status={document.status} />
        </div>

        <div
          style={{
            width: "100%",
            minHeight: 220,
            maxHeight: 480,
            overflow: "auto",
            margin: "16px 0",
            padding: 12,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            borderRadius: 12,
            background: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {hasUploadedFile && isPdf && (
            <iframe
              src={previewUrl}
              title={`Preview of ${document.name}`}
              style={{
                width: "100%",
                height: 440,
                border: 0,
                borderRadius: 8,
                background: "#ffffff",
              }}
            />
          )}

          {hasUploadedFile && isImage && (
            <img
              src={previewUrl}
              alt={document.name}
              style={{
                display: "block",
                maxWidth: "100%",
                maxHeight: 440,
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          )}

          {previewLoading && (
  <div style={{ textAlign: "center", padding: 24 }}>
    <p>Loading document securely...</p>
  </div>
)}

{previewError && (
  <div style={{ textAlign: "center", padding: 24 }}>
    <p>{previewError}</p>
  </div>
)}

{!previewLoading && !previewError && !hasUploadedFile && (
  <div style={{ textAlign: "center", padding: 24 }}>
    <DocumentIcon document={document} />
    <p style={{ color: "#64748b", marginTop: 12 }}>
      Document preview is not available.
    </p>
  </div>
)}
        </div>

        <div className="detail-list">
          <div>
            <span>Document ID</span>
            <strong>{document.id}</strong>
          </div>

          <div>
            <span>Category</span>
            <strong>{document.category}</strong>
          </div>

          <div>
            <span>Added</span>
            <strong>{document.date}</strong>
          </div>

          <div>
            <span>Demo hash reference</span>
            <div className="hash-value">
              <code>{document.hash}</code>
              <IconButton
                icon={Copy}
                label="Copy hash reference"
                onClick={onCopy}
              />
            </div>
          </div>
        </div>

        <p className="demo-notice">
          <CircleAlert size={15} />
          This is mock metadata. The hash reference is not proof of
          on-chain storage. Uploaded files are held in browser memory.
        </p>

        <div className="modal-actions">
          {hasUploadedFile && (
            <button
              className="primary-button"
              onClick={downloadDocument}
              type="button"
            >
              <Download size={16} />
              Download original
            </button>
          )}

          <button
            className="secondary-button"
            onClick={onClose}
            type="button"
          >
            Close
          </button>

          <button
            className="danger-button"
            onClick={onRemove}
            type="button"
          >
            <Trash2 size={16} />
            Remove from demo
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}



createRoot(document.getElementById("root")).render(<App />);


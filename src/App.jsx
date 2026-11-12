import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  LockKeyhole,
  Fingerprint,
  Eye,
  EyeOff,
  ArrowRight,
  FileCheck2,
  Blocks,
  UserRound,
  Mail,
  Wallet,
  CheckCircle2,
  Shield,
} from "lucide-react";
import "./App.css";

const VaultScene = lazy(() => import("./components/VaultScene.jsx"));

/* --------------------------------------------------
   VAULTIFY LOGO
-------------------------------------------------- */

function VaultifyLogo({ compact = false }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <svg
        className="brand-mark"
        viewBox="0 0 64 72"
        fill="none"
        role="img"
        aria-label="Vaultify shield logo"
      >
        <defs>
          <linearGradient
            id="vaultifyShieldGradient"
            x1="8"
            y1="5"
            x2="57"
            y2="65"
          >
            <stop stopColor="#60E9FF" />
            <stop offset=".48" stopColor="#2678FF" />
            <stop offset="1" stopColor="#965BFF" />
          </linearGradient>
        </defs>

        <path
          d="M32 3 59 16 55 43 32 68 9 43 5 16 32 3Z"
          stroke="url(#vaultifyShieldGradient)"
          strokeWidth="5"
          strokeLinejoin="round"
        />

        <path
          d="M15 19 32 28 49 19 32 48 15 19Z"
          fill="url(#vaultifyShieldGradient)"
        />

        <path
          d="M32 28V61"
          stroke="#74DBFF"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <path
          d="M15 19 32 48 49 19"
          stroke="#B6F5FF"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      <span className="brand-word">
        Vault<span>ify</span>
      </span>
    </div>
  );
}

/* --------------------------------------------------
   MAIN LOGIN AND REGISTRATION PAGE
-------------------------------------------------- */

function App() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");


  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const [walletAddress, setWalletAddress] = useState("");
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");

  const [formMessage, setFormMessage] = useState("");
  const [formMessageType, setFormMessageType] = useState("info");
  const [registrationOtp, setRegistrationOtp] = useState("");
const [registrationOtpSent, setRegistrationOtpSent] = useState(false);

  const isRegister = mode === "register";


  /* Track account changes only after the user connects from this page. */
  useEffect(() => {
    if (!window.ethereum || !walletAddress) return;

    function handleAccountsChanged(accounts) {
      const nextAddress = accounts?.[0] || "";

      setWalletAddress(nextAddress);
      setWalletMessage(
        nextAddress
          ? "Wallet account changed."
          : "Wallet disconnected from Vaultify."
      );
    }

    window.ethereum.on?.(
      "accountsChanged",
      handleAccountsChanged
    );

    return () => {
      window.ethereum?.removeListener?.(
        "accountsChanged",
        handleAccountsChanged
      );
    };
  }, [walletAddress]);


  function switchMode(nextMode) {
    setMode(nextMode);
    setShowPassword(false);
    setFormMessage("");
    setFormMessageType("info");
  }

  /* Disconnect the wallet from the Vaultify login page. */
  function disconnectMetaMask() {
    setWalletAddress("");
    setWalletMessage(
      "Wallet disconnected from Vaultify. MetaMask site permission remains unchanged."
    );
  }

  /* Connect to MetaMask without exposing private keys. */

  /* Authenticate to Vaultify using an existing verified MetaMask wallet. */
  async function connectMetaMask() {
    setWalletMessage("");

    if (!window.ethereum) {
      setWalletMessage(
        "MetaMask was not detected. Install the official browser extension and try again."
      );
      return;
    }

    try {
      setWalletBusy(true);

      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(window.ethereum);

      // 1. Ask the user to select or connect a MetaMask account.
      const accounts = await provider.send(
        "eth_requestAccounts",
        []
      );

      if (!accounts?.length) {
        throw new Error("No MetaMask account was selected.");
      }

      const selectedAddress = accounts[0];
      setWalletAddress(selectedAddress);

      // 2. Require Ethereum Sepolia.
      const network = await provider.getNetwork();

      if (network.chainId !== 11155111n) {
        throw new Error(
          "Please switch MetaMask to Ethereum Sepolia (Chain ID 11155111)."
        );
      }

      setWalletMessage(
        `Selected ${selectedAddress.slice(0, 6)}...${selectedAddress.slice(-4)} on Ethereum Sepolia. Please approve the login signature in MetaMask.`
      );

      const apiBase = (
        import.meta.env.VITE_API_URL || "http://localhost:3000"
      ).replace(/\/+$/, "");

      // 3. Request a one-time login challenge from the backend.
      const challengeResponse = await fetch(
        `${apiBase}/api/auth/wallet-login/challenge`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: selectedAddress,
          }),
        }
      );

      const challengeResult = await challengeResponse
        .json()
        .catch(() => ({}));

      if (!challengeResponse.ok) {
        throw new Error(
          challengeResult.message ||
          "Unable to create a wallet login challenge."
        );
      }

      if (
        typeof challengeResult.challenge !== "string" ||
        !challengeResult.challenge
      ) {
        throw new Error("The wallet login challenge is invalid.");
      }

      // 4. Sign the exact message generated by the backend.
      const signer = await provider.getSigner(selectedAddress);
      const signature = await signer.signMessage(
        challengeResult.challenge
      );

      // 5. Confirm the account and network have not changed.
      const [currentAccounts, currentChainId] = await Promise.all([
        window.ethereum.request({
          method: "eth_accounts",
        }),
        window.ethereum.request({
          method: "eth_chainId",
        }),
      ]);

      if (
        !currentAccounts?.length ||
        currentAccounts[0].toLowerCase() !==
          selectedAddress.toLowerCase()
      ) {
        throw new Error(
          "MetaMask account changed during login. Please try again."
        );
      }

      if (currentChainId.toLowerCase() !== "0xaa36a7") {
        throw new Error(
          "MetaMask network changed. Please switch back to Ethereum Sepolia."
        );
      }

      // 6. Send the signature to the backend for authentication.
      const verifyResponse = await fetch(
        `${apiBase}/api/auth/wallet-login/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            walletAddress: selectedAddress,
            signature,
          }),
        }
      );

      const result = await verifyResponse
        .json()
        .catch(() => ({}));

      if (!verifyResponse.ok) {
        throw new Error(
          result.message || "Wallet authentication failed."
        );
      }

      if (!result.token || !result.user) {
        throw new Error(
          "Wallet authentication response is incomplete."
        );
      }

      // 7. Save the same session format used by email login.
      const storage = remember
        ? window.localStorage
        : window.sessionStorage;

      const otherStorage = remember
        ? window.sessionStorage
        : window.localStorage;

      otherStorage.removeItem("vaultifyToken");
      otherStorage.removeItem("vaultifyUser");

      storage.setItem("vaultifyToken", result.token);
      storage.setItem("vaultifyUser", JSON.stringify(result.user));

      // Persist the wallet connection preference for this Vaultify user.
const connectionPreferenceKey =
  `vaultifyWalletConnection:${result.user.id}`;

window.localStorage.setItem(
  connectionPreferenceKey,
  "connected"
);

window.sessionStorage.removeItem(
  `vaultifyWalletDisconnected:${result.user.id}`
);

      setWalletMessage("Wallet authentication successful.");

      // 8. Open the authenticated dashboard.
      window.location.href = "/dashboard.html";
    } catch (error) {
      console.error("Wallet login failed:", error);

      if (error.code === 4001) {
        setWalletMessage(
          "You cancelled the MetaMask request or signature."
        );
      } else {
        setWalletMessage(
          error.message || "Unable to sign in with MetaMask."
        );
      }
    } finally {
      setWalletBusy(false);
    }
  }


  /* Frontend-only form handling and dashboard navigation. */
  async function handleSubmit(event) {
  event.preventDefault();

  setFormMessage("");
  setFormMessageType("info");

  if (isRegister && password !== confirmPassword) {
    setFormMessage("Your passwords do not match.");
    setFormMessageType("error");
    return;
  }

  if (isRegister && !name.trim()) {
    setFormMessage("Please enter your full name.");
    setFormMessageType("error");
    return;
  }

  if (!email.trim() || !password) {
    setFormMessage("Please enter your email and password.");
    setFormMessageType("error");
    return;
  }

  if (
    isRegister &&
    !/^[6-9]\d{9}$/.test(phone.trim())
  ) {
    setFormMessage("Enter a valid 10-digit mobile number.");
    setFormMessageType("error");
    return;
  }

  if (
    isRegister &&
    registrationOtpSent &&
    !/^\d{6}$/.test(registrationOtp)
  ) {
    setFormMessage("Enter the six-digit email verification code.");
    setFormMessageType("error");
    return;
  }

  const apiBase = (
    import.meta.env.VITE_API_URL || "http://localhost:3000"
  ).replace(/\/+$/, "");


  try {
    let endpoint;
    let payload;

    if (isRegister && !registrationOtpSent) {
      endpoint = "/api/auth/register/email-otp";
      payload = {
        email: email.trim(),
      };
    } else if (isRegister) {
      endpoint = "/api/auth/register/verify-email";
      payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        otp: registrationOtp,
      };
    } else {
      endpoint = "/api/auth/login";
      payload = {
        email: email.trim(),
        password,
      };
    }

    const response = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.message || "Request failed. Please try again."
      );
    }

    // The first registration request only sends the email OTP.
    if (isRegister && !registrationOtpSent) {
      setRegistrationOtpSent(true);
      setFormMessage(
        result.message || "Check your email for the verification code."
      );
      setFormMessageType("info");
      return;
    }

    if (!result.token || !result.user) {
      throw new Error("Authentication response is incomplete.");
    }

    // Respect the Remember me setting.
    const storage = remember
      ? window.localStorage
      : window.sessionStorage;

    const otherStorage = remember
      ? window.sessionStorage
      : window.localStorage;

    otherStorage.removeItem("vaultifyToken");
    otherStorage.removeItem("vaultifyUser");

    storage.setItem("vaultifyToken", result.token);
    storage.setItem("vaultifyUser", JSON.stringify(result.user));

    setFormMessage(
      isRegister ? "Account created successfully." : "Login successful."
    );
    setFormMessageType("info");

    window.location.href = "/dashboard.html";
  } catch (error) {
    console.error("Authentication request failed:", error);

    setFormMessage(
      error.message || "Unable to connect to Vaultify. Please try again."
    );
    setFormMessageType("error");
  }
}

  return (
    <main className="vault-app">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* Top navigation */}
      <header className="topbar">
        <a
          className="brand-link"
          href="#home"
          aria-label="Vaultify home"
        >
          <VaultifyLogo />

          <span className="brand-tagline">
            YOUR DOCUMENTS. YOUR CONTROL.
          </span>
        </a>

        <nav className="top-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#about">About</a>

          <button
            className="get-started"
            onClick={() =>
              document
                .getElementById("auth-panel")
                ?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
            }
          >
            Get Started <ArrowRight size={17} />
          </button>
        </nav>
      </header>

      {/* Hero and 3D illustration */}
      <section className="hero-layout" id="home">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75 }}
        >
          <div className="eyebrow">
            <span className="eyebrow-line" />
            YOUR DOCUMENTS. YOUR CONTROL.
          </div>

          <h1>
            Secure
            <br />
            Your Digital
            <br />
            <span>Identity</span>
          </h1>

          <p className="hero-description">
            Store, verify, and share your important documents
            on a secure blockchain network. Powered by you.
            Protected by blockchain.
          </p>

          <div className="scene-wrap">
            <Suspense fallback={null}>
              <VaultScene />
            </Suspense>

            <motion.div
              className="float-card card-id"
              animate={{ y: [0, -9, 0], rotate: [-4, -2, -4] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <FileCheck2 size={20} />

              <span>
                <strong>ID Card</strong>
                <small>Digital identity</small>
              </span>
            </motion.div>

            <motion.div
              className="float-card card-certificate"
              animate={{ y: [0, 8, 0], rotate: [3, 5, 3] }}
              transition={{ duration: 4.5, repeat: Infinity }}
            >
              <ShieldCheck size={20} />

              <span>
                <strong>Certificates</strong>
                <small>Integrity protected</small>
              </span>
            </motion.div>

            <motion.div
              className="float-card card-documents"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.8, repeat: Infinity }}
            >
              <Blocks size={20} />

              <span>
                <strong>Documents</strong>
                <small>Verified records</small>
              </span>
            </motion.div>
          </div>

          <div className="benefits" id="features">
            <div className="benefit">
              <span className="benefit-icon">
                <LockKeyhole />
              </span>

              <div>
                <strong>End-to-End Security</strong>
                <small>Your data, always encrypted</small>
              </div>
            </div>

            <div className="benefit" id="security">
              <span className="benefit-icon">
                <Blocks />
              </span>

              <div>
                <strong>Blockchain Verified</strong>
                <small>Tamper-evident verification</small>
              </div>
            </div>

            <div className="benefit" id="about">
              <span className="benefit-icon">
                <UserRound />
              </span>

              <div>
                <strong>You're in Control</strong>
                <small>Own, share, and manage your data</small>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Login and registration panel */}
        <motion.section
          id="auth-panel"
          className="auth-panel"
          aria-label="Vaultify account access"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
        >
          <div className="panel-brand">
            <VaultifyLogo compact />
            <span>YOUR DOCUMENTS. YOUR CONTROL.</span>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={!isRegister ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign In
            </button>

            <button
              type="button"
              className={isRegister ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create Account
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="form-heading">
                <h2>
                  {isRegister
                    ? "Create your vault."
                    : "Welcome back."}
                </h2>

                <p>
                  {isRegister
                    ? "Start protecting your digital documents."
                    : "Your secure space is waiting for you."}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {isRegister && (
                  <label className="field">
                    <UserRound size={19} />

                    <input
                      type="text"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      placeholder="Full name"
                      autoComplete="name"
                      required
                    />
                  </label>
                )}

                <label className="field">
                  <Mail size={19} />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Email address"
                    autoComplete="email"
                    required
                  />
                </label>
{isRegister && registrationOtpSent && (
  <label className="field">
    <Shield size={19} />

    <input
      type="text"
      value={registrationOtp}
      onChange={(event) =>
        setRegistrationOtp(
          event.target.value.replace(/\D/g, "").slice(0, 6)
        )
      }
      placeholder="Six-digit email verification code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      required
    />
  </label>
)}

{isRegister && (
  <label className="field">
    <span className="phone-prefix">+91</span>
    <input
      type="tel"
      value={phone}
      onChange={(event) => setPhone(event.target.value)}
      placeholder="10-digit mobile number"
      autoComplete="tel-national"
      inputMode="numeric"
      pattern="[6-9][0-9]{9}"
      maxLength={10}
      required
    />
  </label>
)}


{isRegister && (
  <p role="status">
    SMS verification is temporarily unavailable.
    You can register after verifying your email.
  </p>
)}




                <label className="field">
                  <LockKeyhole size={19} />

                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Password"
                    minLength={8}
                    autoComplete={
                      isRegister
                        ? "new-password"
                        : "current-password"
                    }
                    required
                  />

                  <button
                    type="button"
                    className="field-action"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </label>

                {isRegister && (
                  <label className="field">
                    <Shield size={19} />

                    <input
                      type={
                        showPassword ? "text" : "password"
                      }
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </label>
                )}

                {!isRegister && (
                  <div className="form-options">
                    <label className="remember">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(event) =>
                          setRemember(event.target.checked)
                        }
                      />

                      <span>Remember me</span>
                    </label>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setFormMessage(
                          "Password recovery will be implemented in a future phase."
                        );
                        setFormMessageType("info");
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  className="submit-button"
                  type="submit"
                >
                  <span>
                    {isRegister
                      ? "Create Account"
                      : "Sign In"}
                  </span>

                  <ArrowRight size={19} />
                </button>

                <AnimatePresence>
                  {formMessage && (
                    <motion.p
                      className={`status-message ${formMessageType}`}
                      role="status"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {formMessage}
                    </motion.p>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          </AnimatePresence>

          <div className="or-divider">
            <span>OR</span>
          </div>



  <button
    type="button"
    className="metamask-button"
    onClick={connectMetaMask}
    disabled={walletBusy}
  >
    {walletBusy ? (
      <span className="loading-orb" />
    ) : (
      <Wallet size={23} />
    )}

    <span>
      {walletBusy
        ? "Authenticating with MetaMask..."
        : walletAddress
          ? `Continue as ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
          : "Continue with MetaMask"}
    </span>
  </button>

  <p className="wallet-description" role="status">
    {walletMessage ||
      (walletAddress
        ? `Selected wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        : "Sign in securely using your existing verified wallet. No password required.")}
  </p>

  {walletAddress && (
    <button
      type="button"
      onClick={disconnectMetaMask}
      disabled={walletBusy}
      style={{
        marginTop: "8px",
        border: "none",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        textDecoration: "underline",
        fontSize: "0.85rem",
      }}
    >
      Clear selected wallet
    </button>
  )}


  <p className="wallet-description" role="status">
    {walletMessage ||
      (walletAddress
        ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}. This does not sign you in.`
        : "Connect your wallet to access your decentralized identity.")}
  </p>


          <div className="panel-footer">
            <Fingerprint size={25} />

            <span>
              YOUR IDENTITY. YOUR KEYS. YOUR CONTROL.
            </span>
          </div>
        </motion.section>
      </section>

      <footer className="page-footer">
        <span>© 2026 VAULTIFY</span>
        <span>BUILT FOR A MORE TRUSTED DIGITAL WORLD</span>
      </footer>
    </main>
  );
}

export default App;
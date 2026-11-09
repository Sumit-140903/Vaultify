import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "dist/**",
    "node_modules/**",
    "**/*.bak",
    "**/*.phase4-backup",
  ]),

  // React frontend: browser globals and React-specific rules.
  {
    files: ["src/**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },

  // Backend, blockchain scripts and root configuration files:
  // Node.js globals.
  {
    files: [
      "backend/**/*.{js,jsx}",
      "blockchain/**/*.{js,jsx}",
      "vite.config.js",
      "eslint.config.js",
    ],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Hardhat tests: Node.js, Mocha and Hardhat ethers globals.
  {
    files: ["blockchain/test/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.mocha,
        ethers: "readonly",
      },
    },
  },

  // dashboard.jsx is a standalone entry point with private local UI helpers.
  // Fast Refresh export restrictions are not applicable to these internal helpers.
  {
    files: ["src/dashboard.jsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);

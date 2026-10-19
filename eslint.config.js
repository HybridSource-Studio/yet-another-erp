import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "test-results", "playwright-report"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // The data layer has no UI in it: no React, and nothing from the app folder.
    files: ["src/data/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: ["react", "react-dom", "wouter", "../app/*", "**/app/*"] },
      ],
    },
  },
  {
    // UI code reaches storage only through the data layer, never Dexie directly.
    files: ["src/app/**/*.{ts,tsx}", "src/main.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "dexie", message: "Use the data layer (src/data) instead." }],
          patterns: ["**/data/db", "**/data/write", "**/data/*/*"],
        },
      ],
    },
  },
);

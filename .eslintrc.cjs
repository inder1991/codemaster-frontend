/* Sprint 12 / S12.1.1 — admin-console ESLint config. */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  extends: [
    "next/core-web-vitals",
    "plugin:jsx-a11y/strict",
  ],
  plugins: ["@typescript-eslint", "jsx-a11y"],
  rules: {
    // Block runtime imports of the read-only vendor tree.
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/vendor/application-ui-v4/**"],
            message:
              "vendor/application-ui-v4 is read-only documentation; adopt-by-copy under src/components/ui/<category>/.",
          },
        ],
      },
    ],
    // Treat warnings as errors per the locked CI policy.
    "react/no-unescaped-entities": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_" },
    ],
  },
};

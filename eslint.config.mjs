import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "storybook-static/**",
      "coverage/**",
    ],
  },
  ...compat.config({
    parser: "@typescript-eslint/parser",
    parserOptions: { ecmaVersion: 2022, sourceType: "module" },
    extends: ["next/core-web-vitals", "plugin:jsx-a11y/strict"],
    plugins: ["@typescript-eslint", "jsx-a11y"],
    rules: {
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
      "react/no-unescaped-entities": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  }),
];

export default config;

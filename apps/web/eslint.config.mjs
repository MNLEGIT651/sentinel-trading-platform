import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { createRequire } from "module";

// eslint-plugin-react@7.x is incompatible with ESLint v10 — disable all its rules
const require = createRequire(import.meta.url);
const reactPlugin = require("eslint-plugin-react");
const disableReactRules = Object.fromEntries(
  Object.keys(reactPlugin.rules).map((name) => [`react/${name}`, "off"]),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: disableReactRules },
  {
    rules: {
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/aria-props": "warn",
      "jsx-a11y/aria-role": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

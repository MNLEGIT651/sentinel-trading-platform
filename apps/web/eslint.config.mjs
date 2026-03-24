import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";

// eslint-plugin-react@7.x uses context.getFilename() which was removed in
// ESLint v10. Disable all react/* rules until the plugin ships ESLint v10
// support (expected in eslint-plugin-react@8 or a subsequent minor).
const reactRuleOverrides = Object.fromEntries(
  Object.keys(reactPlugin.rules ?? {}).map((name) => [`react/${name}`, "off"]),
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  { rules: reactRuleOverrides },
]);

export default eslintConfig;

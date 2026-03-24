import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-plugin-react@7.x uses context.getFilename() which was removed in
// ESLint v10. The eslint-config-next already includes the react plugin, but
// all react/* rules crash on ESLint v10. We disable them by generating rule
// overrides without importing the plugin directly (which would fail in ESM).
// This workaround remains until eslint-plugin-react ships ESLint v10 support.
const reactRuleNames = [
  'display-name', 'jsx-key', 'jsx-no-comment-textnodes', 'jsx-no-duplicate-props',
  'jsx-no-target-blank', 'jsx-no-undef', 'jsx-uses-react', 'jsx-uses-vars',
  'no-children-prop', 'no-danger-with-children', 'no-deprecated', 'no-direct-mutation-state',
  'no-find-dom-node', 'no-is-mounted', 'no-render-return-value', 'no-string-refs',
  'no-unescaped-entities', 'no-unknown-property', 'no-unsafe', 'prop-types',
  'react-in-jsx-scope', 'require-render-return'
];
const reactRuleOverrides = Object.fromEntries(
  reactRuleNames.map((name) => [`react/${name}`, "off"]),
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

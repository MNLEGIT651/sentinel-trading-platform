import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  // eslint-plugin-react@7.x uses context.getFilename() which was removed in
  // ESLint v10. Disable until eslint-plugin-react ships full ESLint v10 support.
  {
    rules: {
      "react/display-name": "off",
    },
  },
]);

export default eslintConfig;

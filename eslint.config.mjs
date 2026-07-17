import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // French UI content — escaping every apostrophe/quote is unreadable
      "react/no-unescaped-entities": "off",
      // Polling pattern (async fn in useEffect + setInterval) is intentional
      "react-hooks/set-state-in-effect": "off",
      // Allow _-prefixed intentionally-unused params
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // @ts-nocheck is used on files pending rewrite after schema migration
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
]);

export default eslintConfig;

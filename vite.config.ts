import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["**/dist/**", "repos/**"],
  },
  lint: {
    ignorePatterns: ["repos/**"],
    jsPlugins: ["./tooling/oxlint-local-plugin.js"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "local/no-product-unknown": "off",
      "local/no-untracked-type-assertions": "error",
    },
    overrides: [
      {
        files: ["apps/web/src/**/*.{ts,tsx}"],
        rules: {
          "local/no-product-unknown": "error",
        },
      },
      {
        files: ["apps/server/src/**/*.ts"],
        rules: {
          "local/no-product-unknown": "error",
        },
      },
      {
        files: [
          "apps/server/src/**/*api.ts",
          "apps/server/src/**/*http.ts",
          "apps/server/src/**/repository.ts",
          "apps/server/src/**/service.ts",
          "apps/server/src/db/**",
          "apps/server/src/http/**",
        ],
        rules: {
          "local/no-product-unknown": "off",
        },
      },
      {
        files: ["apps/web/src/shared/api-client.ts", "**/*.test.{ts,tsx}"],
        rules: {
          "local/no-product-unknown": "off",
        },
      },
    ],
  },
  run: {
    cache: true,
  },
});

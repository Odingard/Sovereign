import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/e2e/**"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      // Spec §9.2: 100% on packages/crypto. Thresholds are scoped per-glob so this
      // gate is real for crypto without imposing a number on packages that have not
      // earned one yet. Widen as each package reaches its target.
      thresholds: {
        "packages/crypto/src/**": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});

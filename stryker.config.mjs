export default {
  plugins: [
    "@stryker-mutator/vitest-runner",
    "@stryker-mutator/typescript-checker",
  ],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.mutation.config.ts",
  },
  mutate: [
    "src/api/**/*.ts",
    "src/components/**/*.tsx",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.stories.tsx",
  ],
  coverageAnalysis: "perTest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  reporters: ["html", "clear-text", "progress", "json"],
  thresholds: {
    high: 80,
    low: 60,
    break: 70,
  },
  ignoreStatic: true,
  incremental: true,
  incrementalFile: "artifacts/stryker/incremental.json",
  cleanTempDir: "always",
  concurrency: process.env.CI ? 2 : 4,
};

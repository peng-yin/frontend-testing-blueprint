import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { analyzeImpact, parseDiffArguments } from "./test-impact.mjs";

const policy = {
  version: 1,
  planPattern: ".testing/plans/*.json",
  requireChangedEvidence: true,
  ignored: ["**/*.md"],
  rules: [
    {
      id: "component",
      include: ["src/components/**/*.tsx"],
      exclude: ["**/*.test.tsx", "**/*.stories.tsx"],
      required: ["unit", "storybook", "mutation"],
    },
    {
      id: "api",
      include: ["src/api/**/*.ts"],
      exclude: ["**/*.test.ts"],
      required: ["unit", "mutation"],
    },
  ],
  evidencePatterns: {
    unit: ["**/*.test.ts", "**/*.test.tsx"],
    storybook: ["**/*.stories.ts", "**/*.stories.tsx"],
    mutation: ["**/*.test.ts", "**/*.test.tsx"],
    e2e: ["e2e/**/*.spec.ts"],
  },
};

function fixture({
  source,
  requiredTests,
  evidence,
  commands = ["pnpm verify"],
}) {
  const root = mkdtempSync(join(tmpdir(), "test-impact-"));
  for (const file of [...source, ...Object.values(evidence).flat()]) {
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "");
  }
  const planPath = ".testing/plans/change.json";
  mkdirSync(join(root, ".testing/plans"), { recursive: true });
  writeFileSync(
    join(root, planPath),
    JSON.stringify({
      version: 1,
      change_id: "change",
      summary: "test",
      behaviors: [
        {
          id: "behavior",
          description: "behavior",
          risk: "high",
          source,
          required_tests: requiredTests,
          evidence,
          commands,
        },
      ],
    }),
  );
  return { root, planPath };
}

test("documentation-only changes pass without a plan", () => {
  const result = analyzeImpact({
    root: "/",
    changedFiles: ["README.md"],
    policy,
  });
  assert.equal(result.ok, true);
});

test("accepts the argument separator forwarded by pnpm", () => {
  assert.deepEqual(parseDiffArguments(["--", "--working-tree"]), {
    changedFiles: [],
    workingTree: true,
  });
});

test("component changes fail without a plan", () => {
  const result = analyzeImpact({
    root: "/",
    changedFiles: ["src/components/Button.tsx"],
    policy,
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Changed test plan required/);
});

test("complete component evidence passes", () => {
  const source = ["src/components/Button.tsx"];
  const evidence = {
    unit: ["src/components/Button.test.tsx"],
    storybook: ["src/components/Button.stories.tsx"],
    mutation: ["src/components/Button.test.tsx"],
    e2e: [],
  };
  const { root, planPath } = fixture({
    source,
    requiredTests: { unit: true, storybook: true, mutation: true, e2e: false },
    evidence,
  });
  const result = analyzeImpact({
    root,
    changedFiles: [
      planPath,
      ...source,
      ...new Set(Object.values(evidence).flat()),
    ],
    policy,
  });
  assert.deepEqual(result.errors, []);
});

test("missing Storybook evidence fails", () => {
  const source = ["src/components/Button.tsx"];
  const evidence = {
    unit: ["src/components/Button.test.tsx"],
    storybook: [],
    mutation: ["src/components/Button.test.tsx"],
    e2e: [],
  };
  const { root, planPath } = fixture({
    source,
    requiredTests: { unit: true, storybook: true, mutation: true, e2e: false },
    evidence,
  });
  const result = analyzeImpact({
    root,
    changedFiles: [planPath, ...source, ...evidence.unit],
    policy,
  });
  assert.match(result.errors.join("\n"), /storybook evidence is required/);
});

test("API unit evidence can also prove mutation behavior", () => {
  const source = ["src/api/users.ts"];
  const evidence = {
    unit: ["src/api/users.test.ts"],
    storybook: [],
    mutation: ["src/api/users.test.ts"],
    e2e: [],
  };
  const { root, planPath } = fixture({
    source,
    requiredTests: { unit: true, storybook: false, mutation: true, e2e: false },
    evidence,
  });
  const result = analyzeImpact({
    root,
    changedFiles: [planPath, ...source, ...evidence.unit],
    policy,
  });
  assert.equal(result.ok, true);
});

test("unsafe evidence paths are rejected", () => {
  const source = ["src/api/users.ts"];
  const evidence = {
    unit: ["../users.test.ts"],
    storybook: [],
    mutation: ["../users.test.ts"],
    e2e: [],
  };
  const { root, planPath } = fixture({
    source,
    requiredTests: { unit: true, storybook: false, mutation: true, e2e: false },
    evidence,
  });
  const result = analyzeImpact({
    root,
    changedFiles: [planPath, ...source],
    policy,
  });
  assert.match(result.errors.join("\n"), /Unsafe repository path/);
});

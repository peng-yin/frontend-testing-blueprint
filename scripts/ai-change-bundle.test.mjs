import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { applyBundle } from "./ai-change-bundle.mjs";

test("applies upserts and deletions", () => {
  const root = mkdtempSync(join(tmpdir(), "change-bundle-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/deleted.ts"), "old");
  applyBundle(
    {
      version: 1,
      expected_head_sha: "abc",
      changes: [
        {
          status: "upsert",
          path: "src/new.ts",
          content: Buffer.from("new").toString("base64"),
        },
        { status: "delete", path: "src/deleted.ts" },
      ],
    },
    root,
  );
  assert.equal(readFileSync(join(root, "src/new.ts"), "utf8"), "new");
  assert.equal(existsSync(join(root, "src/deleted.ts")), false);
});

test("rejects unsafe paths", () => {
  assert.throws(
    () =>
      applyBundle({
        version: 1,
        expected_head_sha: "abc",
        changes: [{ status: "delete", path: "../unsafe" }],
      }),
    /Unsafe repository path/,
  );
});

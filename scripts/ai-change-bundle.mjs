import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeRepositoryPath } from "./test-impact.mjs";

const MAX_FILES = 100;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;

function git(arguments_, root, encoding = "utf8") {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function validateBundle(bundle) {
  if (bundle.version !== 1 || typeof bundle.expected_head_sha !== "string") {
    throw new Error("Unsupported change bundle");
  }
  if (!Array.isArray(bundle.changes) || bundle.changes.length > MAX_FILES) {
    throw new Error(`Change bundle must contain at most ${MAX_FILES} files`);
  }
  let totalBytes = 0;
  for (const change of bundle.changes) {
    change.path = normalizeRepositoryPath(change.path);
    if (!["upsert", "delete"].includes(change.status)) {
      throw new Error(`Unsupported change status for ${change.path}`);
    }
    if (change.status === "upsert") {
      if (typeof change.content !== "string") {
        throw new Error(`Missing base64 content for ${change.path}`);
      }
      const size = Buffer.from(change.content, "base64").byteLength;
      if (size > MAX_FILE_BYTES)
        throw new Error(`${change.path} exceeds 1 MiB`);
      totalBytes += size;
    }
  }
  if (totalBytes > MAX_BUNDLE_BYTES)
    throw new Error("Change bundle exceeds 5 MiB");
  return bundle;
}

export function createBundle(root = process.cwd()) {
  const statusOutput = git(
    ["diff", "--name-status", "--no-renames", "-z", "HEAD", "--"],
    root,
  );
  const fields = statusOutput.split("\0").filter(Boolean);
  const statuses = new Map();
  for (let index = 0; index < fields.length; index += 2) {
    statuses.set(normalizeRepositoryPath(fields[index + 1]), fields[index]);
  }
  const untracked = git(
    ["ls-files", "--others", "--exclude-standard", "-z"],
    root,
  )
    .split("\0")
    .filter(Boolean)
    .map(normalizeRepositoryPath);
  for (const file of untracked) statuses.set(file, "A");

  const changes = [...statuses]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, status]) => {
      if (status.startsWith("D")) return { status: "delete", path: file };
      const content = readFileSync(resolve(root, file)).toString("base64");
      return { status: "upsert", path: file, content };
    });

  return validateBundle({
    version: 1,
    expected_head_sha: git(["rev-parse", "HEAD"], root).trim(),
    generated_at: new Date().toISOString(),
    changes,
  });
}

export function applyBundle(bundle, root = process.cwd()) {
  validateBundle(bundle);
  for (const change of bundle.changes) {
    const target = resolve(root, change.path);
    if (change.status === "delete") {
      if (existsSync(target)) rmSync(target);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(change.content, "base64"));
  }
}

function option(arguments_, name) {
  const index = arguments_.indexOf(name);
  if (index < 0 || !arguments_[index + 1])
    throw new Error(`${name} is required`);
  return arguments_[index + 1];
}

function main() {
  const [command, ...arguments_] = process.argv.slice(2);
  if (command === "create") {
    const output = resolve(option(arguments_, "--output"));
    const bundle = createBundle();
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`);
    console.log(`Change bundle written: ${bundle.changes.length} files`);
  } else if (command === "apply") {
    const input = resolve(option(arguments_, "--input"));
    applyBundle(JSON.parse(readFileSync(input, "utf8")));
    console.log(`Change bundle applied from ${input}`);
  } else {
    throw new Error("Use create --output <file> or apply --input <file>.");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

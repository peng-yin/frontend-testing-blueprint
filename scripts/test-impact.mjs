import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const TEST_LAYERS = ["unit", "storybook", "mutation", "e2e"];

export function normalizeRepositoryPath(value) {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.includes("\0")
  ) {
    throw new Error(`Unsafe repository path: ${value}`);
  }
  return normalized;
}

export function globToRegExp(pattern) {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else {
        expression += ".*";
        index += 1;
      }
    } else if (character === "*") {
      expression += "[^/]*";
    } else if (character === "?") {
      expression += "[^/]";
    } else {
      expression += character.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
    }
  }
  return new RegExp(`${expression}$`);
}

export function matchesAny(file, patterns = []) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

export function loadPolicy(root = process.cwd()) {
  const source = readFileSync(resolve(root, ".testing/policy.yml"), "utf8");
  return JSON.parse(source.replace(/,\s*([}\]])/g, "$1"));
}

function gitLines(arguments_, root) {
  return execFileSync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function listChangedFiles(options = {}) {
  const root = options.root ?? process.cwd();
  if (options.changedFiles?.length) {
    return [
      ...new Set(options.changedFiles.map(normalizeRepositoryPath)),
    ].sort();
  }
  if (options.workingTree) {
    return [
      ...new Set([
        ...gitLines(["diff", "--name-only", "HEAD", "--"], root),
        ...gitLines(["ls-files", "--others", "--exclude-standard"], root),
      ]),
    ]
      .map(normalizeRepositoryPath)
      .sort();
  }
  if (options.base && options.head) {
    return gitLines(
      ["diff", "--name-only", options.base, options.head, "--"],
      root,
    )
      .map(normalizeRepositoryPath)
      .sort();
  }
  throw new Error(
    "Use --working-tree, --base <sha> --head <sha>, or --changed-file <path>.",
  );
}

function validatePlan(plan, planPath) {
  const errors = [];
  if (plan.version !== 1) errors.push(`${planPath}: version must be 1`);
  if (typeof plan.change_id !== "string" || !plan.change_id) {
    errors.push(`${planPath}: change_id is required`);
  }
  if (!Array.isArray(plan.behaviors) || plan.behaviors.length === 0) {
    errors.push(`${planPath}: behaviors must be a non-empty array`);
  }
  for (const behavior of plan.behaviors ?? []) {
    if (
      typeof behavior.id !== "string" ||
      typeof behavior.description !== "string" ||
      !Array.isArray(behavior.source) ||
      !behavior.required_tests ||
      !behavior.evidence ||
      !Array.isArray(behavior.commands)
    ) {
      errors.push(
        `${planPath}: every behavior must satisfy the test-plan contract`,
      );
      continue;
    }
    for (const layer of TEST_LAYERS) {
      if (typeof behavior.required_tests[layer] !== "boolean") {
        errors.push(
          `${planPath}/${behavior.id}: required_tests.${layer} must be boolean`,
        );
      }
      if (!Array.isArray(behavior.evidence[layer])) {
        errors.push(
          `${planPath}/${behavior.id}: evidence.${layer} must be an array`,
        );
      }
    }
  }
  return errors;
}

export function analyzeImpact({
  root = process.cwd(),
  changedFiles,
  policy = loadPolicy(root),
}) {
  const changed = [
    ...new Set(changedFiles.map(normalizeRepositoryPath)),
  ].sort();
  const relevant = changed.filter((file) => !matchesAny(file, policy.ignored));
  const impacted = relevant
    .map((file) => {
      const rules = policy.rules.filter(
        (rule) =>
          matchesAny(file, rule.include) &&
          !matchesAny(file, rule.exclude ?? []),
      );
      return {
        file,
        rules: rules.map((rule) => rule.id),
        required: [...new Set(rules.flatMap((rule) => rule.required))],
      };
    })
    .filter((item) => item.rules.length > 0);
  const planPaths = changed.filter((file) =>
    globToRegExp(policy.planPattern).test(file),
  );
  const errors = [];
  const plans = [];

  for (const planPath of planPaths) {
    try {
      const plan = JSON.parse(readFileSync(resolve(root, planPath), "utf8"));
      errors.push(...validatePlan(plan, planPath));
      plans.push({ path: planPath, plan });
    } catch (error) {
      errors.push(`${planPath}: ${error.message}`);
    }
  }

  if (impacted.length > 0 && plans.length === 0) {
    errors.push(`Changed test plan required: ${policy.planPattern}`);
  }

  const behaviors = plans.flatMap(({ path, plan }) =>
    (plan.behaviors ?? []).map((behavior) => ({ ...behavior, planPath: path })),
  );

  for (const item of impacted) {
    const owners = behaviors.filter((behavior) =>
      behavior.source?.map(normalizeRepositoryPath).includes(item.file),
    );
    if (owners.length === 0) {
      errors.push(
        `${item.file}: not mapped to any behavior in a changed test plan`,
      );
      continue;
    }
    for (const owner of owners) {
      if (item.required.length === 0 && owner.commands.length === 0) {
        errors.push(
          `${owner.planPath}/${owner.id}: infrastructure changes need commands`,
        );
      }
      for (const layer of item.required) {
        if (owner.required_tests[layer] !== true) {
          errors.push(
            `${owner.planPath}/${owner.id}: ${item.file} requires ${layer}`,
          );
          continue;
        }
        const evidence = owner.evidence[layer] ?? [];
        if (evidence.length === 0) {
          errors.push(
            `${owner.planPath}/${owner.id}: ${layer} evidence is required`,
          );
        }
        for (const rawEvidencePath of evidence) {
          let evidencePath;
          try {
            evidencePath = normalizeRepositoryPath(rawEvidencePath);
          } catch (error) {
            errors.push(`${owner.planPath}/${owner.id}: ${error.message}`);
            continue;
          }
          if (!matchesAny(evidencePath, policy.evidencePatterns[layer])) {
            errors.push(
              `${owner.planPath}/${owner.id}: ${evidencePath} is not valid ${layer} evidence`,
            );
          }
          if (!existsSync(resolve(root, evidencePath))) {
            errors.push(
              `${owner.planPath}/${owner.id}: missing evidence ${evidencePath}`,
            );
          }
          if (
            policy.requireChangedEvidence &&
            !changed.includes(evidencePath)
          ) {
            errors.push(
              `${owner.planPath}/${owner.id}: evidence must change: ${evidencePath}`,
            );
          }
        }
      }
    }
  }

  return {
    changed,
    relevant,
    impacted,
    plans,
    errors,
    ok: errors.length === 0,
  };
}

export function parseDiffArguments(arguments_) {
  const options = { changedFiles: [] };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--") continue;
    if (argument === "--working-tree") options.workingTree = true;
    else if (argument === "--base") options.base = arguments_[++index];
    else if (argument === "--head") options.head = arguments_[++index];
    else if (argument === "--changed-file")
      options.changedFiles.push(arguments_[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function main() {
  const options = parseDiffArguments(process.argv.slice(2));
  const changedFiles = listChangedFiles(options);
  const result = analyzeImpact({ changedFiles });
  console.log(`Changed files: ${result.changed.length}`);
  console.log(`Policy-classified files: ${result.impacted.length}`);
  console.log(`Changed test plans: ${result.plans.length}`);
  if (!result.ok) {
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Test impact policy: PASS");
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

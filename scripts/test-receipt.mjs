import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  TEST_LAYERS,
  analyzeImpact,
  listChangedFiles,
  parseDiffArguments,
} from "./test-impact.mjs";

export function renderReceipt(result) {
  const lines = [
    "# AI test completion receipt",
    "",
    `Changed files: ${result.changed.length} · Policy-classified files: ${result.impacted.length}`,
    "",
    "| Behavior | Risk | Source | Required evidence |",
    "| --- | --- | --- | --- |",
  ];
  for (const { plan } of result.plans) {
    for (const behavior of plan.behaviors) {
      const required = TEST_LAYERS.filter(
        (layer) => behavior.required_tests[layer],
      )
        .map(
          (layer) => `${layer}: ${(behavior.evidence[layer] ?? []).join(", ")}`,
        )
        .join("<br>");
      lines.push(
        `| ${behavior.id} | ${behavior.risk} | ${behavior.source.join("<br>")} | ${required || "Infrastructure verification"} |`,
      );
    }
  }
  lines.push("", "## Commands");
  for (const { plan } of result.plans) {
    for (const behavior of plan.behaviors) {
      lines.push(
        "",
        `### ${behavior.id}`,
        "",
        "```text",
        ...behavior.commands,
        "```",
      );
    }
  }
  lines.push("", `Policy result: **${result.ok ? "PASS" : "FAIL"}**`, "");
  return lines.join("\n");
}

function main() {
  const arguments_ = process.argv.slice(2);
  let output = "artifacts/ai-test-completion/test-receipt.md";
  const outputIndex = arguments_.indexOf("--output");
  if (outputIndex >= 0) {
    output = arguments_[outputIndex + 1];
    arguments_.splice(outputIndex, 2);
  }
  const options = parseDiffArguments(arguments_);
  const result = analyzeImpact({ changedFiles: listChangedFiles(options) });
  if (result.plans.length === 0)
    throw new Error("No changed test plan is available for a receipt.");
  if (!result.ok) {
    throw new Error(`Test impact policy failed:\n${result.errors.join("\n")}`);
  }
  const outputPath = resolve(output);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, renderReceipt(result));
  console.log(`Test receipt written to ${outputPath}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}

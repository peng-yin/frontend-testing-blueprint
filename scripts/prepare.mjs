import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (existsSync(".git")) {
  execFileSync("husky", { stdio: "inherit", shell: true });
} else {
  console.log(
    "Husky skipped because this template is not inside a Git repository.",
  );
}

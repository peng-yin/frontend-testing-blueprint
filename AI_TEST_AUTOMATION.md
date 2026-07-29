# AI 测试补全编排

该编排在可信的同仓库 PR 上运行 Codex，自动补齐受影响测试，执行确定性验证，再通过
GitHub Contents API 将改动写回 PR 分支。它不会执行 `git push`。

## 启用

1. 在仓库 `Settings → Secrets and variables → Actions` 创建
   `OPENAI_API_KEY` Repository Secret。
2. 为同仓库 PR 添加 `ai-test-completion` 标签。
3. 后续每次由可信成员推送新改动时，只要标签仍存在，编排会再次运行。

也可以在 Actions 页面手动运行 **AI Test Completion**，输入 PR 编号。

## 安全边界

- 只接受 `OWNER`、`MEMBER` 或 `COLLABORATOR` 创建的同仓库 PR。
- Fork PR 在接触 `OPENAI_API_KEY` 前即被拒绝。
- 不使用 `pull_request_target` 执行 PR 代码。
- Codex 使用 `drop-sudo`、`:workspace` 权限配置和固定版本 Action。
- GitHub Contents API 写入前检查 PR 分支 SHA；分支已变化时停止发布。
- AI 生成后由无 OpenAI Secret 的独立 Job 重跑所有门禁。
- `github-actions[bot]` 写回产生的同步事件不会递归触发 AI。

## 自动闭环

1. Resolve：校验 PR、仓库来源、作者关系和触发标签。
2. Generate：Codex 按 `AGENTS.md` 与 `.testing/policy.yml` 修改测试。
3. Verify：应用候选改动，执行影响检查、Vitest、Storybook、Stryker 和 Playwright。
4. Publish：验证通过后，通过 Contents API 写回 PR 分支并发布测试回执。
5. CI：正常 PR CI 再次执行，最终由 `Quality gate` 决定是否允许合并。

## 变更计划

每次行为变化都必须增加或更新 `.testing/plans/*.json`。计划必须满足
`.testing/test-plan.schema.json`，并列出：

- 可观察行为；
- 受影响源码；
- 必须执行的测试层；
- 同一 PR 中变化的测试证据；
- 实际验证命令。

本地检查：

```bash
pnpm test:impact -- --working-tree
pnpm test:receipt -- --working-tree
```

CI 会拒绝缺少计划、缺少测试层或证据未随 PR 变化的行为修改。

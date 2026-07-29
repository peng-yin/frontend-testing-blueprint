# 贡献指南

感谢你帮助改进 Frontend Testing Blueprint。本仓库强调可复制、可验证和最小重复，
任何改动都应说明它改善了哪一层测试或哪一项工程门禁。

## 开发环境

- Node.js 24+
- Corepack
- pnpm 11.17+

```bash
corepack enable
pnpm install
pnpm exec playwright install chromium
pnpm verify
pnpm test:e2e:pr
```

## 提交改动

1. 从 `main` 创建功能分支。
2. 保持改动范围单一，并为行为变化补充相应层级的测试。
3. 使用 Conventional Commits，例如 `feat: add visual regression gate`。
4. 提交 PR，并完成 PR 模板中的检查项。
5. 等待 `Quality gate` 通过和至少一名维护者批准。

## 测试层级选择

- 纯函数和业务分支：Vitest 单元测试。
- React 用户行为与请求状态：Testing Library + MSW。
- 组件状态、交互和无障碍：Storybook `play()` 测试。
- 跨页面或生产构建关键路径：Playwright E2E。
- 测试有效性：Stryker 变异测试。

不要在多个层级重复同一组断言。优先选择能够稳定发现缺陷的最低测试层级。

## 质量要求

PR 必须通过类型检查、ESLint、格式检查、覆盖率、Storybook 浏览器测试、生产构建和
Chromium E2E。涉及测试关键逻辑的改动还应手动运行：

```bash
pnpm test:mutation
pnpm test:e2e
```

禁止通过增加无意义断言、排除业务文件或降低阈值来绕过质量门禁。

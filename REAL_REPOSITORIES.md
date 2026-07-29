# 真实 GitHub 仓库案例

调研不是把多个官方 Demo 拼成“看起来能用”的配置，而是先找到长期维护的真实仓库，再用
各工具官方文档校准。

## 主案例：Recharts

[recharts/recharts](https://github.com/recharts/recharts) 是本模板最接近的整体参考。
截至调研时，它的 `package.json` 同时包含：

- Vitest 4.1.x、jsdom、Testing Library；
- Storybook 10 + `@storybook/addon-vitest`；
- Stryker 9 + Vitest Runner + TypeScript checker；
- Playwright 1.62 与三浏览器视觉回归；
- ESLint 9、Husky、lint-staged；
- GitHub Actions 中并行的 build、unit、Storybook、typecheck、integration、VR 和 deploy。

可直接阅读：

- [依赖与脚本](https://github.com/recharts/recharts/blob/main/package.json)
- [Vitest 多项目配置](https://github.com/recharts/recharts/blob/main/vitest.config.mts)
- [专用 mutation Vitest 配置](https://github.com/recharts/recharts/blob/main/vitest.config-mutation.mts)
- [Stryker 配置](https://github.com/recharts/recharts/blob/main/stryker.config.mjs)
- [Storybook 配置](https://github.com/recharts/recharts/blob/main/storybook/main.ts)
- [并行 CI/CD](https://github.com/recharts/recharts/blob/main/.github/workflows/ci.yml)

最值得复用的点：

1. Vitest `projects` 把 library、website、build output、tree-shaking、Storybook 分开；
2. Storybook 项目在 Playwright browser provider 中执行；
3. Stryker 使用单独的 Vitest config，避开 mutation runner 与多项目配置耦合；
4. build artifact 被后续 Job 下载复用；
5. Playwright 三浏览器分别产出 blob report，再合并为一个 HTML report；
6. Job 使用 `needs` 显式表达依赖，避免串行执行所有检查。

本模板没有照抄其全部复杂度：对于普通业务仓库，动态 integration matrix、文档生成、
bundle watch 与 PR 预览部署应按需引入。

## MSW + Storybook：官方插件仓库

[mswjs/msw-storybook-addon](https://github.com/mswjs/msw-storybook-addon) 本身使用
Storybook 10、Vitest 4、Playwright 和 MSW 2，是当前 MSW Storybook 集成的权威例子：

- [CSF Next preview 配置](https://github.com/mswjs/msw-storybook-addon/blob/main/tests/factory/.storybook/preview.ts)
- [每个 Story 覆盖 handler 与 play](https://github.com/mswjs/msw-storybook-addon/blob/main/tests/factory/stories/basic.stories.tsx)
- [Storybook Vitest Browser 配置](https://github.com/mswjs/msw-storybook-addon/blob/main/tests/factory/vitest.config.ts)

模板据此采用 `definePreview({ addons: [addonMsw()] })` 与 Story 级 `beforeEach({ msw })`，
没有继续使用已弃用的 CSF3 loader。

## MSW 的真实测试矩阵

[mswjs/msw](https://github.com/mswjs/msw) 自身同时运行 Vitest Node、Playwright Browser、
E2E、memory 和 typings tests。它的
[package.json](https://github.com/mswjs/msw/blob/main/package.json) 还展示了：

- Commitlint + Conventional Commits；
- staged lint/format；
- Node 与 browser 测试分离；
- 一个网络 Mock 库如何对不同运行时建立独立配置。

它使用 `simple-git-hooks` 而不是 Husky，说明 Hook manager 是可替换的；体系真正需要的是
`pre-commit` 的快速 staged check 与 `commit-msg` 的语义校验。

## Commitlint + Husky

[conventional-changelog/commitlint](https://github.com/conventional-changelog/commitlint)
自己的
[package.json](https://github.com/conventional-changelog/commitlint/blob/master/package.json)
使用 Husky、lint-staged、Vitest 4，并在仓库内维护 Conventional Commit 规则。

本模板保留最小 Hook：

```text
.husky/pre-commit  → lint-staged
.husky/commit-msg  → commitlint --edit "$1"
```

CI 再对 PR 的 base/head commit range 执行一次 Commitlint，防止 `--no-verify` 绕过。

## 为什么不强求一个仓库包含全部工具

成熟仓库会根据产品形态裁剪工具：组件库通常拥有更强的 Storybook/视觉回归，业务应用通常
拥有更强的 E2E，网络库则拥有更复杂的运行时矩阵。硬找“恰好包含所有依赖”的仓库，容易
把偶然的依赖组合误当成架构。

这里采用：

- Recharts：整体编排与高强度测试；
- MSW 官方仓库：网络 Mock 与 Storybook 集成；
- Commitlint 官方仓库：提交治理；
- 各项目官方文档：校验当前 API 与推荐路径。

因此模板是经过真实实践交叉验证的最小通用集合，而不是某个仓库的复制品。

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import storybook from "eslint-plugin-storybook";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "@vitest/eslint-plugin";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "storybook-static/**",
      ".stryker-tmp/**",
      "artifacts/**",
      "coverage/**",
      "public/mockServiceWorker.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "*.config.mjs",
            "scripts/*.mjs",
            ".storybook/*.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "test/**/*.{ts,tsx}"],
    plugins: {
      "testing-library": testingLibrary,
      vitest,
    },
    rules: {
      ...testingLibrary.configs["flat/react"].rules,
      ...vitest.configs.recommended.rules,
      "vitest/expect-expect": "error",
      "vitest/no-focused-tests": "error",
    },
  },
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
  {
    files: ["test/setup.ts"],
    rules: {
      "testing-library/no-manual-cleanup": "off",
    },
  },
  ...storybook.configs["flat/recommended"],
  prettier,
);

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000",
      },
    },
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["**/.stryker-tmp/**"],
    setupFiles: ["./test/setup.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    clearMocks: true,
  },
});

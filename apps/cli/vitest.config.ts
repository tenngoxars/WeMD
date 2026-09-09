import { defineConfig } from "vitest/config";

/**
 * CLI render tests launch a real Chromium process to verify the generated
 * WeChat-ready HTML. A 15-second budget accommodates cold browser startup on
 * local macOS and CI machines while keeping failures bounded.
 */
export default defineConfig({
  test: {
    testTimeout: 15_000,
  },
});

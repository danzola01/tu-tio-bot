import { defineConfig } from "vitest/config";
export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        include: ["tests/**/*.test.ts"],
        poolOptions: {
            threads: {
                singleThread: true,
            },
        },
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
        },
    },
});
//# sourceMappingURL=vitest.config.js.map
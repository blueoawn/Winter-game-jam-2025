import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    test: {
        // Use happy-dom for lightweight DOM simulation
        environment: 'happy-dom',

        // Include test files
        include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

        // Exclude node_modules and build output
        exclude: ['node_modules', 'dist', '.git'],

        // Global test APIs (describe, it, expect) without imports
        globals: true,

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['network/**/*.ts', 'managers/**/*.ts'],
            exclude: ['**/*.test.ts', '**/*.spec.ts'],
        },

        // Setup files run before each test file
        setupFiles: ['./tests/setup.ts'],

        // Type checking
        typecheck: {
            enabled: true,
        },
    },
    resolve: {
        alias: {
            '@': '/src',
        },
    },
});

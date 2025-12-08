import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins: [vue()],
    base: './',
    publicDir: 'public',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    }
});

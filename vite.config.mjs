import { defineConfig } from 'vite';

process.env.VITE_SITE_URL ??= '';

export default defineConfig({
    root: 'public',
    publicDir: 'static',
    base: './',

    server: {
        port: 3050,
    },

    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },

    test: {
        root: '.',
        include: ['tests/**/*.test.js'],
    },
});

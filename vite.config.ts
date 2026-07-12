import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  preview: {
    port: Number(process.env.PORT) || 5317,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});

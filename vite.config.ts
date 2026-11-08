import { defineConfig } from 'vite';

// Relative base so the built site works from any path or subdomain.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
});

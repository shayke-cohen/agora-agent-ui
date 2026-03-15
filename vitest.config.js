import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.{js,jsx}'],
    exclude: ['packages/canvas/**'],
  },
});

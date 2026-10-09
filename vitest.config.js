import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/server.js', 'src/scripts/**', '**/*.test.js', '**/*.spec.js']
    },
    globals: true,
    testTimeout: 10000
  }
});
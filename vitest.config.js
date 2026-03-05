import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      DATABASE_PATH: 'data/test.db',
      JWT_SECRET: 'test-secret-key',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'admin',
    },
    fileParallelism: false,
    globalSetup: './tests/global-setup.js',
  },
});

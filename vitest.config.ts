import { defineConfig } from 'vitest/config';

// 게임 규칙/AI/스토어는 순수 TS 라 node 환경에서 바로 테스트한다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

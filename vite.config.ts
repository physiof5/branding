import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → dist/        (일반 정적 배포용, 청크 분리)
// `npm run build:single` → dist-single/ (JS/CSS 를 index.html 하나에 인라인 — 단일 파일 공유/데모용)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 2500,
    },
    server: { host: true },
  };
});

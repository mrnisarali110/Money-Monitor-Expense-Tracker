
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env': env
    },
    build: {
      rollupOptions: {
        // Treat @google/genai as external (do not bundle)
        external: ['@google/genai'],
        output: {
          globals: {
            '@google/genai': 'GoogleGenAI'
          }
        }
      }
    },
    optimizeDeps: {
      // Exclude from pre-bundling in dev mode
      exclude: ['@google/genai']
    }
  };
});

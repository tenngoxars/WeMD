import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Electron 打包需要使用相对路径，Web 部署使用绝对路径
const isElectronBuild = process.env.ELECTRON_BUILD === 'true';

// https://vite.dev/config/
export default defineConfig({
  base: isElectronBuild ? './' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库单独分块
          'react-vendor': ['react', 'react-dom'],
          // CodeMirror 编辑器单独分块
          'codemirror': [
            'codemirror',
            '@codemirror/lang-markdown',
            '@codemirror/language',
            '@codemirror/state',
            '@codemirror/view',
            '@uiw/codemirror-theme-github',
          ],
        },
      },
    },
  },
})

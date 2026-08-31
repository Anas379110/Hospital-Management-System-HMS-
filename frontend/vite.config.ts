import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Code Splitting — راجع PROJECT-AUDIT.md §9 (Performance، تحسين مؤجَّل 🟢).
        // يفصل مكتبات ثقيلة نادرة التغيير (MUI، React) عن كود التطبيق نفسه،
        // فيستفيد المتصفح من Cache طويل الأمد لها بين كل تحديث للتطبيق.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{outDir:'dist-demo',sourcemap:false,rollupOptions:{input:'demo.html'}}});

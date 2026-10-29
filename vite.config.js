import { defineConfig } from 'vite';

export default defineConfig({
  // Caminhos relativos: o build roda em qualquer subpasta
  // (GitHub Pages, itch.io, ou abrir direto num servidor estático).
  base: './',

  // Arquivos estáticos (texturas, modelos, sons) ficam em /public
  // e são servidos na raiz: /public/tex/asfalto.png -> 'tex/asfalto.png'
  publicDir: 'public',

  server: {
    port: 5173,
    open: true,
  },

  preview: {
    port: 4173,
  },

  // Permite importar esses formatos direto no código (import url from './x.glb')
  assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr', '**/*.ktx2'],

  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    // Three.js sozinho passa de 500 kB; sobe o limite pra não poluir o log
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Three.js num chunk separado: muda pouco, fica em cache no navegador
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },

  // Vitest: testes de logica rodam em Node, sem navegador
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
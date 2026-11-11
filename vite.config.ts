import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relativ base gjør at appen kan ligge i en undermappe (for eksempel GitHub Pages).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react()],
  build: mode === 'artifact'
    ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false, rolldownOptions: { output: { codeSplitting: false } } }
    : {},
}))

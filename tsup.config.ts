import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/qrbit.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['./native.js'],
  noExternal: [],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js'
    }
  }
})
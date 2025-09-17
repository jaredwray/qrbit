import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/qrbit.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['./native.js', './native.cjs'],
  noExternal: [],
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js'
    }
  },
  onSuccess: async () => {
    // After successful build, replace ./native.js with ./native.cjs in the CommonJS output
    const fs = await import('fs')
    const path = await import('path')

    const cjsFile = path.join('dist', 'qrbit.cjs')

    if (fs.existsSync(cjsFile)) {
      let content = fs.readFileSync(cjsFile, 'utf8')
      content = content.replace(/require\(["']\.\/native\.js["']\)/g, 'require("./native.cjs")')
      fs.writeFileSync(cjsFile, content, 'utf8')
    }
  }
})

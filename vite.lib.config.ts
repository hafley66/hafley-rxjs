import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { join } from 'path'
import dts from 'vite-plugin-dts'

export function createLibConfig(
  packageDir: string,
  rootDir: string = resolve(packageDir, '../..'),
  entries?: Record<string, string>,
) {
  // Read package.json to get dependencies
  const pkgPath = join(packageDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

  // Collect all external dependencies (mark as external so they don't get bundled)
  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ]

  const libEntry = entries ?? { index: resolve(packageDir, 'src/index.ts') }

  return defineConfig(({ command }) => ({
    plugins: [
      ...(command === "build"
        ? [
            dts({
              include: ["src/**/*.ts"],
              exclude: ["src/**/*.test.ts"],
              outDir: resolve(packageDir, "dist"),
            }),
          ]
        : []),
    ],
    build: {
      lib: {
        entry: libEntry,
        formats: ['es'],
      },
      rollupOptions: {
        // Mark all dependencies as external (won't be bundled)
        external: (id) => {
          // Don't bundle node_modules
          if (id.includes('node_modules')) return true
          // Don't bundle anything outside src
          if (!id.startsWith('.') && !id.startsWith('/')) {
            return external.some(dep => id.startsWith(dep))
          }
          return false
        },
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
          minify: false,
          keepNames: true,
          minifyInternalExports: false,
        },
        preserveEntrySignatures: 'strict'
      },
      outDir: resolve(packageDir, 'dist'),
      emptyOutDir: true,
      sourcemap: true,
      minify: false,
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: [resolve(rootDir, 'vitest.setup.ts')],
    },
  }))
}

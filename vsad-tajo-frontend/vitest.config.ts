import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

import { dependencies } from './package.json'
const externalPackages = [...Object.keys(dependencies || {})]

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      server: {
        deps: {
          inline: externalPackages,
        },
      },
      reporters: ['junit', 'json', 'default'],
      outputFile: {
        junit: './junit-report.xml',
        json: './json-report.json',
      },
      coverage: {
        provider: 'istanbul', // or 'v8'
        reporter: ['json', 'cobertura', 'html', 'text'],
        include: ['**/components/**', '**/utils/**'],
      },
    },
  })
)

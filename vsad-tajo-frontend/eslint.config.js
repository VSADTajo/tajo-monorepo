// eslint.config.mjs

import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-plugin-prettier/recommended'
import vueConfigTypescript from '@vue/eslint-config-typescript'
import vueConfigPrettier from '@vue/eslint-config-prettier'
import pluginVitest from '@vitest/eslint-plugin'
import pluginCypress from 'eslint-plugin-cypress/flat'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
  },

  {
    ...pluginCypress.configs.recommended,
    files: ['cypress/e2e/**/*.{cy,spec}.{js,ts,jsx,tsx}', 'cypress/support/**/*.{js,ts,jsx,tsx}'],
  },

  // js
  pluginJs.configs.recommended,
  {
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
  // ts
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { args: 'after-used', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // vue
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      ...vueConfigTypescript.rules,
      ...vueConfigPrettier.rules,
      'prettier/prettier': [
        'warn',
        {
          endOfLine: 'auto', // Ajuste automático según sistema
          tabWidth: 2,
          useTabs: false,
          vueIndentScriptAndStyle: true,
        },
      ],
      semi: ['warn', 'never'],
      'vue/script-setup-uses-vars': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'warn',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/valid-v-slot': [
        'error',
        {
          allowModifiers: true,
        },
      ],
    },
  },
  {
    ignores: ['node_modules', '.nuxt', '.output', 'dist'],
  },
  // prettier
  prettier,
  {
    rules: {
      'prettier/prettier': [
        'warn',
        {
          singleQuote: true,
          semi: false,
          tabWidth: 2,
          useTabs: false,
          endOfLine: 'crlf', // Fuerza que ESLint use la misma línea de fin que Prettier
        },
      ],
      semi: ['warn', 'never'],
      'vue/script-setup-uses-vars': 'error',
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'warn',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/valid-v-slot': [
        'error',
        {
          allowModifiers: true,
        },
      ],
    },
  },
]

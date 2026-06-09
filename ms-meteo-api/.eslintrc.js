module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint/eslint-plugin', 'prettier', 'boundaries'],
    extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended', 'plugin:boundaries/recommended'],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    ignorePatterns: ['.eslintrc.js'],
    settings: {
        'boundaries/include': ['src/**/*.ts'],
        // Order matters: more specific patterns must come BEFORE the broader ones,
        // because boundaries uses first-match for type assignment.
        'boundaries/elements': [
            // Cross-layer exception explicitly allowed by the platform CLAUDE.md:
            // command/query handlers may import cache key constants from this single file.
            { type: 'infra-cache-registry', pattern: 'src/app/infrastructure/cache/cache-config.registry.ts', mode: 'file' },
            { type: 'domain', pattern: 'src/app/domain/**' },
            { type: 'application', pattern: 'src/app/application/**' },
            { type: 'infrastructure', pattern: 'src/app/infrastructure/**' },
            { type: 'api', pattern: 'src/app/api/**' },
            { type: 'common', pattern: 'src/common/**' },
            { type: 'configuration', pattern: 'src/configuration/**' },
            { type: 'health', pattern: 'src/health/**' },
            { type: 'swagger', pattern: 'src/swagger/**' },
            { type: 'migrations', pattern: 'src/migrations/**' },
            { type: 'root', pattern: 'src/*.ts', mode: 'file' },
        ],
    },
    rules: {
        'prettier/prettier': 'error',
        indent: 'off',
        'no-console': 'warn',
        quotes: ['error', 'single'],
        'linebreak-style': ['error', 'unix'],
        semi: ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        '@typescript-eslint/consistent-type-assertions': 'error',
        '@typescript-eslint/dot-notation': 'error',
        '@typescript-eslint/no-misused-new': 'error',
        '@typescript-eslint/no-namespace': 'error',
        '@typescript-eslint/no-var-requires': 'error',
        '@typescript-eslint/prefer-for-of': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-namespace-keyword': 'error',
        '@typescript-eslint/ban-types': [
            'error',
            {
                types: {
                    Object: {
                        message: 'Avoid using the `Object` type. Did you mean `object`?',
                    },
                    Function: {
                        message: 'Avoid using the `Function` type. Prefer a specific function type, like `() => void`.',
                    },
                    Boolean: {
                        message: 'Avoid using the `Boolean` type. Did you mean `boolean`?',
                    },
                    Number: {
                        message: 'Avoid using the `Number` type. Did you mean `number`?',
                    },
                    String: {
                        message: 'Avoid using the `String` type. Did you mean `string`?',
                    },
                    Symbol: {
                        message: 'Avoid using the `Symbol` type. Did you mean `symbol`?',
                    },
                },
            },
        ],
        '@typescript-eslint/quotes': ['error', 'single'],
        '@typescript-eslint/triple-slash-reference': [
            'error',
            {
                path: 'always',
                types: 'prefer-import',
                lib: 'always',
            },
        ],
        '@typescript-eslint/unified-signatures': 'error',
        'constructor-super': 'error',
        eqeqeq: ['error', 'smart'],
        'guard-for-in': 'error',
        'max-len': [
            'error',
            {
                code: 250,
            },
        ],
        'new-parens': 'error',
        'no-bitwise': 'error',
        'no-caller': 'error',
        'no-cond-assign': 'error',
        'no-debugger': 'error',
        'no-eval': 'error',

        'no-new-wrappers': 'error',
        'no-throw-literal': 'error',
        'no-trailing-spaces': 'error',
        'no-undef-init': 'error',

        'no-unsafe-finally': 'error',
        'no-unused-labels': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'prefer-const': 'error',
        radix: 'error',
        'spaced-comment': [
            'error',
            'always',
            {
                markers: ['/'],
            },
        ],
        'use-isnan': 'error',

        // ─────────────────────────────────────────────────────────────
        // Hexagonal layering enforcement (eslint-plugin-boundaries)
        // ─────────────────────────────────────────────────────────────
        // The constitution defines: api → application → domain ← infrastructure
        // Concrete rules:
        //   - domain      MUST NOT depend on application/infrastructure/api
        //   - application MUST NOT depend on infrastructure (except cache registry, allowed by boilerplate)
        //                 MUST NOT depend on api
        //                 MUST NOT use node:* builtins (use a port instead)
        //   - api         MUST NOT depend on infrastructure
        //   - infrastructure may depend on domain (ports + types)
        // Cross-cutting (common, configuration, health, swagger, migrations) is allowed everywhere.
        'boundaries/element-types': [
            'error',
            {
                default: 'disallow',
                rules: [
                    {
                        from: 'domain',
                        allow: ['domain', 'common', 'configuration', 'swagger'],
                    },
                    {
                        from: 'application',
                        // Note: infrastructure is NOT here. Only the cache-registry escape hatch is allowed.
                        allow: ['application', 'domain', 'common', 'configuration', 'swagger', 'infra-cache-registry'],
                    },
                    {
                        from: 'api',
                        allow: ['api', 'application', 'domain', 'common', 'configuration', 'swagger'],
                    },
                    {
                        from: 'infrastructure',
                        allow: ['infrastructure', 'domain', 'common', 'configuration', 'swagger', 'infra-cache-registry'],
                    },
                    {
                        from: 'infra-cache-registry',
                        allow: ['domain', 'common'],
                    },
                    {
                        from: 'common',
                        allow: ['common', 'domain', 'configuration'],
                    },
                    {
                        from: 'configuration',
                        allow: ['configuration', 'common'],
                    },
                    {
                        from: 'health',
                        allow: ['health', 'configuration', 'common'],
                    },
                    {
                        from: 'swagger',
                        allow: ['swagger', 'common'],
                    },
                    {
                        from: 'migrations',
                        allow: ['migrations', 'domain', 'common'],
                    },
                    {
                        from: 'root',
                        allow: ['root', 'application', 'api', 'infrastructure', 'common', 'configuration', 'health', 'swagger'],
                    },
                ],
            },
        ],
        'boundaries/no-unknown': 'off',
        'boundaries/no-unknown-files': 'off',
        // Forbid node:* builtins from application/ and domain/ — those layers must use ports.
        'no-restricted-imports': [
            'error',
            {
                patterns: [
                    {
                        group: ['node:*'],
                        message:
                            'Do not import node:* builtins from application/ or domain/. Define a domain port (e.g. IFileSystem) and bind the impl in infrastructure/.',
                    },
                ],
            },
        ],
    },
    overrides: [
        // The infrastructure layer is allowed to import node:* and third-party libs freely.
        {
            files: ['src/app/infrastructure/**/*.ts'],
            rules: {
                'no-restricted-imports': 'off',
            },
        },
        // Tests have their own world.
        {
            files: ['test/**/*.ts'],
            rules: {
                'boundaries/element-types': 'off',
                'no-restricted-imports': 'off',
            },
        },
        // Migrations need the typeorm runtime; configuration needs node primitives.
        {
            files: ['src/migrations/**/*.ts', 'src/configuration/**/*.ts'],
            rules: {
                'no-restricted-imports': 'off',
            },
        },
    ],
};

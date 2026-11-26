import tseslint from 'typescript-eslint';
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'browser-artifacts/**'] },
  { files: ['src/**/*.ts', 'src/**/*.tsx', 'test/**/*.ts', 'test/**/*.tsx', 'test-real-browser/**/*.mjs', 'test-real-postgres/**/*.mjs'], languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } } }, plugins: { '@typescript-eslint': tseslint.plugin }, rules: {
    'constructor-super': 'error', 'for-direction': 'error', 'no-async-promise-executor': 'error', 'no-constant-condition': 'error', 'no-debugger': 'error', 'no-dupe-args': 'error', 'no-duplicate-case': 'error', 'no-ex-assign': 'error', 'no-fallthrough': 'error', 'no-irregular-whitespace': 'error', 'no-loss-of-precision': 'error', 'no-misleading-character-class': 'error', 'no-prototype-builtins': 'error', 'no-self-assign': 'error', 'no-setter-return': 'error', 'no-sparse-arrays': 'error', 'no-unreachable': 'error', 'no-unsafe-finally': 'error', 'no-unsafe-negation': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', '@typescript-eslint/no-explicit-any': 'error'
  } }
];

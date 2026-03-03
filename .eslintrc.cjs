module.exports = {
  root: true,
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '.history/',
  ],
  overrides: [
    {
      files: ['frontend/**/*.{js,jsx}'],
      excludedFiles: ['frontend/src/test/**/*.{js,jsx}'],
      env: {
        browser: true,
        node: true,
        es2022: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      extends: ['eslint:recommended', 'prettier'],
      rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
    {
      files: ['**/*.js'],
      excludedFiles: ['frontend/**/*.{js,jsx}', '**/*.test.js'],
      env: {
        node: true,
        es2022: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'script',
      },
      extends: ['eslint:recommended', 'prettier'],
      rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
    {
      files: ['**/*.test.js', 'frontend/src/test/**/*.{js,jsx}'],
      env: {
        node: true,
        browser: true,
        jest: true,
        es2022: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      extends: ['eslint:recommended', 'prettier'],
      rules: {
        'no-undef': 'off',
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },
  ],
}
export default [{
  ignores: ['main.js'],
}, {
  files: ['src/**/*.js', 'rollup.config.js', 'eslint.config.js'],
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    globals: Object.fromEntries([
      'Blob', 'URL', 'DOMParser', 'TextDecoder', 'setTimeout', 'clearTimeout',
      'console', 'process',
    ].map(name => [name, 'readonly'])),
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    'curly': ['error', 'all'],
    'eqeqeq': ['error', 'always'],
    'prefer-const': 'error',
    'no-var': 'error',
  },
}];

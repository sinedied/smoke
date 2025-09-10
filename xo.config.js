/** @type {import('xo').FlatXoConfig} */
const config = [
  {
    ignores: ['test/mocks/**/*'],
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    space: true,
    prettier: true,
    rules: {
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/no-await-expression-member': 'off',
      'unicorn/import-style': 'off',
      'n/prefer-global/buffer': 'off',
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        describe: true,
        it: true,
        beforeEach: true,
        afterEach: true,
        expect: true,
        jest: true,
      },
    },
  },
];

export default config;

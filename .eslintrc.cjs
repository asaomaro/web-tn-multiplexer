/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
    project: false,
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: {
    node: true,
    es2023: true,
  },
  ignorePatterns: ["**/dist/**", "**/node_modules/**", "*.cjs"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
  },
  overrides: [
    {
      // packages/web はブラウザで動く（Node の env ではない。.vue 自体は vue-tsc が型検査するのでここでは対象外）。
      files: ["packages/web/src/**/*.ts"],
      env: { node: false, browser: true, es2023: true },
    },
  ],
};

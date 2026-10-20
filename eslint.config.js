import vue from "eslint-plugin-vue";
import globals from "globals";
export default [
  ...vue.configs["flat/essential"],
  { ignores: ["dist/**"] },
  {
    files: ["**/*.{js,mjs,vue}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
];

// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: ["src/**", "dist/**"],
}, {
  rules: {
    "@stylistic/quote-props": ["error", "as-needed"],
    "@stylistic/arrow-parens": ["error", "always"],
    "@stylistic/operator-linebreak": ["error", "after", { overrides: { "?": "before", ":": "before" } }],
    "@typescript-eslint/no-unused-vars": "off",
  },
});

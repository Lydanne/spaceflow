// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: ["src/**", "dist/**"],
}, {
  rules: {
    "@stylistic/quote-props": ["error", "as-needed"],
  },
});

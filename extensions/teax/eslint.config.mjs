// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  ignores: ["src/**", "dist/**"],
}, {
  rules: {
    // ─── Stylistic 规则 ─────────────────────────────────────
    "@stylistic/quote-props": ["error", "as-needed"],
    "@stylistic/arrow-parens": ["error", "always"],
    "@stylistic/operator-linebreak": ["error", "before", { overrides: { "?": "before", ":": "before", "|": "before" } }],
    "@stylistic/indent": ["error", 2, { SwitchCase: 1, offsetTernaryExpressions: true }],
    "@stylistic/comma-dangle": ["error", "always-multiline"],
    "@stylistic/semi": ["error", "always"],
    "@stylistic/quotes": ["error", "double", { avoidEscape: true, allowTemplateLiterals: "always" }],
    "@stylistic/brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/array-bracket-spacing": ["error", "never"],
    "@stylistic/computed-property-spacing": ["error", "never"],
    "@stylistic/space-before-blocks": ["error", "always"],
    "@stylistic/space-before-function-paren": ["error", { anonymous: "always", named: "never", asyncArrow: "always" }],
    "@stylistic/space-infix-ops": "error",
    "@stylistic/eol-last": ["error", "always"],
    "@stylistic/no-trailing-spaces": "error",

    // ─── TypeScript 规则 ────────────────────────────────────
    "@typescript-eslint/no-unused-vars": "off",

    // ─── Vue 规则 ────────────────────────────────────────────
    "vue/singleline-html-element-content-newline": "off",
    "vue/max-attributes-per-line": ["error", { singleline: { max: 3 }, multiline: { max: 1 } }],
    "vue/html-indent": ["error", 2, { attribute: 1, baseIndent: 1 }],
    "vue/first-attribute-linebreak": ["error", { singleline: "ignore", multiline: "below" }],
    "vue/multi-word-component-names": "off",
    "vue/no-v-html": "warn", // 允许 v-html 但给出警告（用于渲染 HTML 日志等场景）
  },
});

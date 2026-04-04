import js from "@eslint/js"
import pluginNext from "@next/eslint-plugin-next"
import ts from "typescript-eslint"

export default ts.config(
  {
    ignores: [".next/**", "next-env.d.ts"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    plugins: {
      "@next/next": pluginNext,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
)

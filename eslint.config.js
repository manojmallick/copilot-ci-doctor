import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "docs-vp/", ".copilot-ci-doctor/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js", "scripts/**/*.mjs", "test/**/*.js", "action/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["test/helpers/*.cjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: { ...globals.node } },
  },
];

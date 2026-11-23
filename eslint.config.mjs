import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    // .claude/** holds vendored agent skills, not app code.
    ignores: [".next/**", "node_modules/**", "out/**", "dist/**", "coverage/**", "public/maplibre/**", ".claude/**"]
  }
];

export default eslintConfig;

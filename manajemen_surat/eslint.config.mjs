import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "test-results/**", "src/components/layout/portal-shell.tsx"],
  },
  ...nextVitals,
];

export default config;

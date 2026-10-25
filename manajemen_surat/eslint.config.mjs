import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "test-results/**", "src/components/layout/portal-shell.tsx", "**/*.d.mts"],
  },
  ...nextVitals,
];

export default config;

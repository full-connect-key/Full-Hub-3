import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Saida do gerador de prototipo, nao fonte. `.prototipo` e uma copia
    // inteira do projeto com o `.next` dentro: sem ignorar, o lint demora
    // minutos e acusa erros de codigo gerado que ninguem escreveu nem vai
    // corrigir. O .gitignore ja os ignora; o ESLint tem a lista dele.
    ".prototipo/**",
    ".captura/**",
    "prototipos/**",
  ]),
]);

export default eslintConfig;

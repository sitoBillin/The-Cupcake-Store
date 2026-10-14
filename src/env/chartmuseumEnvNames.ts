/**
 * Nombres de variables en `.env` para ChartMuseum (proxy de Vite).
 * No incluir valores secretos en el código: solo estas claves.
 */
export const CHARTMUSEUM_DOTENV_KEYS = {
  baseUrl: "CHARTMUSEUM_BASE_URL",
  user: "CHARTMUSEUM_USER",
  password: "CHARTMUSEUM_PASSWORD",
  repoPath: "CHARTMUSEUM_REPO_PATH",
} as const;

export function readChartmuseumEnvStrings(
  env: Record<string, string>,
): {
  baseUrl: string;
  user: string;
  password: string;
  repoPath: string;
} {
  return {
    baseUrl: env[CHARTMUSEUM_DOTENV_KEYS.baseUrl] ?? "",
    user: env[CHARTMUSEUM_DOTENV_KEYS.user] ?? "",
    password: env[CHARTMUSEUM_DOTENV_KEYS.password] ?? "",
    repoPath: env[CHARTMUSEUM_DOTENV_KEYS.repoPath] ?? "",
  };
}

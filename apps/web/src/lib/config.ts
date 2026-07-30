/**
 * Base da API. Em desenvolvimento fica vazio (o proxy do Vite encaminha
 * /api). Em producao, defina VITE_API_URL com a URL do backend (Railway).
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

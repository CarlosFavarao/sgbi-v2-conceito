import "server-only";

/**
 * Segredo de sessão usado quando `JWT_SECRET` não está definido. O modo conceito
 * (D47) aceita qualquer usuário e senha, então não há o que proteger: o valor
 * fixo só deixa o projeto rodar sem `.env`. Com autenticação de verdade, defina
 * `JWT_SECRET`.
 */
const SEGREDO_DO_CONCEITO = "sgbi-v2-conceito-segredo-de-demonstracao-sem-valor-de-seguranca";

/** Variáveis de ambiente, todas opcionais: o projeto não precisa de banco nem de API externa. */
export const env = {
  /** Assina o cookie de sessão (D45). */
  get jwtSecret() {
    const valor = process.env.JWT_SECRET;
    if (!valor) return SEGREDO_DO_CONCEITO;
    if (valor.length < 32) throw new Error("JWT_SECRET deve ter pelo menos 32 caracteres.");
    return valor;
  },
  /** Força a plataforma (`vx`, `cloud` ou `fivewin`) para ver o que cada uma mostra (D46). */
  get plataforma(): string | undefined {
    return process.env.PLATAFORMA?.trim() || undefined;
  },
  /** Identifica a instalação quando há mais de um SGBI no mesmo endereço (cookie próprio). */
  get clientSlug() {
    return (process.env.CLIENT_SLUG ?? "").trim().replace(/^\/+|\/+$/g, "");
  },
};

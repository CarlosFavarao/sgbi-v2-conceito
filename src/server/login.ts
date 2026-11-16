import "server-only";

import type { Usuario } from "./sessao";

/**
 * Modo conceito (D47): não há cadastro de usuários nem validação em outro sistema,
 * então qualquer nome e senha entram (a senha só precisa ser informada, na action). O nome digitado vira o nome mostrado no menu.
 * Quando houver autenticação de verdade (P59), é aqui que ela entra.
 */
export async function autenticar(usuario: string): Promise<Usuario> {
  const login = usuario.trim();
  const nome = login
    .split(/\s+/)
    .map((parte) => parte.charAt(0).toLocaleUpperCase("pt-BR") + parte.slice(1))
    .join(" ");
  return { login, nome: nome || login, admin: false, plataforma: "vx" };
}

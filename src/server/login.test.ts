import { describe, expect, it } from "vitest";
import { autenticar } from "./login";

describe("autenticar (modo conceito)", () => {
  it("aceita qualquer usuário", async () => {
    expect((await autenticar("qualquer")).login).toBe("qualquer");
    expect((await autenticar("x")).login).toBe("x");
  });

  it("usa o nome digitado, com a primeira letra de cada palavra em maiúscula", async () => {
    const u = await autenticar("maria da silva");
    expect(u.nome).toBe("Maria Da Silva");
    expect(u.login).toBe("maria da silva");
  });

  it("entra como VX, sem restrições", async () => {
    expect(await autenticar("a")).toMatchObject({ plataforma: "vx", admin: false });
  });
});

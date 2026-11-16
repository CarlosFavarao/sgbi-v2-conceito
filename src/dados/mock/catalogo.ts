import type { Empresa, Hierarquia, Loja } from "../tipos";
import { sorteio } from "./aleatorio";

export const EMPRESA: Empresa = {
  nomeFantasia: "Mercado Teste",
  cnpj: "12345678000190",
  codigoCliente: "1001",
};

/** Lojas do Mercado Teste e o tamanho de cada uma em relação à matriz. */
export const LOJAS: (Loja & { porte: number })[] = [
  { codigo: 1, descricao: "Mercado Teste · Matriz", porte: 1 },
  { codigo: 2, descricao: "Mercado Teste · Centro", porte: 0.72 },
  { codigo: 3, descricao: "Mercado Teste · Jardim América", porte: 0.5 },
];

export const porteDaLoja = (filial: number) => LOJAS.find((l) => l.codigo === filial)?.porte ?? 1;

type ProdutoBruto = [descricao: string, preco: number];
type SubgrupoBruto = [descricao: string, produtos: ProdutoBruto[]];
type GrupoBruto = [descricao: string, subgrupos: SubgrupoBruto[]];

type DepartamentoBruto = {
  descricao: string;
  /** Margem bruta média do departamento. */
  margem: number;
  /** Fração dos cupons que têm ao menos um item do departamento. */
  penetracao: number;
  /** Fração da venda que vai por faturamento (notas, não PDV). */
  faturamento: number;
  /** Unidades vendidas por dia, por produto, na matriz (antes da popularidade de cada produto). */
  unidades: number;
  grupos: GrupoBruto[];
};

const CATALOGO: DepartamentoBruto[] = [
  {
    descricao: "Mercearia",
    margem: 0.24,
    penetracao: 0.9,
    faturamento: 0.08,
    unidades: 62,
    grupos: [
      [
        "Grãos e Massas",
        [
          [
            "Arroz e Feijão",
            [
              ["Arroz Branco Tipo 1 5kg", 27.9],
              ["Feijão Carioca 1kg", 8.49],
              ["Feijão Preto 1kg", 9.19],
            ],
          ],
          [
            "Massas e Molhos",
            [
              ["Macarrão Espaguete 500g", 4.89],
              ["Macarrão Parafuso 500g", 4.69],
              ["Molho de Tomate Sachê 340g", 2.79],
            ],
          ],
        ],
      ],
      [
        "Café e Açúcar",
        [
          [
            "Café",
            [
              ["Café Torrado e Moído 500g", 18.9],
              ["Café Solúvel 100g", 14.5],
            ],
          ],
          [
            "Açúcar e Adoçantes",
            [
              ["Açúcar Refinado 1kg", 4.99],
              ["Açúcar Cristal 5kg", 21.9],
            ],
          ],
        ],
      ],
      [
        "Óleos e Temperos",
        [
          [
            "Óleos e Azeites",
            [
              ["Óleo de Soja 900ml", 7.79],
              ["Azeite Extra Virgem 500ml", 36.9],
            ],
          ],
          [
            "Temperos",
            [
              ["Sal Refinado 1kg", 3.29],
              ["Extrato de Tomate 340g", 4.19],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Hortifruti",
    margem: 0.38,
    penetracao: 0.55,
    faturamento: 0.02,
    unidades: 52,
    grupos: [
      [
        "Frutas",
        [
          [
            "Frutas Frescas",
            [
              ["Banana Prata kg", 6.99],
              ["Maçã Fuji kg", 9.9],
              ["Laranja Pera kg", 4.99],
              ["Mamão Formosa kg", 6.5],
            ],
          ],
          [
            "Frutas Tropicais",
            [
              ["Melancia kg", 3.99],
              ["Abacaxi un", 7.9],
            ],
          ],
        ],
      ],
      [
        "Verduras e Legumes",
        [
          [
            "Legumes",
            [
              ["Tomate kg", 7.49],
              ["Batata Lavada kg", 6.29],
              ["Cebola kg", 5.49],
              ["Cenoura kg", 4.99],
            ],
          ],
          [
            "Folhas",
            [
              ["Alface Crespa un", 3.49],
              ["Couve Manteiga maço", 3.99],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Açougue",
    margem: 0.26,
    penetracao: 0.5,
    faturamento: 0.03,
    unidades: 19,
    grupos: [
      [
        "Bovinos",
        [
          [
            "Cortes Bovinos",
            [
              ["Contra Filé kg", 49.9],
              ["Alcatra kg", 44.9],
              ["Patinho Moído kg", 36.9],
              ["Costela Bovina kg", 27.9],
            ],
          ],
        ],
      ],
      [
        "Aves e Suínos",
        [
          [
            "Frango",
            [
              ["Frango Inteiro Resfriado kg", 11.9],
              ["Peito de Frango kg", 17.9],
              ["Coxa e Sobrecoxa kg", 12.5],
            ],
          ],
          [
            "Suínos",
            [
              ["Linguiça Toscana kg", 19.9],
              ["Bisteca Suína kg", 17.5],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Padaria",
    margem: 0.45,
    penetracao: 0.48,
    faturamento: 0.01,
    unidades: 70,
    grupos: [
      [
        "Panificação",
        [
          [
            "Pães",
            [
              ["Pão Francês kg", 17.9],
              ["Pão de Forma 500g", 8.99],
              ["Pão de Queijo kg", 39.9],
            ],
          ],
        ],
      ],
      [
        "Confeitaria e Salgados",
        [
          [
            "Bolos e Doces",
            [
              ["Bolo de Cenoura un", 14.9],
              ["Sonho de Creme un", 5.5],
            ],
          ],
          [
            "Salgados",
            [
              ["Coxinha un", 6.5],
              ["Esfiha de Carne un", 5.9],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Bebidas",
    margem: 0.28,
    penetracao: 0.55,
    faturamento: 0.12,
    unidades: 42,
    grupos: [
      [
        "Refrigerantes e Sucos",
        [
          [
            "Refrigerantes",
            [
              ["Refrigerante Cola 2L", 9.49],
              ["Refrigerante Guaraná 2L", 8.49],
            ],
          ],
          [
            "Sucos e Água",
            [
              ["Suco de Uva Integral 1L", 13.9],
              ["Água Mineral 1,5L", 2.99],
            ],
          ],
        ],
      ],
      [
        "Cervejas e Vinhos",
        [
          [
            "Cervejas",
            [
              ["Cerveja Pilsen Lata 350ml", 3.99],
              ["Cerveja Long Neck 330ml", 5.49],
            ],
          ],
          [
            "Vinhos e Destilados",
            [
              ["Vinho Tinto Suave 750ml", 32.9],
              ["Cachaça Tradicional 1L", 24.9],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Laticínios e Frios",
    margem: 0.27,
    penetracao: 0.6,
    faturamento: 0.04,
    unidades: 34,
    grupos: [
      [
        "Laticínios",
        [
          [
            "Leites e Iogurtes",
            [
              ["Leite Integral UHT 1L", 5.29],
              ["Iogurte Natural 170g", 2.99],
            ],
          ],
          [
            "Manteigas e Requeijão",
            [
              ["Manteiga com Sal 200g", 13.9],
              ["Requeijão Cremoso 200g", 8.49],
            ],
          ],
        ],
      ],
      [
        "Queijos e Frios",
        [
          [
            "Queijos",
            [
              ["Queijo Mussarela kg", 42.9],
              ["Queijo Prato kg", 44.9],
            ],
          ],
          [
            "Frios",
            [
              ["Presunto Fatiado kg", 31.9],
              ["Mortadela kg", 19.9],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Limpeza",
    margem: 0.31,
    penetracao: 0.35,
    faturamento: 0.1,
    unidades: 26,
    grupos: [
      [
        "Lavanderia",
        [
          [
            "Sabão e Amaciante",
            [
              ["Sabão em Pó 1kg", 12.9],
              ["Amaciante 2L", 14.9],
            ],
          ],
          [
            "Alvejantes",
            [
              ["Água Sanitária 2L", 5.99],
              ["Desinfetante 1L", 6.49],
            ],
          ],
        ],
      ],
      [
        "Cozinha",
        [
          [
            "Louça e Utensílios",
            [
              ["Detergente Líquido 500ml", 2.69],
              ["Esponja de Cozinha c/3", 4.99],
              ["Papel Toalha c/2", 6.9],
            ],
          ],
        ],
      ],
    ],
  },
  {
    descricao: "Higiene e Beleza",
    margem: 0.34,
    penetracao: 0.3,
    faturamento: 0.06,
    unidades: 21,
    grupos: [
      [
        "Higiene Pessoal",
        [
          [
            "Banho e Higiene",
            [
              ["Papel Higiênico c/12", 18.9],
              ["Sabonete 85g", 2.49],
              ["Creme Dental 90g", 4.99],
            ],
          ],
          [
            "Desodorantes",
            [
              ["Desodorante Aerosol 150ml", 13.9],
              ["Fralda Descartável M c/30", 49.9],
            ],
          ],
        ],
      ],
      [
        "Cabelos",
        [
          [
            "Shampoo e Condicionador",
            [
              ["Shampoo 350ml", 14.9],
              ["Condicionador 350ml", 14.9],
            ],
          ],
        ],
      ],
    ],
  },
];

export type Produto = {
  codigo: number;
  descricao: string;
  departamento: number;
  grupo: number;
  subgrupo: number;
  preco: number;
  /** Unidades por dia na matriz, em um dia comum. */
  unidades: number;
  margem: number;
  /** Fração da venda por faturamento. */
  faturamento: number;
};

export type NoCodigo = { codigo: number; descricao: string; pai: number | null; penetracao: number };

/** Os códigos são únicos em toda a hierarquia (como no banco): departamento 1-8, grupo 1xx, subgrupo 1xxx, produto 10001+. */
export const PRODUTOS: Produto[] = [];
export const DEPARTAMENTOS: NoCodigo[] = [];
export const GRUPOS: NoCodigo[] = [];
export const SUBGRUPOS: NoCodigo[] = [];
/** Margem esperada por departamento. */
export const MARGEM_DEPARTAMENTO = new Map<number, number>();

/** Ajusta o volume de todos os produtos de uma vez (a matriz vende cerca de R$ 90 mil por dia). */
const ESCALA_DE_VOLUME = 2.1;

let sequencia = 10000;
CATALOGO.forEach((dep, i) => {
  const codigoDep = i + 1;
  DEPARTAMENTOS.push({ codigo: codigoDep, descricao: dep.descricao, pai: null, penetracao: dep.penetracao });
  MARGEM_DEPARTAMENTO.set(codigoDep, dep.margem);
  dep.grupos.forEach(([descricaoGrupo, subgrupos], g) => {
    const codigoGrupo = codigoDep * 100 + g + 1;
    GRUPOS.push({
      codigo: codigoGrupo,
      descricao: descricaoGrupo,
      pai: codigoDep,
      penetracao: dep.penetracao * (0.45 + 0.4 * sorteio(codigoGrupo, 31)),
    });
    subgrupos.forEach(([descricaoSub, produtos], s) => {
      const codigoSub = codigoGrupo * 10 + s + 1;
      SUBGRUPOS.push({
        codigo: codigoSub,
        descricao: descricaoSub,
        pai: codigoGrupo,
        penetracao: GRUPOS.at(-1)!.penetracao * (0.4 + 0.45 * sorteio(codigoSub, 32)),
      });
      for (const [descricao, preco] of produtos) {
        const codigo = ++sequencia;
        PRODUTOS.push({
          codigo,
          descricao,
          departamento: codigoDep,
          grupo: codigoGrupo,
          subgrupo: codigoSub,
          preco,
          unidades: ESCALA_DE_VOLUME * dep.unidades * (0.35 + 1.5 * sorteio(codigo, 77) ** 1.5),
          margem: dep.margem + (sorteio(codigo, 11) - 0.5) * 0.08,
          faturamento: dep.faturamento,
        });
      }
    });
  });
});

export const HIERARQUIA: Hierarquia = {
  departamentos: DEPARTAMENTOS.map(({ codigo, descricao }) => ({ codigo, descricao })),
  grupos: GRUPOS.map((g) => ({ codigo: g.codigo, descricao: g.descricao, departamento: g.pai! })),
  subgrupos: SUBGRUPOS.map((s) => ({ codigo: s.codigo, descricao: s.descricao, grupo: s.pai! })),
};

/** Departamento, grupo e subgrupo de um produto, pelo código do nível. */
export const produtosDoNivel = {
  departamento: (codigo: number) => PRODUTOS.filter((p) => p.departamento === codigo),
  grupo: (codigo: number) => PRODUTOS.filter((p) => p.grupo === codigo),
  subgrupo: (codigo: number) => PRODUTOS.filter((p) => p.subgrupo === codigo),
} as const;

export const NOS_POR_NIVEL = { departamento: DEPARTAMENTOS, grupo: GRUPOS, subgrupo: SUBGRUPOS } as const;

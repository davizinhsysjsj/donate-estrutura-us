/**
 * Rotacao de variantes Shopify entre produtos digitais com o mesmo ticket.
 *
 * Cada tier (valor em EUR) tem multiplas variantes mapeadas pra produtos
 * digitais diferentes — todos com mesmo preco. A rotacao aleatoria dilui
 * as vendas entre eles, dando cara de loja real com varios produtos.
 *
 * IMPORTANTE: precos das variantes precisam ser identicos. Se mudar valor
 * em um produto, atualiza nos outros pra evitar discrepancia no checkout.
 *
 * Produtos atuais:
 *  - P1: "Complete care package for Belgian dogs" (original)
 *  - P2: "How to care for rescued dogs - pdf" (copia, mesmo conteudo logico)
 */

export const SHOPIFY_SHOP_DOMAIN = 'inigualavelshop.myshopify.com';

/**
 * Mapa tier -> lista de variant IDs disponiveis (qualquer produto).
 * pickVariantForAmount sorteia uniformemente entre eles.
 */
export const VARIANTS_BY_AMOUNT: Record<number, string[]> = {
  10:  ['49461830844554', '49473431011466'], // Bronze
  15:  ['49469523361930', '49473431142538'], // Helper
  20:  ['49461830877322', '49473431044234'], // Silver
  25:  ['49461830910090', '49473431077002'], // Gold
  30:  ['49469523394698', '49473431175306'], // Guardian
  35:  ['49461830942858', '49473431109770'], // Platinum
  50:  ['49469523427466', '49473431208074'], // Hero
  80:  ['49469523460234', '49473431240842'], // Champion
  100: ['49469523493002', '49473431273610'], // Protector
  200: ['49469523525770', '49473431306378'], // Benefactor
  300: ['49469523558538', '49473431339146'], // Patron
  500: ['49469523591306', '49473431371914']  // Saviour
};

export const TIER_NAME_BY_AMOUNT: Record<number, string> = {
  10:  'Bronze',
  15:  'Helper',
  20:  'Silver',
  25:  'Gold',
  30:  'Guardian',
  35:  'Platinum',
  50:  'Hero',
  80:  'Champion',
  100: 'Protector',
  200: 'Benefactor',
  300: 'Patron',
  500: 'Saviour'
};

/**
 * Sorteia uma variante pro tier informado.
 * Retorna `undefined` se o tier nao existir no mapa.
 *
 * Distribuicao: uniforme entre as variantes disponiveis (50/50 com 2 produtos,
 * 33/33/33 com 3, etc.). Pra ajustar peso, transforma o array em pool ponderado
 * (ex: [A, A, B] = 66% A / 33% B).
 */
export function pickVariantForAmount(amount: number): string | undefined {
  const pool = VARIANTS_BY_AMOUNT[amount];
  if (!pool || pool.length === 0) return undefined;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

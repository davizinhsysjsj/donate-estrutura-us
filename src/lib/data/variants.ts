/**
 * Mapa tier (EUR) -> variant ID Shopify do produto digital.
 *
 * Produto unico: "Compleet pakket - Gids voor hondenvoer en supplementen"
 * (handle: complete-care-package-for-belgian-dogs-copia, id 9074861179018)
 */

export const SHOPIFY_SHOP_DOMAIN = 'belgiancare.online';

export const VARIANT_BY_AMOUNT: Record<number, string> = {
  10:  '49473431011466', // Bronze
  15:  '49473431142538', // Helper
  20:  '49473431044234', // Silver
  25:  '49473431077002', // Gold
  30:  '49473431175306', // Guardian
  35:  '49473431109770', // Platinum
  50:  '49473431208074', // Hero
  80:  '49473431240842', // Champion
  100: '49473431273610', // Protector
  200: '49473431306378', // Benefactor
  300: '49473431339146', // Patron
  500: '49473431371914'  // Saviour
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

export function pickVariantForAmount(amount: number): string | undefined {
  return VARIANT_BY_AMOUNT[amount];
}

import { Drink } from '../models/drink.model';
import { drinkTypeFor } from '../models/drink-types';
import { alcoholGrams } from './bac';

/**
 * Energy in a gram of ethanol. Fineli counts 29 kJ, which is 6.9 kcal; 7 is
 * the figure on every label and well inside the spread between brands.
 */
export const KCAL_PER_ALCOHOL_GRAM = 7;

/**
 * Non-alcohol energy for a drink whose icon names no kind (🧉, or anything an
 * older client stored), guessed from its strength: beer-strength drinks carry
 * a beer's malt, wine-strength a wine's sugar, spirits nothing. A guess from
 * ABV beats counting the alcohol alone, which would undershoot a beer by a third.
 */
function extraKcalPer100MlByStrength(abv: number): number {
  if (abv <= 0) return 0;
  if (abv < 9) return 15;
  if (abv < 25) return 10;
  return 0;
}

/**
 * Estimated kilocalories in one drink: the alcohol, which is exact from volume
 * and ABV, plus the sugar typical of its kind, which is the estimate.
 *
 * Keyed off the icon rather than the free-text label, because the icon is the
 * kind of drink the user picked — "IPA", "Karhu" and "Olut" are all 🍺.
 */
export function drinkKcal(drink: Pick<Drink, 'volumeMl' | 'abv' | 'icon'>): number {
  const extra =
    drinkTypeFor(drink.icon)?.extraKcalPer100Ml ?? extraKcalPer100MlByStrength(drink.abv);
  return (
    alcoholGrams(drink.volumeMl, drink.abv) * KCAL_PER_ALCOHOL_GRAM + (drink.volumeMl / 100) * extra
  );
}

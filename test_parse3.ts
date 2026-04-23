import { MEASURE_UNITS } from './src/lib/constants'; // I don't have this file yet, I'll put MEASURE_UNITS in the script

export const MEASURE_UNITS: any[] = [
  { type: 'cup', label: 'Cup', amountPerUnit: 200, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: false, icon: 'cafe-outline' },
  { type: 'bowl', label: 'Bowl', amountPerUnit: 350, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: false, icon: 'ellipse-outline' },
  { type: 'plate', label: 'Plate', amountPerUnit: 450, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: false, icon: 'disc-outline' },
  { type: 'glass', label: 'Glass', amountPerUnit: 300, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: false, icon: 'wine-outline' },
  { type: 'handful', label: 'Handful', amountPerUnit: 27.5, calculationBasis: 'weight', displayUnit: 'g', allowCustomQuantity: false, icon: 'hand-left-outline' },
  { type: 'slice', label: 'Slice', amountPerUnit: 37.5, calculationBasis: 'weight', displayUnit: 'g', allowCustomQuantity: false, icon: 'triangle-outline' },
  { type: 'piece', label: 'Piece', amountPerUnit: 1, calculationBasis: 'piece', displayUnit: 'piece', allowCustomQuantity: false, icon: 'apps-outline' },
  { type: 'teaspoon', label: 'Teaspoon', amountPerUnit: 5, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: false, icon: 'restaurant-outline' },
  { type: 'tablespoon', label: 'Tablespoon', amountPerUnit: 15, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: false, icon: 'restaurant' },
  { type: 'grams', label: 'Grams', amountPerUnit: 1, calculationBasis: 'weight', displayUnit: 'g', allowCustomQuantity: true, icon: 'scale-outline' },
  { type: 'ounces', label: 'Ounces', amountPerUnit: 28.35, calculationBasis: 'weight', displayUnit: 'g', allowCustomQuantity: true, icon: 'scale-outline' },
  { type: 'milliliters', label: 'Milliliters', amountPerUnit: 1, calculationBasis: 'volume', displayUnit: 'ml', allowCustomQuantity: true, icon: 'water-outline' },
];

function calculateMultiplier(description: string, densityStr: string | null, piecewiseStr: string | null) {
  if (!description) return 1;

  const cleanDesc = description.toLowerCase().replace(/[^a-z0-9.]/g, ' ').trim();
  const match = cleanDesc.match(/([\d.]+)\s*([a-z]+)/);
  if (!match) return 1;

  const quantity = parseFloat(match[1]);
  let unitStr = match[2];
  
  let type = 'piece';
  if (['g', 'gm', 'gram', 'grams', 'gms'].includes(unitStr)) type = 'grams';
  else if (['ml', 'mltr', 'milliliters'].includes(unitStr)) type = 'milliliters';
  else if (['cup', 'cups'].includes(unitStr)) type = 'cup';
  else if (['bowl', 'bowls'].includes(unitStr)) type = 'bowl';
  else if (['plate', 'plates'].includes(unitStr)) type = 'plate';
  else if (['glass', 'glasses'].includes(unitStr)) type = 'glass';
  else if (['handful', 'handfuls'].includes(unitStr)) type = 'handful';
  else if (['slice', 'slices'].includes(unitStr)) type = 'slice';
  else if (['teaspoon', 'tsp'].includes(unitStr)) type = 'teaspoon';
  else if (['tablespoon', 'tbsp'].includes(unitStr)) type = 'tablespoon';
  else if (['oz', 'ounce', 'ounces'].includes(unitStr)) type = 'ounces';
  else if (['pc', 'pcs', 'piece', 'pieces'].includes(unitStr)) type = 'piece';

  const unitDesc = MEASURE_UNITS.find(u => u.type === type) || MEASURE_UNITS.find(u => u.type === 'piece');
  if (!unitDesc) return 1;

  let M = 1;
  const density = parseFloat(densityStr || '1') || 1;
  const piecewise = parseFloat(piecewiseStr || '1') || 1;

  if (unitDesc.calculationBasis === 'weight') {
    const gram = quantity * unitDesc.amountPerUnit;
    M = gram / 100;
  } else if (unitDesc.calculationBasis === 'volume') {
    const ml = quantity * unitDesc.amountPerUnit;
    const gram = ml * density;
    M = gram / 100;
  } else if (unitDesc.calculationBasis === 'piece') {
    const pieces = quantity * unitDesc.amountPerUnit;
    M = pieces * piecewise;
  }

  return M;
}

console.log("300ml, density 1.0 =>", calculateMultiplier("300ml.", "1.0", null));
console.log("200g, normal =>", calculateMultiplier("200gm.", null, null));
console.log("6 cups, density 1.2 =>", calculateMultiplier("6 cups", "1.2", null)); 
console.log("1 piece, piecewise 2.5 =>", calculateMultiplier("1 pcs", null, "2.5"));

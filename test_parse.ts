function parseQuantity(description: string) {
  if (!description) return { quantity: 1, type: 'piece', originalUnit: '' };
  
  // Clean up punctuation
  const cleanDesc = description.toLowerCase().replace(/[^a-z0-9.]/g, ' ').trim();
  const match = cleanDesc.match(/([\d.]+)\s*([a-z]+)/);
  if (!match) return { quantity: 1, type: 'piece', originalUnit: '' };
  
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
  
  return { quantity, type, originalUnit: unitStr };
}

console.log(parseQuantity("300ml."));
console.log(parseQuantity("6 cups"));
console.log(parseQuantity("100gm."));
console.log(parseQuantity("1 pcs"));
console.log(parseQuantity("1 only with 150gm curd"));


export const getIngredientCost = (ing) => {
  const price = Number(ing.price) || 0;
  const qty = Number(ing.qtyUsed) || 1;
  const u1 = (ing.unit || '').toLowerCase().trim();
  const u2 = (ing.recipeUnit || ing.unit || '').toLowerCase().trim();

  if (u1 === u2 || !u1 || !u2) {
    return price * qty;
  }
  
  if (u1 === 'kg' && (u2 === 'gram' || u2 === 'g')) return (price / 1000) * qty;
  if (u1 === 'liter' && (u2 === 'ml' || u2 === 'mili')) return (price / 1000) * qty;
  if (u1 === 'ekor' && u2 === 'potong') return (price / 8) * qty;
  if ((u1 === 'gram' || u1 === 'g') && u2 === 'kg') return (price * 1000) * qty;
  if (u1 === 'ml' && u2 === 'liter') return (price * 1000) * qty;
  
  return price * qty;
};
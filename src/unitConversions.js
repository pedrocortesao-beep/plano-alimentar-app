// Correspondência aproximada para gramas — só faz sentido para unidades de
// volume (assume densidade parecida com a da água; é uma aproximação, não
// um valor nutricional exato, porque varia por alimento).
const APPROX_GRAMS_PER_UNIT = {
  ml: 1,
  l: 1000,
  colher: 15,   // colher de sopa
  chávena: 240,
  kg: 1000,
  g: 1,
};

export function approxGrams(qty, unit) {
  const n = Number(qty);
  if (!n || !unit) return null;
  const factor = APPROX_GRAMS_PER_UNIT[unit];
  if (!factor || unit === "g") return null; // já está em gramas, ou não é convertível (ex.: "unidade")
  return Math.round(n * factor);
}

// Gramas efetivas de um ingrediente, para efeitos de cálculo nutricional.
// Para "unidade", só é possível se tiver sido preenchido "grams_per_unit"
// (ex.: "1 banana ≈ 120 g"); caso contrário devolve null (não contabilizável).
export function gramsForIngredient(ing) {
  const qty = Number(ing.qty);
  if (!qty) return null;
  if (ing.unit === "g") return qty;
  if (ing.unit === "unidade") {
    return ing.grams_per_unit ? qty * Number(ing.grams_per_unit) : null;
  }
  const factor = APPROX_GRAMS_PER_UNIT[ing.unit];
  return factor ? qty * factor : null;
}

// Soma os macros de uma lista de ingredientes. Ingredientes sem valores
// nutricionais preenchidos, ou sem forma de saber o peso em gramas, ficam de
// fora da soma (mas contam para "incomplete", para se poder avisar disso).
export function computeMacros(ingredients) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0;
  let anyCounted = false;
  const missing = [];

  (ingredients || []).forEach(ing => {
    const grams = gramsForIngredient(ing);
    const hasNutrition = ing.kcal_per_100 != null || ing.protein_per_100 != null || ing.carbs_per_100 != null || ing.fat_per_100 != null;
    if (grams == null || !hasNutrition) {
      if (Number(ing.qty) && ing.name) missing.push(ing.name); // tem quantidade, mas não dá para contabilizar
      return;
    }
    anyCounted = true;
    const factor = grams / 100;
    kcal += (Number(ing.kcal_per_100) || 0) * factor;
    protein += (Number(ing.protein_per_100) || 0) * factor;
    carbs += (Number(ing.carbs_per_100) || 0) * factor;
    fat += (Number(ing.fat_per_100) || 0) * factor;
  });

  if (!anyCounted) return null;
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    incomplete: missing.length > 0,
    missing,
  };
}

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

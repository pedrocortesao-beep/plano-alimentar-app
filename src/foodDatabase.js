// Valores de referência por 100 g/ml (médias típicas de tabelas de
// composição de alimentos) para os ingredientes mais comuns em português.
// São valores aproximados e genéricos — servem de ponto de partida, não
// substituem o rótulo do produto real quando existir.
// gramsPerUnit: peso médio de "1 unidade", quando faz sentido (ex.: 1 ovo).
const FOOD_DB = [
  { names: ["aveia", "flocos de aveia"], kcal: 379, protein: 13.5, carbs: 62, fat: 7 },
  { names: ["leite", "leite meio gordo"], kcal: 46, protein: 3.4, carbs: 4.8, fat: 1.6 },
  { names: ["leite magro", "leite desnatado"], kcal: 35, protein: 3.4, carbs: 5, fat: 0.1 },
  { names: ["banana"], kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, gramsPerUnit: 120 },
  { names: ["maçã", "maca"], kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, gramsPerUnit: 150 },
  { names: ["laranja"], kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, gramsPerUnit: 130 },
  { names: ["pera"], kcal: 57, protein: 0.4, carbs: 15, fat: 0.1, gramsPerUnit: 150 },
  { names: ["ovo", "ovos"], kcal: 155, protein: 13, carbs: 1.1, fat: 11, gramsPerUnit: 55 },
  { names: ["pão", "pao"], kcal: 265, protein: 9, carbs: 49, fat: 3.2, gramsPerUnit: 50 },
  { names: ["pão integral", "pao integral"], kcal: 247, protein: 13, carbs: 41, fat: 3.4, gramsPerUnit: 50 },
  { names: ["iogurte", "iogurte natural"], kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3, gramsPerUnit: 125 },
  { names: ["iogurte grego"], kcal: 97, protein: 9, carbs: 4, fat: 5, gramsPerUnit: 125 },
  { names: ["cereais", "cereais de pequeno-almoço"], kcal: 378, protein: 7, carbs: 84, fat: 1 },
  { names: ["frutos secos", "mistura de frutos secos", "oleaginosas"], kcal: 607, protein: 15, carbs: 20, fat: 54 },
  { names: ["amêndoas", "amendoas"], kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { names: ["nozes"], kcal: 654, protein: 15, carbs: 14, fat: 65 },
  { names: ["frango", "peito de frango"], kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { names: ["carne de vaca", "vaca", "novilho"], kcal: 217, protein: 26, carbs: 0, fat: 12 },
  { names: ["peixe branco", "pescada", "faneca"], kcal: 82, protein: 18, carbs: 0, fat: 1 },
  { names: ["salmão", "salmao"], kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { names: ["atum", "atum em lata"], kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { names: ["arroz", "arroz branco"], kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { names: ["arroz integral"], kcal: 123, protein: 2.6, carbs: 26, fat: 1 },
  { names: ["massa", "esparguete", "macarrão"], kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  { names: ["batata"], kcal: 77, protein: 2, carbs: 17, fat: 0.1 },
  { names: ["batata-doce", "batata doce"], kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 },
  { names: ["legumes", "legumes variados", "salteado de legumes"], kcal: 35, protein: 2, carbs: 6, fat: 0.3 },
  { names: ["brócolos", "brocolos"], kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { names: ["cenoura"], kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { names: ["tomate"], kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { names: ["alface"], kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 },
  { names: ["feijão", "feijao", "feijão cozido"], kcal: 127, protein: 8.7, carbs: 23, fat: 0.5 },
  { names: ["grão", "grao", "grão-de-bico"], kcal: 164, protein: 9, carbs: 27, fat: 2.6 },
  { names: ["queijo"], kcal: 350, protein: 25, carbs: 1.3, fat: 27 },
  { names: ["queijo fresco"], kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { names: ["azeite"], kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { names: ["manteiga"], kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { names: ["mel"], kcal: 304, protein: 0.3, carbs: 82, fat: 0 },
  { names: ["açúcar", "acucar"], kcal: 387, protein: 0, carbs: 100, fat: 0 },
];

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();
}

export function suggestNutrition(ingredientName) {
  const n = normalize(ingredientName);
  if (!n) return null;
  // correspondência exata primeiro, depois por inclusão (em qualquer sentido)
  let match = FOOD_DB.find(f => f.names.some(name => normalize(name) === n));
  if (!match) {
    match = FOOD_DB.find(f => f.names.some(name => {
      const nn = normalize(name);
      return n.includes(nn) || nn.includes(n);
    }));
  }
  return match || null;
}

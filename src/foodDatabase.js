import { supabase } from "./supabaseClient";

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .trim();
}

export async function loadFoods() {
  const { data } = await supabase.from("foods").select("*").order("name");
  return data || [];
}

const STOPWORDS = new Set(["de", "da", "do", "com", "sem", "e", "a", "o", "em", "para"]);

function words(s) {
  return normalize(s).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOPWORDS.has(w));
}

function scoreMatch(ingredientName, candidateName) {
  const n = normalize(ingredientName);
  const c = normalize(candidateName);
  if (!n || !c) return 0;
  if (n === c) return 100; // igual
  if (n.includes(c) || c.includes(n)) return 60; // um contém o outro
  const nWords = new Set(words(ingredientName));
  const cWords = words(candidateName);
  const shared = cWords.filter(w => nWords.has(w)).length;
  return shared > 0 ? shared * 10 : 0; // palavras em comum (ex.: "Whey" em "Whey Protein Chocolate")
}

// Encontra o alimento da base de dados que melhor corresponde ao nome escrito,
// mesmo que não seja uma correspondência exata (ex.: "Whey" ↔
// "Whey Protein (sabor a chocolate)" em qualquer sentido).
export function findMatch(foods, ingredientName) {
  if (!ingredientName || !foods || !foods.length) return null;

  let best = null, bestScore = 0;
  foods.forEach(f => {
    const candidates = [f.name, ...(f.aliases || [])];
    const score = Math.max(...candidates.map(c => scoreMatch(ingredientName, c)));
    if (score > bestScore) { bestScore = score; best = f; }
  });

  return bestScore >= 10 ? best : null;
}

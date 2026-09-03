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

// Encontra o alimento da base de dados que melhor corresponde ao nome escrito.
export function findMatch(foods, ingredientName) {
  const n = normalize(ingredientName);
  if (!n || !foods || !foods.length) return null;

  const candidates = (f) => [f.name, ...(f.aliases || [])];

  let match = foods.find(f => candidates(f).some(name => normalize(name) === n));
  if (!match) {
    match = foods.find(f => candidates(f).some(name => {
      const nn = normalize(name);
      return n.includes(nn) || nn.includes(n);
    }));
  }
  return match || null;
}

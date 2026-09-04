import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

const empty = { name: "", aliases: "", kcal: "", protein: "", carbs: "", fat: "", grams_per_unit: "" };

export default function FoodsAdminTab() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(empty);
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("foods").select("*").order("name");
    setFoods(data || []);
    setLoading(false);
  }

  const toRow = (d) => ({
    name: d.name.trim(),
    aliases: d.aliases.split(",").map(a => a.trim()).filter(Boolean),
    kcal: Number(d.kcal) || 0,
    protein: Number(d.protein) || 0,
    carbs: Number(d.carbs) || 0,
    fat: Number(d.fat) || 0,
    grams_per_unit: d.grams_per_unit === "" ? null : Number(d.grams_per_unit),
  });

  const startEdit = (f) => {
    setEditingId(f.id);
    setDraft({
      name: f.name, aliases: (f.aliases || []).join(", "),
      kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat,
      grams_per_unit: f.grams_per_unit ?? "",
    });
  };

  const [formError, setFormError] = useState(null);

  const saveEdit = async () => {
    if (!draft.name.trim()) return;
    setFormError(null);
    const { error } = await supabase.from("foods").update(toRow(draft)).eq("id", editingId);
    if (error) { setFormError(error.code === "23505" ? "Já existe um alimento com esse nome." : error.message); return; }
    setEditingId(null);
    load();
  };

  const remove = async (id) => {
    await supabase.from("foods").delete().eq("id", id);
    load();
  };

  const addNew = async () => {
    if (!draft.name.trim()) return;
    setFormError(null);
    const { error } = await supabase.from("foods").insert(toRow(draft));
    if (error) { setFormError(error.code === "23505" ? "Já existe um alimento com esse nome." : error.message); return; }
    setDraft(empty);
    setAdding(false);
    load();
  };

  if (loading) return <p style={styles.emptyMeal}>A carregar…</p>;

  return (
    <div style={styles.planObsBox}>
      <div style={styles.planObsTitle}>Base de dados de alimentos</div>
      <p style={{ ...styles.emptyMeal, marginBottom: 8 }}>
        Valores por 100 g/ml. As sugestões nos ingredientes fazem correspondência pelo nome e pelos "outros nomes" (separados por vírgula).
      </p>

      {foods.map(f => (
        <div key={f.id} style={{ borderTop: "1px solid #F0EEE3", padding: "8px 0" }}>
          {editingId === f.id ? (
            <FoodForm draft={draft} setDraft={setDraft} onSave={saveEdit} onCancel={() => { setEditingId(null); setFormError(null); }} saveLabel="Guardar" error={formError} />
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{f.name}</div>
                <div style={{ fontSize: 11.5, color: "#6b7268" }}>
                  {f.kcal} kcal · {f.protein}g prot · {f.carbs}g hid · {f.fat}g gord
                  {(f.aliases || []).length > 0 ? ` — também: ${f.aliases.join(", ")}` : ""}
                </div>
              </div>
              <div style={styles.rowGap}>
                <button style={styles.iconBtn} onClick={() => startEdit(f)}><Pencil size={13} /></button>
                <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => remove(f.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div style={{ marginTop: 10 }}>
          <FoodForm draft={draft} setDraft={setDraft} onSave={addNew} onCancel={() => { setAdding(false); setDraft(empty); setFormError(null); }} saveLabel="Adicionar" error={formError} />
        </div>
      ) : (
        <button style={{ ...styles.addOptionBtn, marginTop: 10 }} onClick={() => { setDraft(empty); setAdding(true); }}>
          <Plus size={13} /> Adicionar alimento
        </button>
      )}
    </div>
  );
}

function FoodForm({ draft, setDraft, onSave, onCancel, saveLabel, error }) {
  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }));
  return (
    <div>
      <input style={{ ...styles.obsInput, marginBottom: 6 }} placeholder="Nome (ex.: Aveia)" value={draft.name} onChange={set("name")} />
      <input style={{ ...styles.obsInput, marginBottom: 6 }} placeholder="Outros nomes, separados por vírgula" value={draft.aliases} onChange={set("aliases")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
        <input style={styles.nutritionInput} type="number" placeholder="kcal" value={draft.kcal} onChange={set("kcal")} />
        <input style={styles.nutritionInput} type="number" step="0.1" placeholder="Proteína (g)" value={draft.protein} onChange={set("protein")} />
        <input style={styles.nutritionInput} type="number" step="0.1" placeholder="Hidratos (g)" value={draft.carbs} onChange={set("carbs")} />
        <input style={styles.nutritionInput} type="number" step="0.1" placeholder="Gordura (g)" value={draft.fat} onChange={set("fat")} />
      </div>
      <input style={{ ...styles.obsInput, marginBottom: 8 }} type="number" placeholder="Peso por unidade, se aplicável (g) — ex.: 1 ovo ≈ 55"
        value={draft.grams_per_unit} onChange={set("grams_per_unit")} />
      {error && <p style={styles.errorText}>{error}</p>}
      <div style={styles.rowGap}>
        <button style={styles.smallBtnPrimary} onClick={onSave}><Check size={13} /> {saveLabel}</button>
        <button style={styles.smallBtn} onClick={onCancel}><X size={13} /> Cancelar</button>
      </div>
    </div>
  );
}

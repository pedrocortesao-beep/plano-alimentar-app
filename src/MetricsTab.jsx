import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, TrendingUp, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

const FIELDS = [
  { key: "weight_kg", label: "Peso (kg)", step: 0.1 },
  { key: "height_cm", label: "Altura (cm)", step: 0.5 },
  { key: "waist_cm", label: "Cintura (cm)", step: 0.5 },
  { key: "arm_cm", label: "Braço (cm)", step: 0.5 },
  { key: "thigh_cm", label: "Coxa (cm)", step: 0.5 },
  { key: "chest_cm", label: "Peito (cm)", step: 0.5 },
];

const emptyDraft = () => ({
  measured_on: new Date().toISOString().slice(0, 10),
  weight_kg: "", height_cm: "", waist_cm: "", arm_cm: "", thigh_cm: "", chest_cm: "", notes: "",
});

function bmiCategory(bmi) {
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Peso normal";
  if (bmi < 30) return "Excesso de peso";
  return "Obesidade";
}

export default function MetricsTab({ userId, onGoalsChange }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());

  const [goals, setGoals] = useState({ target_weight_kg: "", target_kcal: "" });
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalsDraft, setGoalsDraft] = useState({ target_weight_kg: "", target_kcal: "" });

  useEffect(() => { load(); loadGoals(); }, [userId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("metrics")
      .select("*").eq("user_id", userId).order("measured_on", { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

  async function loadGoals() {
    const { data } = await supabase.from("goals").select("*").eq("user_id", userId).maybeSingle();
    const g = { target_weight_kg: data?.target_weight_kg ?? "", target_kcal: data?.target_kcal ?? "" };
    setGoals(g);
    if (onGoalsChange) onGoalsChange(g);
  }

  const saveGoals = async () => {
    const row = {
      user_id: userId,
      target_weight_kg: goalsDraft.target_weight_kg === "" ? null : Number(goalsDraft.target_weight_kg),
      target_kcal: goalsDraft.target_kcal === "" ? null : Number(goalsDraft.target_kcal),
    };
    const { error } = await supabase.from("goals").upsert(row);
    if (!error) { setGoals(goalsDraft); if (onGoalsChange) onGoalsChange(goalsDraft); setEditingGoals(false); }
  };

  const toRow = (d) => ({
    user_id: userId,
    measured_on: d.measured_on,
    weight_kg: d.weight_kg === "" ? null : Number(d.weight_kg),
    height_cm: d.height_cm === "" ? null : Number(d.height_cm),
    waist_cm: d.waist_cm === "" ? null : Number(d.waist_cm),
    arm_cm: d.arm_cm === "" ? null : Number(d.arm_cm),
    thigh_cm: d.thigh_cm === "" ? null : Number(d.thigh_cm),
    chest_cm: d.chest_cm === "" ? null : Number(d.chest_cm),
    notes: d.notes || "",
  });

  const addEntry = async () => {
    const { error } = await supabase.from("metrics").insert(toRow(draft));
    if (!error) { setDraft(emptyDraft()); setAdding(false); load(); }
  };

  const startEdit = (e) => {
    setEditingId(e.id);
    setDraft({
      measured_on: e.measured_on,
      weight_kg: e.weight_kg ?? "", height_cm: e.height_cm ?? "", waist_cm: e.waist_cm ?? "",
      arm_cm: e.arm_cm ?? "", thigh_cm: e.thigh_cm ?? "", chest_cm: e.chest_cm ?? "", notes: e.notes || "",
    });
  };

  const saveEdit = async () => {
    const { error } = await supabase.from("metrics").update(toRow(draft)).eq("id", editingId);
    if (!error) { setEditingId(null); load(); }
  };

  const remove = async (id) => {
    await supabase.from("metrics").delete().eq("id", id);
    load();
  };

  if (loading) return <p style={styles.emptyMeal}>A carregar…</p>;

  const latestWeight = entries.find(e => e.weight_kg != null);
  const latestHeight = entries.find(e => e.height_cm != null);
  const bmi = latestWeight && latestHeight
    ? latestWeight.weight_kg / Math.pow(latestHeight.height_cm / 100, 2)
    : null;

  const chartData = [...entries]
    .filter(e => e.weight_kg != null)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .map(e => ({ date: formatShortDate(e.measured_on), peso: e.weight_kg }));

  return (
    <div>
      <div style={styles.planObsBox}>
        <div style={styles.planObsHead}>
          <span style={styles.planObsTitle}><Target size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Objetivos</span>
          {!editingGoals && (
            <button style={styles.iconBtn} onClick={() => { setGoalsDraft(goals); setEditingGoals(true); }}><Pencil size={13} /></button>
          )}
        </div>
        {editingGoals ? (
          <div>
            <div style={styles.field}>
              <label style={styles.label}>Peso-alvo (kg)</label>
              <input style={styles.input} type="number" step="0.1" value={goalsDraft.target_weight_kg}
                onChange={e => setGoalsDraft(g => ({ ...g, target_weight_kg: e.target.value }))} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Meta de calorias diárias (kcal)</label>
              <input style={styles.input} type="number" value={goalsDraft.target_kcal}
                onChange={e => setGoalsDraft(g => ({ ...g, target_kcal: e.target.value }))} />
            </div>
            <div style={styles.rowGap}>
              <button style={styles.smallBtnPrimary} onClick={saveGoals}><Check size={13} /> Guardar</button>
              <button style={styles.smallBtn} onClick={() => setEditingGoals(false)}><X size={13} /> Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            {goals.target_weight_kg || goals.target_kcal ? (
              <div style={{ fontSize: 13, color: "#3c463f" }}>
                {goals.target_weight_kg && (
                  <p style={{ margin: "0 0 4px" }}>
                    Peso-alvo: <strong>{goals.target_weight_kg} kg</strong>
                    {latestWeight && (
                      <span style={{ color: "#6b7268" }}> — faltam {Math.abs(latestWeight.weight_kg - goals.target_weight_kg).toFixed(1)} kg
                        {latestWeight.weight_kg > goals.target_weight_kg ? " para perder" : latestWeight.weight_kg < goals.target_weight_kg ? " para ganhar" : " — objetivo atingido!"}
                      </span>
                    )}
                  </p>
                )}
                {goals.target_kcal && <p style={{ margin: 0 }}>Meta diária: <strong>{goals.target_kcal} kcal</strong></p>}
              </div>
            ) : (
              <p style={styles.emptyMeal}>Ainda não definiste objetivos — toca no lápis para adicionar.</p>
            )}
          </>
        )}
      </div>

      {bmi && (
        <div style={styles.planObsBox}>
          <div style={styles.planObsTitle}>IMC (Índice de Massa Corporal)</div>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#4B6350", margin: "0 0 2px" }}>{bmi.toFixed(1)}</p>
          <p style={{ fontSize: 13, color: "#6b7268", margin: 0 }}>{bmiCategory(bmi)}</p>
          <p style={{ ...styles.emptyMeal, marginTop: 6 }}>
            Calculado a partir do peso e altura mais recentes. É um indicador geral, não tem em conta massa muscular, idade ou outros fatores — não substitui avaliação profissional.
          </p>
        </div>
      )}

      {chartData.length > 1 && (
        <div style={styles.planObsBox}>
          <div style={styles.planObsTitle}><TrendingUp size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Evolução do peso</div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E1D2" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7268" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7268" }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #DEDAC8" }} />
                <Line type="monotone" dataKey="peso" stroke="#4B6350" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Registos</div>

        {entries.length === 0 && !adding && (
          <p style={styles.emptyMeal}>Ainda não tens registos. Adiciona o primeiro abaixo.</p>
        )}

        {entries.map(e => (
          <div key={e.id} style={{ borderTop: "1px solid #F0EEE3", padding: "10px 0" }}>
            {editingId === e.id ? (
              <MetricsForm draft={draft} setDraft={setDraft} onSave={saveEdit} onCancel={() => setEditingId(null)} saveLabel="Guardar" />
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{formatDate(e.measured_on)}</div>
                  <div style={{ fontSize: 12, color: "#6b7268", marginTop: 2 }}>
                    {FIELDS.filter(f => e[f.key] != null).map(f => `${f.label.split(" ")[0]}: ${e[f.key]}`).join(" · ") || "Sem valores"}
                  </div>
                  {e.notes && <div style={{ fontSize: 12, color: "#8A6A2E", marginTop: 2, fontStyle: "italic" }}>{e.notes}</div>}
                </div>
                <div style={styles.rowGap}>
                  <button style={styles.iconBtn} onClick={() => startEdit(e)}><Pencil size={13} /></button>
                  <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => remove(e.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div style={{ marginTop: 10 }}>
            <MetricsForm draft={draft} setDraft={setDraft} onSave={addEntry} onCancel={() => { setAdding(false); setDraft(emptyDraft()); }} saveLabel="Adicionar" />
          </div>
        ) : (
          <button style={{ ...styles.addOptionBtn, marginTop: 10 }} onClick={() => { setDraft(emptyDraft()); setAdding(true); }}>
            <Plus size={13} /> Novo registo
          </button>
        )}
      </div>
    </div>
  );
}

function MetricsForm({ draft, setDraft, onSave, onCancel, saveLabel }) {
  const set = (k) => (e) => setDraft(d => ({ ...d, [k]: e.target.value }));
  return (
    <div>
      <div style={styles.field}>
        <label style={styles.label}>Data</label>
        <input style={styles.input} type="date" value={draft.measured_on} onChange={set("measured_on")} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8, marginBottom: 8 }}>
        {FIELDS.map(f => (
          <label key={f.key} style={styles.nutritionField}>
            {f.label}
            <input style={styles.nutritionInput} type="number" step={f.step} value={draft[f.key]} onChange={set(f.key)} />
          </label>
        ))}
      </div>
      <input style={{ ...styles.obsInput, marginBottom: 8 }} placeholder="Observações (opcional)" value={draft.notes} onChange={set("notes")} />
      <div style={styles.rowGap}>
        <button style={styles.smallBtnPrimary} onClick={onSave}><Check size={13} /> {saveLabel}</button>
        <button style={styles.smallBtn} onClick={onCancel}><X size={13} /> Cancelar</button>
      </div>
    </div>
  );
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function formatShortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

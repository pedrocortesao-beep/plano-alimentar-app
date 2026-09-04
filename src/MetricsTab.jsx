import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, TrendingUp } from "lucide-react";
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

export default function MetricsTab({ userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("metrics")
      .select("*").eq("user_id", userId).order("measured_on", { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

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

  const chartData = [...entries]
    .filter(e => e.weight_kg != null)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .map(e => ({ date: formatShortDate(e.measured_on), peso: e.weight_kg }));

  return (
    <div>
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

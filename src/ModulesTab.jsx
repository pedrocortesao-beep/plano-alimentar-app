import { useState } from "react";
import { Check, Clock } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

const MODULES = [
  { key: "plano_alimentar", label: "Plano Alimentar", desc: "Refeições, opções e ingredientes.", available: true },
  { key: "plano_treino", label: "Plano de Treino", desc: "Exercícios e planos de treino.", available: false },
  { key: "metricas", label: "Recolha de Métricas", desc: "Peso, altura, larguras (braço, coxa, ...).", available: true },
];

export default function ModulesTab({ userId, modules, onSaved }) {
  const [selected, setSelected] = useState(new Set(modules || ["plano_alimentar"]));
  const [saving, setSaving] = useState(false);

  const toggle = async (key, available) => {
    if (!available) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
    setSaving(true);
    const arr = Array.from(next);
    const { error } = await supabase.from("profiles").update({ modules: arr }).eq("id", userId);
    if (!error) onSaved(arr);
    setSaving(false);
  };

  return (
    <div style={styles.planObsBox}>
      <div style={styles.planObsTitle}>O que pretendes usar</div>
      <p style={{ ...styles.planObsText, marginBottom: 12 }}>
        Escolhe os módulos que queres ter disponíveis. Os que ainda não existem aparecem marcados como "Em breve".
      </p>
      {MODULES.map(m => (
        <button key={m.key} onClick={() => toggle(m.key, m.available)}
          style={{ ...moduleRow, opacity: m.available ? 1 : 0.55, cursor: m.available ? "pointer" : "default" }}>
          <div style={checkbox(selected.has(m.key), m.available)}>
            {selected.has(m.key) && <Check size={13} color="#fff" />}
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{m.label}</div>
            <div style={{ fontSize: 12.5, color: "#6b7268" }}>{m.desc}</div>
          </div>
          {!m.available && (
            <span style={badge}><Clock size={11} /> Em breve</span>
          )}
        </button>
      ))}
    </div>
  );
}

const moduleRow = {
  display: "flex", alignItems: "center", gap: 12, width: "100%",
  border: "1px solid #E4E1D2", borderRadius: 8, padding: "12px", marginBottom: 8,
  background: "#FBFAF5", textAlign: "left",
};

const badge = {
  display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
  color: "#8A4B52", background: "#F5E3E1", padding: "3px 8px", borderRadius: 12, whiteSpace: "nowrap",
};

function checkbox(checked, available) {
  return {
    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: checked && available ? "#4B6350" : "#fff",
    border: `1px solid ${checked && available ? "#4B6350" : "#DEDAC8"}`,
  };
}

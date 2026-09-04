import { useState, useEffect } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Dumbbell } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function TrainingTab({ userId }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);

  useEffect(() => { load(); }, [userId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("training_days")
      .select("id, name, day_of_week, position, observations, exercises(id, name, sets, reps, weight_kg, rest_seconds, notes, position)")
      .eq("user_id", userId)
      .order("position")
      .order("position", { referencedTable: "exercises" });
    setDays(data || []);
    setLoading(false);
  }

  const addDay = async () => {
    const position = days.length ? Math.max(...days.map(d => d.position)) + 1 : 0;
    const { data, error } = await supabase.from("training_days")
      .insert({ user_id: userId, name: "Novo dia de treino", position, observations: "" })
      .select().single();
    if (!error) {
      setDays(d => [...d, { ...data, exercises: [] }]);
      setExpandedDay(data.id);
    }
  };

  const updateDay = async (dayId, fields) => {
    setDays(d => d.map(x => x.id === dayId ? { ...x, ...fields } : x));
    await supabase.from("training_days").update(fields).eq("id", dayId);
  };

  const deleteDay = async (dayId) => {
    setDays(d => d.filter(x => x.id !== dayId));
    await supabase.from("training_days").delete().eq("id", dayId);
  };

  const moveDay = async (dayId, dir) => {
    const sorted = [...days].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(d => d.id === dayId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const [posA, posB] = [a.position, b.position];
    setDays(d => d.map(x => x.id === a.id ? { ...x, position: posB } : x.id === b.id ? { ...x, position: posA } : x));
    await Promise.all([
      supabase.from("training_days").update({ position: posB }).eq("id", a.id),
      supabase.from("training_days").update({ position: posA }).eq("id", b.id),
    ]);
  };

  const addExercise = async (dayId) => {
    const day = days.find(d => d.id === dayId);
    const position = day.exercises.length ? Math.max(...day.exercises.map(e => e.position)) + 1 : 0;
    const { data, error } = await supabase.from("exercises")
      .insert({ day_id: dayId, user_id: userId, name: "", sets: 3, reps: "10", weight_kg: null, rest_seconds: 60, position })
      .select().single();
    if (!error) setDays(d => d.map(x => x.id === dayId ? { ...x, exercises: [...x.exercises, data] } : x));
  };

  const updateExercise = async (dayId, exId, fields) => {
    setDays(d => d.map(x => x.id !== dayId ? x : { ...x, exercises: x.exercises.map(e => e.id === exId ? { ...e, ...fields } : e) }));
    await supabase.from("exercises").update(fields).eq("id", exId);
  };

  const deleteExercise = async (dayId, exId) => {
    setDays(d => d.map(x => x.id !== dayId ? x : { ...x, exercises: x.exercises.filter(e => e.id !== exId) }));
    await supabase.from("exercises").delete().eq("id", exId);
  };

  if (loading) return <p style={styles.emptyMeal}>A carregar…</p>;

  const todayDow = new Date().getDay();
  const sortedDays = [...days].sort((a, b) => a.position - b.position);

  return (
    <div>
      {sortedDays.map(day => {
        const isToday = day.day_of_week === todayDow;
        const expanded = expandedDay === day.id;
        return (
          <div key={day.id} style={{ ...styles.mealEditorBox, ...(isToday ? styles.trainingDayToday : {}) }}>
            <div style={styles.mealEditorHead}>
              <button style={styles.expandBtn} onClick={() => setExpandedDay(expanded ? null : day.id)}>
                <ChevronRight size={15} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
              <input style={styles.mealNameInput} value={day.name} onChange={e => updateDay(day.id, { name: e.target.value })} />
              <select style={styles.dayOfWeekSelect} value={day.day_of_week ?? ""}
                onChange={e => updateDay(day.id, { day_of_week: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">Sem dia fixo</option>
                {DAY_LABELS.map((label, i) => <option key={i} value={i}>{label}</option>)}
              </select>
              <div style={styles.rowGap}>
                <button style={styles.iconBtn} onClick={() => moveDay(day.id, "up")}><ChevronUp size={14} /></button>
                <button style={styles.iconBtn} onClick={() => moveDay(day.id, "down")}><ChevronDown size={14} /></button>
                <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => deleteDay(day.id)}><Trash2 size={14} /></button>
              </div>
            </div>

            {expanded && (
              <div style={styles.mealEditorBody}>
                {isToday && <p style={styles.trainingTodayBadge}><Dumbbell size={12} /> Treino de hoje</p>}
                <input style={styles.obsInput} placeholder="Observações do dia (opcional)"
                  value={day.observations} onChange={e => updateDay(day.id, { observations: e.target.value })} />

                {[...day.exercises].sort((a, b) => a.position - b.position).map(ex => (
                  <div key={ex.id} style={styles.exerciseRow}>
                    <input style={styles.ingNameInput} placeholder="Exercício" value={ex.name}
                      onChange={e => updateExercise(day.id, ex.id, { name: e.target.value })} />
                    <div style={styles.exerciseFieldsRow}>
                      <label style={styles.exerciseField}>Séries
                        <input style={styles.nutritionInput} type="number" min="0" value={ex.sets ?? ""}
                          onChange={e => updateExercise(day.id, ex.id, { sets: e.target.value === "" ? null : Number(e.target.value) })} />
                      </label>
                      <label style={styles.exerciseField}>Reps
                        <input style={styles.nutritionInput} value={ex.reps ?? ""}
                          onChange={e => updateExercise(day.id, ex.id, { reps: e.target.value })} />
                      </label>
                      <label style={styles.exerciseField}>Peso (kg)
                        <input style={styles.nutritionInput} type="number" step="0.5" value={ex.weight_kg ?? ""}
                          onChange={e => updateExercise(day.id, ex.id, { weight_kg: e.target.value === "" ? null : Number(e.target.value) })} />
                      </label>
                      <label style={styles.exerciseField}>Descanso (s)
                        <input style={styles.nutritionInput} type="number" min="0" step="5" value={ex.rest_seconds ?? ""}
                          onChange={e => updateExercise(day.id, ex.id, { rest_seconds: e.target.value === "" ? null : Number(e.target.value) })} />
                      </label>
                      <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => deleteExercise(day.id, ex.id)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
                <button style={styles.addIngBtn} onClick={() => addExercise(day.id)}><Plus size={12} /> Adicionar exercício</button>
              </div>
            )}
          </div>
        );
      })}

      <button style={styles.addMealBtn} onClick={addDay}><Plus size={15} /> Adicionar dia de treino</button>
    </div>
  );
}

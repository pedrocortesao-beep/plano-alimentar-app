import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Clock, Pencil, Check, X, ChevronRight, LogOut, Lock, Flame } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles, fontImport, UNITS } from "./styles";
import AboutTab, { APP_VERSION, CHANGELOG } from "./AboutTab";
import ShareTab from "./ShareTab";
import PersonalDataTab from "./PersonalDataTab";
import ModulesTab from "./ModulesTab";
import TutorTab from "./TutorTab";
import AdminTab from "./AdminTab";
import MoreMenu from "./MoreMenu";
import { DEFAULT_MENU_STRUCTURE } from "./menuItems";
import { useWaterReminder, loadWaterSettings } from "./useWaterReminder";
import { getTodayPhrase } from "./dailyPhrase";
import { approxGrams, computeMacros } from "./unitConversions";
import { suggestNutrition } from "./foodDatabase";

function computeVisibleKeys(menuVisibility, isTutor) {
  if (!menuVisibility) return null; // ainda a carregar: mostra tudo por omissão
  const myGroups = new Set(["user"]);
  if (isTutor) myGroups.add("tutor");
  const visible = new Set();
  Object.entries(menuVisibility).forEach(([itemKey, groups]) => {
    if ((groups || []).some(g => myGroups.has(g))) visible.add(itemKey);
  });
  return visible;
}

function getCurrentMealId(meals) {
  const timed = meals.filter(m => m.meal_time);
  if (!timed.length) return meals[0] ? meals[0].id : null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let current = timed[0];
  for (const m of timed) {
    if (toMin(m.meal_time) <= nowMin) current = m;
  }
  return current.id;
}

// Atrasa a escrita na base de dados (para não disparar um pedido por cada tecla),
// mas o estado local (o que vês no ecrã) atualiza-se sempre de imediato.
function useDebouncedSave(delay = 600) {
  const timers = useRef({});
  return useCallback((key, fn) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, delay);
  }, [delay]);
}

export default function PlanApp({ session, installPrompt, onInstall }) {
  const userId = session.user.id;
  const [viewingUserId, setViewingUserId] = useState(userId);
  const [myRole, setMyRole] = useState("user");
  const [myModules, setMyModules] = useState(["plano_alimentar"]);
  const [tutees, setTutees] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [profile, setProfile] = useState({ name: session.user.email, birth_date: null, sex: null, modules: ["plano_alimentar"] });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("hoje");
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [expandedOption, setExpandedOption] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [waterSettings, setWaterSettings] = useState(null);
  const [updateNotice, setUpdateNotice] = useState(null);
  const scheduleSave = useDebouncedSave();

  useWaterReminder(waterSettings);

  useEffect(() => {
    const seen = localStorage.getItem("activelife_seen_version");
    if (seen === null) {
      localStorage.setItem("activelife_seen_version", APP_VERSION);
    } else if (seen !== APP_VERSION) {
      const entry = CHANGELOG.find(c => c.version === APP_VERSION);
      setUpdateNotice(entry || { version: APP_VERSION, notes: "Novas melhorias disponíveis." });
    }
  }, []);

  const dismissUpdateNotice = () => {
    localStorage.setItem("activelife_seen_version", APP_VERSION);
    setUpdateNotice(null);
  };

  // Dados da própria conta (papel, tutelados, água) — carregam uma vez, não
  // mudam quando trocas de quem estás a gerir.
  useEffect(() => {
    supabase.from("profiles").select("role, modules").eq("id", userId).maybeSingle()
      .then(({ data }) => { if (data) { setMyRole(data.role); setMyModules(data.modules || ["plano_alimentar"]); } });
    loadWaterSettings(userId).then(setWaterSettings);
    loadTutees();
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle()
      .then(({ data }) => { if (data) setAppSettings(data); });
  }, []);

  async function loadTutees() {
    const { data } = await supabase
      .from("tutor_relationships")
      .select("user_id, profiles!user_id(name)")
      .eq("tutor_id", userId)
      .eq("status", "accepted");
    setTutees((data || []).map(r => ({ id: r.user_id, name: r.profiles?.name || "…" })));
  }

  // Dados da pessoa que estás a gerir (tu próprio, ou um tutelado) — recarrega
  // sempre que mudas o seletor "A gerir".
  useEffect(() => { loadTarget(viewingUserId); }, [viewingUserId]);

  async function loadTarget(targetId) {
    setLoading(true);
    try {
      const { data: profileRow } = await supabase
        .from("profiles").select("name, birth_date, sex, modules").eq("id", targetId).maybeSingle();
      if (profileRow) setProfile(profileRow);

      let { data: planRow, error } = await supabase
        .from("plans")
        .select(`
          id, observations, locked,
          meals ( id, name, meal_time, position, observations, selected_option_id,
            options!meal_id ( id, name, observations,
              ingredients ( id, name, qty, unit, notes )
            )
          )
        `)
        .eq("user_id", targetId)
        .order("position", { referencedTable: "meals" })
        .maybeSingle();

      if (error) throw error;

      if (!planRow) {
        const { data: created, error: createErr } = await supabase
          .from("plans").insert({ user_id: targetId, observations: "" }).select().single();
        if (createErr) throw createErr;
        planRow = { ...created, meals: [] };
      }
      if (!planRow.meals) planRow.meals = [];
      setPlan(planRow);
    } catch (e) {
      console.error(e);
      setSaveError(true);
    }
    setLoading(false);
  }

  const toggleLock = async () => {
    const locked = !plan.locked;
    setPlan(p => ({ ...p, locked }));
    const { error } = await supabase.from("plans").update({ locked }).eq("id", plan.id);
    if (error) setSaveError(true);
  };

  // ---- Refeições ----
  const addMeal = async () => {
    const position = plan.meals.length ? Math.max(...plan.meals.map(m => m.position)) + 1 : 0;
    const { data: meal, error } = await supabase.from("meals")
      .insert({ plan_id: plan.id, user_id: viewingUserId, name: "Nova refeição", meal_time: null, position, observations: "" })
      .select().single();
    if (error) { setSaveError(true); return; }
    const { data: option, error: optErr } = await supabase.from("options")
      .insert({ meal_id: meal.id, user_id: viewingUserId, name: "Opção 1", observations: "" })
      .select().single();
    if (optErr) { setSaveError(true); return; }
    const fullMeal = { ...meal, options: [{ ...option, ingredients: [] }] };
    setPlan(p => ({ ...p, meals: [...p.meals, fullMeal] }));
    setExpandedMeal(meal.id);
  };

  const updateMeal = (mealId, fields) => {
    setPlan(p => ({ ...p, meals: p.meals.map(m => m.id === mealId ? { ...m, ...fields } : m) }));
    scheduleSave(`meal:${mealId}`, async () => {
      const { error } = await supabase.from("meals").update(fields).eq("id", mealId);
      if (error) setSaveError(true);
    });
  };

  const deleteMeal = async (mealId) => {
    setPlan(p => ({ ...p, meals: p.meals.filter(m => m.id !== mealId) }));
    const { error } = await supabase.from("meals").delete().eq("id", mealId);
    if (error) setSaveError(true);
  };

  const moveMeal = async (mealId, dir) => {
    const sorted = [...plan.meals].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(m => m.id === mealId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const [posA, posB] = [a.position, b.position];
    setPlan(p => ({
      ...p,
      meals: p.meals.map(m => m.id === a.id ? { ...m, position: posB } : m.id === b.id ? { ...m, position: posA } : m)
    }));
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("meals").update({ position: posB }).eq("id", a.id),
      supabase.from("meals").update({ position: posA }).eq("id", b.id),
    ]);
    if (e1 || e2) setSaveError(true);
  };

  // ---- Opções ----
  const addOption = async (mealId) => {
    const meal = plan.meals.find(m => m.id === mealId);
    const n = meal.options.length + 1;
    const { data: option, error } = await supabase.from("options")
      .insert({ meal_id: mealId, user_id: viewingUserId, name: `Opção ${n}`, observations: "" })
      .select().single();
    if (error) { setSaveError(true); return; }
    setPlan(p => ({ ...p, meals: p.meals.map(m => m.id !== mealId ? m : { ...m, options: [...m.options, { ...option, ingredients: [] }] }) }));
  };

  const updateOption = (mealId, optionId, fields) => {
    setPlan(p => ({ ...p, meals: p.meals.map(m => m.id !== mealId ? m : { ...m, options: m.options.map(o => o.id === optionId ? { ...o, ...fields } : o) }) }));
    scheduleSave(`option:${optionId}`, async () => {
      const { error } = await supabase.from("options").update(fields).eq("id", optionId);
      if (error) setSaveError(true);
    });
  };

  const deleteOption = async (mealId, optionId) => {
    setPlan(p => ({
      ...p,
      meals: p.meals.map(m => m.id !== mealId ? m : {
        ...m,
        options: m.options.filter(o => o.id !== optionId),
        selected_option_id: m.selected_option_id === optionId ? null : m.selected_option_id,
      })
    }));
    const { error } = await supabase.from("options").delete().eq("id", optionId);
    if (error) setSaveError(true);
  };

  const selectOption = (mealId, optionId) => updateMeal(mealId, { selected_option_id: optionId });

  // ---- Ingredientes ----
  const addIngredient = async (mealId, optionId) => {
    const { data: ing, error } = await supabase.from("ingredients")
      .insert({ option_id: optionId, user_id: viewingUserId, name: "", qty: "", unit: "g", notes: "" })
      .select().single();
    if (error) { setSaveError(true); return; }
    setPlan(p => ({ ...p, meals: p.meals.map(m => m.id !== mealId ? m : { ...m, options: m.options.map(o => o.id !== optionId ? o : { ...o, ingredients: [...o.ingredients, ing] }) }) }));
  };

  const updateIngredient = (mealId, optionId, ingId, fields) => {
    setPlan(p => ({
      ...p, meals: p.meals.map(m => m.id !== mealId ? m : {
        ...m, options: m.options.map(o => o.id !== optionId ? o : {
          ...o, ingredients: o.ingredients.map(i => i.id === ingId ? { ...i, ...fields } : i)
        })
      })
    }));
    scheduleSave(`ing:${ingId}`, async () => {
      const { error } = await supabase.from("ingredients").update(fields).eq("id", ingId);
      if (error) setSaveError(true);
    });
  };

  const deleteIngredient = async (mealId, optionId, ingId) => {
    setPlan(p => ({
      ...p, meals: p.meals.map(m => m.id !== mealId ? m : {
        ...m, options: m.options.map(o => o.id !== optionId ? o : { ...o, ingredients: o.ingredients.filter(i => i.id !== ingId) })
      })
    }));
    const { error } = await supabase.from("ingredients").delete().eq("id", ingId);
    if (error) setSaveError(true);
  };

  const updatePlanObs = (v) => {
    setPlan(p => ({ ...p, observations: v }));
    scheduleSave(`plan:${plan.id}`, async () => {
      const { error } = await supabase.from("plans").update({ observations: v }).eq("id", plan.id);
      if (error) setSaveError(true);
    });
  };

  if (loading || !plan) {
    return (
      <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{fontImport}</style>
        <p style={{ fontFamily: "Karla, sans-serif", color: "#6b7268" }}>A carregar plano…</p>
      </div>
    );
  }

  const sortedMeals = [...plan.meals].sort((a, b) => a.position - b.position);

  return (
    <div style={styles.page}>
      <style>{`${fontImport} * { box-sizing: border-box; } input, textarea, select { font-family: 'Karla', sans-serif; } ::placeholder { color: #a3a08f; }`}</style>

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>ActiveLife</div>
          {tutees.length > 0 ? (
            <select style={styles.viewingSelect} value={viewingUserId} onChange={e => setViewingUserId(e.target.value)}>
              <option value={userId}>A gerir: Eu</option>
              {tutees.map(t => <option key={t.id} value={t.id}>A gerir: {t.name}</option>)}
            </select>
          ) : (
            <h1 style={styles.h1}>Olá, {profile.name}</h1>
          )}
        </div>
        <div style={styles.rowGap}>
          {installPrompt && (
            <button style={styles.smallBtnPrimary} onClick={onInstall}>
              Instalar app
            </button>
          )}
          {waterSettings && (
            <MoreMenu userId={userId} waterSettings={waterSettings} onWaterSettingsChange={setWaterSettings}
              onNavigate={setTab} isAdmin={myRole === "admin"}
              menuStructure={appSettings?.menu_structure || DEFAULT_MENU_STRUCTURE}
              menuVisibleKeys={computeVisibleKeys(appSettings?.menu_visibility, tutees.length > 0)} />
          )}
          <button style={styles.logoutBtn} onClick={() => supabase.auth.signOut()}>
            <LogOut size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> Sair
          </button>
        </div>
      </header>

      {updateNotice && (
        <div style={styles.updateBanner}>
          <span>✨ Atualizado para a versão {updateNotice.version}: {updateNotice.notes}</span>
          <button style={styles.iconBtn} onClick={dismissUpdateNotice}><X size={15} /></button>
        </div>
      )}

      {saveError && <div style={styles.errorBanner}>Houve um problema a guardar a última alteração. Verifica a ligação e tenta de novo.</div>}

      <main style={styles.main}>
        {tab !== "hoje" && (
          <button style={styles.backLink} onClick={() => setTab("hoje")}>
            <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Hoje
          </button>
        )}
        {tab === "hoje" && (
          <TodayView plan={plan} meals={sortedMeals} onSelectOption={selectOption} />
        )}
        {tab === "gerir" && (
          <ManageView
            plan={plan} meals={sortedMeals} locked={plan.locked} onToggleLock={toggleLock}
            expandedMeal={expandedMeal} setExpandedMeal={setExpandedMeal}
            expandedOption={expandedOption} setExpandedOption={setExpandedOption}
            onAddMeal={addMeal} onUpdateMeal={updateMeal} onDeleteMeal={deleteMeal} onMoveMeal={moveMeal}
            onAddOption={addOption} onUpdateOption={updateOption} onDeleteOption={deleteOption}
            onAddIngredient={addIngredient} onUpdateIngredient={updateIngredient} onDeleteIngredient={deleteIngredient}
            onUpdatePlanObs={updatePlanObs}
          />
        )}
        {tab === "sobre" && <AboutTab limit={appSettings?.changelog_limit} />}
        {tab === "partilhar" && <ShareTab />}
        {tab === "dados" && (
          <PersonalDataTab key={viewingUserId} userId={viewingUserId} profile={profile}
            canChangePassword={viewingUserId === userId}
            onSaved={(fields) => setProfile(p => ({ ...p, ...fields }))} />
        )}
        {tab === "modulos" && (
          <ModulesTab userId={userId} modules={myModules}
            onSaved={setMyModules} />
        )}
        {tab === "tutores" && <TutorTab userId={userId} />}
        {tab === "admin" && myRole === "admin" && <AdminTab userId={userId} />}
      </main>
    </div>
  );
}

function MacroSummary({ ingredients }) {
  const macros = computeMacros(ingredients);
  if (!macros) return null;
  return (
    <div style={styles.macroSummary}>
      <span><strong>{macros.kcal}</strong> kcal</span>
      <span><strong>{macros.protein}g</strong> proteína</span>
      <span><strong>{macros.carbs}g</strong> hidratos</span>
      <span><strong>{macros.fat}g</strong> gordura</span>
      {macros.incomplete && <span style={styles.macroIncomplete}>(alguns ingredientes sem dados nutricionais)</span>}
    </div>
  );
}

function TodayView({ plan, meals, onSelectOption }) {
  const [pinnedId, setPinnedId] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const autoId = getCurrentMealId(meals);
  const openMealId = pinnedId || autoId;
  const toggleMeal = (id) => { if (id !== openMealId) setPinnedId(id); };

  return (
    <div>
      <div style={styles.phraseCard}>
        <p style={styles.phraseText}>"{getTodayPhrase()}"</p>
      </div>

      <div style={styles.timeline}>
        {meals.length === 0 && (
          <div style={{ padding: 18 }}>
            <p style={styles.emptyMeal}>Ainda não tens refeições. Vai a "Gerir plano" para adicionar a primeira.</p>
          </div>
        )}
        {meals.map((meal, idx) => {
          const selected = meal.options.find(o => o.id === meal.selected_option_id) || meal.options[0];
          const isOpen = openMealId === meal.id;
          return (
            <div key={meal.id} style={{ ...styles.timelineRow, borderTop: idx === 0 ? "none" : "1px solid #DEDAC8" }}>
              <div style={styles.timeCol}>
                {meal.meal_time && <>
                  <Clock size={12} color="#8A4B52" />
                  <span style={styles.timeText}>{meal.meal_time}</span>
                </>}
              </div>
              <div style={styles.mealCol}>
                <button style={styles.mealHeadBtn} onClick={() => toggleMeal(meal.id)}>
                  <span style={styles.mealName}>{meal.name}</span>
                  <ChevronRight size={15} color="#6b7268" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                </button>
                {isOpen && (
                  <div style={styles.mealBody}>
                    {meal.options.length > 1 && (
                      <div style={styles.optionChips}>
                        {meal.options.map(o => (
                          <button key={o.id} onClick={() => onSelectOption(meal.id, o.id)}
                            style={{ ...styles.chip, ...(o.id === (selected && selected.id) ? styles.chipActive : {}) }}>
                            {o.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {selected && selected.ingredients.length > 0 ? (
                      <ul style={styles.ingList}>
                        {selected.ingredients.map(i => {
                          const grams = approxGrams(i.qty, i.unit);
                          const qtyLabel = i.qty ? `${i.qty} ${i.unit === "unidade" ? "Un" : (i.unit || "")}`.trim() : "";
                          return (
                            <li key={i.id} style={styles.ingItem}>
                              {qtyLabel && <span style={styles.ingQty}>{qtyLabel}</span>}
                              <span>
                                {i.name}{i.notes ? ` — ${i.notes}` : ""}
                                {grams && <span style={styles.approxGrams}> (≈ {grams} g)</span>}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p style={styles.emptyMeal}>Sem ingredientes definidos ainda.</p>
                    )}
                    {selected && <MacroSummary ingredients={selected.ingredients} />}
                    {meal.observations && <p style={styles.mealObs}>{meal.observations}</p>}
                    {selected && selected.observations && <p style={styles.mealObs}>{selected.observations}</p>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Observações do plano</div>
        <p style={styles.planObsText}>{plan.observations || "Sem observações."}</p>
      </div>
    </div>
  );
}

function ManageView(props) {
  const { plan, meals, locked, onToggleLock, expandedMeal, setExpandedMeal, expandedOption, setExpandedOption,
    onAddMeal, onUpdateMeal, onDeleteMeal, onMoveMeal,
    onAddOption, onUpdateOption, onDeleteOption,
    onAddIngredient, onUpdateIngredient, onDeleteIngredient, onUpdatePlanObs } = props;

  return (
    <div>
      <button style={lockBannerStyle(locked)} onClick={onToggleLock}>
        <Lock size={14} />
        {locked ? "Plano bloqueado — toca para desbloquear e editar" : "Plano desbloqueado — toca para bloquear"}
      </button>

      <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0, minWidth: 0, width: "100%", opacity: locked ? 0.55 : 1 }}>
      {meals.map((meal, idx) => (
        <MealEditor key={meal.id} meal={meal} isFirst={idx === 0} isLast={idx === meals.length - 1}
          expanded={expandedMeal === meal.id}
          onToggle={() => setExpandedMeal(expandedMeal === meal.id ? null : meal.id)}
          expandedOption={expandedOption} setExpandedOption={setExpandedOption}
          onUpdateMeal={(f) => onUpdateMeal(meal.id, f)}
          onDeleteMeal={() => onDeleteMeal(meal.id)}
          onMoveMeal={(dir) => onMoveMeal(meal.id, dir)}
          onAddOption={() => onAddOption(meal.id)}
          onUpdateOption={(optId, f) => onUpdateOption(meal.id, optId, f)}
          onDeleteOption={(optId) => onDeleteOption(meal.id, optId)}
          onAddIngredient={(optId) => onAddIngredient(meal.id, optId)}
          onUpdateIngredient={(optId, ingId, f) => onUpdateIngredient(meal.id, optId, ingId, f)}
          onDeleteIngredient={(optId, ingId) => onDeleteIngredient(meal.id, optId, ingId)}
        />
      ))}

      <button style={styles.addMealBtn} onClick={onAddMeal}><Plus size={15} /> Adicionar refeição</button>

      <div style={{ ...styles.planObsBox, marginTop: 20 }}>
        <div style={styles.planObsTitle}>Observações do plano</div>
        <textarea style={styles.textarea} value={plan.observations || ""} onChange={e => onUpdatePlanObs(e.target.value)} rows={3}
          placeholder="Ex.: beber 2L de água por dia…" />
      </div>
      </fieldset>
    </div>
  );
}

function lockBannerStyle(locked) {
  return {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    border: "1px solid #DEDAC8", borderRadius: 8, padding: "10px 12px",
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", marginBottom: 12,
    background: locked ? "#F5E3E1" : "#EAF0EA", color: locked ? "#8A4B52" : "#4B6350",
  };
}

function MealEditor({ meal, isFirst, isLast, expanded, onToggle, expandedOption, setExpandedOption,
  onUpdateMeal, onDeleteMeal, onMoveMeal, onAddOption, onUpdateOption, onDeleteOption,
  onAddIngredient, onUpdateIngredient, onDeleteIngredient }) {

  return (
    <div style={styles.mealEditorBox}>
      <div style={styles.mealEditorHead}>
        <button style={styles.expandBtn} onClick={onToggle}>
          <ChevronRight size={15} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        </button>
        <input style={styles.mealNameInput} value={meal.name} onChange={e => onUpdateMeal({ name: e.target.value })} />
        <input style={styles.timeInput} type="time" value={meal.meal_time || ""} onChange={e => onUpdateMeal({ meal_time: e.target.value || null })} />
        <div style={styles.rowGap}>
          <button style={styles.iconBtn} disabled={isFirst} onClick={() => onMoveMeal("up")}><ChevronUp size={14} /></button>
          <button style={styles.iconBtn} disabled={isLast} onClick={() => onMoveMeal("down")}><ChevronDown size={14} /></button>
          <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={onDeleteMeal}><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div style={styles.mealEditorBody}>
          <input style={styles.obsInput} placeholder="Observações da refeição (opcional)"
            value={meal.observations} onChange={e => onUpdateMeal({ observations: e.target.value })} />

          {meal.options.map(opt => (
            <OptionEditor key={opt.id} option={opt}
              expanded={expandedOption === opt.id}
              onToggle={() => setExpandedOption(expandedOption === opt.id ? null : opt.id)}
              onUpdateOption={(f) => onUpdateOption(opt.id, f)}
              onDeleteOption={() => onDeleteOption(opt.id)}
              onAddIngredient={() => onAddIngredient(opt.id)}
              onUpdateIngredient={(ingId, f) => onUpdateIngredient(opt.id, ingId, f)}
              onDeleteIngredient={(ingId) => onDeleteIngredient(opt.id, ingId)}
            />
          ))}
          <button style={styles.addOptionBtn} onClick={onAddOption}><Plus size={13} /> Adicionar opção</button>
        </div>
      )}
    </div>
  );
}

function OptionEditor({ option, expanded, onToggle, onUpdateOption, onDeleteOption,
  onAddIngredient, onUpdateIngredient, onDeleteIngredient }) {
  const [nutritionOpenId, setNutritionOpenId] = useState(null);

  return (
    <div style={styles.optionBox}>
      <div style={styles.optionHead}>
        <button style={styles.expandBtn} onClick={onToggle}>
          <ChevronRight size={13} style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
        </button>
        <input style={styles.optionNameInput} value={option.name} onChange={e => onUpdateOption({ name: e.target.value })} />
        <span style={styles.ingCount}>{option.ingredients.length} ingrediente{option.ingredients.length !== 1 ? "s" : ""}</span>
        <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={onDeleteOption}><Trash2 size={13} /></button>
      </div>
      {expanded && (
        <div style={styles.optionBody}>
          {option.ingredients.map(ing => (
            <div key={ing.id}>
              <div style={styles.ingRow}>
                <input style={styles.ingNameInput} placeholder="Ingrediente" value={ing.name} onChange={e => onUpdateIngredient(ing.id, { name: e.target.value })} />
                <input style={styles.ingQtyInput} placeholder="Qtd" value={ing.qty} onChange={e => onUpdateIngredient(ing.id, { qty: e.target.value })} />
                <select style={styles.ingUnitInput} value={ing.unit || "g"} onChange={e => onUpdateIngredient(ing.id, { unit: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button style={styles.iconBtn}
                  onClick={() => setNutritionOpenId(nutritionOpenId === ing.id ? null : ing.id)}
                  title="Valores nutricionais">
                  <Flame size={13} color={ing.kcal_per_100 != null ? "#C98A3D" : (suggestNutrition(ing.name) ? "#E8CFA0" : "#a3a08f")} />
                </button>
                <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => onDeleteIngredient(ing.id)}><Trash2 size={12} /></button>
              </div>
              {nutritionOpenId === ing.id && (
                <div style={styles.nutritionBox}>
                  <p style={{ ...styles.emptyMeal, marginBottom: 6 }}>Valores por 100 g/ml:</p>
                  {ing.kcal_per_100 == null && (() => {
                    const suggestion = suggestNutrition(ing.name);
                    if (!suggestion) return null;
                    return (
                      <button style={styles.suggestionBtn} onClick={() => onUpdateIngredient(ing.id, {
                        kcal_per_100: suggestion.kcal, protein_per_100: suggestion.protein,
                        carbs_per_100: suggestion.carbs, fat_per_100: suggestion.fat,
                        ...(ing.unit === "unidade" && suggestion.gramsPerUnit ? { grams_per_unit: suggestion.gramsPerUnit } : {}),
                      })}>
                        <Flame size={13} /> Usar sugestão: {suggestion.kcal} kcal, {suggestion.protein}g prot., {suggestion.carbs}g hid., {suggestion.fat}g gord. (por 100g)
                      </button>
                    );
                  })()}
                  <div style={styles.nutritionGrid}>
                    <label style={styles.nutritionField}>
                      kcal
                      <input style={styles.input} type="number" min="0" value={ing.kcal_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { kcal_per_100: e.target.value === "" ? null : Number(e.target.value) })} />
                    </label>
                    <label style={styles.nutritionField}>
                      Proteína (g)
                      <input style={styles.input} type="number" min="0" step="0.1" value={ing.protein_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { protein_per_100: e.target.value === "" ? null : Number(e.target.value) })} />
                    </label>
                    <label style={styles.nutritionField}>
                      Hidratos (g)
                      <input style={styles.input} type="number" min="0" step="0.1" value={ing.carbs_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { carbs_per_100: e.target.value === "" ? null : Number(e.target.value) })} />
                    </label>
                    <label style={styles.nutritionField}>
                      Gordura (g)
                      <input style={styles.input} type="number" min="0" step="0.1" value={ing.fat_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { fat_per_100: e.target.value === "" ? null : Number(e.target.value) })} />
                    </label>
                    {ing.unit === "unidade" && (
                      <label style={styles.nutritionField}>
                        Peso aprox. por unidade (g)
                        <input style={styles.input} type="number" min="0" value={ing.grams_per_unit ?? ""}
                          onChange={e => onUpdateIngredient(ing.id, { grams_per_unit: e.target.value === "" ? null : Number(e.target.value) })} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <button style={styles.addIngBtn} onClick={onAddIngredient}><Plus size={12} /> Adicionar ingrediente</button>
          <MacroSummary ingredients={option.ingredients} />
          <input style={styles.obsInput} placeholder="Observações da opção (opcional)" value={option.observations} onChange={e => onUpdateOption({ observations: e.target.value })} />
        </div>
      )}
    </div>
  );
}

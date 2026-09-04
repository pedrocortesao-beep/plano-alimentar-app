import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Clock, Pencil, Check, X, ChevronRight, LogOut, Lock, Flame, Camera } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles, fontImport, UNITS } from "./styles";
import AboutTab, { APP_VERSION, CHANGELOG } from "./AboutTab";
import ShareTab from "./ShareTab";
import PersonalDataTab from "./PersonalDataTab";
import ModulesTab from "./ModulesTab";
import TutorTab from "./TutorTab";
import AdminTab from "./AdminTab";
import MetricsTab from "./MetricsTab";
import TrainingTab from "./TrainingTab";
import BottomNav from "./BottomNav";
import MoreMenu from "./MoreMenu";
import { DEFAULT_MENU_STRUCTURE } from "./menuItems";
import { useWaterReminder, loadWaterSettings } from "./useWaterReminder";
import { getTodayPhrase } from "./dailyPhrase";
import { approxGrams, computeMacros } from "./unitConversions";
import { loadFoods, findMatch } from "./foodDatabase";

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
// Junta todas as alterações feitas dentro da janela de espera, para não
// perder campos anteriores quando editas vários seguidos rapidamente, e
// permite forçar a gravação imediata (ex.: quando sais da app).
function useDebouncedSave(delay = 600) {
  const timers = useRef({});
  const pending = useRef({}); // key -> { fields, saveFn }

  const runNow = useCallback((key) => {
    const entry = pending.current[key];
    if (!entry) return;
    delete pending.current[key];
    if (timers.current[key]) { clearTimeout(timers.current[key]); delete timers.current[key]; }
    entry.saveFn(entry.fields);
  }, []);

  const schedule = useCallback((key, fields, saveFn) => {
    const existing = pending.current[key];
    pending.current[key] = { fields: { ...(existing?.fields || {}), ...fields }, saveFn };
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => runNow(key), delay);
  }, [delay, runNow]);

  const flushAll = useCallback(() => {
    Object.keys(pending.current).forEach(runNow);
  }, [runNow]);

  return { schedule, flushAll };
}

export default function PlanApp({ session, installPrompt, onInstall }) {
  const userId = session.user.id;
  const [viewingUserId, setViewingUserId] = useState(userId);
  const [myRole, setMyRole] = useState("user");
  const [myModules, setMyModules] = useState(["plano_alimentar"]);
  const [tutees, setTutees] = useState([]);
  const [appSettings, setAppSettings] = useState(null);
  const [goals, setGoals] = useState({ target_weight_kg: "", target_kcal: "" });
  const [foods, setFoods] = useState([]);
  const [profile, setProfile] = useState({ name: session.user.email, birth_date: null, sex: null, modules: ["plano_alimentar"] });
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("hoje");
  const [expandedMeal, setExpandedMeal] = useState(null);
  const [expandedOption, setExpandedOption] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [waterSettings, setWaterSettings] = useState(null);
  const [updateNotice, setUpdateNotice] = useState(null);
  const { schedule: scheduleSave, flushAll } = useDebouncedSave();
  const autoFilledForRef = useRef(null);

  useWaterReminder(waterSettings);

  // Grava imediatamente qualquer alteração pendente sempre que a app é posta
  // em segundo plano, ou a página está prestes a fechar/recarregar — sem
  // isto, uma saída rápida a seguir a escrever podia perder a gravação.
  useEffect(() => {
    const onHide = () => { if (document.hidden) flushAll(); };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("beforeunload", flushAll);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      window.removeEventListener("beforeunload", flushAll);
    };
  }, [flushAll]);

  const changeTab = (t) => { flushAll(); setTab(t); };

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
    supabase.from("profiles").select("role, modules, blocked").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (data?.blocked) {
          localStorage.setItem("activelife_blocked", "1");
          supabase.auth.signOut();
          return;
        }
        if (data) { setMyRole(data.role); setMyModules(data.modules || ["plano_alimentar"]); }
      });
    loadWaterSettings(userId).then(setWaterSettings);
    loadTutees();
    supabase.from("app_settings").select("*").eq("id", true).maybeSingle()
      .then(({ data }) => { if (data) setAppSettings(data); });
    loadFoods().then(setFoods);
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

      supabase.from("goals").select("target_weight_kg, target_kcal").eq("user_id", targetId).maybeSingle()
        .then(({ data }) => setGoals({ target_weight_kg: data?.target_weight_kg ?? "", target_kcal: data?.target_kcal ?? "" }));

      let { data: planRow, error } = await supabase
        .from("plans")
        .select(`
          id, observations, locked,
          meals ( id, name, meal_time, position, observations, selected_option_id,
            options!meal_id ( id, name, observations, photo_url,
              ingredients ( id, name, qty, unit, notes, kcal_per_100, protein_per_100, carbs_per_100, fat_per_100, grams_per_unit )
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
    scheduleSave(`meal:${mealId}`, fields, async (toSave) => {
      const { error } = await supabase.from("meals").update(toSave).eq("id", mealId);
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
    scheduleSave(`option:${optionId}`, fields, async (toSave) => {
      const { error } = await supabase.from("options").update(toSave).eq("id", optionId);
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
    scheduleSave(`ing:${ingId}`, fields, async (toSave) => {
      const { error } = await supabase.from("ingredients").update(toSave).eq("id", ingId);
      if (error) setSaveError(true);
    });
  };

  // Assim que o plano e a base de alimentos carregam, preenche automaticamente
  // os valores nutricionais de ingredientes já existentes que ainda não os
  // têm, e contribui para a base partilhada os que já têm valores mas ainda
  // não têm correspondência lá (uma vez por pessoa gerida).
  useEffect(() => {
    if (!plan || !foods.length) return;
    if (autoFilledForRef.current === viewingUserId) return;
    autoFilledForRef.current = viewingUserId;
    const contributedNames = new Set();
    plan.meals.forEach(meal => {
      meal.options.forEach(opt => {
        opt.ingredients.forEach(ing => {
          applySuggestionIfEmpty(ing, (ingId, fields) => updateIngredient(meal.id, opt.id, ingId, fields), foods);
          const norm = (ing.name || "").trim().toLowerCase();
          if (ing.kcal_per_100 != null && norm && !contributedNames.has(norm) && !findMatch(foods, ing.name)) {
            contributedNames.add(norm);
            contributeFood(ing);
          }
        });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, foods, viewingUserId]);

  // Quando preenches os valores nutricionais à mão num ingrediente, aplica os
  // mesmos valores a outros ingredientes com o mesmo nome, no resto do plano,
  // que ainda não os tenham (para não teres de repetir o preenchimento).
  const propagateNutrition = (sourceIng) => {
    if (sourceIng.kcal_per_100 == null || !sourceIng.name) return;
    const norm = sourceIng.name.trim().toLowerCase();
    plan.meals.forEach(meal => {
      meal.options.forEach(opt => {
        opt.ingredients.forEach(ing => {
          if (ing.id === sourceIng.id) return;
          if (ing.kcal_per_100 != null) return;
          if ((ing.name || "").trim().toLowerCase() !== norm) return;
          updateIngredient(meal.id, opt.id, ing.id, {
            kcal_per_100: sourceIng.kcal_per_100, protein_per_100: sourceIng.protein_per_100,
            carbs_per_100: sourceIng.carbs_per_100, fat_per_100: sourceIng.fat_per_100,
            ...(ing.unit === "unidade" && sourceIng.grams_per_unit ? { grams_per_unit: sourceIng.grams_per_unit } : {}),
          });
        });
      });
    });
  };

  const foodsRef = useRef(foods);
  useEffect(() => { foodsRef.current = foods; }, [foods]);
  const contributingRef = useRef(new Set());

  const contributeFood = async (ing) => {
    if (ing.kcal_per_100 == null || !ing.name) return;
    const norm = ing.name.trim().toLowerCase();
    if (findMatch(foodsRef.current, ing.name)) return; // já existe (ou acabou de ser criado)
    if (contributingRef.current.has(norm)) return; // já está a ser criado agora mesmo
    contributingRef.current.add(norm);
    const { data, error } = await supabase.from("foods").insert({
      name: ing.name.trim(), aliases: [],
      kcal: ing.kcal_per_100, protein: ing.protein_per_100 || 0,
      carbs: ing.carbs_per_100 || 0, fat: ing.fat_per_100 || 0,
      grams_per_unit: ing.grams_per_unit || null,
    }).select().single();
    contributingRef.current.delete(norm);
    if (!error && data) setFoods(f => findMatch(f, data.name) ? f : [...f, data]);
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
    scheduleSave(`plan:${plan.id}`, { observations: v }, async (toSave) => {
      const { error } = await supabase.from("plans").update(toSave).eq("id", plan.id);
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
        {waterSettings && (
          <MoreMenu userId={userId} waterSettings={waterSettings} onWaterSettingsChange={setWaterSettings}
            onNavigate={changeTab} isAdmin={myRole === "admin"}
            menuStructure={appSettings?.menu_structure || DEFAULT_MENU_STRUCTURE}
            menuVisibleKeys={computeVisibleKeys(appSettings?.menu_visibility, tutees.length > 0)}
            installPrompt={installPrompt} onInstall={onInstall}
            metricsEnabled={myModules.includes("metricas")} trainingEnabled={myModules.includes("plano_treino")} />
        )}
        <div style={styles.headerCenter}>
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
        <button style={styles.logoutBtn} onClick={() => { flushAll(); supabase.auth.signOut(); }}>
          <LogOut size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} /> Sair
        </button>
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
          <button style={styles.backLink} onClick={() => changeTab("hoje")}>
            <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Hoje
          </button>
        )}
        {tab === "hoje" && (
          <TodayView plan={plan} meals={sortedMeals} onSelectOption={selectOption} targetKcal={goals.target_kcal} userId={viewingUserId} foods={foods} onContributeFood={contributeFood} />
        )}
        {tab === "gerir" && (
          <ManageView
            plan={plan} meals={sortedMeals} locked={plan.locked} onToggleLock={toggleLock} foods={foods}
            onPropagateNutrition={propagateNutrition} onContributeFood={contributeFood}
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
        {tab === "metricas" && myModules.includes("metricas") && <MetricsTab key={viewingUserId} userId={viewingUserId} onGoalsChange={setGoals} />}
        {tab === "treino" && myModules.includes("plano_treino") && <TrainingTab key={viewingUserId} userId={viewingUserId} />}
      </main>

      <BottomNav modules={myModules} currentTab={tab} onNavigate={changeTab} />
    </div>
  );
}

function computeDailyMacros(meals) {
  let kcal = 0, protein = 0, carbs = 0, fat = 0, any = false;
  const missing = [];
  meals.forEach(meal => {
    const firstOption = meal.options[0];
    if (!firstOption) return;
    const m = computeMacros(firstOption.ingredients);
    if (!m) {
      (firstOption.ingredients || []).forEach(i => { if (Number(i.qty) && i.name) missing.push(i.name); });
      return;
    }
    any = true;
    kcal += m.kcal; protein += m.protein; carbs += m.carbs; fat += m.fat;
    missing.push(...m.missing);
  });
  if (!any) return null;
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    incomplete: missing.length > 0,
    missing,
  };
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
      {macros.incomplete && <span style={styles.macroIncomplete}>(sem dados: {macros.missing.join(", ")})</span>}
    </div>
  );
}

function todayLocalISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function TodayView({ plan, meals, onSelectOption, targetKcal, userId, foods, onContributeFood }) {
  const [pinnedId, setPinnedId] = useState(null);
  const [tick, setTick] = useState(0);
  const [log, setLog] = useState([]);
  const [addingExtra, setAddingExtra] = useState(false);
  const [extraDraft, setExtraDraft] = useState({ label: "", kcal: "", protein: "", carbs: "", fat: "", weight_g: "", qty: "" });

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { loadLog(); }, [userId]);

  async function loadLog() {
    const { data } = await supabase.from("consumption_log")
      .select("*").eq("user_id", userId).eq("log_date", todayLocalISO());
    setLog(data || []);
  }

  const markEaten = async (meal, selected) => {
    const macros = computeMacros(selected.ingredients) || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const row = {
      user_id: userId, log_date: todayLocalISO(), meal_id: meal.id, option_id: selected.id,
      label: `${meal.name} — ${selected.name}`,
      kcal: macros.kcal, protein: macros.protein, carbs: macros.carbs, fat: macros.fat,
    };
    const { data, error } = await supabase.from("consumption_log").insert(row).select().single();
    if (!error) setLog(l => [...l, data]);
  };

  const unmarkEaten = async (mealId) => {
    const entry = log.find(e => e.meal_id === mealId);
    if (!entry) return;
    setLog(l => l.filter(e => e.id !== entry.id));
    await supabase.from("consumption_log").delete().eq("id", entry.id);
  };

  const [matchedExtraFood, setMatchedExtraFood] = useState(null);

  const suggestExtra = () => {
    const match = findMatch(foods, extraDraft.label);
    if (!match) { setMatchedExtraFood(null); return; }
    setMatchedExtraFood(match);
    if (extraDraft.kcal !== "") return; // já tem valores, não sobrepor
    if (match.grams_per_unit) {
      const qty = Number(extraDraft.qty) || 1;
      const weight = qty * match.grams_per_unit;
      setExtraDraft(d => ({
        ...d, qty,
        kcal: Math.round(match.kcal * weight / 100),
        protein: Math.round(match.protein * weight / 100 * 10) / 10,
        carbs: Math.round(match.carbs * weight / 100 * 10) / 10,
        fat: Math.round(match.fat * weight / 100 * 10) / 10,
      }));
    } else {
      const weight = Number(extraDraft.weight_g) || 100;
      setExtraDraft(d => ({
        ...d, weight_g: weight,
        kcal: Math.round(match.kcal * weight / 100),
        protein: Math.round(match.protein * weight / 100 * 10) / 10,
        carbs: Math.round(match.carbs * weight / 100 * 10) / 10,
        fat: Math.round(match.fat * weight / 100 * 10) / 10,
      }));
    }
  };

  const recomputeFromQty = (qty) => {
    if (matchedExtraFood?.grams_per_unit) {
      const weight = (Number(qty) || 0) * matchedExtraFood.grams_per_unit;
      setExtraDraft(d => ({
        ...d, qty,
        kcal: Math.round(matchedExtraFood.kcal * weight / 100),
        protein: Math.round(matchedExtraFood.protein * weight / 100 * 10) / 10,
        carbs: Math.round(matchedExtraFood.carbs * weight / 100 * 10) / 10,
        fat: Math.round(matchedExtraFood.fat * weight / 100 * 10) / 10,
      }));
    } else {
      setExtraDraft(d => ({ ...d, qty }));
    }
  };

  const effectiveWeight = () => {
    if (matchedExtraFood?.grams_per_unit) return (Number(extraDraft.qty) || 0) * matchedExtraFood.grams_per_unit;
    return Number(extraDraft.weight_g) || 0;
  };

  const updateExtraWeight = (weight_g) => {
    if (matchedExtraFood && weight_g) {
      setExtraDraft(d => ({
        ...d, weight_g,
        kcal: Math.round(matchedExtraFood.kcal * weight_g / 100),
        protein: Math.round(matchedExtraFood.protein * weight_g / 100 * 10) / 10,
        carbs: Math.round(matchedExtraFood.carbs * weight_g / 100 * 10) / 10,
        fat: Math.round(matchedExtraFood.fat * weight_g / 100 * 10) / 10,
      }));
    } else {
      setExtraDraft(d => ({ ...d, weight_g }));
    }
  };

  const addExtra = async () => {
    if (!extraDraft.label.trim()) return;
    const row = {
      user_id: userId, log_date: todayLocalISO(), meal_id: null,
      label: extraDraft.label.trim(),
      kcal: Number(extraDraft.kcal) || 0, protein: Number(extraDraft.protein) || 0,
      carbs: Number(extraDraft.carbs) || 0, fat: Number(extraDraft.fat) || 0,
    };
    const { data, error } = await supabase.from("consumption_log").insert(row).select().single();
    if (!error) {
      setLog(l => [...l, data]);
      // Se souberes o peso do que comeste, contribui para a base partilhada
      // (convertido para valores "por 100g", como o resto da base de dados).
      const weight = effectiveWeight();
      if (weight > 0 && row.kcal > 0 && !findMatch(foods, row.label)) {
        onContributeFood({
          name: row.label,
          kcal_per_100: (row.kcal / weight) * 100,
          protein_per_100: (row.protein / weight) * 100,
          carbs_per_100: (row.carbs / weight) * 100,
          fat_per_100: (row.fat / weight) * 100,
        });
      }
      setExtraDraft({ label: "", kcal: "", protein: "", carbs: "", fat: "", weight_g: "", qty: "" });
      setMatchedExtraFood(null);
      setAddingExtra(false);
    }
  };

  const removeLogEntry = async (id) => {
    setLog(l => l.filter(e => e.id !== id));
    await supabase.from("consumption_log").delete().eq("id", id);
  };

  const autoId = getCurrentMealId(meals);
  const openMealId = pinnedId || autoId;
  const toggleMeal = (id) => { if (id !== openMealId) setPinnedId(id); };

  const dailyTotals = computeDailyMacros(meals);
  const consumedTotals = log.reduce((acc, e) => ({
    kcal: acc.kcal + Number(e.kcal || 0), protein: acc.protein + Number(e.protein || 0),
    carbs: acc.carbs + Number(e.carbs || 0), fat: acc.fat + Number(e.fat || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const extras = log.filter(e => !e.meal_id);

  return (
    <div>
      <div style={styles.phraseCard}>
        <p style={styles.phraseText}>"{getTodayPhrase()}"</p>
      </div>

      {log.length > 0 && (
        <div style={{ ...styles.dailyMacroCard, borderColor: "#4B6350" }}>
          <div style={styles.dailyMacroTitle}>Já comeste hoje</div>
          <div style={styles.dailyMacroRow}>
            <div style={styles.dailyMacroItem}><strong>{Math.round(consumedTotals.kcal)}</strong><span> kcal</span></div>
            <div style={styles.dailyMacroItem}><strong>{consumedTotals.protein.toFixed(1)}g</strong><span> proteína</span></div>
            <div style={styles.dailyMacroItem}><strong>{consumedTotals.carbs.toFixed(1)}g</strong><span> hidratos</span></div>
            <div style={styles.dailyMacroItem}><strong>{consumedTotals.fat.toFixed(1)}g</strong><span> gordura</span></div>
          </div>
          {targetKcal && (
            <p style={{ ...styles.macroIncomplete, color: "#4B6350", fontStyle: "normal", fontWeight: 600 }}>
              {Math.round(consumedTotals.kcal)} / {targetKcal} kcal
              {consumedTotals.kcal > targetKcal
                ? ` (já ultrapassaste em ${Math.round(consumedTotals.kcal - targetKcal)})`
                : ` (ainda podes comer ${Math.round(targetKcal - consumedTotals.kcal)})`}
            </p>
          )}
        </div>
      )}

      {dailyTotals && (
        <div style={styles.dailyMacroCard}>
          <div style={styles.dailyMacroTitle}>Total estimado do dia</div>
          <div style={styles.dailyMacroRow}>
            <div style={styles.dailyMacroItem}><strong>{dailyTotals.kcal}</strong><span> kcal</span></div>
            <div style={styles.dailyMacroItem}><strong>{dailyTotals.protein}g</strong><span> proteína</span></div>
            <div style={styles.dailyMacroItem}><strong>{dailyTotals.carbs}g</strong><span> hidratos</span></div>
            <div style={styles.dailyMacroItem}><strong>{dailyTotals.fat}g</strong><span> gordura</span></div>
          </div>
          {targetKcal && (
            <p style={{ ...styles.macroIncomplete, color: "#4B6350", fontStyle: "normal", fontWeight: 600 }}>
              {dailyTotals.kcal} / {targetKcal} kcal da meta diária
              {dailyTotals.kcal > targetKcal ? ` (+${dailyTotals.kcal - targetKcal})` : ` (faltam ${targetKcal - dailyTotals.kcal})`}
            </p>
          )}
          {dailyTotals.incomplete && (
            <p style={styles.macroIncomplete}>Sem dados nutricionais: {dailyTotals.missing.join(", ")}.</p>
          )}
          <p style={styles.macroIncomplete}>Baseado na 1ª opção de cada refeição.</p>
        </div>
      )}

      <div style={styles.timeline}>
        {meals.length === 0 && (
          <div style={{ padding: 18 }}>
            <p style={styles.emptyMeal}>Ainda não tens refeições. Vai a "Gerir plano" para adicionar a primeira.</p>
          </div>
        )}
        {meals.map((meal, idx) => {
          const selected = meal.options.find(o => o.id === meal.selected_option_id) || meal.options[0];
          const isOpen = openMealId === meal.id;
          const eatenEntry = log.find(e => e.meal_id === meal.id);
          return (
            <div key={meal.id} style={{ ...styles.timelineWrap, borderTop: idx === 0 ? "none" : "1px solid #DEDAC8" }}>
              <div style={styles.timelineHeadRow}>
                {meal.meal_time && (
                  <div style={styles.timeCol}>
                    <Clock size={12} color="#8A4B52" />
                    <span style={styles.timeText}>{meal.meal_time}</span>
                  </div>
                )}
                <button style={styles.mealHeadBtn} onClick={() => toggleMeal(meal.id)}>
                  <span style={styles.mealName}>{meal.name}</span>
                  <ChevronRight size={15} color="#6b7268" style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                </button>
              </div>
              {isOpen && (
                <div style={styles.mealBody}>
                  {selected && (
                    <button style={eatenEntry ? styles.eatenBtnActive : styles.eatenBtn}
                      onClick={() => eatenEntry ? unmarkEaten(meal.id) : markEaten(meal, selected)}>
                      <Check size={13} />
                      {eatenEntry
                        ? `Comido: "${meal.options.find(o => o.id === eatenEntry.option_id)?.name || eatenEntry.label}" — toca para desfazer`
                        : `Marcar "${selected.name}" como comido`}
                    </button>
                  )}
                  {meal.options.length > 1 && (
                    <div style={styles.optionChips}>
                      {meal.options.map(o => (
                        <button key={o.id} onClick={() => onSelectOption(meal.id, o.id)}
                          style={{ ...styles.chip, ...(o.id === (selected && selected.id) ? styles.chipActive : {}) }}>
                          {o.id === eatenEntry?.option_id && <Check size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />}
                          {o.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {selected && selected.photo_url && (
                    <img src={selected.photo_url} alt={selected.name} style={styles.optionPhotoHoje} />
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
          );
        })}
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsHead}>
          <span style={styles.planObsTitle}>Extras (fora do plano)</span>
          {!addingExtra && (
            <button style={styles.iconBtn} onClick={() => setAddingExtra(true)}><Plus size={15} /></button>
          )}
        </div>
        {extras.length === 0 && !addingExtra && (
          <p style={styles.emptyMeal}>Nada extra registado hoje.</p>
        )}
        {extras.map(e => (
          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
            <span style={{ fontSize: 13.5 }}>{e.label} <span style={{ color: "#6b7268", fontSize: 12 }}>({Math.round(e.kcal)} kcal)</span></span>
            <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => removeLogEntry(e.id)}><Trash2 size={13} /></button>
          </div>
        ))}
        {addingExtra && (
          <div style={{ marginTop: 8 }}>
            <input style={{ ...styles.obsInput, marginBottom: 6 }} placeholder="O que comeste? (ex.: Chocolate)"
              value={extraDraft.label} onChange={e => setExtraDraft(d => ({ ...d, label: e.target.value }))}
              onBlur={suggestExtra} />
            {matchedExtraFood?.grams_per_unit ? (
              <input style={{ ...styles.obsInput, marginBottom: 6 }} type="number" min="0" step="0.5"
                placeholder={`Quantas unidades? (1 = ${matchedExtraFood.grams_per_unit}g)`}
                value={extraDraft.qty} onChange={e => recomputeFromQty(e.target.value)} />
            ) : (
              <input style={{ ...styles.obsInput, marginBottom: 6 }} type="number" placeholder="Peso aproximado (g) — opcional, ajuda a sugerir e a contribuir para a base"
                value={extraDraft.weight_g} onChange={e => updateExtraWeight(e.target.value)} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 6, marginBottom: 8 }}>
              <input style={styles.nutritionInput} type="number" placeholder="kcal" value={extraDraft.kcal} onChange={e => setExtraDraft(d => ({ ...d, kcal: e.target.value }))} />
              <input style={styles.nutritionInput} type="number" step="0.1" placeholder="Proteína (g)" value={extraDraft.protein} onChange={e => setExtraDraft(d => ({ ...d, protein: e.target.value }))} />
              <input style={styles.nutritionInput} type="number" step="0.1" placeholder="Hidratos (g)" value={extraDraft.carbs} onChange={e => setExtraDraft(d => ({ ...d, carbs: e.target.value }))} />
              <input style={styles.nutritionInput} type="number" step="0.1" placeholder="Gordura (g)" value={extraDraft.fat} onChange={e => setExtraDraft(d => ({ ...d, fat: e.target.value }))} />
            </div>
            {matchedExtraFood && (
              <p style={{ ...styles.emptyMeal, marginBottom: 8 }}>Valores sugeridos a partir de "{matchedExtraFood.name}" na base de alimentos.</p>
            )}
            <div style={styles.rowGap}>
              <button style={styles.smallBtnPrimary} onClick={addExtra}><Check size={13} /> Adicionar</button>
              <button style={styles.smallBtn} onClick={() => { setAddingExtra(false); setMatchedExtraFood(null); }}><X size={13} /> Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Observações do plano</div>
        <p style={styles.planObsText}>{plan.observations || "Sem observações."}</p>
      </div>
    </div>
  );
}

function ManageView(props) {
  const { plan, meals, locked, onToggleLock, foods, onPropagateNutrition, onContributeFood, expandedMeal, setExpandedMeal, expandedOption, setExpandedOption,
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
        <MealEditor key={meal.id} meal={meal} isFirst={idx === 0} isLast={idx === meals.length - 1} foods={foods} onPropagateNutrition={onPropagateNutrition} onContributeFood={onContributeFood}
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

function MealEditor({ meal, isFirst, isLast, expanded, onToggle, expandedOption, setExpandedOption, foods, onPropagateNutrition, onContributeFood,
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
            <OptionEditor key={opt.id} option={opt} foods={foods} onPropagateNutrition={onPropagateNutrition} onContributeFood={onContributeFood}
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

function applySuggestionIfEmpty(ing, onUpdateIngredient, foods) {
  if (ing.kcal_per_100 != null) return; // já tem valores — não sobrepor
  const match = findMatch(foods, ing.name);
  if (!match) return;
  onUpdateIngredient(ing.id, {
    kcal_per_100: match.kcal, protein_per_100: match.protein,
    carbs_per_100: match.carbs, fat_per_100: match.fat,
    ...(ing.unit === "unidade" && match.grams_per_unit ? { grams_per_unit: match.grams_per_unit } : {}),
  });
}

function PhotoUploader({ option, onUpdateOption }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true); setError(null);
    const ext = file.name.split(".").pop();
    const path = `${option.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("option-photos").upload(path, file, { upsert: true });
    if (upErr) { setError("Não foi possível enviar a foto."); setUploading(false); return; }
    const { data } = supabase.storage.from("option-photos").getPublicUrl(path);
    onUpdateOption({ photo_url: data.publicUrl });
    setUploading(false);
  };

  return (
    <div style={{ marginBottom: 8 }}>
      {option.photo_url ? (
        <div style={{ position: "relative", marginBottom: 6 }}>
          <img src={option.photo_url} alt={option.name} style={styles.optionPhoto} />
          <button style={styles.removePhotoBtn} onClick={() => onUpdateOption({ photo_url: null })}>
            <Trash2 size={12} /> Remover foto
          </button>
        </div>
      ) : (
        <label style={styles.photoUploadBtn}>
          <Camera size={13} /> {uploading ? "A enviar…" : "Adicionar foto"}
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => upload(e.target.files[0])} disabled={uploading} />
        </label>
      )}
      {error && <p style={styles.errorText}>{error}</p>}
    </div>
  );
}

function OptionEditor({ option, expanded, onToggle, onUpdateOption, onDeleteOption, foods, onPropagateNutrition, onContributeFood,
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
          <PhotoUploader option={option} onUpdateOption={onUpdateOption} />
          {option.ingredients.map(ing => (
            <div key={ing.id}>
              <div style={styles.ingRow}>
                <input style={styles.ingNameInput} placeholder="Ingrediente" value={ing.name}
                  onChange={e => onUpdateIngredient(ing.id, { name: e.target.value })}
                  onBlur={() => applySuggestionIfEmpty(ing, onUpdateIngredient, foods)} />
                <input style={styles.ingQtyInput} placeholder="Qtd" value={ing.qty} onChange={e => onUpdateIngredient(ing.id, { qty: e.target.value })} />
                <select style={styles.ingUnitInput} value={ing.unit || "g"} onChange={e => onUpdateIngredient(ing.id, { unit: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <button style={styles.iconBtn}
                  onClick={() => {
                    applySuggestionIfEmpty(ing, onUpdateIngredient, foods);
                    setNutritionOpenId(nutritionOpenId === ing.id ? null : ing.id);
                  }}
                  title="Valores nutricionais">
                  <Flame size={13} color={ing.kcal_per_100 != null ? "#C98A3D" : (findMatch(foods, ing.name) ? "#E8CFA0" : "#a3a08f")} />
                </button>
                <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => onDeleteIngredient(ing.id)}><Trash2 size={12} /></button>
              </div>
              {nutritionOpenId === ing.id && (
                <div style={styles.nutritionBox}>
                  <p style={{ ...styles.emptyMeal, marginBottom: 6 }}>
                    Valores por 100 g/ml{ing.kcal_per_100 != null && findMatch(foods, ing.name) ? " (sugestão já aplicada — ajusta se quiseres)" : ""}:
                  </p>
                  <div style={styles.nutritionGrid}>
                    <label style={styles.nutritionField}>
                      kcal
                      <input style={styles.nutritionInput} type="number" min="0" value={ing.kcal_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { kcal_per_100: e.target.value === "" ? null : Number(e.target.value) })}
                        onBlur={() => { onPropagateNutrition({ ...ing }); if (!findMatch(foods, ing.name)) onContributeFood(ing); }} />
                    </label>
                    <label style={styles.nutritionField}>
                      Proteína (g)
                      <input style={styles.nutritionInput} type="number" min="0" step="0.1" value={ing.protein_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { protein_per_100: e.target.value === "" ? null : Number(e.target.value) })}
                        onBlur={() => { onPropagateNutrition({ ...ing }); if (!findMatch(foods, ing.name)) onContributeFood(ing); }} />
                    </label>
                    <label style={styles.nutritionField}>
                      Hidratos (g)
                      <input style={styles.nutritionInput} type="number" min="0" step="0.1" value={ing.carbs_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { carbs_per_100: e.target.value === "" ? null : Number(e.target.value) })}
                        onBlur={() => { onPropagateNutrition({ ...ing }); if (!findMatch(foods, ing.name)) onContributeFood(ing); }} />
                    </label>
                    <label style={styles.nutritionField}>
                      Gordura (g)
                      <input style={styles.nutritionInput} type="number" min="0" step="0.1" value={ing.fat_per_100 ?? ""}
                        onChange={e => onUpdateIngredient(ing.id, { fat_per_100: e.target.value === "" ? null : Number(e.target.value) })}
                        onBlur={() => { onPropagateNutrition({ ...ing }); if (!findMatch(foods, ing.name)) onContributeFood(ing); }} />
                    </label>
                    {ing.unit === "unidade" && (
                      <label style={styles.nutritionField}>
                        Peso aprox. por unidade (g)
                        <input style={styles.nutritionInput} type="number" min="0" value={ing.grams_per_unit ?? ""}
                          onChange={e => onUpdateIngredient(ing.id, { grams_per_unit: e.target.value === "" ? null : Number(e.target.value) })}
                          onBlur={() => { onPropagateNutrition({ ...ing }); if (!findMatch(foods, ing.name)) onContributeFood(ing); }} />
                      </label>
                    )}
                  </div>
                  {ing.kcal_per_100 != null && !findMatch(foods, ing.name) && (
                    <button style={styles.contributeBtn} onClick={() => onContributeFood(ing)}>
                      <Plus size={12} /> Adicionar "{ing.name}" à base de alimentos partilhada
                    </button>
                  )}
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

import { useState } from "react";
import { MoreVertical, Droplet, MessageSquarePlus, X, Info, Share2, Settings2, UserCircle, LayoutGrid, Users, ShieldCheck, ChevronRight, ArrowLeft, Folder, Download, TrendingUp, Dumbbell } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";
import { saveWaterSettings } from "./useWaterReminder";
import { MENU_ITEMS, DEFAULT_MENU_STRUCTURE } from "./menuItems";

const ICONS = { gerir: Settings2, partilhar: Share2, agua: Droplet, sugestoes: MessageSquarePlus, dados: UserCircle, modulos: LayoutGrid, tutores: Users };
const PANEL_ITEMS = { agua: "water", sugestoes: "feedback" };

export default function MoreMenu({ userId, waterSettings, onWaterSettingsChange, onNavigate, isAdmin, menuStructure, menuVisibleKeys, installPrompt, onInstall, metricsEnabled, trainingEnabled }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(null); // null | "water" | "feedback" | { submenu: node }

  const go = (tabId) => { onNavigate(tabId); setOpen(false); setPanel(null); };

  const isVisible = (key) => isAdmin || !menuVisibleKeys || menuVisibleKeys.has(key);

  const structure = menuStructure && menuStructure.length ? menuStructure : DEFAULT_MENU_STRUCTURE;

  const renderItemButton = (key) => {
    const item = MENU_ITEMS.find(i => i.key === key);
    if (!item) return null;
    const Icon = ICONS[key];
    const panelName = PANEL_ITEMS[key];
    return (
      <button key={key} style={menuStyles.item} onClick={() => panelName ? setPanel(panelName) : go(key)}>
        <Icon size={15} /> {item.label}
      </button>
    );
  };

  const rootNodes = structure.filter(node => {
    if (node.type === "item") return isVisible(node.key);
    if (node.type === "submenu") return (node.items || []).some(isVisible);
    return false;
  });

  const isSubmenuPanel = panel && typeof panel === "object" && panel.submenu;

  return (
    <>
      <button style={styles.logoutBtn} onClick={() => { setOpen(true); setPanel(null); }} title="Mais opções">
        <MoreVertical size={13} style={{ verticalAlign: "-2px" }} />
      </button>

      {open && !panel && (
        <div style={menuStyles.overlay} onClick={() => setOpen(false)}>
          <div style={menuStyles.panel} onClick={e => e.stopPropagation()}>
            <div style={menuStyles.panelHead}>
              <span style={styles.planObsTitle}>Mais opções</span>
              <button style={styles.iconBtn} onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            {installPrompt && (
              <button style={menuStyles.item} onClick={() => { onInstall(); setOpen(false); }}>
                <Download size={15} /> Instalar app
              </button>
            )}
            {rootNodes.map(node => node.type === "item" ? renderItemButton(node.key) : (
              <button key={node.id || node.label} style={menuStyles.item} onClick={() => setPanel({ submenu: node })}>
                <Folder size={15} /> {node.label}
                <ChevronRight size={15} style={{ marginLeft: "auto" }} />
              </button>
            ))}
            {metricsEnabled && (
              <button style={menuStyles.item} onClick={() => go("metricas")}>
                <TrendingUp size={15} /> Métricas
              </button>
            )}
            {trainingEnabled && (
              <button style={menuStyles.item} onClick={() => go("treino")}>
                <Dumbbell size={15} /> Treino
              </button>
            )}
            {isAdmin && (
              <button style={menuStyles.item} onClick={() => go("admin")}>
                <ShieldCheck size={15} /> Administração
              </button>
            )}
            <button style={menuStyles.item} onClick={() => go("sobre")}>
              <Info size={15} /> Sobre a app
            </button>
          </div>
        </div>
      )}

      {open && isSubmenuPanel && (
        <div style={menuStyles.overlay} onClick={() => setOpen(false)}>
          <div style={menuStyles.panel} onClick={e => e.stopPropagation()}>
            <div style={menuStyles.panelHead}>
              <button style={styles.iconBtn} onClick={() => setPanel(null)}><ArrowLeft size={16} /></button>
              <span style={styles.planObsTitle}>{panel.submenu.label}</span>
              <button style={styles.iconBtn} onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            {(panel.submenu.items || []).filter(isVisible).map(key => renderItemButton(key))}
          </div>
        </div>
      )}

      {panel === "water" && (
        <WaterPanel
          userId={userId}
          initial={waterSettings}
          onClose={() => { setPanel(null); setOpen(false); }}
          onSaved={onWaterSettingsChange}
        />
      )}
      {panel === "feedback" && (
        <FeedbackPanel userId={userId} onClose={() => { setPanel(null); setOpen(false); }} />
      )}
    </>
  );
}

function WaterPanel({ userId, initial, onClose, onSaved }) {
  const [amount, setAmount] = useState(initial.amount_ml);
  const [frequency, setFrequency] = useState(initial.frequency_minutes);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const settings = { user_id: userId, amount_ml: Number(amount), frequency_minutes: Number(frequency), enabled };
    const { data, error } = await saveWaterSettings(settings);
    if (!error) onSaved(data);
    setSaving(false);
    onClose();
  };

  return (
    <div style={menuStyles.overlay} onClick={onClose}>
      <div style={menuStyles.panel} onClick={e => e.stopPropagation()}>
        <div style={menuStyles.panelHead}>
          <span style={styles.planObsTitle}>Lembrete de água</span>
          <button style={styles.iconBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Quantidade por lembrete (ml)</label>
          <input style={styles.input} type="number" min="50" step="50" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div style={styles.field}>
          <label style={styles.label}>Repetir a cada (minutos)</label>
          <input style={styles.input} type="number" min="10" step="10" value={frequency} onChange={e => setFrequency(e.target.value)} />
        </div>
        <label style={{ ...styles.rowGap, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          Ativar lembrete
        </label>
        <p style={{ ...styles.emptyMeal, marginTop: 8 }}>
          Só funciona com a app aberta e visível no ecrã — não dispara com o telemóvel bloqueado ou a app em segundo plano/fechada.
        </p>
        <button style={{ ...styles.primaryBtn, marginTop: 10 }} onClick={save} disabled={saving}>
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function FeedbackPanel({ userId, onClose }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("feedback").insert({ user_id: userId, message: message.trim() });
    setSaving(false);
    if (!error) setDone(true);
  };

  return (
    <div style={menuStyles.overlay} onClick={onClose}>
      <div style={menuStyles.panel} onClick={e => e.stopPropagation()}>
        <div style={menuStyles.panelHead}>
          <span style={styles.planObsTitle}>Sugerir melhorias</span>
          <button style={styles.iconBtn} onClick={onClose}><X size={16} /></button>
        </div>
        {done ? (
          <p style={styles.messageText}>Obrigado! A sugestão foi guardada.</p>
        ) : (
          <>
            <textarea style={styles.textarea} rows={4} placeholder="O que gostavas de ver na app?"
              value={message} onChange={e => setMessage(e.target.value)} />
            <button style={{ ...styles.primaryBtn, marginTop: 10 }} onClick={submit} disabled={saving || !message.trim()}>
              {saving ? "A enviar…" : "Enviar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const menuStyles = {
  item: { display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: "transparent", padding: "12px 4px", fontSize: 14, fontWeight: 600, color: "#26312B", cursor: "pointer", textAlign: "left", borderTop: "1px solid #F0EEE3" },
  overlay: { position: "fixed", inset: 0, background: "rgba(38,49,43,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 30, padding: 20 },
  panel: { background: "#fff", borderRadius: 12, padding: 20, width: "100%", maxWidth: 340 },
  panelHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 8 },
};

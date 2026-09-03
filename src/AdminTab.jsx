import { useState, useEffect } from "react";
import { ShieldCheck, Shield, ChevronUp, ChevronDown, Check, Plus, Trash2, Folder } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";
import { MENU_ITEMS, DEFAULT_MENU_STRUCTURE, GROUPS, unplacedItems } from "./menuItems";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function AdminTab({ userId }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saved, setSaved] = useState(false);
  const [newSubmenuName, setNewSubmenuName] = useState("");

  useEffect(() => { loadUsers(); loadSettings(); }, []);

  async function loadUsers() {
    setLoadingUsers(true);
    const { data } = await supabase.from("profiles").select("id, name, email, role").order("name");
    setUsers(data || []);
    setLoadingUsers(false);
  }

  async function loadSettings() {
    setLoadingSettings(true);
    const { data } = await supabase.from("app_settings").select("*").eq("id", true).maybeSingle();
    setSettings(data || { menu_structure: DEFAULT_MENU_STRUCTURE, menu_visibility: {}, changelog_limit: 5 });
    setLoadingSettings(false);
  }

  const toggleRole = async (u) => {
    const nextRole = u.role === "admin" ? "user" : "admin";
    setUsers(list => list.map(x => x.id === u.id ? { ...x, role: nextRole } : x));
    await supabase.from("profiles").update({ role: nextRole }).eq("id", u.id);
    loadUsers();
  };

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };

  const saveSettings = async (fields) => {
    const next = { ...settings, ...fields };
    setSettings(next);
    const { error } = await supabase.from("app_settings").update(fields).eq("id", true);
    if (!error) flashSaved();
  };

  const structure = settings?.menu_structure && settings.menu_structure.length ? settings.menu_structure : DEFAULT_MENU_STRUCTURE;

  const moveNode = (index, dir) => {
    const next = [...structure];
    const swapIdx = dir === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    saveSettings({ menu_structure: next });
  };

  const addSubmenu = () => {
    const name = newSubmenuName.trim();
    if (!name) return;
    const next = [...structure, { type: "submenu", id: uid(), label: name, items: [] }];
    saveSettings({ menu_structure: next });
    setNewSubmenuName("");
  };

  const deleteSubmenu = (nodeId) => {
    const node = structure.find(n => n.id === nodeId);
    const returned = (node?.items || []).map(key => ({ type: "item", key }));
    const next = structure.filter(n => n.id !== nodeId).concat(returned);
    saveSettings({ menu_structure: next });
  };

  const renameSubmenu = (nodeId, label) => {
    const next = structure.map(n => n.id === nodeId ? { ...n, label } : n);
    saveSettings({ menu_structure: next });
  };

  // Move um item para dentro de um submenu (tirando-o de onde estava) ou de
  // volta para o topo (targetId null).
  const placeItem = (itemKey, targetId) => {
    let next = structure
      .map(n => n.type === "submenu" ? { ...n, items: (n.items || []).filter(k => k !== itemKey) } : n)
      .filter(n => n.type !== "item" || n.key !== itemKey);

    if (targetId === null) {
      next = [...next, { type: "item", key: itemKey }];
    } else {
      next = next.map(n => n.id === targetId ? { ...n, items: [...(n.items || []), itemKey] } : n);
    }
    saveSettings({ menu_structure: next });
  };

  const toggleVisibility = (itemKey, groupKey) => {
    const vis = { ...(settings.menu_visibility || {}) };
    const current = new Set(vis[itemKey] || []);
    if (current.has(groupKey)) current.delete(groupKey); else current.add(groupKey);
    vis[itemKey] = Array.from(current);
    saveSettings({ menu_visibility: vis });
  };

  if (loadingUsers || loadingSettings || !settings) return <p style={styles.emptyMeal}>A carregar…</p>;

  const submenus = structure.filter(n => n.type === "submenu");

  return (
    <div>
      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Utilizadores</div>
        {users.map(u => (
          <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #F0EEE3" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{u.name}</div>
              <div style={{ fontSize: 12, color: "#6b7268" }}>{u.email}</div>
            </div>
            <button
              style={u.role === "admin" ? styles.smallBtnPrimary : styles.smallBtn}
              onClick={() => toggleRole(u)}
              disabled={u.id === userId}
              title={u.id === userId ? "Não podes alterar o teu próprio papel" : ""}
            >
              {u.role === "admin" ? <ShieldCheck size={13} /> : <Shield size={13} />}
              {u.role === "admin" ? "Admin" : "Tornar admin"}
            </button>
          </div>
        ))}
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Ordem e grupos do menu</div>
        <p style={{ ...styles.emptyMeal, marginBottom: 8 }}>
          "Sobre a app" fica sempre por último; "Administração" só aparece para administradores.
          Podes agrupar itens dentro de submenus, e reordenar tudo com as setas.
        </p>

        {structure.map((node, idx) => (
          <div key={node.id || node.key} style={{ border: "1px solid #E4E1D2", borderRadius: 8, marginBottom: 8, background: "#FBFAF5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {node.type === "submenu" ? <Folder size={14} /> : null}
                {node.type === "submenu" ? node.label : MENU_ITEMS.find(i => i.key === node.key)?.label}
              </span>
              <div style={styles.rowGap}>
                <button style={styles.iconBtn} disabled={idx === 0} onClick={() => moveNode(idx, "up")}><ChevronUp size={14} /></button>
                <button style={styles.iconBtn} disabled={idx === structure.length - 1} onClick={() => moveNode(idx, "down")}><ChevronDown size={14} /></button>
                {node.type === "submenu" && (
                  <button style={{ ...styles.iconBtn, color: "#8A4B52" }} onClick={() => deleteSubmenu(node.id)}><Trash2 size={14} /></button>
                )}
              </div>
            </div>

            {node.type === "submenu" && (
              <div style={{ padding: "0 10px 10px" }}>
                <input style={{ ...styles.obsInput, marginBottom: 8 }} value={node.label}
                  onChange={e => renameSubmenu(node.id, e.target.value)} placeholder="Nome do submenu" />
                {(node.items || []).length === 0 && <p style={styles.emptyMeal}>Sem itens ainda — adiciona abaixo.</p>}
                {(node.items || []).map(key => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                    <span style={{ fontSize: 12.5 }}>{MENU_ITEMS.find(i => i.key === key)?.label}</span>
                    <button style={styles.smallBtn} onClick={() => placeItem(key, null)}>Tirar do submenu</button>
                  </div>
                ))}
                {unplacedItems(structure).length > 0 && (
                  <select style={{ ...styles.input, marginTop: 6 }} value=""
                    onChange={e => e.target.value && placeItem(e.target.value, node.id)}>
                    <option value="">+ Adicionar item a este submenu…</option>
                    {unplacedItems(structure).map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>
        ))}

        <div style={{ ...styles.rowGap, marginTop: 6 }}>
          <input style={styles.input} placeholder="Nome do novo submenu (ex.: Definições)"
            value={newSubmenuName} onChange={e => setNewSubmenuName(e.target.value)} />
          <button style={styles.smallBtnPrimary} onClick={addSubmenu} disabled={!newSubmenuName.trim()}>
            <Plus size={13} /> Criar
          </button>
        </div>
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>O que cada grupo pode ver no menu</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 4px" }}></th>
                {GROUPS.map(g => <th key={g.key} style={{ textAlign: "center", padding: "6px 4px", fontWeight: 700 }}>{g.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {MENU_ITEMS.map(item => (
                <tr key={item.key} style={{ borderTop: "1px solid #F0EEE3" }}>
                  <td style={{ padding: "8px 4px", fontWeight: 600 }}>{item.label}</td>
                  {GROUPS.map(g => {
                    const checked = (settings.menu_visibility?.[item.key] || []).includes(g.key);
                    return (
                      <td key={g.key} style={{ textAlign: "center", padding: "8px 4px" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleVisibility(item.key, g.key)} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ ...styles.emptyMeal, marginTop: 8 }}>
          Administradores veem sempre tudo, independentemente destas marcações. Um submenu só aparece se tiver, pelo menos, um item visível para essa pessoa.
        </p>
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Histórico de versões visível</div>
        <div style={styles.field}>
          <label style={styles.label}>Número de alterações mostradas em "Sobre a app"</label>
          <input style={styles.input} type="number" min="1" max="50"
            value={settings.changelog_limit}
            onChange={e => saveSettings({ changelog_limit: Number(e.target.value) })} />
        </div>
        {saved && <p style={styles.messageText}><Check size={13} style={{ verticalAlign: "-2px" }} /> Guardado</p>}
      </div>
    </div>
  );
}

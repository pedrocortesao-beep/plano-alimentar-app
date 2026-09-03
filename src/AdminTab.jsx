import { useState, useEffect } from "react";
import { ShieldCheck, Shield } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

export default function AdminTab({ userId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("id, name, email, role").order("name");
    setUsers(data || []);
    setLoading(false);
  }

  const toggleRole = async (u) => {
    const nextRole = u.role === "admin" ? "user" : "admin";
    setUsers(list => list.map(x => x.id === u.id ? { ...x, role: nextRole } : x));
    await supabase.from("profiles").update({ role: nextRole }).eq("id", u.id);
    load();
  };

  if (loading) return <p style={styles.emptyMeal}>A carregar…</p>;

  return (
    <div style={styles.planObsBox}>
      <div style={styles.planObsTitle}>Administração — todos os utilizadores</div>
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
  );
}

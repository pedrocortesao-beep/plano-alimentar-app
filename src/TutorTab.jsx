import { useState, useEffect } from "react";
import { UserPlus, Check, X as XIcon, Users } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

export default function TutorTab({ userId }) {
  const [relationships, setRelationships] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [asTutor, setAsTutor] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteMessage, setInviteMessage] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("tutor_relationships")
      .select("*")
      .or(`tutor_id.eq.${userId},user_id.eq.${userId}`);

    const rows = data || [];
    setRelationships(rows);

    const otherIds = Array.from(new Set(rows.flatMap(r => [r.tutor_id, r.user_id]))).filter(id => id !== userId);
    if (otherIds.length) {
      const { data: people } = await supabase.from("profiles").select("id, name, email").in("id", otherIds);
      const map = {};
      (people || []).forEach(p => { map[p.id] = p; });
      setProfilesById(map);
    }
    setLoading(false);
  }

  const invite = async (e) => {
    e.preventDefault();
    setSending(true); setInviteError(null); setInviteMessage(null);
    const { error } = await supabase.rpc("invite_relationship", { target_email: email.trim(), invite_as_tutor: asTutor });
    if (error) setInviteError(error.message);
    else { setInviteMessage("Convite enviado."); setEmail(""); load(); }
    setSending(false);
  };

  const respond = async (id, status) => {
    await supabase.rpc("respond_relationship", { relationship_id: id, new_status: status });
    load();
  };

  const remove = async (id) => {
    await supabase.from("tutor_relationships").delete().eq("id", id);
    load();
  };

  if (loading) return <p style={styles.emptyMeal}>A carregar…</p>;

  const pendingIncoming = relationships.filter(r => r.status === "pending" && r.requested_by !== userId);
  const pendingOutgoing = relationships.filter(r => r.status === "pending" && r.requested_by === userId);
  const myTutors = relationships.filter(r => r.status === "accepted" && r.user_id === userId);
  const myTutees = relationships.filter(r => r.status === "accepted" && r.tutor_id === userId);

  return (
    <div>
      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}><Users size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Convidar</div>
        <form onSubmit={invite}>
          <div style={styles.field}>
            <label style={styles.label}>Email da pessoa</label>
            <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <label style={{ ...styles.rowGap, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
            <input type="checkbox" checked={asTutor} onChange={e => setAsTutor(e.target.checked)} />
            Convidar esta pessoa para ser meu tutor (em vez de eu ser tutor dela)
          </label>
          {inviteError && <p style={styles.errorText}>{inviteError}</p>}
          {inviteMessage && <p style={styles.messageText}>{inviteMessage}</p>}
          <button style={styles.smallBtnPrimary} disabled={sending}>
            <UserPlus size={13} /> {sending ? "A enviar…" : "Enviar convite"}
          </button>
        </form>
      </div>

      {pendingIncoming.length > 0 && (
        <RelList title="Pedidos pendentes para ti" items={pendingIncoming} profilesById={profilesById} userId={userId}
          renderActions={(r) => (
            <div style={styles.rowGap}>
              <button style={styles.smallBtnPrimary} onClick={() => respond(r.id, "accepted")}><Check size={13} /> Aceitar</button>
              <button style={styles.smallBtn} onClick={() => respond(r.id, "declined")}><XIcon size={13} /> Recusar</button>
            </div>
          )} />
      )}

      {pendingOutgoing.length > 0 && (
        <RelList title="Convites enviados, a aguardar resposta" items={pendingOutgoing} profilesById={profilesById} userId={userId}
          renderActions={(r) => (
            <button style={styles.smallBtn} onClick={() => remove(r.id)}><XIcon size={13} /> Cancelar</button>
          )} />
      )}

      {myTutees.length > 0 && (
        <RelList title="Quem orientas" items={myTutees} profilesById={profilesById} userId={userId}
          renderActions={(r) => (
            <button style={styles.smallBtn} onClick={() => remove(r.id)}><XIcon size={13} /> Terminar</button>
          )} />
      )}

      {myTutors.length > 0 && (
        <RelList title="Os teus tutores" items={myTutors} profilesById={profilesById} userId={userId}
          renderActions={(r) => (
            <button style={styles.smallBtn} onClick={() => remove(r.id)}><XIcon size={13} /> Terminar</button>
          )} />
      )}

      <p style={{ ...styles.emptyMeal, marginTop: 4 }}>
        Para gerires o plano de quem orientas, usa o seletor "A gerir" no topo da app.
      </p>
    </div>
  );
}

function RelList({ title, items, profilesById, userId, renderActions }) {
  return (
    <div style={styles.planObsBox}>
      <div style={styles.planObsTitle}>{title}</div>
      {items.map(r => {
        const otherId = r.tutor_id === userId ? r.user_id : r.tutor_id;
        const other = profilesById[otherId];
        return (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #F0EEE3" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{other?.name || "…"}</div>
              <div style={{ fontSize: 12, color: "#6b7268" }}>{other?.email}</div>
            </div>
            {renderActions(r)}
          </div>
        );
      })}
    </div>
  );
}

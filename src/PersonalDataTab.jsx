import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "./supabaseClient";
import { styles } from "./styles";

const SEX_OPTIONS = [
  { value: "", label: "Prefiro não dizer" },
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "outro", label: "Outro" },
];

export default function PersonalDataTab({ userId, profile, onSaved }) {
  const [name, setName] = useState(profile.name || "");
  const [birthDate, setBirthDate] = useState(profile.birth_date || "");
  const [sex, setSex] = useState(profile.sex || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState(null);
  const [pwError, setPwError] = useState(null);

  const saveProfile = async () => {
    setSaving(true); setSaved(false);
    const fields = { name: name.trim(), birth_date: birthDate || null, sex: sex || null };
    const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
    if (!error) { onSaved(fields); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { setPwError("A palavra-passe precisa de pelo menos 6 caracteres."); return; }
    setPwSaving(true); setPwError(null); setPwMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setPwError(error.message);
    else { setPwMessage("Palavra-passe alterada."); setNewPassword(""); }
    setPwSaving(false);
  };

  return (
    <div>
      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Dados pessoais</div>

        <div style={styles.field}>
          <label style={styles.label}>Nome</label>
          <input style={styles.input} value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Data de nascimento</label>
          <input style={styles.input} type="date" value={birthDate || ""} onChange={e => setBirthDate(e.target.value)} />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Sexo</label>
          <select style={styles.input} value={sex} onChange={e => setSex(e.target.value)}>
            {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <button style={styles.smallBtnPrimary} onClick={saveProfile} disabled={saving}>
          {saved ? <Check size={13} /> : null} {saving ? "A guardar…" : saved ? "Guardado" : "Guardar"}
        </button>
      </div>

      <div style={styles.planObsBox}>
        <div style={styles.planObsTitle}>Alterar palavra-passe</div>
        <div style={styles.field}>
          <label style={styles.label}>Palavra-passe nova</label>
          <input style={styles.input} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} />
        </div>
        {pwError && <p style={styles.errorText}>{pwError}</p>}
        {pwMessage && <p style={styles.messageText}>{pwMessage}</p>}
        <button style={styles.smallBtnPrimary} onClick={changePassword} disabled={pwSaving || !newPassword}>
          {pwSaving ? "A alterar…" : "Alterar palavra-passe"}
        </button>
      </div>
    </div>
  );
}

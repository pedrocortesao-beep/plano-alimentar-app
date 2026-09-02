import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { styles, fontImport } from "./styles";

export default function AuthScreens({ installPrompt, onInstall }) {
  const [mode, setMode] = useState("login"); // login | register | forgot | recovery
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const reset = () => { setError(null); setMessage(null); };

  const handleLogin = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(traduzErro(error.message));
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    });
    if (error) setError(traduzErro(error.message));
    else setMessage("Conta criada. Verifica o teu email para confirmar antes de entrares.");
    setLoading(false);
  };

  const handleForgot = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(traduzErro(error.message));
    else setMessage("Enviámos um link de recuperação para o teu email.");
    setLoading(false);
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(traduzErro(error.message));
    else { setMessage("Palavra-passe alterada. Já podes continuar."); setMode("login"); }
    setLoading(false);
  };

  return (
    <div style={styles.authPage}>
      <style>{`${fontImport} * { box-sizing: border-box; } ::placeholder { color: #a3a08f; }`}</style>
      <div style={styles.authCard}>
        <div style={styles.authEyebrow}>Plano Alimentar</div>
        {installPrompt && (
          <button style={{ ...styles.primaryBtn, marginTop: -6, marginBottom: 16, background: "#C98A3D" }} onClick={onInstall}>
            Instalar app no telemóvel
          </button>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <h1 style={styles.authTitle}>Entrar</h1>
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field label="Palavra-passe" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
            {error && <p style={styles.errorText}>{error}</p>}
            <button style={styles.primaryBtn} disabled={loading}>{loading ? "A entrar…" : "Entrar"}</button>
            <div style={styles.authFooter}>
              <button type="button" style={styles.linkBtn} onClick={() => { reset(); setMode("register"); }}>Criar conta</button>
              <button type="button" style={styles.linkBtn} onClick={() => { reset(); setMode("forgot"); }}>Esqueci-me da palavra-passe</button>
            </div>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister}>
            <h1 style={styles.authTitle}>Criar conta</h1>
            <Field label="O teu nome" type="text" value={name} onChange={setName} autoComplete="name" required />
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field label="Palavra-passe" type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={6} />
            {error && <p style={styles.errorText}>{error}</p>}
            {message && <p style={styles.messageText}>{message}</p>}
            <button style={styles.primaryBtn} disabled={loading}>{loading ? "A criar…" : "Criar conta"}</button>
            <div style={styles.authFooter}>
              <button type="button" style={styles.linkBtn} onClick={() => { reset(); setMode("login"); }}>Já tenho conta</button>
            </div>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <h1 style={styles.authTitle}>Recuperar palavra-passe</h1>
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            {error && <p style={styles.errorText}>{error}</p>}
            {message && <p style={styles.messageText}>{message}</p>}
            <button style={styles.primaryBtn} disabled={loading}>{loading ? "A enviar…" : "Enviar link"}</button>
            <div style={styles.authFooter}>
              <button type="button" style={styles.linkBtn} onClick={() => { reset(); setMode("login"); }}>Voltar a entrar</button>
            </div>
          </form>
        )}

        {mode === "recovery" && (
          <form onSubmit={handleSetNewPassword}>
            <h1 style={styles.authTitle}>Nova palavra-passe</h1>
            <Field label="Palavra-passe nova" type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={6} />
            {error && <p style={styles.errorText}>{error}</p>}
            <button style={styles.primaryBtn} disabled={loading}>{loading ? "A guardar…" : "Guardar palavra-passe"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, ...rest }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <input style={styles.input} type={type} value={value} onChange={e => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function traduzErro(msg) {
  if (/invalid login credentials/i.test(msg)) return "Email ou palavra-passe incorretos.";
  if (/already registered/i.test(msg)) return "Já existe uma conta com este email.";
  if (/password should be at least/i.test(msg)) return "A palavra-passe precisa de pelo menos 6 caracteres.";
  return msg;
}

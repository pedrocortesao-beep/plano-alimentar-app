import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import AuthScreens from "./AuthScreens";
import PlanApp from "./PlanApp";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = a carregar
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Pode já ter sido apanhado antes da app arrancar (ver index.html).
    if (window.__installPromptEvent) setInstallPrompt(window.__installPromptEvent);

    const onReady = () => setInstallPrompt(window.__installPromptEvent);
    window.addEventListener("installpromptready", onReady);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      window.__installPromptEvent = e;
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("installpromptready", onReady);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    window.__installPromptEvent = null;
    setInstallPrompt(null);
  };

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#6b7268", background: "#EEF0E6" }}>
        A carregar…
      </div>
    );
  }

  return session
    ? <PlanApp session={session} installPrompt={installPrompt} onInstall={handleInstall} />
    : <AuthScreens installPrompt={installPrompt} onInstall={handleInstall} />;
}

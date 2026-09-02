import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import AuthScreens from "./AuthScreens";
import PlanApp from "./PlanApp";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = a carregar

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#6b7268", background: "#EEF0E6" }}>
        A carregar…
      </div>
    );
  }

  return session ? <PlanApp session={session} /> : <AuthScreens />;
}

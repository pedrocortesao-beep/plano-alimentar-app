import { useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

// Corre o lembrete de água enquanto a app estiver aberta. Não é uma
// notificação em segundo plano (isso exigiria um servidor de push) —
// funciona enquanto tens a app aberta num separador.
export function useWaterReminder(settings) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!settings || !settings.enabled) return;

    const fire = () => {
      const text = `Hora de beber água — ${settings.amount_ml} ml`;
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Plano Alimentar", { body: text, icon: "/icon-192.png" });
      } else {
        alert(text);
      }
    };

    timerRef.current = setInterval(fire, settings.frequency_minutes * 60 * 1000);
    return () => clearInterval(timerRef.current);
  }, [settings]);
}

export async function loadWaterSettings(userId) {
  const { data } = await supabase.from("water_settings").select("*").eq("user_id", userId).maybeSingle();
  return data || { user_id: userId, amount_ml: 250, frequency_minutes: 90, enabled: false };
}

export async function saveWaterSettings(settings) {
  return supabase.from("water_settings").upsert(settings).select().single();
}

import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

export async function loadReminderSettings(userId) {
  const { data, error } = await supabase
    .from("water_reminder_settings")
    .select("enabled, interval_minutes, start_time, end_time")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || { enabled: false, interval_minutes: 120, start_time: "08:00", end_time: "22:00" };
}

export async function saveReminderSettings(userId, fields) {
  const { error } = await supabase
    .from("water_reminder_settings")
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

// Pede permissão de notificações e regista a subscrição push do dispositivo atual.
export async function enablePush(userId) {
  if (!pushSupported()) throw new Error("Notificações push não são suportadas neste dispositivo/navegador.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão de notificações recusada.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
}

export async function disablePush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

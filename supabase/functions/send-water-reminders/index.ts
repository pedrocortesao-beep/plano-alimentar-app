// Edge Function agendada (ver README) que envia notificações push de
// "beber água" a cada utilizador que tenha o lembrete ativo e esteja
// dentro da janela horária definida, respeitando o intervalo escolhido.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabase = createClient(supabaseUrl, serviceRoleKey);

function minutesSinceMidnight(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

Deno.serve(async () => {
  const now = new Date();

  const { data: settingsRows, error } = await supabase
    .from("water_reminder_settings")
    .select("user_id, interval_minutes, start_time, end_time, last_sent_at, timezone")
    .eq("enabled", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;

  for (const setting of settingsRows ?? []) {
    const tz = setting.timezone || "Europe/Lisbon";
    const nowMin = minutesSinceMidnight(now, tz);
    const startMin = toMinutes(setting.start_time);
    const endMin = toMinutes(setting.end_time);
    if (nowMin < startMin || nowMin > endMin) continue;

    const dueMs = setting.interval_minutes * 60 * 1000;
    const lastSent = setting.last_sent_at ? new Date(setting.last_sent_at).getTime() : 0;
    if (now.getTime() - lastSent < dueMs) continue;

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", setting.user_id);

    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: "Hora de beber água 💧", body: "Já bebeste água nas últimas horas?" })
        );
        sent++;
      } catch (err) {
        // Subscrição inválida/expirada — remove-a para não voltar a tentar.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        } else {
          console.error("Falha ao enviar push:", err);
        }
      }
    }

    await supabase
      .from("water_reminder_settings")
      .update({ last_sent_at: now.toISOString() })
      .eq("user_id", setting.user_id);
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});

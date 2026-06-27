import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return new Response(JSON.stringify({ error: "Chýba email alebo kód" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const SUPA_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE = Deno.env.get("SERVICE_ROLE_KEY") || "";
    const STRIPE = Deno.env.get("STRIPE_SECRET_KEY") || "";

    const lookup = await fetch(
      `${SUPA_URL}/rest/v1/access_codes?email=eq.${encodeURIComponent(email)}&code=eq.${encodeURIComponent(code)}&select=stripe_id,valid_until&limit=1`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const rows = await lookup.json();
    if (!rows || !rows.length || !rows[0].stripe_id) {
      return new Response(JSON.stringify({ error: "Predplatné sa nenašlo" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const subId = rows[0].stripe_id;
    const cancel = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "cancel_at_period_end=true",
    });
    const result = await cancel.json();
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, valid_until: rows[0].valid_until }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

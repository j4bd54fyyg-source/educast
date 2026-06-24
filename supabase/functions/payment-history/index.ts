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

    // Najdi subscription ID
    const lookup = await fetch(
      `${SUPA_URL}/rest/v1/access_codes?email=eq.${encodeURIComponent(email)}&code=eq.${encodeURIComponent(code)}&select=stripe_id&limit=1`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    );
    const rows = await lookup.json();
    if (!rows || !rows.length || !rows[0].stripe_id) {
      return new Response(JSON.stringify({ error: "Predplatné sa nenašlo" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Zisti customer zo subscription
    const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${rows[0].stripe_id}`, {
      headers: { Authorization: `Bearer ${STRIPE}` },
    });
    const sub = await subRes.json();
    if (sub.error || !sub.customer) {
      return new Response(JSON.stringify({ error: "Zákazník sa nenašiel" }), { status: 404, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    // Nacitaj faktury zakaznika
    const invRes = await fetch(`https://api.stripe.com/v1/invoices?customer=${sub.customer}&limit=24`, {
      headers: { Authorization: `Bearer ${STRIPE}` },
    });
    const inv = await invRes.json();
    if (inv.error) {
      return new Response(JSON.stringify({ error: inv.error.message }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const items = (inv.data || []).map((i: any) => ({
      date: i.created,
      amount: i.amount_paid,
      currency: i.currency,
      status: i.status,
      pdf: i.invoice_pdf || null,
      url: i.hosted_invoice_url || null,
    }));

    return new Response(JSON.stringify({
      ok: true,
      invoices: items,
      cancel_at_period_end: !!sub.cancel_at_period_end,
      current_period_end: sub.current_period_end || null,
      sub_status: sub.status || null,
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});

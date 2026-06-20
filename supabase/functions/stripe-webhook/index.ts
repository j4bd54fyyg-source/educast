import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  "https://mcusipcyapsuvrbnxtkw.supabase.co",
  Deno.env.get("SERVICE_ROLE_KEY")!
);

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EDU-P-2025-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function sendNewCodeEmail(email: string, code: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Educast <noreply@educast.sk>",
      to: email,
      subject: "Tvoj prístupový kód Educast+ 🎓",
      html: `
        <h2>Tvoja platba prebehla úspešne! 🎉</h2>
        <p>Vitaj v <strong>EDUCAST+</strong>.</p>
        <h3>🔑 Tvoj prístupový kód:</h3>
        <div style="background:#1a1a1a;color:#B5D4F4;font-size:24px;font-weight:bold;padding:16px 24px;border-radius:8px;letter-spacing:2px;text-align:center;margin:16px 0;">${code}</div>
        <p><strong>Email:</strong> ${email}</p>
        <h3>Ako sa prihlásiť:</h3>
        <ol>
          <li>Choď na <a href="https://educast.sk">educast.sk</a></li>
          <li>Klikni na <strong>🔑 Zadať kód</strong></li>
          <li>Zadaj svoj email a kód uvedený vyššie</li>
        </ol>
        <p style="color:#888;font-size:12px;">Predplatné sa obnovuje automaticky každý mesiac. Zrušiť ho môžeš kedykoľvek.</p>
        <br><p>Tím Educast</p>
      `,
    }),
  });
}

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // ── PRVÁ PLATBA: vytvor nový kód + pošli mail ──
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_email!;
    const code = generateCode();

    const { error } = await supabase.from("access_codes").insert({
      code,
      email,
      tier: 'p',
      stripe_id: session.subscription as string,
      valid_until: new Date(Date.now() + THIRTY_DAYS).toISOString(),
    });

    if (error) {
      console.error("DB error (insert):", error);
      return new Response("Error saving code", { status: 500 });
    }

    await sendNewCodeEmail(email, code);
  }

  // ── OBNOVA: predĺž platnosť existujúceho kódu o 30 dní ──
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object as Stripe.Invoice;

    // Prvú faktúru rieši už checkout.session.completed → preskočíme, aby sa nezdvojila
    if (invoice.billing_reason === "subscription_create") {
      return new Response(JSON.stringify({ received: true, skipped: "first invoice" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const subId = invoice.subscription as string;
    if (subId) {
      // Nájdi existujúci kód podľa subscription ID
      const { data: rows, error: selErr } = await supabase
        .from("access_codes")
        .select("id, valid_until")
        .eq("stripe_id", subId)
        .order("valid_until", { ascending: false })
        .limit(1);

      if (selErr) {
        console.error("DB error (select):", selErr);
        return new Response("Error reading code", { status: 500 });
      }

      if (rows && rows.length > 0) {
        // Predĺž od neskoršieho z [teraz, súčasná platnosť], aby sa nestratili dni
        const current = new Date(rows[0].valid_until).getTime();
        const base = Math.max(Date.now(), current);
        const newUntil = new Date(base + THIRTY_DAYS).toISOString();

        const { error: updErr } = await supabase
          .from("access_codes")
          .update({ valid_until: newUntil })
          .eq("id", rows[0].id);

        if (updErr) {
          console.error("DB error (update):", updErr);
          return new Response("Error extending code", { status: 500 });
        }
      } else {
        console.warn("Renewal for unknown subscription:", subId);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  "https://mcusipcyapsuvrbnxtkw.supabase.co",
  Deno.env.get("SERVICE_ROLE_KEY")!
);

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'EDU-P-2025-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.CheckoutSession;
    const email = session.customer_email!;
    const code = generateCode();

    const { error } = await supabase.from("access_codes").insert({
      code,
      email,
      tier: 'p',
      stripe_id: session.subscription as string,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    if (error) {
      console.error("DB error:", error);
      return new Response("Error saving code", { status: 500 });
    }

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
          <div style="background:#1a1a1a;color:#9FE1CB;font-size:24px;font-weight:bold;padding:16px 24px;border-radius:8px;letter-spacing:2px;text-align:center;margin:16px 0;">${code}</div>
          <p><strong>Email:</strong> ${email}</p>
          <h3>Ako sa prihlásiť:</h3>
          <ol>
            <li>Choď na <a href="https://educast.sk">educast.sk</a></li>
            <li>Klikni na <strong>🔑 Zadať kód</strong></li>
            <li>Zadaj svoj email a kód uvedený vyššie</li>
          </ol>
          <p style="color:#888;font-size:12px;">Kód je viazaný na tvoj email a zariadenie.</p>
          <br><p>Tím Educast</p>
        `,
      }),
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

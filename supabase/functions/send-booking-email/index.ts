// Supabase Edge Function: send-booking-email
// Sends a booking request email to the business email if configured.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type BookingPayload = {
  business_id: string;
  business_email: string | null;
  service_name?: string | null;
  staff_member_id: string;
  staff_name?: string | null;
  client_id: string;
  client_email?: string | null;
  client_name?: string | null;
  start_time: string;
  end_time: string;
  notes?: string | null;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  let payload: BookingPayload | null = null;
  try {
    payload = await req.json();
  } catch (_) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!payload?.business_email) {
    return new Response(
      JSON.stringify({ status: "ok", message: "No business email provided; skipping send." }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const apiKey = Deno.env.get("RESEND_API_KEY") || Deno.env.get("BOOKEASE_RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set; email send skipped.");
    return new Response(
      JSON.stringify({ status: "ok", message: "Email not configured; skipped." }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  // Use a verified sender if provided; otherwise default to Resend's onboarding sender
  const fromEmail = Deno.env.get("EMAIL_FROM") || Deno.env.get("BOOKEASE_EMAIL_FROM") || "onboarding@resend.dev";

  const subject = `New Booking Request`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
      <h2>New Booking Request</h2>
      <p><strong>Business ID:</strong> ${payload.business_id}</p>
      <p><strong>Service:</strong> ${payload.service_name ?? "(unknown)"}</p>
      <p><strong>Staff:</strong> ${payload.staff_name ?? payload.staff_member_id}</p>
      <p><strong>Client:</strong> ${payload.client_name ?? payload.client_email ?? payload.client_id}</p>
      <p><strong>Start:</strong> ${payload.start_time}</p>
      <p><strong>End:</strong> ${payload.end_time}</p>
      ${payload.notes ? `<p><strong>Notes:</strong> ${payload.notes}</p>` : ""}
    </div>
  `;

  try {
    const body: Record<string, any> = {
      from: fromEmail,
      to: payload.business_email,
      subject,
      html,
    };
    if (payload.client_email) {
      body.reply_to = payload.client_email;
    }

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Resend API error:", text);
      return new Response(JSON.stringify({ error: "Failed to send email", detail: text }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    const json = await resp.json().catch(() => ({}));
    return new Response(JSON.stringify({ status: "ok", provider: "resend", result: json }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("Email send failed:", err);
    return new Response(JSON.stringify({ error: "Email send failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
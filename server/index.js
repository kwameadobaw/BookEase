import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = Number(process.env.EMAIL_SERVER_PORT || 4000);
const allowedOrigin = process.env.EMAIL_SERVER_ALLOWED_ORIGIN || '*';

app.use(express.json());
app.use(
  cors({
    origin: allowedOrigin === '*' ? true : allowedOrigin,
    credentials: false,
  })
);

// --- Supabase (service role) ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// --- Nodemailer Transport ---
function createTransport() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_AUTH_TYPE,
    SMTP_OAUTH_CLIENT_ID,
    SMTP_OAUTH_CLIENT_SECRET,
    SMTP_OAUTH_REFRESH_TOKEN,
  } = process.env;

  const authType = (SMTP_AUTH_TYPE || 'smtp').toLowerCase();

  if (authType === 'oauth2') {
    if (!SMTP_USER || !SMTP_OAUTH_CLIENT_ID || !SMTP_OAUTH_CLIENT_SECRET || !SMTP_OAUTH_REFRESH_TOKEN) {
      console.error('[email] Missing OAuth2 envs: SMTP_USER/SMTP_OAUTH_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN');
      return null;
    }
    const transport = nodemailer.createTransport({
      host: SMTP_HOST || 'smtp.gmail.com',
      port: Number(SMTP_PORT || 465),
      secure: String(SMTP_SECURE ?? 'true').toLowerCase() === 'true',
      auth: {
        type: 'OAuth2',
        user: SMTP_USER,
        clientId: SMTP_OAUTH_CLIENT_ID,
        clientSecret: SMTP_OAUTH_CLIENT_SECRET,
        refreshToken: SMTP_OAUTH_REFRESH_TOKEN,
      },
    });
    return transport;
  }

  // Default SMTP user/pass
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.error('[email] Missing SMTP envs: SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS');
    return null;
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transport;
}

const transporter = createTransport();
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Bookings';

function fromAddress() {
  return `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`;
}

// --- Helpers ---
function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return String(iso);
  }
}

async function getBusinessEmail(business_id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('business_profiles')
    .select('email, name')
    .eq('id', business_id)
    .maybeSingle();
  if (error) {
    console.error('[email] fetch business email error', error);
    return null;
  }
  return data?.email || null;
}

async function getAppointmentWithJoins(appointment_id) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, client_id, business_id, staff_member_id, service_id,
      start_time, end_time, notes,
      service:services(name),
      staff:staff_members(name),
      business:business_profiles(name, email)
    `)
    .eq('id', appointment_id)
    .maybeSingle();
  if (error) {
    console.error('[email] fetch appointment error', error);
    return null;
  }
  return data || null;
}

async function getUserEmailById(user_id) {
  if (!supabase || !user_id) return null;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(user_id);
    if (error) {
      console.error('[email] getUserById error', error);
      return null;
    }
    return data?.user?.email || null;
  } catch (e) {
    console.error('[email] getUserById exception', e);
    return null;
  }
}

// --- Routes ---
// Send email to business when a booking is created
app.post('/send-booking-email', async (req, res) => {
  if (!transporter) return res.status(500).json({ ok: false, error: 'SMTP not configured' });

  const {
    business_id,
    business_email, // optional; will be looked up if missing
    service_name,
    staff_member_id,
    staff_name, // optional
    client_id,
    client_name,
    client_email, // optional for reply-to
    start_time,
    end_time,
    notes,
  } = req.body || {};

  try {
    const toEmail = business_email || (await getBusinessEmail(business_id));
    if (!toEmail) return res.status(400).json({ ok: false, error: 'Business email not found' });

    const subject = `New booking: ${service_name || 'Service'}${staff_name ? ' with ' + staff_name : ''}`;
    const text = `A new booking request was made.\n\n` +
      `Service: ${service_name || 'N/A'}\n` +
      (staff_name ? `Staff: ${staff_name}\n` : '') +
      `Client: ${client_name || 'N/A'}\n` +
      `Start: ${fmtDateTime(start_time)}\n` +
      `End: ${fmtDateTime(end_time)}\n` +
      (notes ? `Notes: ${notes}\n` : '') +
      `\nTo confirm or reject, please use your dashboard.`;

    const html = `
      <h2>New booking request</h2>
      <p><strong>Service:</strong> ${service_name || 'N/A'}</p>
      ${staff_name ? `<p><strong>Staff:</strong> ${staff_name}</p>` : ''}
      <p><strong>Client:</strong> ${client_name || 'N/A'}</p>
      <p><strong>Start:</strong> ${fmtDateTime(start_time)}</p>
      <p><strong>End:</strong> ${fmtDateTime(end_time)}</p>
      ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      <p>To confirm or reject, please use your dashboard.</p>
    `;

    const info = await transporter.sendMail({
      from: fromAddress(),
      to: toEmail,
      subject,
      text,
      html,
      replyTo: client_email || undefined,
    });

    return res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error('[email] send-booking-email error', e);
    return res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
});

// Send confirmation to client when business confirms booking
app.post('/send-confirmation-email', async (req, res) => {
  if (!transporter) return res.status(500).json({ ok: false, error: 'SMTP not configured' });

  const { appointment_id, client_email: clientEmailOverride } = req.body || {};

  try {
    const appt = await getAppointmentWithJoins(appointment_id);
    if (!appt) return res.status(404).json({ ok: false, error: 'Appointment not found' });

    const clientEmail = clientEmailOverride || (await getUserEmailById(appt.client_id));
    if (!clientEmail) return res.status(400).json({ ok: false, error: 'Client email not found' });

    const businessName = appt.business?.name || 'Our Business';
    const staffName = appt.staff?.name || undefined;
    const serviceName = appt.service?.name || 'Service';

    const subject = `Your booking is confirmed: ${serviceName}${staffName ? ' with ' + staffName : ''}`;
    const text = `Your booking has been confirmed.\n\n` +
      `Business: ${businessName}\n` +
      `Service: ${serviceName}\n` +
      (staffName ? `Staff: ${staffName}\n` : '') +
      `Start: ${fmtDateTime(appt.start_time)}\n` +
      `End: ${fmtDateTime(appt.end_time)}\n` +
      `\nWe look forward to seeing you!`;

    const html = `
      <h2>Your booking is confirmed</h2>
      <p><strong>Business:</strong> ${businessName}</p>
      <p><strong>Service:</strong> ${serviceName}</p>
      ${staffName ? `<p><strong>Staff:</strong> ${staffName}</p>` : ''}
      <p><strong>Start:</strong> ${fmtDateTime(appt.start_time)}</p>
      <p><strong>End:</strong> ${fmtDateTime(appt.end_time)}</p>
      <p>We look forward to seeing you!</p>
    `;

    const info = await transporter.sendMail({
      from: fromAddress(),
      to: clientEmail,
      subject,
      text,
      html,
    });

    return res.json({ ok: true, messageId: info.messageId });
  } catch (e) {
    console.error('[email] send-confirmation-email error', e);
    return res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
});

app.get('/health', (req, res) => {
  const authType = (process.env.SMTP_AUTH_TYPE || 'smtp').toLowerCase();
  res.json({ ok: true, serviceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY), smtp: Boolean(transporter), authType });
});

app.listen(PORT, () => {
  console.log(`[email] server listening on http://localhost:${PORT}`);
});
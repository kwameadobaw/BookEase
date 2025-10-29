import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

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

// --- Supabase Clients ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Fallback anon client for read-only queries when service role is missing/invalid
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabaseAnon = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
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


// Developer authentication
app.post('/developer/auth', (req, res) => {
  const { password } = req.body || {};
  const DEVELOPER_PASSWORD = process.env.DEVELOPER_PASSWORD;
  
  if (!DEVELOPER_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Developer password not configured' });
  }
  
  if (password === DEVELOPER_PASSWORD) {
    return res.json({ ok: true, authenticated: true });
  } else {
    return res.status(401).json({ ok: false, error: 'Invalid password' });
  }
});

// Get all businesses with analytics
app.get('/developer/businesses', async (req, res) => {
  // Prefer service role, but allow anon fallback for read-only business list
  const clientPrimary = supabase;
  const clientFallback = supabaseAnon;

  if (!clientPrimary && !clientFallback) {
    return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  }

  try {
    // Try with primary client first
    let { data: businesses, error: businessError } = await (clientPrimary || clientFallback)
      .from('business_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // If primary client fails due to invalid key, retry with fallback anon client
    if (businessError && clientFallback && clientPrimary) {
      const errMsg = String(businessError?.message || '').toLowerCase();
      if (errMsg.includes('invalid api key') || errMsg.includes('anonymous key')) {
        ({ data: businesses, error: businessError } = await clientFallback
          .from('business_profiles')
          .select('*')
          .order('created_at', { ascending: false }));
      }
    }

    if (businessError) throw businessError;

    const usingAnon = !clientPrimary || businessError; // if we had to fallback

    // If using anon, skip analytics (RLS likely blocks appointments); return zeros
    const businessesWithAnalytics = await Promise.all(
      (businesses || []).map(async (business) => {
        const ownerEmail = null;

        if (usingAnon) {
          return {
            ...business,
            email: ownerEmail || '',
            users: { email: ownerEmail || '' },
            analytics: { totalBookings: 0, confirmedBookings: 0, totalRevenue: 0 },
          };
        }

        // With service role, compute full analytics
        const { count: totalBookings } = await clientPrimary
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', business.id);

        const { count: confirmedBookings } = await clientPrimary
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', business.id)
          .eq('status', 'confirmed');

        const { data: revenueData } = await clientPrimary
          .from('appointments')
          .select(`
            services!appointments_service_id_fkey(price)
          `)
          .eq('business_id', business.id)
          .eq('status', 'confirmed');

        const totalRevenue = revenueData?.reduce((sum, appointment) => sum + (appointment.services?.price || 0), 0) || 0;

        return {
          ...business,
          email: ownerEmail || '',
          users: { email: ownerEmail || '' },
          analytics: {
            totalBookings: totalBookings || 0,
            confirmedBookings: confirmedBookings || 0,
            totalRevenue,
          },
        };
      })
    );

    return res.json({ ok: true, businesses: businessesWithAnalytics });
  } catch (e) {
    console.error('[developer] get businesses error', e);
    return res.status(500).json({ ok: false, error: 'Failed to fetch businesses' });
  }
});

// Get detailed business analytics
app.get('/developer/businesses/:businessId/analytics', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, error: 'Service role not configured' });
  }

  const { businessId } = req.params;
  const { startDate, endDate } = req.query;

  try {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        services!appointments_service_id_fkey(name, price),
        staff!appointments_staff_id_fkey(name),
        users!appointments_client_id_fkey(email)
      `)
      .eq('business_id', businessId)
      .order('start_time', { ascending: false });

    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('start_time', endDate);
    }

    const { data: appointments, error } = await query;
    if (error) throw error;

    // Group by date for daily analytics
    const dailyStats = {};
    appointments.forEach(appointment => {
      const date = appointment.start_time.split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          totalBookings: 0,
          confirmedBookings: 0,
          revenue: 0,
          appointments: []
        };
      }
      
      dailyStats[date].totalBookings++;
      dailyStats[date].appointments.push(appointment);
      
      if (appointment.status === 'confirmed') {
        dailyStats[date].confirmedBookings++;
        dailyStats[date].revenue += appointment.services?.price || 0;
      }
    });

    return res.json({ 
      ok: true, 
      analytics: {
        appointments,
        dailyStats: Object.values(dailyStats)
      }
    });
  } catch (e) {
    console.error('[developer] get business analytics error', e);
    return res.status(500).json({ ok: false, error: 'Failed to fetch analytics' });
  }
});

// Toggle business listing status
app.post('/developer/businesses/:businessId/toggle-listing', async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ ok: false, error: 'Service role not configured' });
  }

  const { businessId } = req.params;

  try {
    // Get current status
    const { data: business, error: fetchError } = await supabase
      .from('business_profiles')
      .select('is_listed')
      .eq('id', businessId)
      .single();

    if (fetchError) throw fetchError;

    // Toggle the status
    const newStatus = !business.is_listed;
    const { error: updateError } = await supabase
      .from('business_profiles')
      .update({ is_listed: newStatus })
      .eq('id', businessId);

    if (updateError) throw updateError;

    return res.json({ ok: true, is_listed: newStatus });
  } catch (e) {
    console.error('[developer] toggle listing error', e);
    return res.status(500).json({ ok: false, error: 'Failed to toggle listing status' });
  }
});

app.get('/health', (req, res) => {
  const authType = (process.env.SMTP_AUTH_TYPE || 'smtp').toLowerCase();
  res.json({ ok: true, serviceRole: Boolean(SUPABASE_SERVICE_ROLE_KEY), smtp: Boolean(transporter), authType });
});

app.listen(PORT, () => {
  console.log(`[email] server listening on http://localhost:${PORT}`);
});

// Generate PDF report for a business within a date range
app.get('/businesses/:businessId/report', async (req, res) => {
  // We prefer service role, but can gracefully degrade to anon for limited data
  const clientPrimary = supabase;
  const clientFallback = supabaseAnon;

  if (!clientPrimary && !clientFallback) {
    return res.status(500).json({ ok: false, error: 'Supabase not configured' });
  }

  const { businessId } = req.params;
  const { startDate, endDate } = req.query;

  function isInvalidApiKeyError(err) {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('invalid api key') || msg.includes('anonymous key');
  }

  try {
    // Load business info (fallback to anon if invalid api key)
    let { data: business, error: businessError } = await (clientPrimary || clientFallback)
      .from('business_profiles')
      .select('*')
      .eq('id', businessId)
      .maybeSingle();

    if (businessError && clientFallback && clientPrimary && isInvalidApiKeyError(businessError)) {
      ({ data: business, error: businessError } = await clientFallback
        .from('business_profiles')
        .select('*')
        .eq('id', businessId)
        .maybeSingle());
    }
    if (businessError) throw businessError;
    if (!business) return res.status(404).json({ ok: false, error: 'Business not found' });

    // Load appointments with service details in the range (no anon fallback; appointments likely RLS-protected)
    let appointments = [];
    let appointmentsUnavailable = false;
    if (clientPrimary) {
      try {
        let apptQuery = clientPrimary
          .from('appointments')
          .select(`
            *,
            services!appointments_service_id_fkey(name, price)
          `)
          .eq('business_id', businessId);
        if (startDate) apptQuery = apptQuery.gte('start_time', startDate);
        if (endDate) apptQuery = apptQuery.lte('start_time', endDate);
        const { data: appts, error: apptError } = await apptQuery;
        if (apptError) throw apptError;
        appointments = appts || [];
      } catch (err) {
        console.warn('[report] appointments unavailable, continuing with limited report', err);
        appointmentsUnavailable = true;
        appointments = [];
      }
    } else {
      appointmentsUnavailable = true;
    }

    // Load reviews in the range (fallback to anon if invalid api key)
    let reviews = [];
    {
      let reviewQuery = (clientPrimary || clientFallback)
        .from('reviews')
        .select('rating, created_at')
        .eq('business_id', businessId);
      if (startDate) reviewQuery = reviewQuery.gte('created_at', startDate);
      if (endDate) reviewQuery = reviewQuery.lte('created_at', endDate);
      let { data: revs, error: reviewError } = await reviewQuery;
      if (reviewError && clientFallback && clientPrimary && isInvalidApiKeyError(reviewError)) {
        let rq = clientFallback
          .from('reviews')
          .select('rating, created_at')
          .eq('business_id', businessId);
        if (startDate) rq = rq.gte('created_at', startDate);
        if (endDate) rq = rq.lte('created_at', endDate);
        ({ data: revs, error: reviewError } = await rq);
      }
      if (reviewError) throw reviewError;
      reviews = revs || [];
    }

    // Compute stats
    const totalAppointments = appointments.length;
    const pending = appointments.filter(a => a.status === 'PENDING').length;
    const confirmed = appointments.filter(a => a.status === 'CONFIRMED').length;
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    const revenue = appointments
      .filter(a => a.status === 'CONFIRMED' || a.status === 'COMPLETED')
      .reduce((sum, a) => sum + (a.services?.price || 0), 0);
    const averageRating = reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length)
      : 0;

    // Top services by count
    const serviceCounts = new Map();
    appointments.forEach(a => {
      const name = a.services?.name || 'Unknown Service';
      serviceCounts.set(name, (serviceCounts.get(name) || 0) + 1);
    });
    const topServices = Array.from(serviceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Prepare PDF response
    const filename = `bookease-report-${business.slug || business.id}-${startDate || 'start'}-${endDate || 'end'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(18).text('BookEase — Business Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`${business.name}`, { align: 'center' });
    doc.fontSize(10).text(`${business.address || ''}${business.city ? ', ' + business.city : ''}`, { align: 'center' });
    doc.moveDown();

    // Period
    doc.fontSize(12).text('Report Period', { underline: true });
    doc.text(`From: ${startDate || '—'}  To: ${endDate || '—'}`);
    doc.moveDown();

    // Summary stats
    doc.fontSize(12).text('Summary', { underline: true });
    doc.text(`Total Appointments: ${totalAppointments}${appointmentsUnavailable ? ' (unavailable)' : ''}`);
    doc.text(`Pending: ${pending}`);
    doc.text(`Confirmed: ${confirmed}`);
    doc.text(`Completed: ${completed}`);
    doc.text(`Revenue (GHS): ${revenue.toFixed(2)}`);
    doc.text(`Average Rating: ${averageRating.toFixed(2)} (${reviews.length} reviews)`);
    doc.moveDown();

    // Top services
    doc.fontSize(12).text('Top Services', { underline: true });
    if (topServices.length === 0) {
      doc.text(appointmentsUnavailable ? 'Unavailable in this period.' : 'No services in this period.');
    } else {
      topServices.forEach(([name, count]) => {
        doc.text(`${name}: ${count}`);
      });
    }
    doc.moveDown();

    // Recent appointments table-like listing (limited)
    doc.fontSize(12).text('Recent Appointments', { underline: true });
    const recent = appointments.slice(0, 20);
    if (appointmentsUnavailable) {
      doc.text('Unavailable');
    } else if (recent.length === 0) {
      doc.text('None');
    } else {
      recent.forEach(a => {
        const date = new Date(a.start_time).toLocaleString();
        const svc = a.services?.name || '—';
        const price = a.services?.price != null ? `GHS ${a.services.price}` : '—';
        doc.text(`${date} — ${svc} (${price}) — ${a.status}`);
      });
    }

    doc.end();
  } catch (e) {
    console.error('[report] error', e);
    return res.status(500).json({ ok: false, error: 'Failed to generate report' });
  }
});
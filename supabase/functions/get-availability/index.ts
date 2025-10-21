import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface WorkingHours {
  start_time: string;
  end_time: string;
}

interface Appointment {
  start_time: string;
  end_time: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseKey = serviceRoleKey ?? anonKey!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const staffId = url.searchParams.get('staff_id');
    const date = url.searchParams.get('date');
    const durationMinutes = parseInt(url.searchParams.get('duration') || '60');
    const debug = url.searchParams.get('debug') === 'true';

    if (!staffId || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: staff_id and date' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse date in LOCAL timezone for correct day-of-week and boundaries
    const localStart = new Date(`${date}T00:00:00`);
    const localEnd = new Date(`${date}T23:59:59`);
    const dayOfWeek = localStart.getDay();

    const { data: workingHours, error: hoursError } = await supabase
      .from('working_hours')
      .select('start_time, end_time')
      .eq('staff_member_id', staffId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (hoursError || !workingHours) {
      return new Response(
        JSON.stringify({
          availableSlots: [],
          meta: debug ? { reason: 'no_working_hours', staffId, dayOfWeek, date, workingHours: null, appointmentsCount: 0, keyType: serviceRoleKey ? 'service' : 'anon' } : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const startOfDay = localStart.toISOString();
    const endOfDay = localEnd.toISOString();

    // Fetch appointments that OVERLAP the day window, not just those starting the same day
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('staff_member_id', staffId)
      .lt('start_time', endOfDay)
      .gt('end_time', startOfDay)
      .in('status', ['PENDING', 'CONFIRMED']);

    if (apptError) {
      // If using anon key under RLS, this will often fail; surface informative meta in debug mode
      const meta = debug ? { reason: 'appointments_fetch_error', message: (apptError as any)?.message, staffId, dayOfWeek, date, workingHours, keyType: serviceRoleKey ? 'service' : 'anon' } : undefined;
      return new Response(JSON.stringify({ availableSlots: [], meta }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const availableSlots = calculateAvailableSlots(
      workingHours,
      appointments || [],
      date,
      durationMinutes
    );

    return new Response(
      JSON.stringify({
        availableSlots,
        meta: debug ? { staffId, dayOfWeek, date, workingHours, appointmentsCount: (appointments || []).length, keyType: serviceRoleKey ? 'service' : 'anon' } : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function calculateAvailableSlots(
  workingHours: WorkingHours,
  appointments: Appointment[],
  dateStr: string,
  durationMinutes: number
): string[] {
  const slots: string[] = [];

  // Normalize time strings (accept HH:MM or HH:MM:SS)
  const normalize = (t: string) => (t.length === 5 ? `${t}:00` : t);

  // Use local date boundaries to construct slot times
  let currentTime = new Date(`${dateStr}T${normalize(workingHours.start_time)}`);
  const endTime = new Date(`${dateStr}T${normalize(workingHours.end_time)}`);

  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60000);

    if (slotEnd > endTime) break;

    const isAvailable = !appointments.some((appt) => {
      const apptStart = new Date(appt.start_time);
      const apptEnd = new Date(appt.end_time);
      return (
        (currentTime >= apptStart && currentTime < apptEnd) ||
        (slotEnd > apptStart && slotEnd <= apptEnd) ||
        (currentTime <= apptStart && slotEnd >= apptEnd)
      );
    });

    if (isAvailable) {
      slots.push(currentTime.toISOString());
    }

    currentTime = new Date(currentTime.getTime() + durationMinutes * 60000);
  }

  return slots;
}

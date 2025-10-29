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
    const businessId = url.searchParams.get('business_id');
    const date = url.searchParams.get('date');
    const durationMinutes = parseInt(url.searchParams.get('duration') || '60');
    const debug = url.searchParams.get('debug') === 'true';

    if (!businessId || !date) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: business_id and date' }),
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
      .from('business_working_hours')
      .select('start_time, end_time')
      .eq('business_id', businessId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (hoursError || !workingHours) {
      return new Response(
        JSON.stringify({
          availableSlots: [],
          meta: debug ? { reason: 'no_business_working_hours', businessId, dayOfWeek, date, workingHours: null, keyType: serviceRoleKey ? 'service' : 'anon' } : undefined,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const availableSlots = calculateAvailableSlots(
      workingHours,
      date,
      durationMinutes
    );

    return new Response(
      JSON.stringify({
        availableSlots,
        meta: debug ? { businessId, dayOfWeek, date, workingHours, keyType: serviceRoleKey ? 'service' : 'anon' } : undefined,
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

    slots.push(currentTime.toISOString());

    currentTime = new Date(currentTime.getTime() + durationMinutes * 60000);
  }

  return slots;
}

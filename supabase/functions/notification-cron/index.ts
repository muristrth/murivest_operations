import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results: Record<string, number> = {}

    // 1. Check overdue tasks
    const { data: overdueTasks, error: taskError } = await supabase
      .rpc('check_overdue_tasks')
    if (taskError) console.error('Overdue tasks check failed:', taskError)
    else results.overdueTasks = 1

    // 2. Check due/overdue follow-ups
    const { data: dueFollowups, error: followupError } = await supabase
      .rpc('check_due_followups')
    if (followupError) console.error('Due follow-ups check failed:', followupError)
    else results.dueFollowups = 1

    // 3. Check appointment reminders (24h)
    const { data: apptReminders, error: apptError } = await supabase
      .rpc('check_appointment_reminders')
    if (apptError) console.error('Appointment reminders check failed:', apptError)
    else results.appointmentReminders = 1

    // 4. Process email queue (trigger send-email function)
    // We'll call the send-email function via HTTP
    const sendEmailUrl = `${supabaseUrl}/functions/v1/send-email`
    const emailResponse = await fetch(sendEmailUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      }
    })
    const emailResult = await emailResponse.json()
    results.emailsSent = emailResult.sent || 0

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Cron function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
// @ts-ignore Deno resolves URL imports; Node/TypeScript tooling may not.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore Deno resolves URL imports; Node/TypeScript tooling may not.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore Deno resolves URL imports; Node/TypeScript tooling may not.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailQueueItem {
  id: string
  recipient_id: string
  type: string
  title: string
  body: string | null
  module: string | null
  record_id: string | null
  created_at: string
}

interface Profile {
  id: string
  email: string
  full_name: string
  email_notifications: boolean
}

interface EmailHtmlParams {
  recipientName: string
  title: string
  body: string | null
  module: string | null
  recordId: string | null
  type: string
  systemUrl: string
  logoUrl: string
}

const getEnv = (name: string): string | undefined =>
  (globalThis as typeof globalThis & {
    Deno: { env: { get(name: string): string | undefined } }
  }).Deno.env.get(name)

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = getEnv('SUPABASE_URL')!
    const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')!
    const smtpHost = getEnv('SMTP_HOST')
    const smtpPort = Number(getEnv('SMTP_PORT') ?? '465')
    const smtpUser = getEnv('SMTP_USER')
    const smtpPass = getEnv('SMTP_PASS')
    const senderName = getEnv('SMTP_SENDER_NAME') ?? 'Murivest Operations'
    const appUrl = getEnv('APP_URL') || 'https://app.murivest.com'
    const logoUrl = `${appUrl}/logo.webp`

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('SMTP_HOST / SMTP_USER / SMTP_PASS not configured')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Gmail rewrites the From header to the authenticated account, so the
    // sender address must be SMTP_USER or a verified "Send mail as" alias.
    const smtp = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: { username: smtpUser, password: smtpPass },
      },
    })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get pending emails from queue
    const { data: queueItems, error: queueError } = await supabase
      .from('email_queue')
      .select('*')
      .is('sent_at', null)
      .order('created_at', { ascending: true })
      .limit(50)

    if (queueError) throw queueError
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No pending emails' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let sentCount = 0
    const errors: string[] = []

    for (const item of queueItems as EmailQueueItem[]) {
      try {
        // Get recipient profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email, full_name, email_notifications')
          .eq('id', item.recipient_id)
          .single()

        if (profileError) throw profileError
        if (!profile || !profile.email_notifications) {
          // Mark as sent (skip)
          await supabase.from('email_queue').update({ sent_at: new Date().toISOString() }).eq('id', item.id)
          continue
        }

        const recipientEmail = (profile as Profile).email
        const recipientName = (profile as Profile).full_name || 'Team Member'

        // Build email content
        const emailHtml = buildEmailHtml({
          recipientName,
          title: item.title,
          body: item.body,
          module: item.module,
          recordId: item.record_id,
          type: item.type,
          systemUrl: `${appUrl}/app/${item.module}`,
          logoUrl
        })

        // Send via SMTP
        await smtp.send({
          from: `${senderName} <${smtpUser}>`,
          to: recipientEmail,
          subject: `[Murivest] ${item.title}`,
          html: emailHtml,
          content: 'auto',
        })

        // Mark as sent
        await supabase.from('email_queue').update({ sent_at: new Date().toISOString() }).eq('id', item.id)
        sentCount++

        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 100))

      } catch (err: any) {
        console.error(`Failed to send email ${item.id}:`, err)
        errors.push(`${item.id}: ${err.message}`)
      }
    }

    await smtp.close()

    return new Response(JSON.stringify({ 
      sent: sentCount, 
      failed: errors.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    console.error('Edge function error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildEmailHtml({ recipientName, title, body, module, recordId, type, systemUrl, logoUrl }: EmailHtmlParams): string {
  const moduleLabels: Record<string, string> = {
    inquiries: 'Inquiries',
    calls: 'Call Log',
    appointments: 'Appointments',
    followups: 'Follow-ups',
    tasks: 'Tasks',
    properties: 'Properties',
    correspondence: 'Correspondence',
    escalations: 'Escalations',
    daily_reports: 'Daily Reports'
  }

  const typeLabels: Record<string, string> = {
    new_inquiry: 'New Inquiry Received',
    task_assigned: 'Task Assigned',
    task_overdue: 'Task Overdue',
    task_deadline: 'Task Deadline Approaching',
    escalation_created: 'New Escalation',
    escalation_assigned: 'Escalation Assigned',
    escalation_resolved: 'Escalation Resolved',
    appointment_reminder: 'Appointment Reminder',
    followup_due: 'Follow-up Due',
    followup_overdue: 'Follow-up Overdue',
    daily_report_submitted: 'Daily Report Submitted',
    property_review_completed: 'Property Review Completed',
    property_correction_requested: 'Property Correction Requested',
    md_audit_create: 'Record Created',
    md_audit_edit: 'Record Updated',
    md_audit_archive: 'Record Archived',
    md_audit_delete: 'Deletion Requested'
  }

  const moduleLabel = module ? moduleLabels[module] || module : 'System'
  const typeLabel = typeLabels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #0f172a; border-radius: 8px; overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px 24px; text-align: center; border-bottom: 3px solid #c9a84c;">
      <img src="${logoUrl}" width="56" alt="Murivest" style="display: block; margin: 0 auto 16px; width: 56px; height: auto; border: 0;">
      <div style="display: inline-block; background: #c9a84c; color: #0f172a; padding: 8px 16px; border-radius: 4px; font-weight: 600; font-size: 14px; letter-spacing: 0.1em; text-transform: uppercase;">MURIVEST</div>
      <p style="margin: 12px 0 0; color: #94a3b8; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase;">Internal Operations System</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 32px 24px;">
      <p style="margin: 0 0 16px; font-size: 16px;">Dear ${recipientName},</p>
      
      <div style="background: #f8fafc; border-left: 4px solid #c9a84c; padding: 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
        <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #0f172a;">${title}</h2>
        ${body ? `<p style="margin: 0; font-size: 15px; color: #334155;">${body}</p>` : ''}
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 14px; color: #475569;">
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; width: 120px;">Module:</td>
          <td style="padding: 8px 0; font-weight: 500;">${moduleLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;">Type:</td>
          <td style="padding: 8px 0; font-weight: 500;">${typeLabel}</td>
        </tr>
        ${recordId ? `
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;">Record ID:</td>
          <td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${recordId}</td>
        </tr>
        ` : ''}
      </table>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${systemUrl}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 15px; transition: background 0.2s;">
          View in Murivest System
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;">
      
      <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
        This is an automated notification from the Murivest Operations System.<br>
        You received this because you have email notifications enabled for this event type.<br>
        <a href="${systemUrl}/settings" style="color: #c9a84c;">Manage notification preferences</a>
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #0f172a; padding: 20px 24px; text-align: center; border-top: 1px solid #1e293b;">
      <p style="margin: 0; font-size: 11px; color: #64748b; letter-spacing: 0.05em;">
        MURIVEST GROUP LTD. &mdash; CONFIDENTIAL<br>
        Internal use only. Do not forward without authorization.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim()
}
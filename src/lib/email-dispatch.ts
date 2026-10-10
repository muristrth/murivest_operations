import { supabase } from "@/integrations/supabase/client";

/**
 * Triggers the Supabase `send-email` edge function so the email_queue is
 * drained immediately. Call this (fire-and-forget) after any mutation that
 * changes a record — the database triggers queue notification emails for the
 * staff member and the Managing Director, and this flushes them out.
 *
 * The edge function is also invoked on a schedule (see migration
 * 20260921000001) so time-based reminders still send even when nobody is
 * using the app.
 */
export async function flushEmailQueue(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-email");
    if (error) {
      console.warn("[email-dispatch]", error.message);
    }
  } catch (err) {
    console.warn("[email-dispatch]", err instanceof Error ? err.message : err);
  }
}

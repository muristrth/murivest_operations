import { supabase } from "@/integrations/supabase/client";

/** Shared lightweight data-access helpers. All access is enforced server-side by
 *  row-level security and permission checks in the database. */

export async function listStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, job_title, active")
    .order("full_name");
  if (error) throw error;
  return data;
}

export async function listPropertyOptions() {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, status")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

// TASKS
export async function listTasks(filters?: { status?: string; assigned_to?: string; due_before?: string }) {
  let query = supabase.from("tasks").select("*").is("deleted_at", null).order("due_date", { ascending: true });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.due_before) query = query.lte("due_date", filters.due_before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTask(id: string) {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTaskComments(taskId: string) {
  const { data, error } = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at");
  if (error) throw error;
  return data;
}

// CORRESPONDENCE
export async function listCorrespondence(filters?: { assigned_to?: string; status?: string; module?: string; record_id?: string }) {
  let query = supabase.from("correspondence").select("*").is("deleted_at", null).order("date", { ascending: false });
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.module && filters?.record_id) {
    query = query.eq(`related_${filters.module}_id` as any, filters.record_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ESCALATIONS
export async function listEscalations(filters?: { status?: string; assigned_to?: string; module?: string; record_id?: string }) {
  let query = supabase.from("escalations").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.module) query = query.eq("related_module", filters.module);
  if (filters?.record_id) query = query.eq("related_record_id", filters.record_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// KNOWLEDGE GUIDE
export async function listKnowledgeGuide(category?: string) {
  let query = supabase.from("knowledge_guide").select("*").eq("is_active", true).order("sort_order");
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// WORK LOG, RATE CARD & WALLET
export async function listRateCard(activeOnly = true) {
  let query = supabase.from("rate_card").select("*").order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWorkLog(filters?: { staff_id?: string; status?: string; from?: string; to?: string }) {
  let query = supabase
    .from("work_log_entries")
    .select("*, rate_card(code, name, section, unit_label, bonus_condition)")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters?.staff_id) query = query.eq("staff_id", filters.staff_id);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.from) query = query.gte("entry_date", filters.from);
  if (filters?.to) query = query.lte("entry_date", filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWalletSummary(staffId?: string) {
  let query = supabase.from("staff_wallet_summary").select("*").order("balance_kes", { ascending: false });
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWalletPayments(staffId?: string) {
  let query = supabase.from("wallet_payments").select("*").order("paid_at", { ascending: false });
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function logAudit(entry: {
  action: string;
  module: string;
  record_id?: string;
  record_label?: string;
  field?: string;
  previous_value?: string;
  new_value?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("audit_logs").insert({ ...entry, user_id: auth.user.id });
}

export async function notify(entry: {
  recipient_id: string;
  type: string;
  title: string;
  body?: string;
  module?: string;
  record_id?: string;
}) {
  await supabase.from("notifications").insert(entry);
}

export function staffName(
  staff: { id: string; full_name: string; email: string }[] | undefined,
  id: string | null | undefined,
) {
  if (!id) return "Unassigned";
  const person = staff?.find((s) => s.id === id);
  return person ? person.full_name || person.email : "—";
}

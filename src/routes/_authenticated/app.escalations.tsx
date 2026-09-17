import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, listEscalations } from "@/lib/queries";
import {
  ESCALATION_CATEGORY,
  ESCALATION_STATUS,
  PRIORITY,
  optionsOf,
} from "@/lib/constants";
import { formatDateTime, friendlyError, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/escalations")({
  component: EscalationsPage,
});

const ALL = "all";

function NewEscalationDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const empty = {
    related_module: "inquiries",
    related_record_id: "",
    reason: "",
    category: "other",
    priority: "high",
    assigned_to: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("escalations").insert({
        related_module: form.related_module,
        related_record_id: form.related_record_id,
        reason: form.reason,
        category: form.category as never,
        priority: form.priority as never,
        assigned_to: form.assigned_to || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escalation created and MD notified.");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to create the escalation.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">Escalate to MD</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Escalation</DialogTitle>
          <DialogDescription>
            Escalate matters requiring management attention. The Managing Director will be notified immediately.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Related module">
            <Select value={form.related_module} onValueChange={(v) => setForm({ ...form, related_module: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inquiries">Inquiries</SelectItem>
                <SelectItem value="calls">Calls</SelectItem>
                <SelectItem value="properties">Properties</SelectItem>
                <SelectItem value="appointments">Appointments</SelectItem>
                <SelectItem value="tasks">Tasks</SelectItem>
                <SelectItem value="correspondence">Correspondence</SelectItem>
                <SelectItem value="followups">Follow-ups</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Record ID">
            <Input
              required
              value={form.related_record_id}
              onChange={(e) => setForm({ ...form, related_record_id: e.target.value })}
              placeholder="e.g. inquiry UUID"
            />
          </Field>
          <Field label="Category" className="sm:col-span-2">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(ESCALATION_CATEGORY).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(PRIORITY).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assign to (optional)">
            <Select
              value={form.assigned_to || "none"}
              onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="MD will assign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">MD will assign</SelectItem>
                {(staff ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reason / Details" className="sm:col-span-2">
            <Textarea
              required
              rows={5}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Describe the matter requiring management attention..."
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending} variant="destructive">
              {mutation.isPending ? "Escalating…" : "Escalate to Managing Director"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EscalationDetailDialog({ escalationId }: { escalationId: string }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const { data: escalation, isLoading } = useQuery({
    queryKey: ["escalation", escalationId],
    queryFn: async () => {
      const { data, error } = await supabase.from("escalations").select("*").eq("id", escalationId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!escalationId,
  });
  const [status, setStatus] = useState(escalation?.status ?? "open");
  const [response, setResponse] = useState(escalation?.management_response ?? "");

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("escalations").update({ 
        status: newStatus as never,
        management_response: response || null,
        resolved_by: newStatus === "resolved" || newStatus === "closed" ? auth.user?.id : null,
        resolved_at: newStatus === "resolved" || newStatus === "closed" ? new Date().toISOString() : null,
      }).eq("id", escalationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escalation updated.");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update.")),
  });

  if (isLoading) return <LoadingState label="Loading escalation…" />;
  if (!escalation) return <EmptyState message="Escalation not found" />;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Escalation: {ESCALATION_CATEGORY[escalation.category]}</DialogTitle>
          <DialogDescription>Priority: {PRIORITY[escalation.priority]}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onValueChange={(v) => { setStatus(v); updateStatus.mutate(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(ESCALATION_STATUS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <StatusBadge tone={escalation.priority === "urgent" ? "danger" : escalation.priority === "high" ? "warning" : "neutral"}>
              {PRIORITY[escalation.priority]}
            </StatusBadge>
          </Field>
          <Field label="Module">
            <span className="capitalize">{escalation.related_module}</span>
          </Field>
          <Field label="Record ID">
            <span className="font-mono text-xs">{escalation.related_record_id}</span>
          </Field>
          <Field label="Created by" className="sm:col-span-2">
            <span>{staffName(escalation.created_by)}</span>
          </Field>
          <Field label="Assigned to" className="sm:col-span-2">
            <span>{staffName(escalation.assigned_to)}</span>
          </Field>
          <Field label="Reason" className="sm:col-span-2">
            <p className="whitespace-pre-line text-sm">{text(escalation.reason)}</p>
          </Field>
          {can("escalations.resolve") ? (
            <>
              <Field label="Management Response" className="sm:col-span-2">
                <Textarea
                  rows={4}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Record management decision/response..."
                />
              </Field>
              <DialogFooter className="sm:col-span-2">
                <Button onClick={() => updateStatus.mutate(status)} disabled={updateStatus.isPending}>
                  {updateStatus.isPending ? "Saving…" : "Save Response"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function staffName(id: string | null | undefined) {
  if (!id) return "—";
  return id.slice(0, 8);
}

function EscalationsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["escalations", status, category],
    queryFn: async () => {
      let query = supabase.from("escalations").select("*").is("deleted_at", null).order("created_at", { ascending: false });
      if (status !== ALL) query = query.eq("status", status);
      if (category !== ALL) query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("escalations").update({ 
        status: status as never,
        resolved_by: status === "resolved" || status === "closed" ? auth.user?.id : null,
        resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escalation status updated.");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update.")),
  });

  const queryClient = useQueryClient();

  const rows = (data ?? []).filter((e) =>
    [e.reason, e.related_module, e.related_record_id]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  const openCount = rows.filter((e) => e.status === "open").length;
  const underReviewCount = rows.filter((e) => e.status === "under_review").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Escalations"
        description="Matters escalated to management for review and decision."
        actions={can("escalations.create") ? <NewEscalationDialog /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusBadge tone={openCount > 0 ? "danger" : "success"}>Open: {openCount}</StatusBadge>
        <StatusBadge tone={underReviewCount > 0 ? "warning" : "success"}>Under Review: {underReviewCount}</StatusBadge>
        <StatusBadge tone="neutral">Total: {rows.length}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search reason, module, record…" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(ESCALATION_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {optionsOf(ESCALATION_CATEGORY).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading escalations…" />
      ) : (
        <DataTable
          columns={["Date", "Category", "Module", "Record", "Priority", "Assigned", "Status", ""]}
          empty={rows.length === 0}
        >
          {rows.map((e) => (
            <Row key={e.id}>
              <Cell muted className="whitespace-nowrap text-xs">
                {formatDateTime(e.created_at)}
              </Cell>
              <Cell>
                <StatusBadge tone="warning">{ESCALATION_CATEGORY[e.category]}</StatusBadge>
              </Cell>
              <Cell muted className="capitalize">{e.related_module}</Cell>
              <Cell muted className="font-mono text-xs">{e.related_record_id}</Cell>
              <Cell>
                <StatusBadge tone={e.priority === "urgent" ? "danger" : e.priority === "high" ? "warning" : "neutral"}>
                  {PRIORITY[e.priority]}
                </StatusBadge>
              </Cell>
              <Cell muted>{staffName(e.assigned_to)}</Cell>
              <Cell>
                {can("escalations.resolve") ? (
                  <Select value={e.status} onValueChange={(v) => updateStatus.mutate({ id: e.id, status: v })}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsOf(ESCALATION_STATUS).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge tone={e.status === "resolved" || e.status === "closed" ? "success" : e.status === "under_review" ? "warning" : "danger"}>
                    {ESCALATION_STATUS[e.status]}
                  </StatusBadge>
                )}
              </Cell>
              <Cell>
                <span className="text-xs text-primary hover:underline cursor-pointer">Open</span>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
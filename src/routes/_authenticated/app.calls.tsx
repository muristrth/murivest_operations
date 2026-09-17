import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listPropertyOptions, listStaff, staffName } from "@/lib/queries";
import {
  CALL_ACTIONS,
  CALL_CATEGORY,
  CALL_STATUS,
  ESCALATION,
  INQUIRY_SOURCE,
  optionsOf,
} from "@/lib/constants";
import { formatDateTime, friendlyError, text, todayISO } from "@/lib/format";
import {
  Cell,
  DataTable,
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
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/_authenticated/app/calls")({
  component: CallsPage,
});

const ALL = "all";

function LogCallDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: properties } = useQuery({
    queryKey: ["property-options"],
    queryFn: listPropertyOptions,
  });
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const empty = {
    caller_name: "",
    phone: "",
    email: "",
    reason: "",
    category: "general",
    property_id: "",
    source: "phone",
    action_taken: "Information provided",
    assigned_to: "",
    status: "answered",
    followup_required: false,
    followup_date: "",
    escalation: "none",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("calls").insert({
        caller_name: form.caller_name,
        phone: form.phone || null,
        email: form.email || null,
        reason: form.reason || null,
        category: form.category as never,
        property_id: form.property_id || null,
        source: form.source as never,
        action_taken: form.action_taken,
        assigned_to: form.assigned_to || null,
        status: form.status,
        followup_required: form.followup_required,
        followup_date: form.followup_date || null,
        escalation: form.escalation as never,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;

      if (form.followup_required) {
        await supabase.from("followups").insert({
          client_name: form.caller_name,
          pending_action: form.reason || "Call back caller",
          due_date: form.followup_date || todayISO(),
          assigned_to: form.assigned_to || auth.user?.id || null,
          last_contact: todayISO(),
          created_by: auth.user?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Call logged.");
      queryClient.invalidateQueries();
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the call. Please try again.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Log Call</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log call</DialogTitle>
          <DialogDescription>
            Record the call exactly as it happened. Never confirm figures that have not been
            verified — escalate instead.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Caller name">
            <Input
              required
              value={form.caller_name}
              onChange={(e) => setForm({ ...form, caller_name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(CALL_CATEGORY).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reason for call" className="sm:col-span-2">
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <Field label="Property">
            <Select
              value={form.property_id || "none"}
              onValueChange={(v) => setForm({ ...form, property_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Not property specific" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not property specific</SelectItem>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source">
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(INQUIRY_SOURCE).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Action taken">
            <Select
              value={form.action_taken}
              onValueChange={(v) => setForm({ ...form, action_taken: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALL_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Call status">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CALL_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assign to">
            <Select
              value={form.assigned_to || "none"}
              onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {(staff ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Escalation">
            <Select
              value={form.escalation}
              onValueChange={(v) => setForm({ ...form, escalation: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(ESCALATION).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="followup"
              checked={form.followup_required}
              onCheckedChange={(v) => setForm({ ...form, followup_required: v === true })}
            />
            <label htmlFor="followup" className="text-sm">
              Follow-up required — create a follow-up record
            </label>
          </div>
          {form.followup_required ? (
            <Field label="Follow-up date">
              <Input
                type="date"
                value={form.followup_date}
                onChange={(e) => setForm({ ...form, followup_date: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save call"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CallsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [date, setDate] = useState("");
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["calls", category, date],
    queryFn: async () => {
      let query = supabase
        .from("calls")
        .select("*")
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false });
      if (category !== ALL) query = query.eq("category", category as never);
      if (date) {
        query = query
          .gte("occurred_at", `${date}T00:00:00.000Z`)
          .lte("occurred_at", `${date}T23:59:59.999Z`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((c) =>
    [c.caller_name, c.phone, c.reason]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  function exportCsv() {
    const header = ["Date", "Caller", "Phone", "Category", "Reason", "Action", "Status"];
    const lines = rows.map((c) =>
      [
        formatDateTime(c.occurred_at),
        c.caller_name,
        c.phone ?? "",
        CALL_CATEGORY[c.category],
        c.reason ?? "",
        c.action_taken ?? "",
        c.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `murivest-calls-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Call Log"
        description="Every call received or made by the firm, with the action taken and any follow-up."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              Export
            </Button>
            {can("calls.create") ? <LogCallDialog /> : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search caller, phone, reason…" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {optionsOf(CALL_CATEGORY).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
        {date ? (
          <Button variant="ghost" size="sm" onClick={() => setDate("")}>
            Clear date
          </Button>
        ) : null}
      </div>

      {/* Missed Call Return Queue */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Missed Call Return Queue</h2>
          <p className="text-sm text-muted-foreground">
            Missed calls that need to be returned within 15 minutes
          </p>
        </div>
        {rows.filter((c) => c.status === "missed" && !c.followup_required).length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No missed calls requiring return.</p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.filter((c) => c.status === "missed" && !c.followup_required).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{c.caller_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(c.occurred_at)} · {text(c.phone)} · {CALL_CATEGORY[c.category]}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  // Open log call dialog pre-filled with this missed call info
                  // For now, just log that it was returned
                  supabase.from("calls").update({ 
                    status: "callback pending",
                    action_taken: "Missed call returned",
                    notes: (c.notes || "") + "\n[Returned at " + new Date().toISOString() + "]"
                  }).eq("id", c.id);
                  queryClient.invalidateQueries({ queryKey: ["calls"] });
                  toast.success("Marked as returned. Log the callback details.");
                }}>
                  Mark Returned
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isLoading ? (
        <LoadingState label="Loading calls…" />
      ) : (
        <DataTable
          columns={["Date & time", "Caller", "Category", "Reason", "Action taken", "Assigned", "Status"]}
          empty={rows.length === 0}
        >
          {rows.map((c) => (
            <Row key={c.id}>
              <Cell muted className="whitespace-nowrap text-xs">
                {formatDateTime(c.occurred_at)}
              </Cell>
              <Cell>
                <p className="font-medium">{c.caller_name}</p>
                <p className="text-xs text-muted-foreground">{text(c.phone)}</p>
              </Cell>
              <Cell muted>{CALL_CATEGORY[c.category]}</Cell>
              <Cell muted className="max-w-[240px] text-xs">
                {text(c.reason)}
              </Cell>
              <Cell muted className="text-xs">
                {text(c.action_taken)}
                {c.escalation !== "none" ? (
                  <div className="mt-1">
                    <StatusBadge tone="warning">{ESCALATION[c.escalation]}</StatusBadge>
                  </div>
                ) : null}
              </Cell>
              <Cell muted>{staffName(staff, c.assigned_to)}</Cell>
              <Cell>
                <StatusBadge tone={c.status === "missed" ? "danger" : "neutral"}>
                  {c.status}
                </StatusBadge>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

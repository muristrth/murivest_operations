import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, staffName } from "@/lib/queries";
import { FOLLOWUP_STATUS, PRIORITY, optionsOf } from "@/lib/constants";
import { formatDate, friendlyError, text, todayISO } from "@/lib/format";
import {
  Cell,
  DataTable,
  Field,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
  StatCard,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_authenticated/app/followups")({
  component: FollowupsPage,
});

const ALL = "all";

function NewFollowupDialog() {
  const queryClient = useQueryClient();
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const [open, setOpen] = useState(false);
  const empty = {
    client_name: "",
    pending_action: "",
    due_date: todayISO(),
    last_contact: "",
    priority: "normal",
    assigned_to: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("followups").insert({
        client_name: form.client_name,
        pending_action: form.pending_action,
        due_date: form.due_date,
        last_contact: form.last_contact || null,
        priority: form.priority as never,
        assigned_to: form.assigned_to || auth.user?.id || null,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up created.");
      queryClient.invalidateQueries();
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to create the follow-up.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Follow-up</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add follow-up</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Client">
            <Input
              required
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            />
          </Field>
          <Field label="Due date">
            <Input
              required
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
          <Field label="Pending action" className="sm:col-span-2">
            <Input
              required
              value={form.pending_action}
              onChange={(e) => setForm({ ...form, pending_action: e.target.value })}
            />
          </Field>
          <Field label="Last contact">
            <Input
              type="date"
              value={form.last_contact}
              onChange={(e) => setForm({ ...form, last_contact: e.target.value })}
            />
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
          <Field label="Assigned to" className="sm:col-span-2">
            <Select
              value={form.assigned_to || "none"}
              onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Me" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Me</SelectItem>
                {(staff ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Create follow-up"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FollowupsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["followups", status],
    queryFn: async () => {
      let query = supabase
        .from("followups")
        .select("*")
        .is("deleted_at", null)
        .order("due_date");
      if (status !== ALL) query = query.eq("status", status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("followups")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up completed.");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update the follow-up.")),
  });

  const rows = (data ?? []).filter((f) =>
    [f.client_name, f.pending_action]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );
  const today = todayISO();
  const pending = rows.filter((f) => f.status === "pending");
  const overdue = pending.filter((f) => f.due_date < today);
  const dueToday = pending.filter((f) => f.due_date === today);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Follow-ups"
        description="Outstanding actions owed to clients and counterparties."
        actions={can("followups.create") ? <NewFollowupDialog /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Overdue" value={overdue.length} tone={overdue.length ? "destructive" : "success"} />
        <StatCard label="Due today" value={dueToday.length} tone="gold" />
        <StatCard label="Pending total" value={pending.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search client or action…" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(FOLLOWUP_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading follow-ups…" />
      ) : (
        <DataTable
          columns={["Due", "Client", "Pending action", "Assigned", "Priority", "Status", ""]}
          empty={rows.length === 0}
        >
          {rows.map((f) => {
            const isOverdue = f.status === "pending" && f.due_date < today;
            const isDueToday = f.status === "pending" && f.due_date === today;
            return (
              <Row key={f.id}>
                <Cell muted className="whitespace-nowrap text-xs">
                  {formatDate(f.due_date)}
                </Cell>
                <Cell>
                  <p className="font-medium">{f.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Last contact {formatDate(f.last_contact)}
                  </p>
                </Cell>
                <Cell muted className="text-xs">
                  {f.pending_action}
                  {f.notes ? <p className="mt-0.5">{text(f.notes)}</p> : null}
                </Cell>
                <Cell muted>{staffName(staff, f.assigned_to)}</Cell>
                <Cell>
                  <StatusBadge
                    tone={f.priority === "urgent" ? "danger" : f.priority === "high" ? "warning" : "neutral"}
                  >
                    {PRIORITY[f.priority]}
                  </StatusBadge>
                </Cell>
                <Cell>
                  <StatusBadge
                    tone={
                      f.status === "completed"
                        ? "success"
                        : isOverdue
                          ? "danger"
                          : isDueToday
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {f.status === "pending"
                      ? isOverdue
                        ? "Overdue"
                        : isDueToday
                          ? "Due Today"
                          : "Pending"
                      : FOLLOWUP_STATUS[f.status]}
                  </StatusBadge>
                </Cell>
                <Cell>
                  {f.status === "pending" && can("followups.edit") ? (
                    <Button size="sm" variant="outline" onClick={() => complete.mutate(f.id)}>
                      Complete
                    </Button>
                  ) : null}
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}

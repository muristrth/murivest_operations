import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, listCorrespondence, listPropertyOptions } from "@/lib/queries";
import {
  CORRESPONDENCE_CHANNEL,
  CORRESPONDENCE_STATUS,
  CORRESPONDENCE_TYPE,
  INQUIRY_SOURCE,
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

export const Route = createFileRoute("/_authenticated/app/correspondence")({
  component: CorrespondencePage,
});

const ALL = "all";

function NewCorrespondenceDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data: properties } = useQuery({
    queryKey: ["property-options"],
    queryFn: listPropertyOptions,
  });
  const empty = {
    type: "received",
    from_to: "",
    subject: "",
    channel: "email",
    action_required: false,
    assigned_to: "",
    due_date: "",
    status: "open",
    notes: "",
    attachment_url: "",
    related_property_id: "",
    related_inquiry_id: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("correspondence").insert({
        type: form.type as never,
        from_to: form.from_to,
        subject: form.subject || null,
        channel: form.channel as never,
        action_required: form.action_required,
        assigned_to: form.assigned_to || null,
        due_date: form.due_date || null,
        status: form.status as never,
        notes: form.notes || null,
        attachment_url: form.attachment_url || null,
        related_property_id: form.related_property_id || null,
        related_inquiry_id: form.related_inquiry_id || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correspondence recorded.");
      queryClient.invalidateQueries({ queryKey: ["correspondence"] });
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the correspondence.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Correspondence</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record correspondence</DialogTitle>
          <DialogDescription>
            Log important incoming or outgoing communications.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(CORRESPONDENCE_TYPE).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(CORRESPONDENCE_CHANNEL).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="From / To">
            <Input
              required
              value={form.from_to}
              onChange={(e) => setForm({ ...form, from_to: e.target.value })}
              placeholder="Name and organization"
            />
          </Field>
          <Field label="Subject">
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Subject line or topic"
            />
          </Field>
          <Field label="Action required">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="action_required"
                checked={form.action_required}
                onChange={(e) => setForm({ ...form, action_required: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="action_required" className="text-sm">Create follow-up task</label>
            </div>
          </Field>
          {form.action_required ? (
            <Field label="Due date">
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </Field>
          ) : null}
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
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(CORRESPONDENCE_STATUS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Related property">
            <Select
              value={form.related_property_id || "none"}
              onValueChange={(v) => setForm({ ...form, related_property_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Related inquiry">
            <Input
              value={form.related_inquiry_id}
              onChange={(e) => setForm({ ...form, related_inquiry_id: e.target.value })}
              placeholder="Inquiry ID (optional)"
            />
          </Field>
          <Field label="Attachment URL">
            <Input
              value={form.attachment_url}
              onChange={(e) => setForm({ ...form, attachment_url: e.target.value })}
              placeholder="Link to document/file"
            />
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
              {mutation.isPending ? "Saving…" : "Save correspondence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CorrespondencePage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [channel, setChannel] = useState(ALL);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["correspondence", status, channel],
    queryFn: async () => {
      let query = supabase.from("correspondence").select("*").is("deleted_at", null).order("date", { ascending: false });
      if (status !== ALL) query = query.eq("status", status);
      if (channel !== ALL) query = query.eq("channel", channel);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("correspondence").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Correspondence updated.");
      queryClient.invalidateQueries({ queryKey: ["correspondence"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update.")),
  });

  const queryClient = useQueryClient();

  const rows = (data ?? []).filter((c) =>
    [c.from_to, c.subject, c.notes]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  function staffName(staff: { id: string; full_name: string; email: string; job_title: string; active: boolean; }[] | undefined, assigned_to: string | null): import("react").ReactNode {
    if (!assigned_to) return "Unassigned";
    const assignedStaff = staff?.find((member) => member.id === assigned_to);
    return assignedStaff?.full_name || assignedStaff?.email || "Unknown staff";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Correspondence"
        description="Track important incoming and outgoing communications."
        actions={can("correspondence.create") ? <NewCorrespondenceDialog /> : null}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search from/to, subject…" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(CORRESPONDENCE_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={setChannel}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All channels</SelectItem>
            {optionsOf(CORRESPONDENCE_CHANNEL).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading correspondence…" />
      ) : (
        <DataTable
          columns={["Date", "Type", "Channel", "From / To", "Subject", "Assigned", "Status", ""]}
          empty={rows.length === 0}
        >
          {rows.map((c) => (
            <Row key={c.id}>
              <Cell muted className="whitespace-nowrap text-xs">
                {formatDateTime(c.date)}
              </Cell>
              <Cell>
                <StatusBadge tone={c.type === "received" ? "info" : "success"}>
                  {CORRESPONDENCE_TYPE[c.type as keyof typeof CORRESPONDENCE_TYPE]}
                </StatusBadge>
              </Cell>
              <Cell muted>{CORRESPONDENCE_CHANNEL[c.channel as keyof typeof CORRESPONDENCE_CHANNEL]}</Cell>
              <Cell>
                <p className="font-medium">{c.from_to}</p>
              </Cell>
              <Cell muted className="text-xs max-w-[200px]">
                {text(c.subject)}
              </Cell>
              <Cell muted>{staffName(staff, c.assigned_to)}</Cell>
              <Cell>
                {can("correspondence.edit") ? (
                  <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsOf(CORRESPONDENCE_STATUS).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge tone={c.status === "completed" || c.status === "closed" ? "success" : c.status === "in_progress" ? "warning" : "neutral"}>
                    {CORRESPONDENCE_STATUS[c.status as keyof typeof CORRESPONDENCE_STATUS]}
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
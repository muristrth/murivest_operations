import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listPropertyOptions, listStaff, staffName } from "@/lib/queries";
import {
  ESCALATION,
  INQUIRY_CATEGORY,
  INQUIRY_SOURCE,
  INQUIRY_STATUS,
  PRIORITY,
  optionsOf,
} from "@/lib/constants";
import { formatDateTime, friendlyError } from "@/lib/format";
import {
  Cell,
  DataTable,
  Field,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
  StatusBadge,
  statusTone,
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

export const Route = createFileRoute("/_authenticated/app/inquiries/")({
  component: InquiriesPage,
});

const ALL = "all";

function NewInquiryDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data: properties } = useQuery({
    queryKey: ["property-options"],
    queryFn: listPropertyOptions,
  });
  const [form, setForm] = useState({
    prospect_name: "",
    phone: "",
    email: "",
    source: "phone",
    category: "general",
    inquiry_type: "",
    property_id: "",
    service_interest: "",
    priority: "normal",
    escalation: "none",
    assigned_to: "",
    next_action: "",
    next_action_date: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("inquiries").insert({
        prospect_name: form.prospect_name,
        phone: form.phone || null,
        email: form.email || null,
        source: form.source as never,
        category: form.category as never,
        inquiry_type: form.inquiry_type || null,
        property_id: form.property_id || null,
        service_interest: form.service_interest || null,
        priority: form.priority as never,
        escalation: form.escalation as never,
        assigned_to: form.assigned_to || null,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inquiry recorded.");
      queryClient.invalidateQueries();
      setOpen(false);
      setForm({ ...form, prospect_name: "", phone: "", email: "", notes: "", next_action: "" });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the inquiry. Please try again.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ New Inquiry</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record inquiry</DialogTitle>
          <DialogDescription>
            Capture the prospect's details exactly as provided. Do not record figures that have
            not been verified.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Prospect name">
            <Input
              required
              value={form.prospect_name}
              onChange={(e) => setForm({ ...form, prospect_name: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
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
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(INQUIRY_CATEGORY).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Inquiry type">
            <Input
              placeholder="e.g. Viewing request"
              value={form.inquiry_type}
              onChange={(e) => setForm({ ...form, inquiry_type: e.target.value })}
            />
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
          <Field label="Service / interest">
            <Input
              value={form.service_interest}
              onChange={(e) => setForm({ ...form, service_interest: e.target.value })}
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
          <Field label="Next action date">
            <Input
              type="date"
              value={form.next_action_date}
              onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
            />
          </Field>
          <Field label="Next action" className="sm:col-span-2">
            <Input
              value={form.next_action}
              onChange={(e) => setForm({ ...form, next_action: e.target.value })}
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
              {mutation.isPending ? "Saving…" : "Save inquiry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InquiriesPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data, isLoading } = useQuery({
    queryKey: ["inquiries", status, source, assignee],
    queryFn: async () => {
      let query = supabase
        .from("inquiries")
        .select("*")
        .is("deleted_at", null)
        .order("received_at", { ascending: false });
      if (status !== ALL) query = query.eq("status", status as never);
      if (source !== ALL) query = query.eq("source", source as never);
      if (assignee !== ALL) query = query.eq("assigned_to", assignee);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((i) =>
    [i.prospect_name, i.phone, i.email, i.service_interest]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inquiry Register"
        description="Every inquiry received by the firm, from first contact through to conversion."
        actions={can("inquiries.create") ? <NewInquiryDialog /> : null}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone, email…" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(INQUIRY_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {optionsOf(INQUIRY_SOURCE).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading inquiries…" />
      ) : (
        <DataTable
          columns={["Received", "Prospect", "Source", "Category", "Assigned", "Priority", "Status"]}
          empty={rows.length === 0}
        >
          {rows.map((i) => (
            <Row key={i.id}>
              <Cell muted className="whitespace-nowrap text-xs">
                {formatDateTime(i.received_at)}
              </Cell>
              <Cell>
                <Link
                  to="/app/inquiries/$inquiryId"
                  params={{ inquiryId: i.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {i.prospect_name}
                </Link>
                <p className="text-xs text-muted-foreground">{i.phone || i.email || "—"}</p>
                {i.escalation !== "none" ? (
                  <StatusBadge tone="warning">{ESCALATION[i.escalation]}</StatusBadge>
                ) : null}
              </Cell>
              <Cell muted>{INQUIRY_SOURCE[i.source]}</Cell>
              <Cell muted>{INQUIRY_CATEGORY[i.category]}</Cell>
              <Cell muted>{staffName(staff, i.assigned_to)}</Cell>
              <Cell>
                <StatusBadge tone={i.priority === "urgent" ? "danger" : i.priority === "high" ? "warning" : "neutral"}>
                  {PRIORITY[i.priority]}
                </StatusBadge>
              </Cell>
              <Cell>
                <StatusBadge tone={statusTone(i.status)}>{INQUIRY_STATUS[i.status]}</StatusBadge>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

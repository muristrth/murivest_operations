import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { flushEmailQueue } from "@/lib/email-dispatch";
import { listStaff, staffName } from "@/lib/queries";
import { APPOINTMENT_FORMAT, APPOINTMENT_STATUS, optionsOf } from "@/lib/constants";
import { formatDateTime, friendlyError, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  Field,
  LoadingState,
  PageHeader,
  Panel,
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

export const Route = createFileRoute("/_authenticated/app/appointments")({
  component: AppointmentsPage,
});

const ALL = "all";

function BookAppointmentDialog() {
  const queryClient = useQueryClient();
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const [open, setOpen] = useState(false);
  const empty = {
    client_name: "",
    phone: "",
    email: "",
    purpose: "",
    scheduled_at: "",
    duration_minutes: "60",
    format: "office_meeting",
    location: "",
    attendee_id: "",
    status: "requested",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointments").insert({
        client_name: form.client_name,
        phone: form.phone || null,
        email: form.email || null,
        purpose: form.purpose || null,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 60,
        format: form.format as never,
        location: form.location || null,
        attendee_id: form.attendee_id || null,
        status: form.status as never,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment booked.");
      queryClient.invalidateQueries();
      setForm(empty);
      setOpen(false);
      void flushEmailQueue();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to book the appointment.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Book Appointment</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book appointment</DialogTitle>
          <DialogDescription>
            Confirm the purpose and the correct Murivest representative before offering times.
          </DialogDescription>
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
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Purpose">
            <Input
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </Field>
          <Field label="Date & time">
            <Input
              required
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
            />
          </Field>
          <Field label="Duration (minutes)">
            <Input
              type="number"
              min={15}
              step={15}
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            />
          </Field>
          <Field label="Format">
            <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(APPOINTMENT_FORMAT).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Murivest attendee">
            <Select
              value={form.attendee_id || "none"}
              onValueChange={(v) => setForm({ ...form, attendee_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="To be confirmed" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">To be confirmed</SelectItem>
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
                {optionsOf(APPOINTMENT_STATUS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
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
              {mutation.isPending ? "Saving…" : "Book appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [attendee, setAttendee] = useState(ALL);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["appointments", status, attendee],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("*")
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true });
      if (status !== ALL) query = query.eq("status", status as never);
      if (attendee !== ALL) query = query.eq("attendee_id", attendee);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: status as never })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment updated.");
      queryClient.invalidateQueries();
      void flushEmailQueue();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update the appointment.")),
  });

  const rows = (data ?? []).filter((a) =>
    [a.client_name, a.purpose, a.location]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Appointments"
        description="Requested, confirmed and completed meetings with clients and counterparties."
        actions={can("appointments.create") ? <BookAppointmentDialog /> : null}
      />

      <Panel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Workflow: purpose identified → representative identified → calendar checked → times
          offered → client confirms → appointment booked → written confirmation → reminder →
          attendance confirmed → outcome recorded. Confirmations and reminders are recorded here;
          the system does not send messages automatically — no messaging integration is connected.
        </p>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search client or purpose…" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(APPOINTMENT_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={attendee} onValueChange={setAttendee}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Attendee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All attendees</SelectItem>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading appointments…" />
      ) : (
        <DataTable
          columns={["Date & time", "Client", "Purpose", "Format", "Attendee", "Status"]}
          empty={rows.length === 0}
        >
          {rows.map((a) => (
            <Row key={a.id}>
              <Cell muted className="whitespace-nowrap text-xs">
                {formatDateTime(a.scheduled_at)}
                <p>{a.duration_minutes} min</p>
              </Cell>
              <Cell>
                <p className="font-medium">{a.client_name}</p>
                <p className="text-xs text-muted-foreground">{text(a.phone || a.email)}</p>
              </Cell>
              <Cell muted className="text-xs">
                {text(a.purpose)}
                <p>{text(a.location)}</p>
              </Cell>
              <Cell muted>{APPOINTMENT_FORMAT[a.format]}</Cell>
              <Cell muted>{staffName(staff, a.attendee_id)}</Cell>
              <Cell>
                {can("appointments.edit") ? (
                  <Select
                    value={a.status}
                    onValueChange={(v) => update.mutate({ id: a.id, status: v })}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsOf(APPOINTMENT_STATUS).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <StatusBadge tone={statusTone(a.status)}>
                    {APPOINTMENT_STATUS[a.status]}
                  </StatusBadge>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, staffName } from "@/lib/queries";
import { APPOINTMENT_FORMAT, APPOINTMENT_STATUS, optionsOf } from "@/lib/constants";
import { formatDateTime, friendlyError, text } from "@/lib/format";
import {
  DetailItem,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  statusTone,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const CHECKLIST_STEPS = [
  { key: "inquiry_received", label: "Inquiry received" },
  { key: "client_identified", label: "Client identified" },
  { key: "purpose_confirmed", label: "Purpose confirmed" },
  { key: "availability_checked", label: "Availability checked" },
  { key: "appointment_proposed", label: "Appointment proposed" },
  { key: "appointment_accepted", label: "Appointment accepted" },
  { key: "calendar_entry_created", label: "Calendar entry created" },
  { key: "confirmation_sent", label: "Confirmation sent" },
  { key: "reminder_sent", label: "Reminder sent" },
  { key: "appointment_completed", label: "Appointment completed" },
  { key: "outcome_recorded", label: "Outcome recorded" },
  { key: "followup_created", label: "Follow-up created" },
];

export const Route = createFileRoute("/_authenticated/app/appointments/$appointmentId")({
  component: AppointmentDetailPage,
});

function AppointmentDetailPage() {
  const { appointmentId } = useParams({ from: "/_authenticated/app/appointments/$appointmentId" });
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const { data: appointment, isLoading } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*").eq("id", appointmentId).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!appointmentId,
  });

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const [form, setForm] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        client_name: form.client_name,
        phone: form.phone || null,
        email: form.email || null,
        purpose: form.purpose || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        duration_minutes: Number(form.duration_minutes) || 60,
        format: form.format,
        location: form.location || null,
        attendee_id: form.attendee_id || null,
        status: form.status,
        notes: form.notes || null,
        checklist: checklist,
        confirmation_message: form.confirmation_message || null,
        reminder_message: form.reminder_message || null,
      };
      const { error } = await supabase.from("appointments").update(patch).eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment saved.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the appointment.")),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("appointments").update({ status: status as never }).eq("id", appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment status updated.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update status.")),
  });

  const sendConfirmation = useMutation({
    mutationFn: async () => {
      if (!appointment) return;
      const message = `Good afternoon, ${appointment.client_name}. I am calling to confirm your appointment with ${staffName(staff, appointment.attendee_id)} tomorrow at ${formatDateTime(appointment.scheduled_at).split(" ")[1]}. May I confirm it remains convenient?`;
      await supabase.from("appointments").update({ confirmation_message: message, checklist: { ...checklist, confirmation_sent: true } }).eq("id", appointmentId);
      await supabase.from("notifications").insert({
        recipient_id: appointment.attendee_id || "",
        type: "appointment_confirmation",
        title: "Appointment confirmation sent",
        body: `Confirmation sent for ${appointment.client_name}`,
        module: "appointments",
        record_id: appointmentId,
      });
      setChecklist({ ...checklist, confirmation_sent: true });
      toast.success("Confirmation message generated.");
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to send confirmation.")),
  });

  const sendReminder = useMutation({
    mutationFn: async () => {
      if (!appointment) return;
      const message = `Good afternoon, ${appointment.client_name}. This is a reminder of your appointment with ${staffName(staff, appointment.attendee_id)} tomorrow at ${formatDateTime(appointment.scheduled_at).split(" ")[1]}. Please let us know if you need to reschedule.`;
      await supabase.from("appointments").update({ reminder_message: message, checklist: { ...checklist, reminder_sent: true } }).eq("id", appointmentId);
      await supabase.from("notifications").insert({
        recipient_id: appointment.attendee_id || "",
        type: "appointment_reminder",
        title: "Appointment reminder sent",
        body: `Reminder sent for ${appointment.client_name}`,
        module: "appointments",
        record_id: appointmentId,
      });
      setChecklist({ ...checklist, reminder_sent: true });
      toast.success("Reminder message generated.");
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to send reminder.")),
  });

  const completeAppointment = useMutation({
    mutationFn: async () => {
      await supabase.from("appointments").update({ status: "completed", checklist: { ...checklist, appointment_completed: true } }).eq("id", appointmentId);
      toast.success("Appointment marked as completed.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to complete appointment.")),
  });

  if (isLoading) return <LoadingState label="Loading appointment…" />;
  if (!appointment) {
    return (
      <EmptyState message="Appointment not found" hint="This appointment may have been removed." />
    );
  }

  const input = (key: string, label: string, disabled = false) => (
    <Field label={label}>
      <Input
        disabled={disabled}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );

  const area = (key: string, label: string, disabled = false) => (
    <Field label={label} className="sm:col-span-2">
      <Textarea
        rows={3}
        disabled={disabled}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <Link to="/app/appointments" className="text-xs text-muted-foreground hover:underline">
        ← Back to appointments
      </Link>

      <PageHeader
        title={appointment.client_name}
        description={`${text(appointment.purpose)} · ${APPOINTMENT_FORMAT[appointment.format]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {can("appointments.edit") && appointment.status !== "completed" && appointment.status !== "cancelled" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("confirmed")} disabled={appointment.status === "confirmed"}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("rescheduled")} disabled={appointment.status === "rescheduled"}>
                  Reschedule
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("cancelled")} disabled={appointment.status === "cancelled"}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => completeAppointment.mutate()} disabled={completeAppointment.isPending}>
                  {completeAppointment.isPending ? "Completing…" : "Complete"}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(appointment.status)}>
          {APPOINTMENT_STATUS[appointment.status]}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          Scheduled: {formatDateTime(appointment.scheduled_at)} · {appointment.duration_minutes} min
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Appointment details" description={can("appointments.edit") ? "Editable" : "Read-only"}>
            <fieldset disabled={!can("appointments.edit")} className="grid gap-4 sm:grid-cols-2">
              {input("client_name", "Client name")}
              {input("phone", "Phone")}
              {input("email", "Email")}
              {input("purpose", "Purpose")}
              <Field label="Date & time">
                <Input
                  type="datetime-local"
                  disabled={!can("appointments.edit")}
                  value={form.scheduled_at ?? ""}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </Field>
              <Field label="Duration (minutes)">
                <Input
                  type="number"
                  min={15}
                  step={15}
                  disabled={!can("appointments.edit")}
                  value={form.duration_minutes ?? ""}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </Field>
              <Field label="Format">
                <Select
                  value={form.format ?? appointment.format}
                  onValueChange={(v) => setForm({ ...form, format: v })}
                  disabled={!can("appointments.edit")}
                >
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
              {input("location", "Location")}
              <Field label="Murivest attendee">
                <Select
                  value={form.attendee_id ?? appointment.attendee_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, attendee_id: v === "none" ? "" : v })}
                  disabled={!can("appointments.edit")}
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
                <Select
                  value={form.status ?? appointment.status}
                  onValueChange={(v) => { setForm({ ...form, status: v }); updateStatus.mutate(v); }}
                  disabled={!can("appointments.edit")}
                >
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
              {area("notes", "Notes")}
              {area("confirmation_message", "Confirmation message (generated)", true)}
              {area("reminder_message", "Reminder message (generated)", true)}
            </fieldset>
            {can("appointments.edit") ? (
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="mt-4">
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
            ) : null}
          </Panel>

          <Panel title="Booking Checklist" description="Track the 11-step booking workflow">
            <div className="space-y-2">
              {CHECKLIST_STEPS.map((step, index) => (
                <div key={step.key} className="flex items-center gap-3 p-3 bg-muted/50 rounded-sm">
                  <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                  <Checkbox
                    id={`checklist-${step.key}`}
                    checked={checklist[step.key] ?? false}
                    onCheckedChange={(v) => setChecklist({ ...checklist, [step.key]: v as boolean })}
                    disabled={!can("appointments.edit")}
                  />
                  <label htmlFor={`checklist-${step.key}`} className="text-sm font-medium cursor-pointer flex-1">
                    {step.label}
                  </label>
                  {(step.key === "confirmation_sent" || step.key === "reminder_sent") && can("appointments.edit") && (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={step.key === "confirmation_sent" ? () => sendConfirmation.mutate() : () => sendReminder.mutate()} disabled={checklist[step.key] || (step.key === "confirmation_sent" ? sendConfirmation.isPending : sendReminder.isPending)}>
                      {step.key === "confirmation_sent" ? (sendConfirmation.isPending ? "Sending…" : "Generate") : (sendReminder.isPending ? "Sending…" : "Generate")}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Progress: {Object.values(checklist).filter(Boolean).length} / {CHECKLIST_STEPS.length} steps completed
              </p>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Details">
            <DetailItem label="Attendee" value={staffName(staff, appointment.attendee_id)} />
            <DetailItem label="Format" value={APPOINTMENT_FORMAT[appointment.format]} />
            <DetailItem label="Location" value={text(appointment.location)} />
            <DetailItem label="Created by" value={staffName(appointment.created_by)} />
            <DetailItem label="Created" value={formatDateTime(appointment.created_at)} />
            {appointment.outcome && <DetailItem label="Outcome" value={text(appointment.outcome)} />}
            {appointment.next_action && <DetailItem label="Next action" value={text(appointment.next_action)} />}
          </Panel>

          {can("appointments.edit") && appointment.status === "confirmed" && !checklist.confirmation_sent && (
            <Panel title="Actions">
              <Button className="w-full" onClick={() => sendConfirmation.mutate()} disabled={sendConfirmation.isPending}>
                {sendConfirmation.isPending ? "Generating…" : "Generate Confirmation Message"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Generates the 24-hour confirmation message text for you to send manually.
              </p>
            </Panel>
          )}

          {can("appointments.edit") && (appointment.status === "confirmed" || appointment.status === "completed") && !checklist.reminder_sent && (
            <Panel title="Actions">
              <Button className="w-full" variant="outline" onClick={() => sendReminder.mutate()} disabled={sendReminder.isPending}>
                {sendReminder.isPending ? "Generating…" : "Generate Reminder Message"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Generates the 24-hour reminder message text for you to send manually.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
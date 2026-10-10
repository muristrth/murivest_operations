import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { COMPANY, ROLE_LABEL } from "@/lib/constants";
import { friendlyError, text } from "@/lib/format";
import { DetailItem, Field, PageHeader, Panel } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, role, permissions, refresh } = useAuth();
  const profileWithNotifications = profile as
    | (NonNullable<typeof profile> & {
        in_app_notifications?: boolean | null;
        email_notifications?: boolean | null;
        desktop_notifications?: boolean | null;
        notify_task_assigned?: boolean | null;
        notify_task_deadline?: boolean | null;
        notify_appointment?: boolean | null;
        notify_followup?: boolean | null;
        notify_escalation?: boolean | null;
        notify_management_message?: boolean | null;
        notify_record_correction?: boolean | null;
        notify_property_review?: boolean | null;
        notify_announcement?: boolean | null;
        notify_all_crud?: boolean | null;
      })
    | null;
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [emailNotifications, setEmailNotifications] = useState(profileWithNotifications?.email_notifications ?? true);
  const [desktopNotifications, setDesktopNotifications] = useState(profileWithNotifications?.desktop_notifications ?? true);
  const [inAppNotifications, setInAppNotifications] = useState(profileWithNotifications?.in_app_notifications ?? true);
  const [notifyTaskAssigned, setNotifyTaskAssigned] = useState(profileWithNotifications?.notify_task_assigned ?? true);
  const [notifyTaskDeadline, setNotifyTaskDeadline] = useState(profileWithNotifications?.notify_task_deadline ?? true);
  const [notifyAppointment, setNotifyAppointment] = useState(profileWithNotifications?.notify_appointment ?? true);
  const [notifyFollowup, setNotifyFollowup] = useState(profileWithNotifications?.notify_followup ?? true);
  const [notifyEscalation, setNotifyEscalation] = useState(profileWithNotifications?.notify_escalation ?? true);
  const [notifyManagementMessage, setNotifyManagementMessage] = useState(profileWithNotifications?.notify_management_message ?? true);
  const [notifyRecordCorrection, setNotifyRecordCorrection] = useState(profileWithNotifications?.notify_record_correction ?? true);
  const [notifyPropertyReview, setNotifyPropertyReview] = useState(profileWithNotifications?.notify_property_review ?? true);
  const [notifyAnnouncement, setNotifyAnnouncement] = useState(profileWithNotifications?.notify_announcement ?? true);
  const [notifyAllCrud, setNotifyAllCrud] = useState(profileWithNotifications?.notify_all_crud ?? false);

  const save = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile loaded.");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          job_title: jobTitle,
          phone: phone || null,
          email_notifications: emailNotifications,
          desktop_notifications: desktopNotifications,
          in_app_notifications: inAppNotifications,
          notify_task_assigned: notifyTaskAssigned,
          notify_task_deadline: notifyTaskDeadline,
          notify_appointment: notifyAppointment,
          notify_followup: notifyFollowup,
          notify_escalation: notifyEscalation,
          notify_management_message: notifyManagementMessage,
          notify_record_correction: notifyRecordCorrection,
          notify_property_review: notifyPropertyReview,
          notify_announcement: notifyAnnouncement,
          notify_all_crud: notifyAllCrud,
        })
        .eq("id", profile.id);
      if (error) throw error;
      await refresh();
    },
    onSuccess: () => toast.success("Settings saved."),
    onError: (e) => toast.error(friendlyError(e, "Unable to update settings.")),
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your profile, role, access and notification preferences." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="My profile">
          <div className="grid gap-4">
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Job title">
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <DetailItem label="Email" value={text(profile?.email)} />
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-fit">
              {save.isPending ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </Panel>

        <Panel title="Notification Preferences" description="Choose how and when you want to be notified.">
          <div className="space-y-4">
            <div className="border-b border-border pb-4">
              <h4 className="font-medium mb-3">Delivery Methods</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="emailNotifications"
                      checked={emailNotifications}
                      onCheckedChange={(checked) => setEmailNotifications(checked === true)}
                    />
                    <label htmlFor="emailNotifications" className="text-sm">Email</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="desktopNotifications"
                      checked={desktopNotifications}
                      onCheckedChange={(checked) => setDesktopNotifications(checked === true)}
                    />
                    <label htmlFor="desktopNotifications" className="text-sm">Desktop/Browser</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="inAppNotifications"
                      checked={inAppNotifications}
                      onCheckedChange={(checked) => setInAppNotifications(checked === true)}
                    />
                    <label htmlFor="inAppNotifications" className="text-sm">In-App</label>
                  </div>
                </Field>
              </div>
            </div>

            <div className="border-b border-border pb-4">
              <h4 className="font-medium mb-3">Task Notifications</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyTaskAssigned"
                      checked={notifyTaskAssigned}
                      onCheckedChange={(checked) => setNotifyTaskAssigned(checked === true)}
                    />
                    <label htmlFor="notifyTaskAssigned" className="text-sm">New task assigned</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyTaskDeadline"
                      checked={notifyTaskDeadline}
                      onCheckedChange={(checked) => setNotifyTaskDeadline(checked === true)}
                    />
                    <label htmlFor="notifyTaskDeadline" className="text-sm">Task deadline approaching/overdue</label>
                  </div>
                </Field>
              </div>
            </div>

            <div className="border-b border-border pb-4">
              <h4 className="font-medium mb-3">Operational Notifications</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyAppointment"
                      checked={notifyAppointment}
                      onCheckedChange={(checked) => setNotifyAppointment(checked === true)}
                    />
                    <label htmlFor="notifyAppointment" className="text-sm">Appointment reminders</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyFollowup"
                      checked={notifyFollowup}
                      onCheckedChange={(checked) => setNotifyFollowup(checked === true)}
                    />
                    <label htmlFor="notifyFollowup" className="text-sm">Follow-up due/overdue</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyEscalation"
                      checked={notifyEscalation}
                      onCheckedChange={(checked) => setNotifyEscalation(checked === true)}
                    />
                    <label htmlFor="notifyEscalation" className="text-sm">Escalation assigned/resolved</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyManagementMessage"
                      checked={notifyManagementMessage}
                      onCheckedChange={(checked) => setNotifyManagementMessage(checked === true)}
                    />
                    <label htmlFor="notifyManagementMessage" className="text-sm">Management messages</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyRecordCorrection"
                      checked={notifyRecordCorrection}
                      onCheckedChange={(checked) => setNotifyRecordCorrection(checked === true)}
                    />
                    <label htmlFor="notifyRecordCorrection" className="text-sm">Record returned for correction</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyPropertyReview"
                      checked={notifyPropertyReview}
                      onCheckedChange={(checked) => setNotifyPropertyReview(checked === true)}
                    />
                    <label htmlFor="notifyPropertyReview" className="text-sm">Property review assigned</label>
                  </div>
                </Field>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyAnnouncement"
                      checked={notifyAnnouncement}
                      onCheckedChange={(checked) => setNotifyAnnouncement(checked === true)}
                    />
                    <label htmlFor="notifyAnnouncement" className="text-sm">Internal announcements</label>
                  </div>
                </Field>
              </div>
            </div>

            {role === "managing_director" && (
              <div>
                <h4 className="font-medium mb-3">Managing Director Options</h4>
                <Field label="">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="notifyAllCrud"
                      checked={notifyAllCrud}
                      onCheckedChange={(checked) => setNotifyAllCrud(checked === true)}
                    />
                    <label htmlFor="notifyAllCrud" className="text-sm">
                      Receive email for ALL record creates, edits, archives and deletions (full audit trail)
                    </label>
                  </div>
                </Field>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Access" description="Permissions are enforced by the server, not the screen.">
          <DetailItem label="Role" value={role ? ROLE_LABEL[role] : "Not assigned"} />
          <div className="mt-3">
            <p className="label-caps text-muted-foreground">Permissions</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {permissions.length === 0 ? (
                <span className="text-xs text-muted-foreground">No permissions assigned.</span>
              ) : (
                permissions.map((p) => (
                  <span
                    key={p}
                    className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {p}
                  </span>
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Organisation">
          <DetailItem label="Company" value={COMPANY.name} />
          <DetailItem label="System" value={COMPANY.system} />
          <DetailItem label="Scope" value={COMPANY.subtitle} />
        </Panel>
      </div>
    </div>
  );
}

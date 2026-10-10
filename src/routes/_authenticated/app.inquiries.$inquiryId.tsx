import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, staffName } from "@/lib/queries";
import {
  ESCALATION,
  ESCALATION_CATEGORY,
  INQUIRY_CATEGORY,
  INQUIRY_SOURCE,
  INQUIRY_STATUS,
  PRIORITY,
  optionsOf,
} from "@/lib/constants";
import { formatDate, formatDateTime, friendlyError, text } from "@/lib/format";
import {
  DetailItem,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  statusTone,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/inquiries/$inquiryId")({
  component: InquiryDetail,
});

function InquiryDetail() {
  const { inquiryId } = Route.useParams();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalationForm, setEscalationForm] = useState({
    category: "other",
    reason: "",
    priority: "high",
  });

  const { data: inquiry, isLoading } = useQuery({
    queryKey: ["inquiry", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select("*, properties(id, name)")
        .eq("id", inquiryId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["inquiry-timeline", inquiryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("module", "inquiries")
        .eq("record_id", inquiryId)
        .order("created_at", { ascending: false });
      if (error) return [];
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      if (!inquiry) throw new Error("Inquiry could not be found.");
      const { data: auth } = await supabase.auth.getUser();
      
      // Mandatory escalation check: prevent closing sensitive matters without escalation
      if (patch["status"] && ["closed", "nurture", "converted"].includes(patch["status"] as string)) {
        const sensitiveCategories = ["complaint", "negotiation", "valuation", "legal", "investment_advice"];
        const sensitiveEscalations = ["requires_md", "requires_management_decision", "urgent"];
        
        // Check if this inquiry has sensitive characteristics
        const isSensitive = 
          (inquiry.category && sensitiveCategories.includes(inquiry.category)) ||
          (inquiry.escalation && sensitiveEscalations.includes(inquiry.escalation));
        
        if (isSensitive && inquiry.escalation === "none") {
          throw new Error("This matter requires escalation to management before it can be closed. Please use the 'Escalate to MD' button first.");
        }
      }
      
      const { error } = await supabase
        .from("inquiries")
        .update({ ...patch, updated_by: auth.user?.id ?? null })
        .eq("id", inquiryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inquiry updated.");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update the inquiry.")),
  });

  const escalate = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("escalations").insert({
        related_module: "inquiries",
        related_record_id: inquiryId,
        reason: escalationForm.reason,
        category: escalationForm.category as never,
        priority: escalationForm.priority as never,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      // Also update inquiry escalation level
      await supabase.from("inquiries").update({ escalation: "requires_md" }).eq("id", inquiryId);
    },
    onSuccess: () => {
      toast.success("Escalation created. Managing Director notified.");
      queryClient.invalidateQueries({ queryKey: ["escalations"] });
      queryClient.invalidateQueries({ queryKey: ["inquiry", inquiryId] });
      setEscalateOpen(false);
      setEscalationForm({ category: "other", reason: "", priority: "high" });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to create escalation.")),
  });

  if (isLoading) return <LoadingState label="Loading inquiry…" />;
  if (!inquiry) return <EmptyState message="This inquiry could not be found." />;

  const editable = can("inquiries.edit");

  return (
    <div className="space-y-5">
      <PageHeader
        title={inquiry.prospect_name}
        description={`Inquiry received ${formatDateTime(inquiry.received_at)} via ${INQUIRY_SOURCE[inquiry.source]}`}
        actions={
          <>
            {can("escalations.create") && inquiry.escalation !== "requires_md" && (
              <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive">Escalate to MD</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Escalate to Managing Director</DialogTitle>
                    <DialogDescription>
                      This will create an escalation record and immediately notify the Managing Director.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      escalate.mutate();
                    }}
                  >
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select value={escalationForm.category} onValueChange={(v) => setEscalationForm({ ...escalationForm, category: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="pricing">Pricing</SelectItem>
                          <SelectItem value="valuation">Valuation</SelectItem>
                          <SelectItem value="complaint">Complaint</SelectItem>
                          <SelectItem value="legal">Legal</SelectItem>
                          <SelectItem value="confidential">Confidential Matter</SelectItem>
                          <SelectItem value="investment_advice">Investment Advice</SelectItem>
                          <SelectItem value="major_client">Major Client</SelectItem>
                          <SelectItem value="institutional">Institutional Opportunity</SelectItem>
                          <SelectItem value="transaction">Transaction Issue</SelectItem>
                          <SelectItem value="media">Media/Public Relations</SelectItem>
                          <SelectItem value="unusual">Unusual Request</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Priority</label>
                      <Select value={escalationForm.priority} onValueChange={(v) => setEscalationForm({ ...escalationForm, priority: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <label className="text-sm font-medium">Reason / Details</label>
                      <Textarea
                        required
                        rows={4}
                        value={escalationForm.reason}
                        onChange={(e) => setEscalationForm({ ...escalationForm, reason: e.target.value })}
                        placeholder="Describe why this requires management attention..."
                      />
                    </div>
                    <DialogFooter className="sm:col-span-2">
                      <Button type="submit" disabled={escalate.isPending} variant="destructive">
                        {escalate.isPending ? "Escalating…" : "Escalate to MD"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to="/app/inquiries">Back to register</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Prospect" className="lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <DetailItem label="Phone" value={text(inquiry.phone)} />
            <DetailItem label="Email" value={text(inquiry.email)} />
            <DetailItem label="Category" value={INQUIRY_CATEGORY[inquiry.category]} />
            <DetailItem label="Inquiry type" value={text(inquiry.inquiry_type)} />
            <DetailItem label="Service / interest" value={text(inquiry.service_interest)} />
            <DetailItem
              label="Property"
              value={
                inquiry.properties ? (
                  <Link
                    to="/app/properties/$propertyId"
                    params={{ propertyId: inquiry.properties.id }}
                    className="underline-offset-4 hover:underline"
                  >
                    {inquiry.properties.name}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <DetailItem label="Next action" value={text(inquiry.next_action)} />
            <DetailItem label="Next action date" value={formatDate(inquiry.next_action_date)} />
            <DetailItem label="Created" value={formatDateTime(inquiry.created_at)} />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <p className="label-caps">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {text(inquiry.notes)}
            </p>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Workflow">
            <div className="space-y-3">
              <div>
                <p className="label-caps mb-1.5">Status</p>
                <Select
                  disabled={!editable}
                  value={inquiry.status}
                  onValueChange={(v) => update.mutate({ status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsOf(INQUIRY_STATUS).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="label-caps mb-1.5">Priority</p>
                <Select
                  disabled={!editable}
                  value={inquiry.priority}
                  onValueChange={(v) => update.mutate({ priority: v })}
                >
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
              </div>
              <div>
                <p className="label-caps mb-1.5">Escalation</p>
                <Select
                  disabled={!editable}
                  value={inquiry.escalation}
                  onValueChange={(v) => update.mutate({ escalation: v })}
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
              </div>
              <div>
                <p className="label-caps mb-1.5">Assigned to</p>
                {can("inquiries.assign") ? (
                  <Select
                    value={inquiry.assigned_to ?? "none"}
                    onValueChange={(v) => update.mutate({ assigned_to: v === "none" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
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
                ) : (
                  <p className="text-sm">{staffName(staff, inquiry.assigned_to)}</p>
                )}
              </div>
              <StatusBadge tone={statusTone(inquiry.status)}>
                {INQUIRY_STATUS[inquiry.status]}
              </StatusBadge>
            </div>
          </Panel>

          <Panel title="Activity timeline">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recorded activity.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gold" />
                    <p className="text-sm">{t.action}</p>
                    {t.previous_value || t.new_value ? (
                      <p className="text-xs text-muted-foreground">
                        {t.previous_value ?? "—"} → {t.new_value ?? "—"}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

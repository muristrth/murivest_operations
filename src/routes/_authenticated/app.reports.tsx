import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { flushEmailQueue } from "@/lib/email-dispatch";
import { useAuth } from "@/lib/auth";
import { endOfTodayISO, formatDate, friendlyError, startOfTodayISO, text, todayISO } from "@/lib/format";
import { Field, LoadingState, PageHeader, Panel, StatCard } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [developments, setDevelopments] = useState("");
  const [mdAttention, setMdAttention] = useState("");
  const [priorities, setPriorities] = useState("");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["report-metrics"],
    queryFn: async () => {
      const from = startOfTodayISO();
      const to = endOfTodayISO();
      const countOf = async (
        table: "inquiries" | "calls" | "appointments" | "followups",
        column: string,
      ) => {
        const { count, error } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .gte(column, from)
          .lte(column, to);
        if (error) throw error;
        return count ?? 0;
      };
      const [inquiries, calls, appointments] = await Promise.all([
        countOf("inquiries", "created_at"),
        countOf("calls", "created_at"),
        countOf("appointments", "scheduled_at"),
      ]);
      const { count: pending } = await supabase
        .from("followups")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return { inquiries, calls, appointments, pending: pending ?? 0 };
    },
  });

  const { data: reports } = useQuery({
    queryKey: ["daily-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reports")
        .select("*")
        .order("report_date", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("daily_reports").insert({
        report_date: todayISO(),
        metrics: metrics ?? {},
        developments: developments || null,
        md_attention: mdAttention || null,
        priorities_tomorrow: priorities || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Daily report submitted.");
      setDevelopments("");
      setMdAttention("");
      setPriorities("");
      queryClient.invalidateQueries();
      void flushEmailQueue();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to submit the report.")),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily Reports"
        description="End-of-day summary of activity, developments and matters for the Managing Director."
      />

      {isLoading ? (
        <LoadingState label="Calculating today's figures…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Inquiries today" value={metrics?.inquiries ?? 0} />
          <StatCard label="Calls today" value={metrics?.calls ?? 0} />
          <StatCard label="Appointments today" value={metrics?.appointments ?? 0} />
          <StatCard label="Pending follow-ups" value={metrics?.pending ?? 0} tone="gold" />
        </div>
      )}

      {can("reports.create") ? (
        <Panel title={`Report for ${formatDate(todayISO())}`}>
          <div className="grid gap-4">
            <Field label="Developments and outcomes">
              <Textarea
                rows={3}
                value={developments}
                onChange={(e) => setDevelopments(e.target.value)}
              />
            </Field>
            <Field label="Matters requiring MD attention">
              <Textarea rows={3} value={mdAttention} onChange={(e) => setMdAttention(e.target.value)} />
            </Field>
            <Field label="Priorities for tomorrow">
              <Textarea rows={3} value={priorities} onChange={(e) => setPriorities(e.target.value)} />
            </Field>
            <Button className="w-fit" onClick={() => submit.mutate()} disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit daily report"}
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel title="Submitted reports">
        {(reports ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No reports submitted yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(reports ?? []).map((r) => (
              <li key={r.id} className="py-3">
                <p className="text-sm font-medium text-foreground">{formatDate(r.report_date)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{text(r.developments)}</p>
                {r.md_attention ? (
                  <p className="mt-1 text-xs text-foreground">MD attention: {r.md_attention}</p>
                ) : null}
                {r.priorities_tomorrow ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tomorrow: {r.priorities_tomorrow}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

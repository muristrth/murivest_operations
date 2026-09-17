import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, INQUIRY_STATUS, INQUIRY_SOURCE, PROPERTY_STATUS, TASK_STATUS, PRIORITY } from "@/lib/constants";
import {
  endOfTodayISO,
  formatDateTime,
  formatTime,
  startOfTodayISO,
  todayISO,
} from "@/lib/format";
import {
  EmptyState,
  LoadingState,
  Panel,
  PageHeader,
  StatCard,
  StatusBadge,
  statusTone,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  component: DashboardPage,
});

async function count(
  table: "inquiries" | "calls" | "appointments" | "followups" | "properties" | "tasks",
  build: (q: any) => any,
) {
  const query = build(supabase.from(table).select("id", { count: "exact", head: true }));
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
}

function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = todayISO();
      const start = startOfTodayISO();
      const end = endOfTodayISO();
      const user = (await supabase.auth.getUser()).data.user;

      const [
        newInquiries,
        websiteInquiries,
        jijiInquiries,
        callsToday,
        missedCallsToday,
        appointmentsToday,
        upcomingAppointments,
        followupsDue,
        followupsOverdue,
        escalated,
        propertiesActive,
        propertiesPublished,
        propertiesReview,
        propertiesNeedsCorrection,
        propertiesAwaitingInfo,
        propertiesVerified,
        myTasksTotal,
        myTasksOverdue,
        myTasksDueToday,
        myTasksInProgress,
      ] = await Promise.all([
        count("inquiries", (q) => q.eq("status", "new").is("deleted_at", null)),
        count("inquiries", (q) => q.eq("source", "website").is("deleted_at", null)),
        count("inquiries", (q) => q.eq("source", "jiji").is("deleted_at", null)),
        count("calls", (q) => q.gte("occurred_at", start).lte("occurred_at", end)),
        count("calls", (q) =>
          q.eq("status", "missed").gte("occurred_at", start).lte("occurred_at", end),
        ),
        count("appointments", (q) =>
          q.gte("scheduled_at", start).lte("scheduled_at", end).is("deleted_at", null),
        ),
        count("appointments", (q) =>
          q.gt("scheduled_at", end).is("deleted_at", null).neq("status", "cancelled"),
        ),
        count("followups", (q) => q.eq("status", "pending").eq("due_date", today)),
        count("followups", (q) => q.eq("status", "pending").lt("due_date", today)),
        count("inquiries", (q) => q.neq("escalation", "none").is("deleted_at", null)),
        count("properties", (q) => q.is("deleted_at", null).neq("status", "archived")),
        count("properties", (q) => q.eq("status", "published")),
        count("properties", (q) => q.eq("status", "internal_review")),
        count("properties", (q) => q.eq("review_status", "needs_correction")),
        count("properties", (q) => q.eq("review_status", "awaiting_information")),
        count("properties", (q) => q.eq("review_status", "verified")),
        // My tasks counts
        user
          ? count("tasks", (q) =>
              q.eq("assigned_to", user.id).is("deleted_at", null).neq("status", "completed").neq("status", "cancelled")
            )
          : Promise.resolve(0),
        user
          ? count("tasks", (q) =>
              q
                .eq("assigned_to", user.id)
                .is("deleted_at", null)
                .neq("status", "completed")
                .neq("status", "cancelled")
                .lt("due_date", today)
            )
          : Promise.resolve(0),
        user
          ? count("tasks", (q) =>
              q
                .eq("assigned_to", user.id)
                .is("deleted_at", null)
                .neq("status", "completed")
                .neq("status", "cancelled")
                .eq("due_date", today)
            )
          : Promise.resolve(0),
        user
          ? count("tasks", (q) =>
              q
                .eq("assigned_to", user.id)
                .is("deleted_at", null)
                .eq("status", "in_progress")
            )
          : Promise.resolve(0),
      ]);

      const [recentInquiries, todaysAppointments, overdue, activity, reviewQueue, myTasks] =
        await Promise.all([
          supabase
            .from("inquiries")
            .select("id, prospect_name, source, status, priority, received_at")
            .is("deleted_at", null)
            .order("received_at", { ascending: false })
            .limit(6),
          supabase
            .from("appointments")
            .select("id, client_name, purpose, scheduled_at, status, format")
            .gte("scheduled_at", start)
            .lte("scheduled_at", end)
            .is("deleted_at", null)
            .order("scheduled_at"),
          supabase
            .from("followups")
            .select("id, client_name, pending_action, due_date, priority")
            .eq("status", "pending")
            .lte("due_date", today)
            .order("due_date")
            .limit(6),
          supabase
            .from("audit_logs")
            .select("id, action, module, record_label, created_at")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("properties")
            .select("id, name, status, review_status, location")
            .in("status", ["internal_review", "needs_update", "draft"])
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
            .limit(6),
          user
            ? supabase
                .from("tasks")
                .select("id, title, status, priority, due_date, related_client")
                .eq("assigned_to", user.id)
                .is("deleted_at", null)
                .neq("status", "completed")
                .neq("status", "cancelled")
                .order("due_date", { ascending: true })
                .limit(6)
            : Promise.resolve({ data: [] }),
        ]);

      return {
        counts: {
          newInquiries,
          websiteInquiries,
          jijiInquiries,
          callsToday,
          missedCallsToday,
          appointmentsToday,
          upcomingAppointments,
          followupsDue,
          followupsOverdue,
          escalated,
          propertiesActive,
          propertiesPublished,
          propertiesReview,
          propertiesNeedsCorrection,
          propertiesAwaitingInfo,
          propertiesVerified,
          myTasksTotal,
          myTasksOverdue,
          myTasksDueToday,
          myTasksInProgress,
        },
        recentInquiries: recentInquiries.data ?? [],
        todaysAppointments: todaysAppointments.data ?? [],
        overdue: overdue.data ?? [],
        activity: activity.data ?? [],
        reviewQueue: reviewQueue.data ?? [],
        myTasks: myTasks.data ?? [],
      };
    },
  });
}

function QuickActions() {
  const { can } = useAuth();
  const actions = [
    { to: "/app/inquiries", label: "New Inquiry", permission: "inquiries.create" },
    { to: "/app/calls", label: "Log Call", permission: "calls.create" },
    { to: "/app/appointments", label: "Book Appointment", permission: "appointments.create" },
    { to: "/app/followups", label: "Add Follow-up", permission: "followups.create" },
    { to: "/app/contacts", label: "Add Contact", permission: "contacts.create" },
  ].filter((a) => can(a.permission));
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.to} asChild variant="outline" size="sm">
          <Link to={a.to}>+ {a.label}</Link>
        </Button>
      ))}
    </div>
  );
}

function DashboardPage() {
  const { profile, role, can } = useAuth();
  const { data, isLoading, error } = useDashboardData();

  if (isLoading) return <LoadingState label="Loading dashboard…" />;
  if (error || !data)
    return <EmptyState message="Unable to load the dashboard." hint="Please refresh the page." />;

  const c = data.counts;
  const isMD = role === "managing_director";
  const isAdvisor = role === "capital_advisor";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${profile?.full_name?.split(" ")[0] || "colleague"}`}
        description={`${role ? ROLE_LABEL[role] : ""} — ${
          isMD
            ? "Executive overview of firm-wide operations."
            : isAdvisor
              ? "Property quality control and capital advisory workload."
              : "Today's secretariat workload and priorities."
        }`}
        actions={<QuickActions />}
      />

      {isAdvisor ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Requiring review" value={c.propertiesReview} tone="gold" />
          <StatCard label="Needs correction" value={c.propertiesNeedsCorrection} tone="warning" />
          <StatCard label="Awaiting information" value={c.propertiesAwaitingInfo} />
          <StatCard label="Verified" value={c.propertiesVerified} tone="success" />
          <StatCard label="Published" value={c.propertiesPublished} tone="success" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="New inquiries" value={c.newInquiries} tone="gold" />
          <StatCard
            label="Calls today"
            value={c.callsToday}
            hint={`${c.missedCallsToday} missed`}
          />
          <StatCard
            label="Appointments today"
            value={c.appointmentsToday}
            hint={`${c.upcomingAppointments} upcoming`}
          />
          <StatCard
            label="Overdue follow-ups"
            value={c.followupsOverdue}
            tone={c.followupsOverdue > 0 ? "destructive" : "success"}
            hint={`${c.followupsDue} due today`}
          />
          <StatCard label="Website inquiries" value={c.websiteInquiries} />
          <StatCard label="Jiji inquiries" value={c.jijiInquiries} />
          <StatCard label="Escalated matters" value={c.escalated} tone="warning" />
          {isMD ? (
            <StatCard
              label="Properties requiring review"
              value={c.propertiesReview}
              hint={`${c.propertiesActive} active · ${c.propertiesPublished} published`}
            />
          ) : (
            <StatCard
              label="Published properties"
              value={c.propertiesPublished}
              hint="Approved information you may share"
            />
          )}
        </div>
      )}

      {/* My Tasks section for all roles */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My Tasks"
          value={c.myTasksTotal}
          tone={c.myTasksOverdue > 0 ? "destructive" : c.myTasksDueToday > 0 ? "warning" : "success"}
          hint={`${c.myTasksOverdue} overdue · ${c.myTasksDueToday} due today · ${c.myTasksInProgress} in progress`}
        />
        <StatCard label="Overdue" value={c.myTasksOverdue} tone={c.myTasksOverdue > 0 ? "destructive" : "success"} />
        <StatCard label="Due Today" value={c.myTasksDueToday} tone={c.myTasksDueToday > 0 ? "warning" : "success"} />
        <StatCard label="In Progress" value={c.myTasksInProgress} tone="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Today's appointments" description="Scheduled for today">
          {data.todaysAppointments.length === 0 ? (
            <EmptyState message="No appointments scheduled for today." />
          ) : (
            <ul className="divide-y divide-border">
              {data.todaysAppointments.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{a.client_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(a.scheduled_at)} · {a.purpose || "Purpose not recorded"}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(a.status)}>
                    {a.status.replace(/_/g, " ")}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Follow-ups requiring attention" description="Due today or overdue">
          {data.overdue.length === 0 ? (
            <EmptyState message="No overdue follow-ups." />
          ) : (
            <ul className="divide-y divide-border">
              {data.overdue.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{f.client_name}</p>
                    <p className="text-xs text-muted-foreground">{f.pending_action}</p>
                  </div>
                  <StatusBadge tone={f.due_date < todayISO() ? "danger" : "warning"}>
                    {f.due_date}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="My Tasks"
          description="Tasks assigned to you"
          actions={
            <Button asChild size="sm" variant="ghost">
              <Link to="/app/tasks">Open tasks</Link>
            </Button>
          }
        >
          {data.myTasks.length === 0 ? (
            <EmptyState message="No tasks assigned to you." />
          ) : (
            <ul className="divide-y divide-border">
              {data.myTasks.map((t) => {
                const isOverdue = t.due_date && t.due_date < todayISO();
                const isDueToday = t.due_date === todayISO();
                return (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <Link
                        to="/app/tasks/$taskId"
                        params={{ taskId: t.id }}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {t.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {t.related_client ? `${t.related_client} · ` : ""}
                        {TASK_STATUS[t.status]}
                        {t.priority !== "normal" && ` · ${PRIORITY[t.priority]}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.due_date && (
                        <StatusBadge tone={isOverdue ? "danger" : isDueToday ? "warning" : "neutral"} className="text-[10px]">
                          {formatDate(t.due_date)}
                        </StatusBadge>
                      )}
                      <StatusBadge tone={statusTone(t.status)} className="text-[10px]">
                        {TASK_STATUS[t.status]}
                      </StatusBadge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {can("properties.review") || isMD ? (
          <Panel
            title="Property review queue"
            description="Drafts and properties awaiting verification"
            actions={
              <Button asChild size="sm" variant="ghost">
                <Link to="/app/properties">Open properties</Link>
              </Button>
            }
          >
            {data.reviewQueue.length === 0 ? (
              <EmptyState message="No properties require review." />
            ) : (
              <ul className="divide-y divide-border">
                {data.reviewQueue.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <Link
                        to="/app/properties/$propertyId"
                        params={{ propertyId: p.id }}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{p.location || "—"}</p>
                    </div>
                    <StatusBadge tone={statusTone(p.status)}>
                      {PROPERTY_STATUS[p.status]}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ) : null}

        <Panel title="Recent inquiries">
          {data.recentInquiries.length === 0 ? (
            <EmptyState message="No new inquiries." />
          ) : (
            <ul className="divide-y divide-border">
              {data.recentInquiries.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <Link
                      to="/app/inquiries/$inquiryId"
                      params={{ inquiryId: i.id }}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {i.prospect_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {INQUIRY_SOURCE[i.source]} · {formatDateTime(i.received_at)}
                    </p>
                  </div>
                  <StatusBadge tone={statusTone(i.status)}>
                    {INQUIRY_STATUS[i.status]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {can("audit.view") ? (
          <Panel title="Recent activity" className="lg:col-span-2">
            {data.activity.length === 0 ? (
              <EmptyState message="No recorded activity yet." />
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {data.activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-gold" />
                    <p className="text-sm text-foreground">
                      {a.action}
                      {a.record_label ? ` — ${a.record_label}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.module} · {formatDateTime(a.created_at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, friendlyError, text } from "@/lib/format";
import { EmptyState, LoadingState, PageHeader, Panel } from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update notifications.")),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Assignments, escalations, review outcomes and system alerts."
        actions={
          <Button size="sm" variant="outline" onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        }
      />
      {isLoading ? (
        <LoadingState label="Loading notifications…" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState message="No notifications yet" />
      ) : (
        <Panel>
          <ul className="divide-y divide-border">
            {(data ?? []).map((n) => (
              <li key={n.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{text(n.body)}</p>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

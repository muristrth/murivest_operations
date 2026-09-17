import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL, optionsOf } from "@/lib/constants";
import { formatDate, friendlyError, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  LoadingState,
  PageHeader,
  Panel,
  Row,
  StatusBadge,
} from "@/components/app/ui-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles, error }, { data: roles, error: roleError }] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw error;
      if (roleError) throw roleError;
      return (profiles ?? []).map((p) => ({
        ...p,
        role: roles?.find((r) => r.user_id === p.id)?.role ?? null,
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase.rpc("set_user_role", {
        _user_id: userId,
        _role: role as never,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated.");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to change the role.")),
  });

  const canManage = can("users.manage");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users & Roles"
        description="Staff accounts and the role that determines what each person can see and do."
      />

      <Panel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Roles are enforced in the database. Changing a role here immediately changes what that
          person can read and write, including confidential property information.
        </p>
      </Panel>

      {isLoading ? (
        <LoadingState label="Loading users…" />
      ) : (
        <DataTable
          columns={["Name", "Email", "Job title", "Joined", "Status", "Role"]}
          empty={(data ?? []).length === 0}
        >
          {(data ?? []).map((u) => (
            <Row key={u.id}>
              <Cell>
                <p className="font-medium">{text(u.full_name)}</p>
              </Cell>
              <Cell muted>{u.email}</Cell>
              <Cell muted>{text(u.job_title)}</Cell>
              <Cell muted>{formatDate(u.created_at)}</Cell>
              <Cell>
                <StatusBadge tone={u.active ? "success" : "neutral"}>
                  {u.active ? "Active" : "Inactive"}
                </StatusBadge>
              </Cell>
              <Cell>
                {canManage ? (
                  <Select
                    value={u.role ?? "none"}
                    onValueChange={(v) => setRole.mutate({ userId: u.id, role: v })}
                  >
                    <SelectTrigger className="h-8 w-64 text-xs">
                      <SelectValue placeholder="No role" />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsOf(ROLE_LABEL).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {u.role ? ROLE_LABEL[u.role] : "No role"}
                  </span>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

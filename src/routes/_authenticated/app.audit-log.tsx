import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { listStaff, staffName } from "@/lib/queries";
import { formatDateTime, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
} from "@/components/app/ui-kit";

export const Route = createFileRoute("/_authenticated/app/audit-log")({
  component: AuditLogPage,
});

function AuditLogPage() {
  const [search, setSearch] = useState("");
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((a) =>
    [a.action, a.module, a.record_label, a.field]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Log"
        description="Immutable record of who changed what, and when."
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search action, module, record…" />
      {isLoading ? (
        <LoadingState label="Loading audit trail…" />
      ) : (
        <DataTable
          columns={["When", "User", "Module", "Action", "Record", "Change"]}
          empty={rows.length === 0}
        >
          {rows.map((a) => (
            <Row key={a.id}>
              <Cell muted className="whitespace-nowrap text-xs">
                {formatDateTime(a.created_at)}
              </Cell>
              <Cell muted>{staffName(staff, a.user_id)}</Cell>
              <Cell muted>{a.module}</Cell>
              <Cell>{a.action}</Cell>
              <Cell muted>{text(a.record_label)}</Cell>
              <Cell muted className="text-xs">
                {a.field ? `${a.field}: ${text(a.previous_value)} → ${text(a.new_value)}` : "—"}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

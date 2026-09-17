import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { LoadingState, PageHeader, Panel, SearchInput } from "@/components/app/ui-kit";

export const Route = createFileRoute("/_authenticated/app/scripts")({
  component: ScriptsPage,
});

function ScriptsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["call-scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_scripts")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((s) =>
    [s.title, s.category, s.body].some((v) => v.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Call Scripts"
        description="Approved Murivest language for greetings, qualification, handling and escalation."
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search scripts…" />
      {isLoading ? (
        <LoadingState label="Loading scripts…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((s) => (
            <Panel key={s.id} title={s.title} description={s.category}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{s.body}</p>
              {s.guidance ? (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  {s.guidance}
                </p>
              ) : null}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

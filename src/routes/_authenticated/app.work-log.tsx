import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  MASTER_DB_STATUS,
  PUBLISH_COUNTRIES,
  PUBLISH_PLATFORMS,
  PUBLISH_PROPERTY_TYPES,
  STUDIO_URL,
  WORK_LOG_STATUS,
  optionsOf,
  type MasterDbStatus,
  type WorkLogStatus,
} from "@/lib/constants";
import { formatDate, formatMoney, friendlyError, text, todayISO } from "@/lib/format";
import { listPropertyOptions, listRateCard, listStaff, listWorkLog, staffName } from "@/lib/queries";
import {
  Cell,
  DataTable,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Row,
  SearchInput,
  StatCard,
  StatusBadge,
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

export const Route = createFileRoute("/_authenticated/app/work-log")({
  component: WorkLogPage,
});

const ALL = "all";

const STATUS_TONE: Record<WorkLogStatus, string> = {
  submitted: "neutral",
  verified: "info",
  approved: "success",
  rejected: "danger",
  paid: "gold",
};

type RateCardItem = Awaited<ReturnType<typeof listRateCard>>[number];

function LogWorkDialog({ rateCard }: { rateCard: RateCardItem[] }) {
  const { session, can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data: properties } = useQuery({ queryKey: ["property-options"], queryFn: listPropertyOptions });

  const empty = {
    entry_date: todayISO(),
    staff_id: session?.user.id ?? "",
    rate_card_id: rateCard[0]?.id ?? "",
    quantity: "1",
    property_type: PUBLISH_PROPERTY_TYPES[0] ?? "",
    platform: PUBLISH_PLATFORMS[0] ?? "",
    country: PUBLISH_COUNTRIES[0] ?? "",
    master_db_status: "not_applicable" as MasterDbStatus,
    related_property_id: "",
    reference_url: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const selected = rateCard.find((r) => r.id === form.rate_card_id);
  const quantity = Number(form.quantity) || 0;
  const bonusApplies = !!selected && selected.bonus_kes > 0 && form.master_db_status === "yes";
  const estimate = selected ? quantity * (selected.rate_kes + (bonusApplies ? selected.bonus_kes : 0)) : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.staff_id) throw new Error("Select the member of staff this work belongs to.");
      if (!form.rate_card_id) throw new Error("Select a work type from the rate card.");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("work_log_entries").insert({
        entry_date: form.entry_date,
        staff_id: form.staff_id,
        rate_card_id: form.rate_card_id,
        quantity,
        property_type: form.property_type || null,
        platform: form.platform || null,
        country: form.country || null,
        master_db_status: form.master_db_status,
        related_property_id: form.related_property_id || null,
        reference_url: form.reference_url || null,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work logged. It will appear in your wallet once approved.");
      queryClient.invalidateQueries({ queryKey: ["work-log"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setForm({ ...empty, staff_id: session?.user.id ?? "" });
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to log this work.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Log Work Done</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Log work done</DialogTitle>
          <DialogDescription>
            Record properties published or tasks completed. Entries are priced from the rate card and
            reviewed before payment.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Date">
            <Input
              type="date"
              required
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            />
          </Field>
          <Field label="Staff member">
            <Select
              value={form.staff_id}
              onValueChange={(v) => setForm({ ...form, staff_id: v })}
              disabled={!can("worklog.view_all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select staff" />
              </SelectTrigger>
              <SelectContent>
                {(staff ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Work type (rate card)" className="sm:col-span-2">
            <Select
              value={form.rate_card_id}
              onValueChange={(v) => setForm({ ...form, rate_card_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select work type" />
              </SelectTrigger>
              <SelectContent>
                {rateCard.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — {formatMoney(r.rate_kes)} per {r.unit_label}
                    {r.bonus_kes > 0 ? ` (+${formatMoney(r.bonus_kes)} bonus)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Quantity (${selected?.unit_label ?? "items"})`}>
            <Input
              type="number"
              min={1}
              required
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Property type">
            <Select
              value={form.property_type}
              onValueChange={(v) => setForm({ ...form, property_type: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Platform">
            <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country">
            <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Uploaded to Murivest Master DB?"
            hint={
              selected && selected.bonus_kes > 0
                ? `Selecting "Yes" adds the ${formatMoney(selected.bonus_kes)} bonus per ${selected.unit_label}.`
                : undefined
            }
          >
            <Select
              value={form.master_db_status}
              onValueChange={(v) => setForm({ ...form, master_db_status: v as MasterDbStatus })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(MASTER_DB_STATUS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Related property (optional)">
            <Select
              value={form.related_property_id || "none"}
              onValueChange={(v) => setForm({ ...form, related_property_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(properties ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Listing URL (optional)">
            <Input
              value={form.reference_url}
              placeholder={`${STUDIO_URL}/...`}
              onChange={(e) => setForm({ ...form, reference_url: e.target.value })}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <div className="surface rounded-md p-3 sm:col-span-2">
            <p className="label-caps">Estimated earning</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(estimate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {selected
                ? `${quantity} × ${formatMoney(selected.rate_kes)}${bonusApplies ? ` + ${quantity} × ${formatMoney(selected.bonus_kes)} bonus` : ""}`
                : "Select a work type to price this entry."}
            </p>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Log work"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudioAccessPanel() {
  const steps = [
    `Open ${STUDIO_URL} in Chrome on a desktop — uploads are not supported on mobile.`,
    "Sign in with the Murivest Studio account issued by the Managing Director. Never share credentials: every upload is attributed to the signed-in account.",
    "Choose the correct upload type — Rental Space, Kenya Property or International Property.",
    "Complete the listing: title, location, price, tenure, description and at least three images. Vet the property against source documents first.",
    "Mirror Kenya uploads to the Murivest Master database to earn the bonus. International uploads require full Master integration.",
    "Return here and log the work: date, type, quantity, platform, country and Master DB status.",
    "The Managing Director verifies and approves each entry. Approved work moves into your wallet balance.",
  ];
  return (
    <Panel title="How to access the Studio" description="murivest.com/studio upload workflow">
      <ol className="space-y-2.5">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">
              {index + 1}
            </span>
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <a
        href={STUDIO_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-block text-xs text-primary hover:underline"
      >
        Open Murivest Studio →
      </a>
    </Panel>
  );
}

function WorkLogPage() {
  const { session, can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [scope, setScope] = useState<"mine" | "all">(can("worklog.view_all") ? "all" : "mine");

  const { data: rateCard = [] } = useQuery({ queryKey: ["rate-card"], queryFn: () => listRateCard() });
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const staffFilter = scope === "mine" ? (session?.user.id ?? undefined) : undefined;
  const { data, isLoading } = useQuery({
    queryKey: ["work-log", scope, status, staffFilter],
    queryFn: () =>
      listWorkLog({
        ...(staffFilter ? { staff_id: staffFilter } : {}),
        ...(status !== ALL ? { status } : {}),
      }),
  });

  const review = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: WorkLogStatus }) => {
      const { data: auth } = await supabase.auth.getUser();
      const patch: Record<string, string | null> = { status: next };
      if (next === "verified") {
        patch["verified_by"] = auth.user?.id ?? null;
        patch["verified_at"] = new Date().toISOString();
      }
      if (next === "approved") {
        patch["approved_by"] = auth.user?.id ?? null;
        patch["approved_at"] = new Date().toISOString();
      }
      const { error } = await supabase.from("work_log_entries").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work log updated.");
      queryClient.invalidateQueries({ queryKey: ["work-log"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update this entry.")),
  });

  const rows = useMemo(
    () =>
      (data ?? []).filter((entry) =>
        [entry.property_type, entry.platform, entry.country, entry.notes, entry.rate_card?.name]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
      ),
    [data, search],
  );

  const totals = rows.reduce(
    (acc, entry) => {
      acc.units += entry.quantity;
      acc.value += entry.amount_kes;
      if (entry.status === "submitted" || entry.status === "verified") acc.pending += entry.amount_kes;
      return acc;
    },
    { units: 0, value: 0, pending: 0 },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work Log & Upload Tracker"
        description="Every property published and task completed, priced against the Murivest upload rate card."
        actions={can("worklog.create") ? <LogWorkDialog rateCard={rateCard} /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Items logged" value={totals.units} hint={`${rows.length} entries`} />
        <StatCard label="Logged value" value={formatMoney(totals.value)} tone="gold" />
        <StatCard label="Awaiting approval" value={formatMoney(totals.pending)} tone="warning" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search type, platform…" />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {optionsOf(WORK_LOG_STATUS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can("worklog.view_all") ? (
              <Select value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  <SelectItem value="mine">My entries</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {isLoading ? (
            <LoadingState label="Loading work log…" />
          ) : rows.length === 0 ? (
            <EmptyState
              message="No work logged yet"
              hint="Publish a listing on the Studio, then log it here to be paid for it."
            />
          ) : (
            <DataTable
              columns={["Date", "Work type", "Qty", "Platform / Country", "Master DB", "Amount", "Status", ""]}
            >
              {rows.map((entry) => (
                <Row key={entry.id}>
                  <Cell muted>{formatDate(entry.entry_date)}</Cell>
                  <Cell>
                    <span className="font-medium">{text(entry.rate_card?.name)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {text(entry.property_type)}
                      {scope === "all" ? ` · ${staffName(staff, entry.staff_id)}` : ""}
                    </span>
                  </Cell>
                  <Cell className="tabular-nums">{entry.quantity}</Cell>
                  <Cell muted>
                    {text(entry.platform)}
                    <span className="block text-xs">{text(entry.country)}</span>
                  </Cell>
                  <Cell muted>{MASTER_DB_STATUS[entry.master_db_status as MasterDbStatus]}</Cell>
                  <Cell className="tabular-nums">{formatMoney(entry.amount_kes)}</Cell>
                  <Cell>
                    <StatusBadge tone={STATUS_TONE[entry.status as WorkLogStatus]}>
                      {WORK_LOG_STATUS[entry.status as WorkLogStatus]}
                    </StatusBadge>
                  </Cell>
                  <Cell>
                    {can("worklog.approve") && entry.status !== "paid" ? (
                      <div className="flex gap-1.5">
                        {entry.status === "submitted" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => review.mutate({ id: entry.id, next: "verified" })}
                          >
                            Verify
                          </Button>
                        ) : null}
                        {entry.status !== "approved" ? (
                          <Button
                            size="sm"
                            onClick={() => review.mutate({ id: entry.id, next: "approved" })}
                          >
                            Approve
                          </Button>
                        ) : null}
                        {entry.status !== "rejected" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => review.mutate({ id: entry.id, next: "rejected" })}
                          >
                            Reject
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </div>

        <div className="space-y-5">
          <StudioAccessPanel />
          <Panel title="Rate card" description="Applied automatically when you log work">
            <ul className="space-y-2.5">
              {rateCard.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{r.name}</span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {formatMoney(r.rate_kes)}
                    {r.bonus_kes > 0 ? ` +${formatMoney(r.bonus_kes)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

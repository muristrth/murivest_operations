import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  PAYMENT_METHOD,
  STUDIO_URL,
  WORK_LOG_STATUS,
  optionsOf,
  type PaymentMethod,
  type WorkLogStatus,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, friendlyError, text } from "@/lib/format";
import {
  listRateCard,
  listStaff,
  listWalletPayments,
  listWalletSummary,
  listWorkLog,
  staffName,
} from "@/lib/queries";
import {
  Cell,
  DataTable,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Row,
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

export const Route = createFileRoute("/_authenticated/app/wallet")({
  component: WalletPage,
});

function RecordPaymentDialog({ staffId, balance }: { staffId: string; balance: number }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const empty = {
    staff_id: staffId,
    amount_kes: balance > 0 ? String(balance) : "",
    method: "mpesa" as PaymentMethod,
    period_start: "",
    period_end: "",
    reference: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount_kes);
      if (!form.staff_id || !amount || amount <= 0) throw new Error("Enter a staff member and a positive amount.");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("wallet_payments").insert({
        staff_id: form.staff_id,
        amount_kes: amount,
        method: form.method,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        reference: form.reference || null,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded.");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to record the payment.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Record payment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Payments reduce the outstanding balance of approved work for this member of staff.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Staff member" className="sm:col-span-2">
            <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
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
          <Field label="Amount (KES)">
            <Input
              type="number"
              min={1}
              required
              value={form.amount_kes}
              onChange={(e) => setForm({ ...form, amount_kes: e.target.value })}
            />
          </Field>
          <Field label="Method">
            <Select
              value={form.method}
              onValueChange={(v) => setForm({ ...form, method: v as PaymentMethod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(PAYMENT_METHOD).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Period start">
            <Input
              type="date"
              value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })}
            />
          </Field>
          <Field label="Period end">
            <Input
              type="date"
              value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })}
            />
          </Field>
          <Field label="Reference" className="sm:col-span-2">
            <Input
              value={form.reference}
              placeholder="M-Pesa code / bank reference"
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RateCardPanel() {
  const { data = [], isLoading } = useQuery({ queryKey: ["rate-card"], queryFn: () => listRateCard() });
  const uploads = data.filter((r) => r.section === "upload");
  const additional = data.filter((r) => r.section === "additional");

  if (isLoading) return <LoadingState label="Loading rate card…" />;

  const table = (items: typeof data) => (
    <DataTable columns={["Type", "Description", "Rate", "Bonus", "Total possible", "Notes"]}>
      {items.map((r) => (
        <Row key={r.id}>
          <Cell>{r.name}</Cell>
          <Cell muted>{text(r.description)}</Cell>
          <Cell className="tabular-nums">{formatMoney(r.rate_kes)}</Cell>
          <Cell className="tabular-nums" muted>
            {r.bonus_kes > 0 ? formatMoney(r.bonus_kes) : "—"}
          </Cell>
          <Cell className="tabular-nums">{formatMoney(r.total_possible_kes)}</Cell>
          <Cell muted>{text(r.notes)}</Cell>
        </Row>
      ))}
    </DataTable>
  );

  return (
    <div className="space-y-5">
      <Panel
        title="Upload rate card"
        description={`Applies to work published on ${STUDIO_URL}`}
      >
        {table(uploads)}
      </Panel>
      <Panel
        title="Additional tasks & compensation"
        description="Rates to be agreed with the Managing Director"
      >
        {table(additional)}
      </Panel>
    </div>
  );
}

function WalletPage() {
  const { session, can } = useAuth();
  const userId = session?.user.id ?? "";
  const viewAll = can("wallet.view_all");
  const [selectedStaff, setSelectedStaff] = useState(userId);

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data: summaries, isLoading } = useQuery({
    queryKey: ["wallet", "summary", viewAll ? "all" : userId],
    queryFn: () => listWalletSummary(viewAll ? undefined : userId),
    enabled: !!userId,
  });

  const activeStaffId = viewAll ? selectedStaff : userId;
  const wallet = (summaries ?? []).find((s) => s.staff_id === activeStaffId);

  const { data: entries } = useQuery({
    queryKey: ["work-log", "wallet", activeStaffId],
    queryFn: () => listWorkLog({ staff_id: activeStaffId }),
    enabled: !!activeStaffId,
  });
  const { data: payments } = useQuery({
    queryKey: ["wallet", "payments", activeStaffId],
    queryFn: () => listWalletPayments(activeStaffId),
    enabled: !!activeStaffId,
  });

  const byRateCard = (entries ?? []).reduce<Record<string, { label: string; units: number; amount: number }>>(
    (acc, entry) => {
      if (entry.status === "rejected") return acc;
      const label = entry.rate_card?.name ?? "Other";
      const current = acc[label] ?? { label, units: 0, amount: 0 };
      current.units += entry.quantity;
      current.amount += entry.amount_kes;
      acc[label] = current;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Wallet"
        description="Work you have completed, what it is worth, and what is still owed to you."
        actions={
          viewAll && wallet ? (
            <RecordPaymentDialog staffId={activeStaffId} balance={Number(wallet.balance_kes)} />
          ) : null
        }
      />

      {viewAll ? (
        <Select value={selectedStaff} onValueChange={setSelectedStaff}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select staff member" />
          </SelectTrigger>
          <SelectContent>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {isLoading ? (
        <LoadingState label="Loading wallet…" />
      ) : !wallet ? (
        <EmptyState
          message="No wallet activity yet"
          hint="Log published properties and completed tasks in the Work Log to start earning."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Items completed" value={Number(wallet.unit_count)} hint={`${Number(wallet.entry_count)} entries`} />
          <StatCard label="Total earned" value={formatMoney(Number(wallet.earned_kes))} tone="gold" />
          <StatCard label="Awaiting approval" value={formatMoney(Number(wallet.pending_kes))} tone="warning" />
          <StatCard label="Paid out" value={formatMoney(Number(wallet.paid_kes))} tone="success" />
          <StatCard
            label="Balance owed"
            value={formatMoney(Number(wallet.balance_kes))}
            tone={Number(wallet.balance_kes) > 0 ? "destructive" : "default"}
            hint="Approved work not yet paid"
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Earnings by work type" description="Excludes rejected entries">
          {Object.keys(byRateCard).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {Object.values(byRateCard).map((line) => (
                <li key={line.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {line.label}
                    <span className="ml-2 text-xs">× {line.units}</span>
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{formatMoney(line.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Payments received">
          {(payments ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {(payments ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 border-b border-border/70 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{formatMoney(Number(p.amount_kes))}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {PAYMENT_METHOD[p.method as PaymentMethod]} · {formatDateTime(p.paid_at)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {p.period_start ? `${formatDate(p.period_start)} – ${formatDate(p.period_end)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Work history" description="Every logged item and its value">
        {(entries ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <DataTable columns={["Date", "Work type", "Qty", "Platform", "Amount", "Status"]}>
            {(entries ?? []).map((entry) => (
              <Row key={entry.id}>
                <Cell muted>{formatDate(entry.entry_date)}</Cell>
                <Cell>
                  {text(entry.rate_card?.name)}
                  <span className="block text-xs text-muted-foreground">{text(entry.property_type)}</span>
                </Cell>
                <Cell className="tabular-nums">{entry.quantity}</Cell>
                <Cell muted>{text(entry.platform)}</Cell>
                <Cell className="tabular-nums">{formatMoney(entry.amount_kes)}</Cell>
                <Cell>
                  <StatusBadge
                    tone={
                      entry.status === "approved"
                        ? "success"
                        : entry.status === "paid"
                          ? "gold"
                          : entry.status === "rejected"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {WORK_LOG_STATUS[entry.status as WorkLogStatus]}
                  </StatusBadge>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </Panel>

      {viewAll && summaries ? (
        <Panel title="All staff balances">
          <DataTable columns={["Staff", "Items", "Earned", "Pending", "Paid", "Owed"]}>
            {summaries.map((s) => (
              <Row key={s.staff_id} onClick={() => setSelectedStaff(s.staff_id)}>
                <Cell>{staffName(staff, s.staff_id)}</Cell>
                <Cell className="tabular-nums">{Number(s.unit_count)}</Cell>
                <Cell className="tabular-nums">{formatMoney(Number(s.earned_kes))}</Cell>
                <Cell className="tabular-nums" muted>
                  {formatMoney(Number(s.pending_kes))}
                </Cell>
                <Cell className="tabular-nums" muted>
                  {formatMoney(Number(s.paid_kes))}
                </Cell>
                <Cell className="tabular-nums font-medium">{formatMoney(Number(s.balance_kes))}</Cell>
              </Row>
            ))}
          </DataTable>
        </Panel>
      ) : null}

      <RateCardPanel />
    </div>
  );
}

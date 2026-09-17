import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, staffName } from "@/lib/queries";
import { CONTACT_CATEGORY, optionsOf } from "@/lib/constants";
import { friendlyError, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  Field,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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

export const Route = createFileRoute("/_authenticated/app/contacts")({
  component: ContactsPage,
});

const ALL = "all";

function NewContactDialog() {
  const queryClient = useQueryClient();
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const [open, setOpen] = useState(false);
  const empty = {
    name: "",
    organization: "",
    role: "",
    category: "other",
    phone: "",
    email: "",
    location: "",
    assigned_to: "",
    notes: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("contacts").insert({
        name: form.name,
        organization: form.organization || null,
        role: form.role || null,
        category: form.category as never,
        phone: form.phone || null,
        email: form.email || null,
        location: form.location || null,
        assigned_to: form.assigned_to || null,
        notes: form.notes || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact added.");
      queryClient.invalidateQueries();
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the contact.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Contact</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Organization">
            <Input
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(CONTACT_CATEGORY).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Assigned to">
            <Select
              value={form.assigned_to || "none"}
              onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
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
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactsPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", category],
    queryFn: async () => {
      let query = supabase.from("contacts").select("*").is("deleted_at", null).order("name");
      if (category !== ALL) query = query.eq("category", category as never);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((c) =>
    [c.name, c.organization, c.phone, c.email, c.location]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts Directory"
        description="Central directory of clients, investors, owners, advisers and counterparties."
        actions={can("contacts.create") ? <NewContactDialog /> : null}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, organization…" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {optionsOf(CONTACT_CATEGORY).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading contacts…" />
      ) : (
        <DataTable
          columns={["Name", "Organization", "Category", "Phone", "Email", "Location", "Assigned"]}
          empty={rows.length === 0}
        >
          {rows.map((c) => (
            <Row key={c.id}>
              <Cell>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{text(c.role)}</p>
              </Cell>
              <Cell muted>{text(c.organization)}</Cell>
              <Cell>
                <StatusBadge tone="navy">{CONTACT_CATEGORY[c.category]}</StatusBadge>
              </Cell>
              <Cell muted>{text(c.phone)}</Cell>
              <Cell muted>{text(c.email)}</Cell>
              <Cell muted>{text(c.location)}</Cell>
              <Cell muted>{staffName(staff, c.assigned_to)}</Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

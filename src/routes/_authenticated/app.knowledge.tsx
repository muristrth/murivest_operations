import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listKnowledgeGuide } from "@/lib/queries";
import { formatDateTime, friendlyError, text } from "@/lib/format";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  SearchInput,
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

const KNOWLEDGE_CATEGORIES = [
  "Company Overview",
  "Property Services",
  "Investment Process",
  "Legal & Compliance",
  "Client Communication",
  "Pricing & Valuation",
  "Market Information",
  "Internal Procedures",
  "Scripts & Templates",
  "Other",
];

export const Route = createFileRoute("/_authenticated/app/knowledge")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-guide", category],
    queryFn: async () => {
      let query = supabase.from("knowledge_guide").select("*").eq("is_active", true).order("sort_order");
      if (category !== "all") query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((k) =>
    [k.title, k.category, k.content].some((v) => v.toLowerCase().includes(search.toLowerCase())),
  );

  // Manage knowledge (MD only)
  if (can("knowledge.manage")) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Company Knowledge Guide"
          description="Approved reference material for client-facing communication and internal procedures."
          actions={<NewKnowledgeDialog />}
        />

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search title, content…" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {KNOWLEDGE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState label="Loading knowledge guide…" />
        ) : rows.length === 0 ? (
          <EmptyState message="No knowledge entries found." hint="Add your first entry using the button above." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((k) => (
              <Panel key={k.id} title={k.title} description={k.category} actions={
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => editKnowledge(k)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteKnowledge(k.id)}>
                    Delete
                  </Button>
                </div>
              }>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{k.content}</p>
              </Panel>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Read-only view for other roles
  return (
    <div className="space-y-5">
      <PageHeader
        title="Company Knowledge Guide"
        description="Approved reference material for client-facing communication and internal procedures."
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, content…" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {KNOWLEDGE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading knowledge guide…" />
      ) : rows.length === 0 ? (
        <EmptyState message="No knowledge entries found." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((k) => (
            <Panel key={k.id} title={k.title} description={k.category}>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{k.content}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function NewKnowledgeDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const empty = {
    category: "Company Overview",
    title: "",
    content: "",
    sort_order: 0,
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("knowledge_guide").insert({
        category: form.category,
        title: form.title,
        content: form.content,
        sort_order: form.sort_order,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Knowledge entry added.");
      queryClient.invalidateQueries({ queryKey: ["knowledge-guide"] });
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ Add Entry</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add knowledge entry</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Category">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Title">
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Sort order">
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </Field>
          <Field label="Content" className="sm:col-span-2">
            <Textarea
              required
              rows={8}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Add entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function editKnowledge(k: any) {
  // Implementation would open edit dialog
  console.log("Edit:", k);
}

function deleteKnowledge(id: string) {
  if (confirm("Delete this knowledge entry?")) {
    supabase.from("knowledge_guide").delete().eq("id", id);
  }
}
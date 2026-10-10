import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listStaff, listTasks, getTask, listTaskComments, listPropertyOptions } from "@/lib/queries";
import {
  ESCALATION,
  PRIORITY,
  TASK_STATUS,
  optionsOf,
} from "@/lib/constants";
import { formatDate, formatDateTime, friendlyError, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  EmptyState,
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

export const Route = createFileRoute("/_authenticated/app/tasks")({
  component: TasksPage,
});

const ALL = "all";

function NewTaskDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data: properties } = useQuery({
    queryKey: ["property-options"],
    queryFn: listPropertyOptions,
  });
  const empty = {
    title: "",
    description: "",
    priority: "normal",
    assigned_to: "",
    due_date: "",
    related_property_id: "",
    related_inquiry_id: "",
    related_appointment_id: "",
    related_client: "",
  };
  const [form, setForm] = useState(empty);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        title: form.title,
        description: form.description || null,
        priority: form.priority as never,
        assigned_to: form.assigned_to || auth.user?.id || null,
        due_date: form.due_date || null,
        related_property_id: form.related_property_id || null,
        related_inquiry_id: form.related_inquiry_id || null,
        related_appointment_id: form.related_appointment_id || null,
        related_client: form.related_client || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setForm(empty);
      setOpen(false);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to create the task.")),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">+ New Task</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            Assign a task with a clear title, description, priority and due date.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <Field label="Title" className="sm:col-span-2">
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Prepare investment memorandum for Property X"
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(PRIORITY).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </Field>
          <Field label="Assign to">
            <Select
              value={form.assigned_to || "none"}
              onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Me" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Me</SelectItem>
                {(staff ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.full_name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Related client" className="sm:col-span-2">
            <Input
              value={form.related_client}
              onChange={(e) => setForm({ ...form, related_client: e.target.value })}
              placeholder="Client or prospect name"
            />
          </Field>
          <Field label="Related property">
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
          <Field label="Related inquiry">
            <Input
              value={form.related_inquiry_id}
              onChange={(e) => setForm({ ...form, related_inquiry_id: e.target.value })}
              placeholder="Inquiry ID (optional)"
            />
          </Field>
          <Field label="Related appointment">
            <Input
              value={form.related_appointment_id}
              onChange={(e) => setForm({ ...form, related_appointment_id: e.target.value })}
              placeholder="Appointment ID (optional)"
            />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailDialog({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: !!taskId,
  });
  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: () => listTaskComments(taskId),
    enabled: !!taskId,
  });
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState(task?.status ?? "not_started");

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase.from("tasks").update({ status: newStatus as never }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task status updated.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update status.")),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!comment.trim()) return;
      if (!auth.user) throw new Error("You must be signed in to comment.");
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId,
        user_id: auth.user.id,
        body: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to add comment.")),
  });

  if (isLoading) return <LoadingState label="Loading task…" />;
  if (!task) return <EmptyState message="Task not found" />;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>Task #{task.id.slice(0, 8)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onValueChange={(v) => { setStatus(v); updateStatus.mutate(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {optionsOf(TASK_STATUS).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Priority">
            <StatusBadge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>
              {PRIORITY[task.priority]}
            </StatusBadge>
          </Field>
          <Field label="Assigned to">
            <span>{staffName(task.assigned_to)}</span>
          </Field>
          <Field label="Due date">
            <span>{task.due_date ? formatDate(task.due_date) : "—"}</span>
          </Field>
          <Field label="Created by" className="sm:col-span-2">
            <span>{staffName(task.created_by)}</span>
          </Field>
          <Field label="Related client" className="sm:col-span-2">
            <span>{text(task.related_client)}</span>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <p className="whitespace-pre-line text-sm">{text(task.description)}</p>
          </Field>
        </div>

        <div className="border-t border-border pt-4 mt-4">
          <h3 className="font-semibold mb-3">Comments</h3>
          {(comments ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {(comments ?? []).map((c) => (
                <li key={c.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">{c.body}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {staffName(c.user_id)} · {formatDateTime(c.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-4">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), addComment.mutate())}
            />
            <Button size="sm" onClick={() => addComment.mutate()} disabled={addComment.isPending || !comment.trim()}>
              {addComment.isPending ? "Posting…" : "Comment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function staffName(id: string | null | undefined) {
  if (!id) return "—";
  return id.slice(0, 8);
}

function TasksPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [assignee, setAssignee] = useState(ALL);
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", status, assignee],
    queryFn: async () => {
      let query = supabase.from("tasks").select("*").is("deleted_at", null).order("due_date", { ascending: true });
      if (status !== ALL) query = query.eq("status", status);
      if (assignee !== ALL) query = query.eq("assigned_to", assignee);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task status updated.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update the task.")),
  });

  const queryClient = useQueryClient();

  const rows = (data ?? []).filter((t) =>
    [t.title, t.description, t.related_client]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(search.toLowerCase())),
  );

  const today = new Date().toISOString().slice(0, 10);
  const overdue = rows.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today);
  const dueToday = rows.filter((t) => t.status !== "completed" && t.status !== "cancelled" && t.due_date === today);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks"
        description="Assign, track and review tasks across the team."
        actions={can("tasks.create") ? <NewTaskDialog /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatusBadge tone={overdue.length > 0 ? "danger" : "success"}>Overdue: {overdue.length}</StatusBadge>
        <StatusBadge tone={dueToday.length > 0 ? "warning" : "success"}>Due Today: {dueToday.length}</StatusBadge>
        <StatusBadge tone="neutral">Total: {rows.length}</StatusBadge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, description, client…" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(TASK_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All assignees</SelectItem>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.full_name || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState label="Loading tasks…" />
      ) : (
        <DataTable
          columns={["Title", "Assigned", "Priority", "Due", "Status", "Related", ""]}
          empty={rows.length === 0}
        >
          {rows.map((t) => {
            const isOverdue = t.due_date && t.due_date < today && t.status !== "completed" && t.status !== "cancelled";
            const isDueToday = t.due_date === today && t.status !== "completed" && t.status !== "cancelled";
            const statusLabel = TASK_STATUS[t.status as keyof typeof TASK_STATUS];
            return (
              <Row key={t.id}>
                <Cell>
                  <Link to={`/app/tasks/${t.id}` as never} className="font-medium underline-offset-4 hover:underline">
                    {t.title}
                  </Link>
                  {t.description ? <p className="text-xs text-muted-foreground">{text(t.description)}</p> : null}
                </Cell>
                <Cell muted>{staffName(t.assigned_to)}</Cell>
                <Cell>
                  <StatusBadge tone={t.priority === "urgent" ? "danger" : t.priority === "high" ? "warning" : "neutral"}>
                    {PRIORITY[t.priority]}
                  </StatusBadge>
                </Cell>
                <Cell muted className="whitespace-nowrap text-xs">
                  {t.due_date ? formatDate(t.due_date) : "—"}
                  {isOverdue && <span className="ml-1 text-destructive">(OVERDUE)</span>}
                  {isDueToday && <span className="ml-1 text-warning">(TODAY)</span>}
                </Cell>
                <Cell>
                  <StatusBadge tone={statusLabel === "Completed" ? "success" : statusLabel === "In Progress" ? "info" : isOverdue ? "danger" : "neutral"}>
                    {statusLabel}
                  </StatusBadge>
                </Cell>
                <Cell muted className="text-xs">
                  {t.related_property_id && <span className="mr-2">Property</span>}
                  {t.related_inquiry_id && <span className="mr-2">Inquiry</span>}
                  {t.related_appointment_id && <span className="mr-2">Appointment</span>}
                </Cell>
                <Cell>
                  {can("tasks.edit") ? (
                    <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {optionsOf(TASK_STATUS).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Link to={`/app/tasks/${t.id}` as never} className="text-xs font-medium text-primary hover:underline">
                      Open
                    </Link>
                  )}
                </Cell>
              </Row>
            );
          })}
        </DataTable>
      )}
    </div>
  );
}
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { listStaff, listTaskComments, getTask, listPropertyOptions } from "@/lib/queries";
import { PRIORITY, TASK_STATUS, optionsOf, type TaskStatus } from "@/lib/constants";
import { formatDate, formatDateTime, friendlyError, text } from "@/lib/format";
import {
  DetailItem,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/tasks/$taskId")({
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { taskId } = useParams({ from: "/_authenticated/app/tasks/$taskId" });
  const { can } = useAuth();
  const queryClient = useQueryClient();

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
  const { data: propertyOptions } = useQuery({
    queryKey: ["property-options"],
    queryFn: listPropertyOptions,
  });
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState(task?.status ?? "not_started");
  const [form, setForm] = useState<Record<string, string>>({});

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const patch: TablesUpdate<"tasks"> = { status: newStatus };
      if (newStatus === "in_progress" && !task?.started_at) patch.started_at = new Date().toISOString();
      if (newStatus === "submitted") patch.submitted_at = new Date().toISOString();
      if (newStatus === "completed") patch.completed_at = new Date().toISOString();
      if (newStatus === "reviewed") {
        patch.reviewed_at = new Date().toISOString();
        patch.reviewed_by = auth.user?.id ?? null;
      }
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
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
      if (!comment.trim() || !auth.user) return;
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

  const saveDetails = useMutation({
    mutationFn: async () => {
      const patch: TablesUpdate<"tasks"> = {
        title: form["title"] ?? task?.title ?? "",
        description: form["description"] ?? null,
        priority: (form["priority"] ?? task?.priority ?? "normal") as Tables<"tasks">["priority"],
        due_date: form["due_date"] || null,
        related_client: form["related_client"] || null,
        related_property_id: form["related_property_id"] || null,
        related_inquiry_id: form["related_inquiry_id"] || null,
        related_appointment_id: form["related_appointment_id"] || null,
      };
      const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task details saved.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save details.")),
  });

  if (isLoading) return <LoadingState label="Loading task…" />;
  if (!task) {
    return (
      <EmptyState message="Task not found" hint="This task may have been removed or you do not have access to it." />
    );
  }

  const input = (key: string, label: string, disabled = false) => (
    <Field label={label}>
      <Input
        disabled={disabled}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );

  const area = (key: string, label: string, disabled = false) => (
    <Field label={label} className="sm:col-span-2">
      <Textarea
        rows={3}
        disabled={disabled}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <Link to="/app/tasks" className="text-xs text-muted-foreground hover:underline">
        ← Back to tasks
      </Link>

      <PageHeader
        title={task.title}
        description={`Task #${task.id.slice(0, 8)} · ${TASK_STATUS[task.status as TaskStatus]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {can("tasks.edit") && task.status !== "cancelled" ? (
              <Button size="sm" onClick={() => updateStatus.mutate("in_progress")} disabled={task.status === "in_progress"}>
                Start
              </Button>
            ) : null}
            {can("tasks.edit") && (task.status === "in_progress" || task.status === "waiting" || task.status === "blocked") ? (
              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate("submitted")}>
                Submit for Review
              </Button>
            ) : null}
            {can("tasks.review") && task.status === "submitted" ? (
              <Button size="sm" onClick={() => updateStatus.mutate("reviewed")}>
                Approve / Complete
              </Button>
            ) : null}
            {can("tasks.edit") && task.status !== "cancelled" ? (
              <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate("cancelled")}>
                Cancel
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "neutral"}>
          {PRIORITY[task.priority]}
        </StatusBadge>
        <StatusBadge tone={task.status === "completed" || task.status === "reviewed" ? "success" : task.status === "in_progress" ? "info" : task.status === "submitted" ? "warning" : task.status === "cancelled" ? "danger" : "neutral"}>
          {TASK_STATUS[task.status as TaskStatus]}
        </StatusBadge>
        {task.due_date && (
          <span className="text-xs text-muted-foreground">
            Due: {formatDate(task.due_date)}
            {task.due_date < new Date().toISOString().slice(0, 10) && task.status !== "completed" && <span className="ml-1 text-destructive">(OVERDUE)</span>}
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Task details" description={can("tasks.edit") ? "Editable" : "Read-only"}>
            <fieldset disabled={!can("tasks.edit")} className="grid gap-4 sm:grid-cols-2">
              {input("title", "Title")}
              {area("description", "Description")}
              <Field label="Priority">
                <Select
                  value={form["priority"] ?? task.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                  disabled={!can("tasks.edit")}
                >
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
              {input("due_date", "Due date", !can("tasks.edit"))}
              {input("related_client", "Related client")}
              <Field label="Related property">
                <Select
                  value={form["related_property_id"] ?? task.related_property_id ?? "none"}
                  onValueChange={(v) => setForm({ ...form, related_property_id: v === "none" ? "" : v })}
                  disabled={!can("tasks.edit")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(propertyOptions ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {input("related_inquiry_id", "Related inquiry ID")}
              {input("related_appointment_id", "Related appointment ID")}
            </fieldset>
            {can("tasks.edit") && task.status !== "cancelled" ? (
              <Button onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending} className="mt-4">
                {saveDetails.isPending ? "Saving…" : "Save changes"}
              </Button>
            ) : null}
          </Panel>

          <Panel title="Assignment & Timeline">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="Assigned to" value={staffName(task.assigned_to)} />
              <DetailItem label="Created by" value={staffName(task.created_by)} />
              <DetailItem label="Created" value={formatDateTime(task.created_at)} />
              {task.started_at && <DetailItem label="Started" value={formatDateTime(task.started_at)} />}
              {task.submitted_at && <DetailItem label="Submitted" value={formatDateTime(task.submitted_at)} />}
              {task.completed_at && <DetailItem label="Completed" value={formatDateTime(task.completed_at)} />}
              {task.reviewed_at && <DetailItem label="Reviewed" value={formatDateTime(task.reviewed_at)} />}
            </div>
          </Panel>

          <Panel title="Comments">
            {(comments ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No comments yet.</p>
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
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Quick Actions">
            <div className="space-y-2">
              {can("tasks.edit") && task.status !== "cancelled" ? (
                <>
                  <Button className="w-full justify-start" variant="outline" onClick={() => updateStatus.mutate("not_started")} disabled={task.status === "not_started"}>
                    Mark Not Started
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => updateStatus.mutate("waiting")} disabled={task.status === "waiting"}>
                    Mark Waiting
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => updateStatus.mutate("blocked")} disabled={task.status === "blocked"}>
                    Mark Blocked
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => updateStatus.mutate("reopened")} disabled={task.status !== "completed" && task.status !== "reviewed" && task.status !== "cancelled"}>
                    Reopen
                  </Button>
                </>
              ) : null}
            </div>
          </Panel>

          {task.related_property_id && (
            <Panel title="Related Property">
              <p className="text-sm text-muted-foreground">Property ID: {task.related_property_id}</p>
              <Link to="/app/properties/$propertyId" params={{ propertyId: task.related_property_id }} className="text-xs text-primary hover:underline mt-2 inline-block">
                Open Property →
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function staffName(id: string | null | undefined) {
  if (!id) return "—";
  return id.slice(0, 8);
}
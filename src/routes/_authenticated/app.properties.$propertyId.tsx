import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { flushEmailQueue } from "@/lib/email-dispatch";
import { PROPERTY_STATUS, PROPERTY_TYPES, REVIEW_STATUS, optionsOf } from "@/lib/constants";
import { formatDateTime, formatMoney, formatNumber, friendlyError, text } from "@/lib/format";
import {
  DetailItem,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  statusTone,
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

export const Route = createFileRoute("/_authenticated/app/properties/$propertyId")({
  component: PropertyDetailPage,
});

function PropertyDetailPage() {
  const { propertyId } = useParams({ from: "/_authenticated/app/properties/$propertyId" });
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const { data: property, isLoading } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["property-reviews", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_reviews")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!property) return;
    setForm({
      name: property.name ?? "",
      reference: property.reference ?? "",
      property_type: property.property_type ?? "Warehouse",
      location: property.location ?? "",
      city: property.city ?? "",
      county: property.county ?? "",
      address: property.address ?? "",
      tenure: property.tenure ?? "",
      description: property.description ?? "",
      investment_summary: property.investment_summary ?? "",
      investment_highlights: property.investment_highlights ?? "",
      location_advantages: property.location_advantages ?? "",
      asset_characteristics: property.asset_characteristics ?? "",
      income_information: property.income_information ?? "",
      seller_information: property.seller_information ?? "",
      internal_notes: property.internal_notes ?? "",
      internal_valuation: property.internal_valuation ?? "",
      primary_image_url: property.primary_image_url ?? "",
      price: property.price?.toString() ?? "",
      annual_income: property.annual_income?.toString() ?? "",
      monthly_income: property.monthly_income?.toString() ?? "",
      yield_percent: property.yield_percent?.toString() ?? "",
      occupancy: property.occupancy?.toString() ?? "",
      land_size: property.land_size ?? "",
      building_size: property.building_size ?? "",
      units: property.units?.toString() ?? "",
    });
  }, [property]);

  const canEdit = can("properties.edit");
  const canFinancials = can("properties.edit.financials");
  const canReview = can("properties.review");
  const canApprove = can("properties.approve");
  const canPublish = can("properties.publish");
  const canSeeConfidential = can("properties.view.confidential");

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        name: form["name"],
        reference: form["reference"] || null,
        property_type: form["property_type"] || null,
        location: form["location"] || null,
        city: form["city"] || null,
        county: form["county"] || null,
        address: form["address"] || null,
        tenure: form["tenure"] || null,
        description: form["description"] || null,
        investment_summary: form["investment_summary"] || null,
        investment_highlights: form["investment_highlights"] || null,
        location_advantages: form["location_advantages"] || null,
        asset_characteristics: form["asset_characteristics"] || null,
        income_information: form["income_information"] || null,
        primary_image_url: form["primary_image_url"] || null,
        units: form["units"] ? Number(form["units"]) : null,
      };
      if (canFinancials) {
        patch["price"] = form["price"] ? Number(form["price"]) : null;
        patch["annual_income"] = form["annual_income"] ? Number(form["annual_income"]) : null;
        patch["monthly_income"] = form["monthly_income"] ? Number(form["monthly_income"]) : null;
        patch["yield_percent"] = form["yield_percent"] ? Number(form["yield_percent"]) : null;
        patch["occupancy"] = form["occupancy"] ? Number(form["occupancy"]) : null;
        patch["land_size"] = form["land_size"] || null;
        patch["building_size"] = form["building_size"] || null;
      }
      if (canSeeConfidential) {
        patch["seller_information"] = form["seller_information"] || null;
        patch["internal_notes"] = form["internal_notes"] || null;
        patch["internal_valuation"] = form["internal_valuation"] || null;
      }
      const { error } = await supabase
        .from("properties")
        .update(patch as never)
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property saved.");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the property.")),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = { status };
      if (status === "approved") {
        patch["approved_at"] = new Date().toISOString();
        patch["approved_by"] = auth.user?.id ?? null;
      }
      if (status === "published") patch["published_at"] = new Date().toISOString();
      const { error } = await supabase
        .from("properties")
        .update(patch as never)
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property status updated.");
      queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to change the status.")),
  });

  const [reviewStatus, setReviewStatus] = useState("verified");
  const [reviewComment, setReviewComment] = useState("");

  const submitReview = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in.");
      const { error } = await supabase.from("property_reviews").insert({
        property_id: propertyId,
        reviewed_by: auth.user.id,
        status: reviewStatus as never,
        comment: reviewComment || null,
      });
      if (error) throw error;
      const { error: updateError } = await supabase
        .from("properties")
        .update({
          review_status: reviewStatus as never,
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user.id,
          status: reviewStatus === "needs_correction" ? "needs_update" : "internal_review",
        } as never)
        .eq("id", propertyId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Review recorded.");
      setReviewComment("");
      queryClient.invalidateQueries();
      void flushEmailQueue();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to record the review.")),
  });

  if (isLoading) return <LoadingState label="Loading property…" />;
  if (!property) {
    return (
      <EmptyState
        message="Property not found"
        hint="This property may have been removed or you do not have access to it."
      />
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
      <Link to="/app/properties" className="text-xs text-muted-foreground hover:underline">
        ← Back to properties
      </Link>

      <PageHeader
        title={property.name}
        description={`${text(property.reference)} · ${text(property.property_type)} · ${text(property.location || property.city)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit && property.status === "draft" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("internal_review")}>
                Submit for review
              </Button>
            ) : null}
            {canApprove && (property.status === "internal_review" || property.status === "needs_update") ? (
              <Button size="sm" onClick={() => setStatus.mutate("approved")}>
                Approve
              </Button>
            ) : null}
            {canPublish && property.status === "approved" ? (
              <Button size="sm" onClick={() => setStatus.mutate("published")}>
                Publish
              </Button>
            ) : null}
            {canEdit && property.status !== "archived" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus.mutate("archived")}>
                Archive
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(property.status)}>
          {PROPERTY_STATUS[property.status]}
        </StatusBadge>
        {property.review_status ? (
          <StatusBadge tone={statusTone(property.review_status)}>
            {REVIEW_STATUS[property.review_status]}
          </StatusBadge>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Updated {formatDateTime(property.updated_at)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Property record">
            <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
              {input("name", "Property name")}
              {input("reference", "Reference")}
              <Field label="Type">
                <Select
                  value={form["property_type"] ?? ""}
                  onValueChange={(v) => setForm({ ...form, property_type: v })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {input("tenure", "Tenure")}
              {input("location", "Location")}
              {input("city", "City")}
              {input("county", "County")}
              {input("address", "Address")}
              {input("units", "Units")}
              {input("primary_image_url", "Primary image URL")}
              {area("description", "Description")}
              {area("investment_summary", "Investment summary")}
              {area("investment_highlights", "Investment highlights")}
              {area("location_advantages", "Location advantages")}
              {area("asset_characteristics", "Asset characteristics")}
              {area("income_information", "Income information")}
            </fieldset>
          </Panel>

          <Panel
            title="Commercial terms"
            description={
              canFinancials
                ? "Editable — financial authority granted by your role."
                : "Read-only — your role cannot edit financial fields."
            }
          >
            {canFinancials ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {input("price", "Price")}
                {input("annual_income", "Annual income")}
                {input("monthly_income", "Monthly income")}
                {input("yield_percent", "Yield (%)")}
                {input("occupancy", "Occupancy (%)")}
                {input("land_size", "Land size")}
                {input("building_size", "Building size")}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Price" value={formatMoney(property.price, property.price_currency ?? "KES")} />
                <DetailItem label="Annual income" value={formatMoney(property.annual_income)} />
                <DetailItem label="Monthly income" value={formatMoney(property.monthly_income)} />
                <DetailItem label="Yield" value={formatNumber(property.yield_percent, "%")} />
                <DetailItem label="Occupancy" value={formatNumber(property.occupancy, "%")} />
                <DetailItem label="Land size" value={text(property.land_size)} />
                <DetailItem label="Building size" value={text(property.building_size)} />
              </div>
            )}
          </Panel>

          {canSeeConfidential ? (
            <Panel title="Confidential" description="Never shown to clients or public listings.">
              <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
                {area("seller_information", "Seller information")}
                {area("internal_valuation", "Internal valuation")}
                {area("internal_notes", "Internal notes")}
              </fieldset>
            </Panel>
          ) : null}

          {canEdit ? (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>

        <div className="space-y-5">
          {canReview ? (
            <Panel title="Record review">
              <div className="space-y-3">
                <Field label="Outcome">
                  <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsOf(REVIEW_STATUS).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Comment">
                  <Textarea
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Verification notes, corrections required, or information awaited."
                  />
                </Field>
                <Button
                  size="sm"
                  onClick={() => submitReview.mutate()}
                  disabled={submitReview.isPending}
                >
                  {submitReview.isPending ? "Saving…" : "Submit review"}
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel title="Review history">
            {(reviews ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviews recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {(reviews ?? []).map((r) => (
                  <li key={r.id} className="border-l-2 border-border pl-3">
                    <StatusBadge tone={statusTone(r.status)}>{REVIEW_STATUS[r.status]}</StatusBadge>
                    <p className="mt-1 text-xs text-muted-foreground">{text(r.comment)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

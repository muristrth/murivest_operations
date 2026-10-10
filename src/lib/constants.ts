import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type PropertyStatus = Database["public"]["Enums"]["property_status"];
export type ReviewStatus = Database["public"]["Enums"]["review_status"];
export type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];
export type InquirySource = Database["public"]["Enums"]["inquiry_source"];
export type InquiryCategory = Database["public"]["Enums"]["inquiry_category"];
export type CallCategory = Database["public"]["Enums"]["call_category"];
export type AppointmentFormat = Database["public"]["Enums"]["appointment_format"];
export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];
export type ContactCategory = Database["public"]["Enums"]["contact_category"];
export type PriorityLevel = Database["public"]["Enums"]["priority_level"];
export type EscalationLevel = Database["public"]["Enums"]["escalation_level"];
export type FollowupStatus = Database["public"]["Enums"]["followup_status"];

// New types for new modules
export type TaskStatus = "not_started" | "in_progress" | "waiting" | "blocked" | "submitted" | "completed" | "reviewed" | "reopened" | "cancelled";
export type CorrespondenceType = "received" | "sent";
export type CorrespondenceChannel = "email" | "whatsapp" | "phone" | "letter" | "website" | "other";
export type CorrespondenceStatus = "open" | "in_progress" | "completed" | "closed";
export type EscalationCategory = "negotiation" | "pricing" | "valuation" | "complaint" | "legal" | "confidential" | "investment_advice" | "major_client" | "institutional" | "transaction" | "media" | "unusual" | "other";
export type EscalationStatus = "open" | "under_review" | "resolved" | "closed";

export const COMPANY = {
  name: "Murivest Group Ltd.",
  system: "Murivest Internal System",
  subtitle: "Internal Operations",
  logo: "/logo.webp",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  managing_director: "Managing Director",
  secretariat: "Secretariat & Client Relations Officer",
  capital_advisor: "Associate Capital Advisor",
};

export const PROPERTY_STATUS: Record<PropertyStatus, string> = {
  draft: "Draft",
  internal_review: "Internal Review",
  approved: "Approved",
  published: "Published",
  needs_update: "Needs Update",
  archived: "Archived",
};

export const REVIEW_STATUS: Record<ReviewStatus, string> = {
  verified: "Verified",
  needs_correction: "Needs Correction",
  awaiting_information: "Awaiting Information",
};

export const INQUIRY_STATUS: Record<InquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualification_pending: "Qualification Pending",
  appointment_requested: "Appointment Requested",
  appointment_confirmed: "Appointment Confirmed",
  meeting_completed: "Meeting Completed",
  handed_over: "Handed Over",
  follow_up: "Follow-up",
  converted: "Converted",
  nurture: "Nurture",
  closed: "Closed",
};

export const INQUIRY_SOURCE: Record<InquirySource, string> = {
  website: "Website",
  jiji: "Jiji",
  whatsapp: "WhatsApp",
  phone: "Phone",
  referral: "Referral",
  email: "Email",
  walk_in: "Walk-in",
  other: "Other",
};

export const INQUIRY_CATEGORY: Record<InquiryCategory, string> = {
  buyer: "Buyer",
  investor: "Investor",
  owner_seller: "Owner/Seller",
  tenant: "Tenant",
  landlord: "Landlord",
  vendor: "Vendor",
  partner: "Partner",
  general: "General",
};

export const CALL_CATEGORY: Record<CallCategory, string> = {
  buyer: "Buyer",
  investor: "Investor",
  owner_seller: "Owner/Seller",
  tenant: "Tenant",
  vendor: "Vendor",
  partner: "Partner",
  general: "General",
  wrong_number: "Wrong Number",
  spam: "Spam",
  existing_client: "Existing Client",
};

export const CALL_ACTIONS = [
  "Information provided",
  "Appointment offered",
  "Appointment booked",
  "Transferred",
  "Callback required",
  "Escalated",
  "Message taken",
  "Follow-up created",
];

export const CALL_STATUS = ["answered", "missed", "voicemail", "callback pending"];

export const APPOINTMENT_FORMAT: Record<AppointmentFormat, string> = {
  physical_meeting: "Physical Meeting",
  virtual_meeting: "Virtual Meeting",
  site_visit: "Site Visit",
  office_meeting: "Office Meeting",
  phone_call: "Phone Call",
  other: "Other",
};

export const APPOINTMENT_STATUS: Record<AppointmentStatus, string> = {
  requested: "Requested",
  pending_confirmation: "Pending Confirmation",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const CONTACT_CATEGORY: Record<ContactCategory, string> = {
  client: "Client",
  investor: "Investor",
  owner: "Owner",
  broker: "Broker",
  lawyer: "Lawyer",
  bank: "Bank",
  supplier: "Supplier",
  partner: "Partner",
  advisor: "Advisor",
  corporate: "Corporate",
  other: "Other",
};

export const PRIORITY: Record<PriorityLevel, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export const ESCALATION: Record<EscalationLevel, string> = {
  none: "None",
  requires_md: "Requires MD Attention",
  requires_capital_advisor: "Requires Capital Advisor",
  requires_property_review: "Requires Property Review",
  requires_management_decision: "Requires Management Decision",
  urgent: "Urgent",
};

export const FOLLOWUP_STATUS: Record<FollowupStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TASK_STATUS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting: "Waiting",
  blocked: "Blocked",
  submitted: "Submitted",
  completed: "Completed",
  reviewed: "Reviewed",
  reopened: "Reopened",
  cancelled: "Cancelled",
};

export const CORRESPONDENCE_TYPE: Record<CorrespondenceType, string> = {
  received: "Received",
  sent: "Sent",
};

export const CORRESPONDENCE_CHANNEL: Record<CorrespondenceChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  phone: "Phone",
  letter: "Letter",
  website: "Website",
  other: "Other",
};

export const CORRESPONDENCE_STATUS: Record<CorrespondenceStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
};

export const ESCALATION_CATEGORY: Record<EscalationCategory, string> = {
  negotiation: "Negotiation",
  pricing: "Pricing",
  valuation: "Valuation",
  complaint: "Complaint",
  legal: "Legal",
  confidential: "Confidential Matter",
  investment_advice: "Investment Advice",
  major_client: "Major Client",
  institutional: "Institutional Opportunity",
  transaction: "Transaction Issue",
  media: "Media/Public Relations",
  unusual: "Unusual Request",
  other: "Other",
};

export const ESCALATION_STATUS: Record<EscalationStatus, string> = {
  open: "Open",
  under_review: "Under Review",
  resolved: "Resolved",
  closed: "Closed",
};

export const PROPERTY_TYPES = [
  "Warehouse",
  "Office",
  "Retail",
  "Industrial",
  "Mixed Use",
  "Land",
  "Residential Investment",
  "Hospitality",
  "Other",
];

export const STUDIO_URL = "https://murivest.com/studio";

export type WorkLogStatus = "submitted" | "verified" | "approved" | "rejected" | "paid";
export type MasterDbStatus = "yes" | "no" | "not_applicable";
export type PaymentMethod = "mpesa" | "bank_transfer" | "cash" | "other";

export const WORK_LOG_STATUS: Record<WorkLogStatus, string> = {
  submitted: "Submitted",
  verified: "Verified",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

export const MASTER_DB_STATUS: Record<MasterDbStatus, string> = {
  yes: "Yes",
  no: "No",
  not_applicable: "N/A",
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  other: "Other",
};

export const PUBLISH_PLATFORMS = ["Murivest Studio", "Jiji", "Property24", "Facebook", "Instagram", "LinkedIn", "Other"];

export const PUBLISH_COUNTRIES = ["Kenya", "UK", "UAE", "USA", "South Africa", "Other"];

/** Listing categories used by the work log, mirroring the upload tracker sheet. */
export const PUBLISH_PROPERTY_TYPES = [
  "Properties For Rent",
  "Properties For Sale",
  "Land Banking",
  "Commercial Spaces",
  "International Listings",
  "Other",
];

/** Financial fields that require the properties.edit.financials permission. */
export const RESTRICTED_PROPERTY_FIELDS = [
  "price",
  "annual_income",
  "monthly_income",
  "yield_percent",
  "occupancy",
  "land_size",
  "building_size",
];

export function optionsOf<T extends string>(map: Record<T, string>) {
  return (Object.keys(map) as T[]).map((value) => ({ value, label: map[value] }));
}

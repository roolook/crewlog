export type TenantStatus = "preview" | "active" | "churned";
export type MemberRole = "owner" | "crew";
export type MemberStatus = "active" | "pending" | "removed";
export type FieldType = "text" | "number" | "date" | "dropdown" | "boolean";
export type IntakeStatus =
  | "queued"
  | "building"
  | "preview_sent"
  | "activated"
  | "archived";

export type Tenant = {
  id: string;
  slug: string;
  name: string;
  log_label: string;
  status: TenantStatus;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  hero_label: string;
  hero_field_key: string | null;
  hero_field_value: string | null;
  source_file_name: string | null;
  source_row_count: number;
  storage_limit_mb: number;
  notes: string | null;
  preview_expires_at: string | null;
  activated_at: string | null;
  created_at: string;
};

export type TenantField = {
  id: string;
  tenant_id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  on_card: boolean;
  options: string[];
  is_title: boolean;
  is_status: boolean;
  position: number;
};

export type Entry = {
  id: string;
  tenant_id: string;
  entry_no: number;
  data: Record<string, string | number | boolean | null>;
  title: string;
  status_value: string | null;
  occurred_on: string | null;
  created_by: string | null;
  created_by_name: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Member = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: MemberRole;
  status: MemberStatus;
  invite_token: string | null;
  last_log_at: string | null;
  joined_at: string | null;
};

export type IntakeSubmission = {
  id: string;
  name: string;
  email: string;
  notes: string | null;
  phone: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  by_email: boolean;
  status: IntakeStatus;
  tenant_id: string | null;
  created_at: string;
};

export type ChangeRequest = {
  id: string;
  tenant_id: string | null;
  requester: string;
  requester_email: string | null;
  body: string;
  done: boolean;
  created_at: string;
  done_at: string | null;
};

/** A tenant plus everything the app shell needs to render itself. */
export type TenantBundle = {
  tenant: Tenant;
  fields: TenantField[];
  entries: Entry[];
  members: Member[];
  /** Role of the signed-in viewer, or null for the unauthenticated demo. */
  viewerRole: MemberRole | null;
  viewerName: string;
};

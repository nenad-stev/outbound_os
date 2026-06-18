// Hand-written types for the entities the UI touches today.
// Once the cloud DB is live, replace/augment with `supabase gen types typescript`.

export type UserRole = "admin" | "operator" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export type CampaignType = "initial" | "follow_up" | "ad_hoc";
export type PersonalizationLevel = "light" | "medium" | "heavy";
export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type SequenceChannel = "connection_request" | "message" | "inmail";

export interface SequenceStep {
  id: string;
  campaign_id: string;
  step_order: number;
  channel: SequenceChannel;
  template_text: string;
  ai_instructions: string | null;
  delay_days: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  type: CampaignType;
  personalization_level: PersonalizationLevel;
  status: CampaignStatus;
  heyreach_campaign_id: string | null;
  parent_campaign_id: string | null;
  sender_profile_id: string | null;
  followup_delay_days: number | null;
  created_by: string | null;
  created_at: string;
}

export interface IcpProfile {
  id: string;
  client_id: string;
  name: string;
  target_description: string | null;
  anti_target: string | null;
  target_roles: string[];
  good_signals: string[];
  bad_signals: string[];
  weight_overrides: { icp_fit: number; signal: number; engagement: number };
  must_have: { field: string; value: string }[];
  must_not: { field: string; value: string }[];
  is_default: boolean;
  created_at: string;
}

export interface SenderProfile {
  id: string;
  client_id: string;
  full_name: string;
  linkedin_url: string | null;
  heyreach_account_id: string | null;
  daily_limit: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export type UUID = string;

export type AgeRange = "13-17" | "18-24" | "25-34" | "35-44" | "45+";

export type UserRole =
  | "help_seeker"
  | "helper"
  | "case_verifier"
  | "case_owner"
  | "moderator"
  | "admin"
  | "head_admin";

export interface ApiErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export interface UserInfo {
  id: UUID;
  name: string;
  email: string;
  phone: string;
  city: string;
  age_range: string;
  roles: string[];
  verification_level: number;
  avatar_url: string | null;
}

export interface SignupRequest {
  name: string;
  phone: string;
  email: string;
  city: string;
  age_range: AgeRange;
  invite_code: string;
  roles: Extract<UserRole, "help_seeker" | "helper">[];
}

export interface SignupResponse {
  id: UUID;
  name: string;
  verification_level: number;
  pending_verification: string[];
  message: string;
}

export interface VerifyOtpRequest {
  phone_or_email: string;
  otp_code: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  verification_level: number;
  message: string;
  // Present when user becomes fully verified — use for auto-login
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: UserInfo;
}

export interface ResendOtpRequest {
  phone_or_email: string;
}

export interface ResendOtpResponse {
  message: string;
}

export interface LoginRequest {
  phone_or_email: string;
  otp_code: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

export interface PrivacySettings {
  show_email: boolean;
  show_phone: boolean;
  show_full_city: boolean;
}

export interface MyUserProfile {
  id: UUID;
  name: string;
  email: string;
  phone: string;
  city: string;
  age_range: string;
  bio: string | null;
  avatar_url: string | null;
  roles: string[];
  verification_level: number;
  phone_verified: boolean;
  email_verified: boolean;
  is_active: boolean;
  skills: string[];
  privacy_settings: PrivacySettings;
}

export interface PublicUserProfile {
  id: UUID;
  name: string;
  city: string | null;
  age_range: string;
  bio: string | null;
  avatar_url: string | null;
  roles: string[];
  verification_level: number;
  skills: string[];
  email: string | null;
  phone: string | null;
}

export interface BlockedUserResponse {
  id: UUID;
  blocked_user_id: UUID;
  blocked_at: string;
}

export interface UpdateProfilePayload {
  name?: string;
  city?: string;
  age_range?: AgeRange;
  bio?: string;
  avatar_url?: string;
}

export interface AuthorInfo {
  id: UUID;
  name: string;
  verification_level: number;
}

export interface PostResponse {
  id: UUID;
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  status: string;
  author: AuthorInfo;
  created_at: string;
  updated_at: string;
}

export interface PostSummary {
  id: UUID;
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  status: string;
  author: AuthorInfo;
  created_at: string;
}

export interface FeedResponse {
  items: PostSummary[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export interface CreatePostPayload {
  title: string;
  description: string;
  category:
    | "emotional_support"
    | "mentorship"
    | "skill_sharing"
    | "navigation"
    | "on_ground"
    | "urgent";
  urgency: "low" | "normal" | "high" | "critical";
  city: string;
  contact_prefs?: Record<string, boolean>;
}

export interface UpdatePostPayload {
  title?: string;
  description?: string;
  category?: CreatePostPayload["category"];
  urgency?: CreatePostPayload["urgency"];
  contact_prefs?: Record<string, boolean>;
}

export interface CommentAuthor {
  id: UUID;
  name: string;
  verification_level: number;
}

export interface CommentResponse {
  id: UUID;
  post_id: UUID;
  author: CommentAuthor;
  body: string;
  created_at: string;
}

export interface CasePostInfo {
  id: UUID;
  title: string;
  category: string;
  urgency: string;
  city: string;
  author_id: UUID;
}

export interface CaseOwnerInfo {
  id: UUID;
  name: string;
  verification_level: number;
}

export interface CaseResponse {
  id: UUID;
  post: CasePostInfo;
  owner: CaseOwnerInfo | null;
  status: string;
  helper_count: number;
  closure_requested_by: UUID | null;
  closure_requested_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseListResponse {
  items: CaseResponse[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export interface CaseHelperResponse {
  id: UUID;
  case_id: UUID;
  user_id: UUID;
  status: string;
  offered_at: string;
  withdrawn_at: string | null;
}

export interface CaseNoteResponse {
  id: UUID;
  case_id: UUID;
  author: CommentAuthor;
  body: string;
  support_type: string | null;
  hours_contributed: number | null;
  attachment_s3_key: string | null;
  created_at: string;
}

export interface CaseClosureResponse {
  id: UUID;
  case_id: UUID;
  closed_by: UUID;
  confirmed_by: UUID | null;
  resolution_type: string;
  remarks: string;
  impact_story: string | null;
  impact_consent: boolean;
  created_at: string;
}

export interface ConsentRequestResponse {
  id: UUID;
  from_user_id: UUID;
  to_user_id: UUID;
  post_id: UUID | null;
  status: string;
  responded_at: string | null;
  created_at: string;
}

export interface ConversationResponse {
  id: UUID;
  consent_id: UUID;
  user_a: UUID;
  user_b: UUID;
  ended_at: string | null;
  created_at: string;
}

export interface MessageResponse {
  id: UUID;
  conversation_id: UUID;
  sender_id: UUID;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface ConversationDetailResponse {
  conversation: ConversationResponse;
  messages: MessageResponse[];
}

export interface VerificationQueueItem {
  post_id: UUID;
  title: string;
  category: string;
  urgency: string;
  city: string;
  author: AuthorInfo;
  submitted_at: string;
}

export interface VerificationQueueResponse {
  items: VerificationQueueItem[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export interface VerificationActionResponse {
  post_id: UUID;
  decision: string;
  new_status: string;
  remarks: string;
  case_id: UUID | null;
  actioned_at: string;
}

export type ReportTargetType = "post" | "comment" | "message" | "user";
export type ReportReason = "spam" | "harassment" | "fraud" | "solicitation" | "crisis" | "other";
export type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

export interface ReportResponse {
  id: UUID;
  reporter_id: UUID;
  target_type: string;
  target_id: UUID;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
}

export interface ReportListResponse {
  items: ReportResponse[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export type ModerationActionType = "warn" | "restrict" | "suspend" | "ban" | "dismiss";

export interface ModerationActionResponse {
  id: UUID;
  report_id: UUID | null;
  target_user_id: UUID;
  acted_by: UUID;
  action: string;
  reason: string;
  duration_hours: number | null;
  expires_at: string | null;
  created_at: string;
}

export interface ModerationActionListResponse {
  items: ModerationActionResponse[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export interface InviteCodeResponse {
  id: UUID;
  code: string;
  max_uses: number;
  use_count: number;
  expires_at: string;
  created_at: string;
  is_available: boolean;
}

export interface GoogleSignupRequest {
  invite_code: string;
  id_token: string;
  phone: string;
  city: string;
  age_range: AgeRange;
  roles: Extract<UserRole, "help_seeker" | "helper">[];
}

export interface GoogleLoginRequest {
  id_token: string;
}

// Google signup and login both return the same shape as OTP token login
export type GoogleAuthResponse = TokenResponse;

export interface FeedFilters {
  city: string;
  category: string;
  urgency: string;
  search: string;
}

export interface AdminStatsResponse {
  total_users: number;
  verified_users: number;
  suspended_users: number;
  active_posts: number;
  open_cases: number;
  pending_verifications: number;
  pending_reports: number;
}

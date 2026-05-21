export interface PublicAuthorInfo {
  id: string;
  name: string;
  verification_level: number;
}

export interface PublicPostSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: string;
  city: string;
  status: string;
  helper_count: number;
  author: PublicAuthorInfo;
  created_at: string;
}

export type PublicPostDetail = PublicPostSummary;

export interface PublicFeedResponse {
  items: PublicPostSummary[];
  page: number;
  per_page: number;
  total: number;
  has_next: boolean;
}

export interface PublicCommentAuthor {
  id: string;
  name: string;
  verification_level: number;
}

export interface PublicCommentResponse {
  id: string;
  post_id: string;
  author: PublicCommentAuthor;
  body: string;
  created_at: string;
}

export interface LandingStatsResponse {
  helped: number;
  verified_members: number;
  active_cases: number;
  cities: number;
  generated_at: string;
}

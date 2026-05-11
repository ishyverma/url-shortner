export interface Link {
  id: string;
  slug: string;
  originalUrl: string;
  workspaceId: string;
  domain: string;
  tags: string[];
  totalClicks: number;
  uniqueClicks: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  apiKey: string;
  createdAt: string;
}

export interface LinkStats {
  totalClicks: number;
  uniqueClicks: number;
  last24hClicks?: number;
  last7dClicks?: number;
  last30dClicks?: number;
  topCountries: { country: string; clicks: number }[];
  topDevices: { device: string; clicks: number }[];
  topBrowsers: { browser: string; clicks: number }[];
  topReferrers: { refDomain: string; clicks: number }[];
}

export interface TimeseriesPoint {
  timestamp: string;
  clicks: number;
  uniqueVisitors: number;
}

export interface TimeseriesResponse {
  data: TimeseriesPoint[];
  interval: string;
  groupBy: string;
  source?: string;
}

export interface CreateLinkPayload {
  url: string;
  slug?: string;
  expiresAt?: string;
  password?: string;
  tags?: string[];
  domain?: string;
  workspaceId?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
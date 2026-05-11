const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export const api = {
  links: {
    list: (params?: { page?: number; limit?: number; workspaceId?: string }) => {
      const query = new URLSearchParams();
      if (params?.page) query.set("page", params.page.toString());
      if (params?.limit) query.set("limit", params.limit.toString());
      if (params?.workspaceId) query.set("workspaceId", params.workspaceId);
      return fetchApi<{ data: any[]; pagination: any }>(`/api/v1/links?${query}`);
    },
    get: (slug: string) => fetchApi<{ data: any }>(`/api/v1/links/${slug}`),
    create: (data: any) => fetchApi<{ data: any }>("/api/v1/links", { method: "POST", body: JSON.stringify(data) }),
    update: (slug: string, data: any) => fetchApi<{ data: any }>(`/api/v1/links/${slug}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (slug: string) => fetchApi<{ success: boolean }>(`/api/v1/links/${slug}`, { method: "DELETE" }),
  },
  analytics: {
    get: (slug: string) => fetchApi<{ data: any }>(`/api/v1/analytics/${slug}`),
    stats: (slug: string) => fetchApi<{ data: any }>(`/api/v1/analytics/${slug}/stats`),
    timeseries: (slug: string, params?: { interval?: string; from?: string; to?: string }) => {
      const query = new URLSearchParams();
      if (params?.interval) query.set("interval", params.interval);
      if (params?.from) query.set("from", params.from);
      if (params?.to) query.set("to", params.to);
      return fetchApi<any>(`/api/v1/analytics/${slug}/timeseries?${query}`);
    },
    countries: (slug: string) => fetchApi<{ data: any[] }>(`/api/v1/analytics/${slug}/countries`),
    devices: (slug: string) => fetchApi<{ data: any[] }>(`/api/v1/analytics/${slug}/devices`),
    browsers: (slug: string) => fetchApi<{ data: any[] }>(`/api/v1/analytics/${slug}/browsers`),
    os: (slug: string) => fetchApi<{ data: any[] }>(`/api/v1/analytics/${slug}/os`),
    referrers: (slug: string) => fetchApi<{ data: any[] }>(`/api/v1/analytics/${slug}/referrers`),
    utm: (slug: string) => fetchApi<{ data: any }>(`/api/v1/analytics/${slug}/utm`),
    workspace: (workspaceId: string, params?: { period?: string; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.period) query.set("period", params.period);
      if (params?.limit) query.set("limit", params.limit.toString());
      return fetchApi<{ data: any }>(`/api/v1/analytics/workspace/${workspaceId}?${query}`);
    },
  },
  workspaces: {
    list: (params?: { userId?: string }) => {
      const query = params?.userId ? `?userId=${params.userId}` : "";
      return fetchApi<{ data: any[] }>(`/api/v1/workspaces${query}`);
    },
    get: (id: string) => fetchApi<{ data: any }>(`/api/v1/workspaces/${id}`),
    create: (data: any) => fetchApi<{ data: any }>("/api/v1/workspaces", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => fetchApi<{ data: any }>(`/api/v1/workspaces/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => fetchApi<{ success: boolean }>(`/api/v1/workspaces/${id}`, { method: "DELETE" }),
    rotateApiKey: (id: string) => fetchApi<{ data: any }>(`/api/v1/workspaces/${id}/api-key/rotate`, { method: "POST" }),
  },
};
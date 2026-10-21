/**
 * Critical Ops Public API Server Client
 * 
 * SECURITY:
 * - Must strictly run on the server side (Server Components, Server Actions, Route Handlers).
 * - Never expose COPS_API_KEY to client components or with NEXT_PUBLIC_ prefix.
 * - Parses and respects X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset headers.
 * - Integrates with Next.js fetch revalidation (caching).
 */

import {
  CopsApiResponse,
  CopsErrorCode,
  CopsErrorResponse,
  GameTypeQuery,
  LeaderboardResponse,
  LeaderboardSortType,
  MatchHistoryEntry,
  MatchInfo,
  MatchesFetchResponse,
  PlayerMatchesResponse,
  PlayerProfile,
  RateLimitInfo,
  ServersStatusMap,
  WeaponStats,
  AutohostCreateRequest,
  AutohostGame,
  AutohostControlRequest,
} from "@/types/cops";

// Server-only runtime safeguard
if (typeof window !== "undefined") {
  throw new Error(
    "SECURITY VIOLATION: CopsApiClient must only be imported and executed on the server!"
  );
}

export class CopsApiError extends Error {
  public readonly status: number;
  public readonly code: CopsErrorCode | "unknown_error";
  public readonly retryAfter?: number;
  public readonly rateLimit?: RateLimitInfo;

  constructor(
    message: string,
    status: number,
    code: CopsErrorCode | "unknown_error" = "unknown_error",
    retryAfter?: number,
    rateLimit?: RateLimitInfo
  ) {
    super(`[C-Ops API Error ${status} - ${code}]: ${message}`);
    this.name = "CopsApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.rateLimit = rateLimit;
  }
}

export interface RequestOptions {
  revalidate?: number | false;
  tags?: string[];
}

export class CopsApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private lastKnownRateLimit: RateLimitInfo | null = null;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.COPS_API_KEY || "";
    this.baseUrl = (
      baseUrl ||
      process.env.COPS_API_BASE_URL ||
      "https://default.prod.copsapi.criticalforce.fi/api/public/v2"
    ).replace(/\/$/, "");

    if (!this.apiKey && process.env.NODE_ENV !== "test") {
      console.warn(
        "⚠️ [CopsApiClient] COPS_API_KEY is not defined in environment variables. Requests may fail with missing_token."
      );
    }
  }

  /**
   * Returns the most recently received rate limit information from C-Ops API.
   */
  public getLastRateLimit(): RateLimitInfo | null {
    return this.lastKnownRateLimit;
  }

  /**
   * Internal HTTP request handler with header parsing, rate limit monitoring, and error normalization.
   */
  private async request<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      query?: Record<string, string | number | boolean | (string | number)[] | undefined>;
      body?: unknown;
      nextOptions?: RequestOptions;
    } = {}
  ): Promise<CopsApiResponse<T>> {
    const { method = "GET", query, body, nextOptions } = options;

    // Build URL with search query parameters
    const url = new URL(`${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);

    if (query) {
      Object.entries(query).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          if (Array.isArray(val)) {
            // C-Ops API accepts comma-separated arrays for query parameters (e.g. ids=1,2,3)
            url.searchParams.append(key, val.join(","));
          } else {
            url.searchParams.append(key, String(val));
          }
        }
      });
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      headers["X-Api-Key"] = this.apiKey;
    }

    if (body) {
      headers["Content-Type"] = "application/json";
    }

    // Configure Next.js fetch caching
    const fetchInit: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } } = {
      method,
      headers,
    };

    if (body) {
      fetchInit.body = JSON.stringify(body);
    }

    if (nextOptions) {
      fetchInit.next = {
        revalidate: nextOptions.revalidate,
        tags: nextOptions.tags,
      };
    } else if (method === "GET") {
      // Default cache TTL: 300 seconds (5 minutes) for GET requests to respect rate limits
      fetchInit.next = {
        revalidate: 300,
      };
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), fetchInit);
    } catch (networkError) {
      throw new CopsApiError(
        networkError instanceof Error ? networkError.message : "Network fetch failed",
        500,
        "internal_error"
      );
    }

    // Parse Rate Limit Headers
    const limitHeader = response.headers.get("X-RateLimit-Limit");
    const remainingHeader = response.headers.get("X-RateLimit-Remaining");
    const resetHeader = response.headers.get("X-RateLimit-Reset");

    const rateLimit: RateLimitInfo = {
      limit: limitHeader ? parseInt(limitHeader, 10) : 60,
      remaining: remainingHeader ? parseInt(remainingHeader, 10) : 60,
      reset: resetHeader ? parseInt(resetHeader, 10) : Math.floor(Date.now() / 1000) + 60,
    };

    this.lastKnownRateLimit = rateLimit;

    if (rateLimit.remaining <= 5 && rateLimit.remaining > 0) {
      console.warn(
        `⚠️ [CopsApiClient] High Rate Limit Usage: ${rateLimit.remaining}/${rateLimit.limit} requests left. Resets at unix ${rateLimit.reset}`
      );
    }

    // Handle Non-200 Responses
    if (!response.ok) {
      let errorData: CopsErrorResponse | null = null;
      try {
        errorData = (await response.json()) as CopsErrorResponse;
      } catch {
        // Fallback if response body is not JSON
      }

      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfter = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : errorData?.error?.retry_after;

      const errorCode = errorData?.error?.code || "unknown_error";
      const errorMessage =
        errorData?.error?.message || response.statusText || `Request failed with status ${response.status}`;

      throw new CopsApiError(errorMessage, response.status, errorCode, retryAfter, rateLimit);
    }

    const data = (await response.json()) as T;
    return { data, rateLimit };
  }

  // ==========================================
  // PLAYERS & PROFILES ENDPOINTS
  // ==========================================

  /**
   * Look up player profiles by IDs and/or Usernames (up to 20 players per request)
   */
  public async getProfiles(params: {
    ids?: number[];
    usernames?: string[];
    nextOptions?: RequestOptions;
  }): Promise<PlayerProfile[]> {
    const { ids, usernames, nextOptions } = params;

    if ((!ids || ids.length === 0) && (!usernames || usernames.length === 0)) {
      return [];
    }

    const res = await this.request<PlayerProfile[]>("/profile", {
      method: "GET",
      query: {
        ids,
        usernames,
      },
      nextOptions,
    });

    return res.data;
  }

  /**
   * Convenience method to fetch a single profile by username
   */
  public async getProfileByUsername(
    username: string,
    nextOptions?: RequestOptions
  ): Promise<PlayerProfile | null> {
    const trimmed = username.trim();
    if (!trimmed) return null;

    try {
      const profiles = await this.getProfiles({
        usernames: [trimmed],
        nextOptions,
      });
      return profiles.length > 0 ? profiles[0] : null;
    } catch (err) {
      if (err instanceof CopsApiError && err.code === "user_not_found") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Convenience method to fetch a single profile by user ID
   */
  public async getProfileById(
    userId: number,
    nextOptions?: RequestOptions
  ): Promise<PlayerProfile | null> {
    if (!userId || userId <= 0) return null;

    try {
      const profiles = await this.getProfiles({
        ids: [userId],
        nextOptions,
      });
      return profiles.length > 0 ? profiles[0] : null;
    } catch (err) {
      if (err instanceof CopsApiError && err.code === "user_not_found") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Get weapon statistics for a specific player
   */
  public async getWeaponStats(
    userId: number,
    gameType: GameTypeQuery = GameTypeQuery.Ranked,
    nextOptions?: RequestOptions
  ): Promise<WeaponStats[]> {
    const res = await this.request<WeaponStats[]>("/stats/weapons", {
      method: "GET",
      query: {
        user_id: userId,
        game_type: gameType,
      },
      nextOptions,
    });

    return res.data;
  }

  // ==========================================
  // SERVER STATUS ENDPOINTS
  // ==========================================

  /**
   * Get live status of all game server regions
   * Cache revalidate default: 60 seconds
   */
  public async getServerStatus(
    nextOptions: RequestOptions = { revalidate: 60 }
  ): Promise<ServersStatusMap> {
    const res = await this.request<ServersStatusMap>("/status/servers", {
      method: "GET",
      nextOptions,
    });

    return res.data;
  }

  // ==========================================
  // MATCHES ENDPOINTS
  // ==========================================

  /**
   * Get a player's recent match history entries
   */
  public async getPlayerMatches(
    userId: number,
    nextOptions?: RequestOptions
  ): Promise<MatchHistoryEntry[]> {
    const res = await this.request<PlayerMatchesResponse>("/matches/player", {
      method: "GET",
      query: {
        user_id: userId,
      },
      nextOptions,
    });

    return res.data.matches;
  }

  /**
   * Fetch full match reports by match IDs
   */
  public async getMatches(
    matchIds: string[],
    nextOptions?: RequestOptions
  ): Promise<MatchInfo[]> {
    if (!matchIds || matchIds.length === 0) return [];

    const res = await this.request<MatchesFetchResponse>("/matches/fetch", {
      method: "GET",
      query: {
        ids: matchIds,
      },
      nextOptions,
    });

    return res.data.matches;
  }

  // ==========================================
  // LEADERBOARDS ENDPOINTS
  // ==========================================

  /**
   * Get seasonal leaderboard ranking
   */
  public async getLeaderboard(params: {
    type: LeaderboardSortType;
    page?: number;
    rank?: number;
    nextOptions?: RequestOptions;
  }): Promise<LeaderboardResponse> {
    const { type, page = 1, rank, nextOptions } = params;

    const res = await this.request<LeaderboardResponse>("/leaderboards", {
      method: "GET",
      query: {
        type,
        page,
        rank,
      },
      nextOptions: nextOptions || { revalidate: 300 },
    });

    return res.data;
  }

  // ==========================================
  // AUTOHOST (CUSTOM MATCH AUTOMATION) ENDPOINTS
  // ==========================================

  /**
   * Request game servers to host a custom match (Requires Autohost permission token)
   */
  public async createAutohost(
    params: AutohostCreateRequest
  ): Promise<{ id: number; pending_expires_at: number | null }> {
    const res = await this.request<{ id: number; pending_expires_at: number | null }>(
      "/autohost/create",
      {
        method: "POST",
        body: params,
        nextOptions: { revalidate: false },
      }
    );

    return res.data;
  }

  /**
   * Poll active hosted games to track room status, scores, and connected players
   */
  public async pollAutohosts(gameIds: number[]): Promise<AutohostGame[]> {
    if (!gameIds || gameIds.length === 0) return [];

    const res = await this.request<AutohostGame[]>("/autohost/poll", {
      method: "GET",
      query: {
        ids: gameIds,
      },
      nextOptions: { revalidate: false },
    });

    return res.data;
  }

  /**
   * Send control actions to an autohosted room (kick, restart, close, ownership)
   */
  public async controlAutohost(params: AutohostControlRequest): Promise<void> {
    await this.request<void>("/autohost/control", {
      method: "POST",
      body: params,
      nextOptions: { revalidate: false },
    });
  }
}

// Export default singleton instance for direct server-side imports
export const copsApi = new CopsApiClient();

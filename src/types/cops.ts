/**
 * Critical Ops Public API TypeScript Definitions
 * Derived strictly from the official Critical Ops OpenAPI 3.1.0 Specification
 * Base URL: https://default.prod.copsapi.criticalforce.fi/api/public/v2
 */

// --- Base & Error Types ---

export type CopsErrorCode =
  | "missing_token"
  | "invalid_token"
  | "token_revoked"
  | "insufficient_permissions"
  | "rate_limited"
  | "bad_request"
  | "user_not_found"
  | "game_not_found"
  | "server_unavailable"
  | "api_disabled"
  | "internal_error";

export interface CopsErrorDetail {
  code: CopsErrorCode;
  message: string;
  retry_after?: number;
}

export interface CopsErrorResponse {
  error: CopsErrorDetail;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

export interface CopsApiResponse<T> {
  data: T;
  rateLimit: RateLimitInfo;
}

// --- Player & Profile Types ---

export type AccountAge =
  | "1w"
  | "1m"
  | "3m"
  | "1y"
  | "2y"
  | "3y"
  | "4y"
  | "5y+";

export enum UserType {
  Spectator = 0,
  User = 1,
  AssistantMod = 2,
  Moderator = 4,
  VeteranMod = 8,
  Developer = 64,
}

export enum PartyInvitePermission {
  Anybody = 0,
  OnlyFriendsAndClanMembers = 1,
  Nobody = 2,
}

export enum BanType {
  Permanent = 0,
  Temporary = 1,
}

export enum BanReason {
  Unknown = 0,
  FraudAttempt = 1,
  Hacking = 2,
  Griefing = 3,
  VerbalAbuse = 4,
  Idle = 5,
  Spam = 6,
  ReportAbuse = 7,
  AccountTrading = 8,
  Glitching = 9,
  Ghosting = 10,
  PartyingWithHacker = 11,
  UnderInvestigation = 12,
  MarketplaceAbuse = 13,
}

export interface BanInfo {
  type: BanType;
  reason: BanReason;
  days_left: number;
}

export interface PlayerLevel {
  level: number;
  current_xp: number;
  next_level_xp: number;
}

export interface ProfileBasicInfo {
  user_id: number;
  name: string;
  user_type: UserType;
  icon_id: number;
  player_level: PlayerLevel;
  last_seen_time: string;
}

export enum ClanMemberRank {
  Member = 10,
  Officer = 20,
  CoLeader = 30,
  Leader = 40,
}

export interface ClanBasicInfo {
  id: number;
  name: string;
  tag: string;
  emblem_id: number;
}

export interface ClanMembership {
  basic_info: ClanBasicInfo;
  member_rank: ClanMemberRank;
  joined: string; // YYYY-MM-DD HH:MM:SS
}

export interface MatchStats {
  k: number; // Kills
  d: number; // Deaths
  a: number; // Assists
  w: number; // Wins
  l: number; // Losses
}

export interface SeasonStats {
  season: number;
  ranked: MatchStats;
  casual: MatchStats;
  custom: MatchStats;
}

export interface RankedStats {
  placement_matches_left: number;
  wins: number;
  losses: number;
  highest_rank: number;
  mmr: number;
  global_position: number;
  rank: number;
}

export interface LeaderboardPosition {
  position: number;
  score: number;
}

export interface ProfileStats {
  seasonal_stats: SeasonStats[];
  ranked: RankedStats;
  leaderboard_data: LeaderboardPosition;
}

export interface PlayerProfile {
  basic_info: ProfileBasicInfo;
  account_age: AccountAge;
  blocked_friend_requests: boolean;
  blocked_clan_requests: boolean;
  party_invite_permissions: PartyInvitePermission;
  ban: BanInfo | null;
  stats: ProfileStats;
  clan?: ClanMembership;
}

// --- Weapon Stats Types ---

export enum GameTypeQuery {
  Ranked = 1,
  CasualAndCustom = 2,
}

export interface WeaponStats {
  weapon_id: number;
  name: string;
  k: number;
  a: number;
  h: number; // Headshots
}

export interface WeaponsStatsResponse {
  weapons: WeaponStats[];
}

// --- Server Status Types ---

export type ServerState = "online" | "offline";

export interface ServerStatus {
  name: string;
  status: ServerState;
}

export type ServersStatusMap = Record<string, ServerStatus>;

// --- Match & History Types ---

export interface MatchHistoryEntry {
  id: string;
  game_type: number;
  game_mode_id: number;
  map_id: number;
  team: number;
  result: number;
  left_match: boolean;
  scores: number[];
}

export interface PlayerMatchesResponse {
  matches: MatchHistoryEntry[];
}

export interface MatchPlayer {
  user_id: number;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
  input_device_flags: number;
  left_match: boolean;
  leave_reason: string | null;
  level: number;
  match_presence: number;
  party_info: Record<string, unknown> | null;
}

export interface MatchInfo {
  id: string;
  game_type: number;
  game_mode_id: number;
  server_id: number;
  map_id: number;
  team_factions: number[];
  winning_team: number;
  win_condition: string;
  scores: number[];
  started_at: number;
  ended_at: number;
  players: MatchPlayer[];
  replay_id: string | null;
}

export interface MatchesFetchResponse {
  matches: MatchInfo[];
}

// --- Leaderboard Types ---

export type LeaderboardSortType =
  | "mmr"
  | "kills"
  | "deaths"
  | "assists"
  | "matches"
  | "wins"
  | "losses"
  | "xp"
  | "mvp";

export interface LeaderboardEntry {
  position: number;
  score: number;
  basic_info: ProfileBasicInfo;
  ranked: RankedStats;
  clan?: ClanMembership;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  leaderboard_size: number;
}

// --- Autohost (Custom Match Hosting) Types ---

export interface AutohostCreateRequest {
  server_id: number;
  room_name: string;
  password?: string;
  map_id: number;
  game_mode_id: number;
}

export interface AutohostRoom {
  id: number;
  code: string | null;
  name: string;
  map_id: number;
  game_mode_id: number;
  has_password: boolean;
}

export interface PlayerMatchLiveStats {
  user_id: number;
  team: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
  input_device_flags: number;
  left_match: boolean;
  leave_reason: string | null;
  ping: number;
  user_type: number;
  is_owner: boolean;
}

export interface AutohostResult {
  match_id: string | null;
  map_id: number;
  team_factions: number[];
  winning_team: number;
  win_condition: string;
  scores: number[];
  started_at: number;
  ended_at: number;
  map_variation: number;
  rounds_played: number;
  players: PlayerMatchLiveStats[];
}

export type AutohostStatus = "open" | "ended";
export type MatchState =
  | "WaitingForPlayers"
  | "Starting"
  | "Freezetime"
  | "OnGoing"
  | "BombPlanted"
  | "Win"
  | "TeamFlip"
  | "GameEnd"
  | "ChangingMap";

export interface AutohostGame {
  id: number;
  status: AutohostStatus;
  created_at: number;
  updated_at: number;
  ended_at: number | null;
  pending_expires_at: number | null;
  server_id: number;
  room: AutohostRoom;
  player_count: number;
  match_started_at: number | null;
  match_state: MatchState | null;
  round: number;
  scores: number[];
  players: PlayerMatchLiveStats[];
  results: AutohostResult[];
  replay_id: string | null;
  rejection_reason: string | null;
}

export type AutohostCommand =
  | "kick"
  | "restart"
  | "room_owner_add"
  | "room_owner_remove"
  | "close";

export interface AutohostControlRequest {
  id: number;
  command: AutohostCommand;
  user_id?: number | null;
}

// --- Official Map & Game Mode Enums and Constants ---

export const GAME_MODES = {
  DEFUSE: 15773,
  ELIMINATION: 15775,
  GUNGAME: 15776,
  TEAM_DEATHMATCH: 15777,
  MANHUNT: 15846,
  TOURNAMENT_MODE: 15847,
  RUSH: 15860,
  DEFEND: 15861,
  MANHUNT_Z: 18596,
  WINGMAN: 18850,
} as const;

export const OFFICIAL_MAPS = {
  CANALS: 613,
  PLAZA: 615,
  LEGACY: 617,
  GROUNDED: 618,
  BUREAU: 619,
  BREWERY: 839,
  DIVISION: 841,
  UPLINK: 1311,
  YARD: 1312,
  RAID: 1360,
  HEAT: 4483,
  WAREHOUSE: 6655,
  GALLERY: 6670,
  PORT: 6677,
  PARK: 7201,
  PURIFY: 7316,
  CARGO: 7554,
  ARCTIC: 7584,
  BOUT: 8024,
  SOAR: 8427,
  SHANTY: 8872,
  HANGAR: 9310,
  VILLAGE: 13410,
  IMPASSE: 14066,
  OVERHAUL: 15028,
  CASTELLO: 15391,
} as const;

export type GameModeId = (typeof GAME_MODES)[keyof typeof GAME_MODES];
export type MapId = (typeof OFFICIAL_MAPS)[keyof typeof OFFICIAL_MAPS];

export interface MapMetadata {
  id: number;
  name: string;
  isCompetitive: boolean;
  image?: string;
}

export const MAP_METADATA_LIST: MapMetadata[] = [
  { id: 613, name: "Canals", isCompetitive: true },
  { id: 615, name: "Plaza", isCompetitive: true },
  { id: 617, name: "Legacy", isCompetitive: true },
  { id: 618, name: "Grounded", isCompetitive: true },
  { id: 619, name: "Bureau", isCompetitive: true },
  { id: 839, name: "Brewery", isCompetitive: true },
  { id: 841, name: "Division", isCompetitive: false },
  { id: 1311, name: "Uplink", isCompetitive: false },
  { id: 1312, name: "Yard", isCompetitive: false },
  { id: 1360, name: "Raid", isCompetitive: true },
  { id: 4483, name: "Heat", isCompetitive: false },
  { id: 6655, name: "Warehouse", isCompetitive: false },
  { id: 6670, name: "Gallery", isCompetitive: false },
  { id: 6677, name: "Port", isCompetitive: true },
  { id: 7201, name: "Park", isCompetitive: false },
  { id: 7316, name: "Purify", isCompetitive: false },
  { id: 7554, name: "Cargo", isCompetitive: false },
  { id: 7584, name: "Arctic", isCompetitive: false },
  { id: 8024, name: "Bout", isCompetitive: false },
  { id: 8427, name: "Soar", isCompetitive: true },
  { id: 8872, name: "Shanty", isCompetitive: false },
  { id: 9310, name: "Hangar", isCompetitive: false },
  { id: 13410, name: "Village", isCompetitive: true },
  { id: 14066, name: "Impasse", isCompetitive: false },
  { id: 15028, name: "Overhaul", isCompetitive: false },
  { id: 15391, name: "Castello", isCompetitive: true },
];

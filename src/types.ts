export type LineKey = 'top' | 'jgl' | 'mid' | 'adc' | 'sup';
export type LineName = 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SUP';

export const LINE_KEYS: LineKey[] = ['top', 'jgl', 'mid', 'adc', 'sup'];

export const LINE_LABELS: Record<LineKey, LineName> = {
  top: 'TOP',
  jgl: 'JGL',
  mid: 'MID',
  adc: 'ADC',
  sup: 'SUP',
};

export type MatchFormat = '단판' | '3판2선승' | '5판3선승';
export type WinningTeam = 'Red' | 'Blue';

export type TeamRoster = Record<LineKey, string>;
export type TeamChamps = Record<LineKey, string>;
export type TeamKda = Record<LineKey, string>;

export interface PlayerGameDetail {
  player: string;
  champion: string;
  line: LineKey;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  damage_dealt: number; // 딜량 (총 챔피언 피해량)
  gold_per_minute: number; // 분당 골드
  runes: string[]; // 특성 (이미지 원본 명칭 그대로 저장)
  spells: string[]; // 스펠 (이미지 원본 명칭 그대로 저장)
  items: string[]; // 아이템 (이미지 원본 명칭 그대로 저장)
}

export interface TeamGameDetail {
  team_kda: string; // 팀 KDA
  global_gold: string | number; // 글로벌 골드
  players: Record<LineKey, PlayerGameDetail>;
}

export interface MatchExtractedData {
  game_duration?: string; // 경기 시간 (예: "32:15")
  winning_team?: WinningTeam;
  red_team?: TeamGameDetail;
  blue_team?: TeamGameDetail;
  screenshots?: {
    red?: string;
    blue?: string;
  };
}

export interface Match {
  id: string;
  date: string; // YYYY-MM-DD
  ck_name: string;
  team_a: TeamRoster; // Red
  team_b: TeamRoster; // Blue
  team_a_champs: TeamChamps;
  team_b_champs: TeamChamps;
  ban_a: string[];
  ban_b: string[];
  team_a_kda: TeamKda;
  team_b_kda: TeamKda;
  score: string; // e.g. "1:0", "2:1"
  winning_team: WinningTeam;
  match_format: MatchFormat;
  set_number: number;
  game_duration?: string; // 경기시간 (원본 명칭/텍스트)
  team_a_detail?: TeamGameDetail; // Red팀 상세 통계 (딜량, 분당골드, 특성, 스펠, 아이템, 팀KDA, 글로벌골드)
  team_b_detail?: TeamGameDetail; // Blue팀 상세 통계
  red_screenshot?: string; // 첨부된 Red팀 결과 스크린샷 이미지
  blue_screenshot?: string; // 첨부된 Blue팀 결과 스크린샷 이미지
  extracted_data?: MatchExtractedData; // AI 비전 추출 원본 데이터 보존
  created_at?: string; // ISO 8601 string for DB/REST synchronization
  updated_at?: string; // ISO 8601 string for DB/REST synchronization
}

export interface ChampionStat {
  champ: string;
  picks: number;
  wins: number;
  losses: number;
  winrate: number;
  avgKDA: string;
  kSum: number;
  dSum: number;
  aSum: number;
  kdaCount: number;
}

export interface PlayerChampionStat {
  champ: string;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
}

export interface PartnerStat {
  name: string;
  line: LineName;
  games: number;
  wins: number;
}

export interface SynergyAnalysisResult {
  mode: 'current' | 'optimal';
  teamA: { line: LineName; player: string }[];
  teamB: { line: LineName; player: string }[];
  expected: number;
  breakdown: { name: string; winrate: number; games: number; line: LineName }[];
  wTeam: WinningTeam;
}

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
  funding?: number; // 총 별풍선 펀딩 개수 (숲TV)
  star_balloons?: number; // 별풍선 펀딩 개수 (alias 호환)
  funding_per_person?: number; // 인당 별풍선 펀딩 개수 (최종 산출액)
  funding_base_amount?: number; // 펀딩 기준 금액 (100% 기준 인당 금액)
  funding_ratio?: string; // 펀딩 배분 비율 (예: '100:0', '9:1', '8:2', '7:3', '6:4', '5:5')
  funding_target_team?: 'auto' | 'winner' | 'loser' | string; // 배분 적용 대상 (auto: 경기결과 연동, winner: 승리팀 지분, loser: 패배팀 지분)
  funding_split_count?: number; // 분배 인원 (기본 5인 - 승리팀, 또는 10인)
  has_partner_subsidy?: boolean; // 숲 파트너 지원금 (100만 원) ON/OFF
  partner_subsidy?: boolean; // 호환용 alias
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

export interface StreamerProfile {
  name: string; // 닉네임 (e.g. "우리밍_", "김민교")
  soop_id: string; // SOOP user_id (e.g. "kmj05317", "minkyo1994")
  main_position: LineKey; // 'top' | 'jgl' | 'mid' | 'adc' | 'sup'
  is_hidden?: boolean; // 숨김/비활성화 (true일 경우 라이브 방송 중이어도 화면 노출 제외)
  updated_at?: string;
  memo?: string;
}

export interface SoopLiveBroadcast {
  broad_no: string | number;
  user_id: string;
  user_nick: string;
  broad_title: string;
  broad_thumb: string;
  profile_img: string;
  total_view_cnt: string | number;
  broad_start: string;
  broad_resolution?: string;
  broad_bps?: string;
}

export interface LiveStreamerMember {
  profile: StreamerProfile;
  live?: SoopLiveBroadcast;
  isLive: boolean;
}


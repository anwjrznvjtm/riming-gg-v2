import React from 'react';
import { SoloTierListTab } from './SoloTierListTab';

interface MainTabProps {
  onToast: (msg: string) => void;
  // Props kept for interface compatibility
  stats?: any;
  matches?: any;
  onOpenSummaryModal?: () => void;
  allStreamers?: string[];
  allChampions?: string[];
  onJumpToStreamer?: (streamerName: string, matchId?: string, teamRole?: 'all' | 'ally' | 'enemy') => void;
  onAddMatch?: (m: any) => void;
  onUpdateMatch?: (m: any) => void;
  onDeleteMatch?: (id: string) => void;
  isAdmin?: boolean;
  onAdminLoginSuccess?: () => void;
  targetStreamer?: string;
  targetMatchId?: string;
  targetStreamerRole?: 'all' | 'ally' | 'enemy';
  jumpTimestamp?: number;
}

/**
 * 메인 탭:
 * 이전의 스트리머 내전/CK 전적 레이아웃(주요 플레이어, 총 세트 수 등)을 전부 제거하고,
 * 1단계에서 구축한 D1 DB(champions & builds 테이블)와 연동된
 * DeepLoL 스타일의 라이엇 공식 솔로랭크 티어리스트 화면을 제공합니다.
 */
export const MainTab: React.FC<MainTabProps> = ({ onToast }) => {
  return <SoloTierListTab onToast={onToast} />;
};

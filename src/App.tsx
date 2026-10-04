import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Match } from './types';
import {
  PASSCODE,
  ADMIN_SESSION_KEY,
  STORAGE_KEY_MATCHES,
  STORAGE_KEY_BACKUP,
  CHAMPIONS_LIST,
  KNOWN_STREAMERS,
  getInitialMatches,
} from './data/initialMatches';
import { calculateStats } from './lib/stats';
import { normalizeChampionName } from './lib/champions';
import { normalizeMatch } from './lib/matchSchema';
import { recalculateAllSeriesScores } from './lib/seriesScores';
import {
  fetchAllMatchesFromApi,
  createMatchOnApi,
  updateMatchOnApi,
  deleteMatchOnApi,
} from './lib/matchApi';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MainTab } from './components/MainTab';
import { SynergyTab } from './components/SynergyTab';
import { RollandTab } from './components/RollandTab';
import { SummaryModal } from './components/SummaryModal';
import { AdminLoginModal } from './components/AdminLoginModal';

export default function App() {
  const [matches, setMatches] = useState<Match[]>(() => {
    try {
      const alreadyPurged = localStorage.getItem('riming_mock_purged_v1');
      if (!alreadyPurged) {
        localStorage.removeItem(STORAGE_KEY_MATCHES);
        localStorage.removeItem(STORAGE_KEY_BACKUP);
        localStorage.setItem('riming_mock_purged_v1', 'true');
        return [];
      }
      const saved = localStorage.getItem(STORAGE_KEY_MATCHES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return recalculateAllSeriesScores(parsed.map((m) => normalizeMatch(m)));
        }
      }
    } catch (e) {
      console.warn('localStorage read error, fallback to initial matches', e);
    }
    return getInitialMatches();
  });

  const [currentTab, setCurrentTab] = useState<string>('main');
  const [targetStreamer, setTargetStreamer] = useState<string | null>(null);
  const [targetMatchId, setTargetMatchId] = useState<string | null>(null);
  const [targetStreamerRole, setTargetStreamerRole] = useState<'all' | 'ally' | 'enemy'>('all');
  const [jumpTimestamp, setJumpTimestamp] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // 스트리머 또는 경기 ID 및 아군/적팀 팀 역할을 받아서 메인(CK 일지)으로 전환하고 해당 경기 위치로 스크롤 점프
  const handleJumpToStreamer = useCallback((streamerName: string, matchId?: string, teamRole: 'all' | 'ally' | 'enemy' = 'all') => {
    setTargetStreamer(streamerName);
    setTargetMatchId(matchId || null);
    setTargetStreamerRole(teamRole);
    setJumpTimestamp(Date.now());
    setCurrentTab('main');
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const syncFromApi = useCallback(async (isSilent = false) => {
    if (!isSilent) setSyncStatus('syncing');
    try {
      const { matches: remoteMatches, source } = await fetchAllMatchesFromApi();
      if (Array.isArray(remoteMatches)) {
        const synced = recalculateAllSeriesScores(remoteMatches);
        setMatches(synced);
        setSyncStatus('synced');
        console.log(`[Cloud Sync] Synchronized ${synced.length} matches from ${source}`);
      }
    } catch (err) {
      console.warn('[Cloud Sync] Failed to sync:', err);
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    syncFromApi(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncFromApi(true);
      }
    }, 20000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFromApi(true);
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [syncFromApi]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MATCHES, JSON.stringify(matches));
      localStorage.setItem(STORAGE_KEY_BACKUP, JSON.stringify(matches));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [matches]);

  useEffect(() => {
    try {
      const sess = sessionStorage.getItem(ADMIN_SESSION_KEY);
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed.expiry && parsed.expiry > Date.now()) {
          setIsAdmin(true);
        } else {
          sessionStorage.removeItem(ADMIN_SESSION_KEY);
        }
      }
    } catch (e) {}
  }, []);

  const handleAdminLoginSuccess = () => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expiry }));
    setIsAdmin(true);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
    showToast('관리자에서 로그아웃되었습니다.');
  };

  const stats = useMemo(() => calculateStats(matches), [matches]);

  const allStreamers = useMemo(() => {
    const set = new Set<string>();
    set.add('우리밍_');
    for (const m of matches) {
      for (const k of ['top', 'jgl', 'mid', 'adc', 'sup'] as const) {
        if (m.team_a && m.team_a[k] && m.team_a[k].trim()) {
          set.add(m.team_a[k].trim());
        }
        if (m.team_b && m.team_b[k] && m.team_b[k].trim()) {
          set.add(m.team_b[k].trim());
        }
      }
    }
    return Array.from(set).filter(Boolean).sort((a, b) => {
      if (a === '우리밍_') return -1;
      if (b === '우리밍_') return 1;
      return a.localeCompare(b);
    });
  }, [matches]);

  const allChampions = useMemo(() => {
    const set = new Set<string>(CHAMPIONS_LIST);
    for (const m of matches) {
      for (const k of ['top', 'jgl', 'mid', 'adc', 'sup'] as const) {
        if (m.team_a_champs[k]) set.add(normalizeChampionName(m.team_a_champs[k].trim()));
        if (m.team_b_champs[k]) set.add(normalizeChampionName(m.team_b_champs[k].trim()));
      }
      for (const b of [...m.ban_a, ...m.ban_b]) {
        if (b) set.add(normalizeChampionName(b.trim()));
      }
    }
    return Array.from(set).filter(Boolean).sort();
  }, [matches]);

  // FIXED: Match mutations - auto-recalculate cumulative series scores to prevent number corruption
  const handleAddMatch = async (newMatch: Match) => {
    const normalized = normalizeMatch(newMatch);
    const updatedList = recalculateAllSeriesScores([normalized, ...matches]);
    setMatches(updatedList);
    const syncedMatch = updatedList.find((m) => String(m.id) === String(normalized.id)) || normalized;
    try {
      const res = await createMatchOnApi(syncedMatch);
      if (res.success) {
        showToast('경기 등록 완료 (Worker 클라우드 저장 ☁)');
      } else {
        showToast('경기 등록 완료 (로컬 캐시 보관됨)');
      }
      setTimeout(() => syncFromApi(true), 1500);
    } catch (err) {
      console.warn('[MatchApi] POST match failed:', err);
    }
  };

  const handleUpdateMatch = async (updatedMatch: Match) => {
    const normalized = normalizeMatch(updatedMatch);
    const rawUpdatedList = matches.map((m) => (String(m.id) === String(normalized.id) ? normalized : m));
    // FIXED: Synchronize cumulative scores for the entire series so sets don't get twisted
    const updatedList = recalculateAllSeriesScores(rawUpdatedList);
    setMatches(updatedList);
    const syncedMatch = updatedList.find((m) => String(m.id) === String(normalized.id)) || normalized;
    try {
      const res = await updateMatchOnApi(syncedMatch, updatedList);
      if (res.success) {
        showToast('경기 수정 완료 (Worker 클라우드 반영 ☁)');
      } else {
        showToast('경기 수정 완료 (로컬 캐시 보관됨) - ' + (res.error || ''));
      }
      setTimeout(() => syncFromApi(true), 1500);
    } catch (err) {
      console.warn('[MatchApi] PUT match failed:', err);
      showToast('로컬에 수정됨 (클라우드 동기화 실패)');
    }
  };

  const handleDeleteMatch = async (id: string) => {
    const remaining = matches.filter((m) => String(m.id) !== String(id));
    const syncedList = recalculateAllSeriesScores(remaining);
    setMatches(syncedList);
    try {
      const res = await deleteMatchOnApi(id, syncedList);
      if (res.success) {
        showToast('경기 삭제 완료 (Worker 클라우드 반영 ☁)');
      } else {
        showToast('경기 삭제 완료 (로컬 캐시 보관됨)');
      }
      setTimeout(() => syncFromApi(true), 1500);
    } catch (err) {
      console.warn('[MatchApi] DELETE match failed:', err);
    }
  };

  const handleImportMatches = (importedList: Match[], mode: 'replace' | 'merge') => {
    const cleanList = importedList.map((m) => normalizeMatch(m));
    if (mode === 'replace') {
      const synced = recalculateAllSeriesScores(cleanList);
      setMatches(synced);
      showToast(`전적 데이터 전체 복원 완료! (총 ${synced.length}경기)`);
    } else {
      setMatches((prev) => {
        const existingIds = new Set(prev.map((m) => String(m.id)));
        const newOnes = cleanList.filter((m) => !existingIds.has(String(m.id)));
        const combined = [...newOnes, ...prev].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const synced = recalculateAllSeriesScores(combined);
        showToast(`전적 데이터 병합 완료! (+${newOnes.length}경기 추가)`);
        return synced;
      });
    }
    fetch('/api/matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, matches: cleanList }),
    }).catch((err) => {
      console.warn('[D1 API] Batch POST /api/matches failed:', err);
    });
  };

  return (
    <div className="min-h-screen bg-[#08080c] text-[#e6e6ef] selection:bg-[#8b5cf6]/30 flex flex-col justify-between">
      <datalist id="players-datalist">
        {allStreamers.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="champs-datalist">
        {allChampions.map((champ) => (
          <option key={champ} value={champ} />
        ))}
      </datalist>
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-[#1e1e2a] border border-[#2a2a3a] text-white px-4 py-2 rounded-full text-[12px] shadow-2xl animate-[fadeIn_0.2s] max-w-[90vw] text-center font-medium">
          {toastMessage}
        </div>
      )}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        matches={matches}
        allStreamers={allStreamers}
        onSelectStreamer={handleJumpToStreamer}
        isAdmin={isAdmin}
        onLoginClick={() => setIsAdminModalOpen(true)}
        onLogoutClick={handleAdminLogout}
      />
      <main className="max-w-[1280px] w-full mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-8 flex-1">
        {(currentTab === 'main' || currentTab === 'journal') && (
          <MainTab
            stats={stats}
            matches={matches}
            onOpenSummaryModal={() => setIsSummaryModalOpen(true)}
            onToast={showToast}
            allStreamers={allStreamers}
            allChampions={allChampions}
            onJumpToStreamer={handleJumpToStreamer}
            onAddMatch={handleAddMatch}
            onUpdateMatch={handleUpdateMatch}
            onDeleteMatch={handleDeleteMatch}
            isAdmin={isAdmin}
            onAdminLoginSuccess={handleAdminLoginSuccess}
            targetStreamer={targetStreamer || undefined}
            targetMatchId={targetMatchId || undefined}
            targetStreamerRole={targetStreamerRole}
            jumpTimestamp={jumpTimestamp}
          />
        )}
        {currentTab === 'synergy' && (
          <SynergyTab
            stats={stats}
            matches={matches}
            allStreamers={allStreamers}
            onToast={showToast}
            onJumpToStreamer={handleJumpToStreamer}
          />
        )}
        {currentTab === 'rolland' && (
          <RollandTab onToast={showToast} allStreamers={allStreamers} />
        )}
      </main>
      <SummaryModal
        stats={stats}
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
      />
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSuccess={handleAdminLoginSuccess}
        onToast={showToast}
      />
      <Footer totalMatches={matches.length} />
    </div>
  );
}

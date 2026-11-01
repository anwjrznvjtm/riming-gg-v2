import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { LineKey, LINE_KEYS, LINE_LABELS, Match, StreamerProfile } from '../types';
import {
  syncStreamersFromBackend,
  saveStreamerProfilesBatchAsync,
  deleteStreamerProfileAsync,
  tidyStreamersFromMatches,
} from '../lib/streamerApi';
import { StreamerAvatar, SOOP_STREAMER_IDS } from './StreamerAvatar';
import { getChosung } from '../lib/championSearch';
import {
  X,
  Search,
  Plus,
  ExternalLink,
  Sparkles,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Radio,
  Lock,
  Swords,
  ShieldCheck,
  RefreshCw,
  Layers,
  ChevronDown,
  CheckSquare,
  Square,
  MinusSquare,
  ShieldAlert,
  Users,
} from 'lucide-react';

interface StreamerManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  allProfiles: StreamerProfile[];
  onProfilesUpdated: (profiles: StreamerProfile[]) => void;
  onSaveComplete?: (profiles: StreamerProfile[]) => Promise<void> | void;
  liveUserIds?: Set<string>;
  onToast: (msg: string) => void;
  isAdmin?: boolean;
}

const LINE_COLOR_CLASSES: Record<LineKey, { bg: string; text: string; border: string }> = {
  top: { bg: 'bg-[#f97316]/15', text: 'text-[#fb923c]', border: 'border-[#f97316]/40' },
  jgl: { bg: 'bg-[#10b981]/15', text: 'text-[#34d399]', border: 'border-[#10b981]/40' },
  mid: { bg: 'bg-[#06b6d4]/15', text: 'text-[#22d3ee]', border: 'border-[#06b6d4]/40' },
  adc: { bg: 'bg-[#a855f7]/15', text: 'text-[#c084fc]', border: 'border-[#a855f7]/40' },
  sup: { bg: 'bg-[#eab308]/15', text: 'text-[#facc15]', border: 'border-[#eab308]/40' },
};

/**
 * Standard streamer dictionary mapper strictly from authoritative server DB profiles.
 * Single Source of Truth: server/streamers.json via GET /api/streamers.
 */
function mapProfilesToDict(profiles: StreamerProfile[]): Record<string, StreamerProfile> {
  const result: Record<string, StreamerProfile> = {};
  for (const p of profiles) {
    if (!p?.name?.trim()) continue;
    const cleanName = p.name.trim();
    const key = cleanName.toLowerCase();
    const serverId = typeof p.soop_id === 'string' ? p.soop_id.trim() : '';
    const fallbackId = (SOOP_STREAMER_IDS[cleanName] || '').trim();

    result[key] = {
      name: cleanName,
      soop_id: serverId || fallbackId,
      main_position: p.main_position || 'mid',
      is_hidden: Boolean(p.is_hidden),
      memo: p.memo,
      updated_at: p.updated_at,
    };
  }
  return result;
}

export const StreamerManageModal: React.FC<StreamerManageModalProps> = ({
  isOpen,
  onClose,
  matches,
  allProfiles,
  onProfilesUpdated,
  onSaveComplete,
  liveUserIds = new Set(),
  onToast,
  isAdmin = false,
}) => {
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<'ALL' | LineKey>('ALL');
  const [filterMode, setFilterMode] = useState<
    'ALL' | 'LIVE' | 'VISIBLE' | 'HIDDEN' | 'HAS_MATCHES' | 'NO_MATCHES' | 'NO_ID'
  >('ALL');

  // Main local editable map (keyed by lowercase streamer name)
  const [localMap, setLocalMap] = useState<Record<string, StreamerProfile>>(() =>
    mapProfilesToDict(allProfiles)
  );

  // Checkbox selection state (Set of streamer names)
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isBatchConfirmOpen, setIsBatchConfirmOpen] = useState(false);

  // Per-streamer temporary input state for smooth typing before Auto-Save
  const [editingIds, setEditingIds] = useState<Record<string, string>>({});
  const [savedIndicatorName, setSavedIndicatorName] = useState<string | null>(null);

  // Manual Add Form state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSoopId, setNewSoopId] = useState('');
  const [newLine, setNewLine] = useState<LineKey>('mid');

  // Status & Confirmation states
  const [deleteTargetName, setDeleteTargetName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('연동됨');

  // Stable callback refs to prevent re-renders
  const onProfilesUpdatedRef = useRef(onProfilesUpdated);
  useEffect(() => {
    onProfilesUpdatedRef.current = onProfilesUpdated;
  }, [onProfilesUpdated]);

  const onSaveCompleteRef = useRef(onSaveComplete);
  useEffect(() => {
    onSaveCompleteRef.current = onSaveComplete;
  }, [onSaveComplete]);

  const onToastRef = useRef(onToast);
  useEffect(() => {
    onToastRef.current = onToast;
  }, [onToast]);

  // Compute CK Match statistics for each streamer from matches array (Single Source of Truth)
  const matchStatsMap = useMemo(() => {
    const stats = new Map<string, { total: number; wins: number; losses: number; winRate: number }>();

    for (const m of matches) {
      for (const line of LINE_KEYS) {
        // Red team (team_a)
        const nameA = m.team_a?.[line]?.trim();
        if (nameA) {
          const keyA = nameA.toLowerCase();
          const cur = stats.get(keyA) || { total: 0, wins: 0, losses: 0, winRate: 0 };
          cur.total++;
          if (m.winning_team === 'Red') cur.wins++;
          else cur.losses++;
          cur.winRate = Math.round((cur.wins / cur.total) * 100);
          stats.set(keyA, cur);
        }

        // Blue team (team_b)
        const nameB = m.team_b?.[line]?.trim();
        if (nameB) {
          const keyB = nameB.toLowerCase();
          const cur = stats.get(keyB) || { total: 0, wins: 0, losses: 0, winRate: 0 };
          cur.total++;
          if (m.winning_team === 'Blue') cur.wins++;
          else cur.losses++;
          cur.winRate = Math.round((cur.wins / cur.total) * 100);
          stats.set(keyB, cur);
        }
      }
    }

    return stats;
  }, [matches]);

  // Authoritative server fetch on modal open (Strictly DB, 0 localStorage)
  const fetchAuthoritativeProfiles = useCallback(async () => {
    setIsSyncing(true);
    try {
      const serverList = await syncStreamersFromBackend(true);
      if (Array.isArray(serverList) && serverList.length > 0) {
        const dict = mapProfilesToDict(serverList);
        setLocalMap(dict);
        onProfilesUpdatedRef.current(serverList);
        // Pre-fill editingIds
        const idMap: Record<string, string> = {};
        for (const [k, p] of Object.entries(dict)) {
          idMap[k] = p.soop_id || '';
        }
        setEditingIds(idMap);
      }
      setAutoSaveStatus('연동됨');
    } catch (err) {
      console.warn('[StreamerManageModal] Server fetch error:', err);
      setAutoSaveStatus('연동 오류');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAuthoritativeProfiles();
      setDeleteTargetName(null);
      setIsAddingNew(false);
      setSelectedNames(new Set());
    }
  }, [isOpen, fetchAuthoritativeProfiles]);

  // Close handler: Trigger parent Re-fetch so main page reflects latest DB streamers & live list immediately
  const handleModalClose = useCallback(async () => {
    const currentList = (Object.values(localMap) as StreamerProfile[]).sort((a, b) => {
      if (a.name === '우리밍_' || a.name === '우리밍') return -1;
      if (b.name === '우리밍_' || b.name === '우리밍') return 1;
      return a.name.localeCompare(b.name, 'ko-KR');
    });

    onProfilesUpdatedRef.current(currentList);
    if (onSaveCompleteRef.current) {
      try {
        await onSaveCompleteRef.current(currentList);
      } catch {}
    }
    onClose();
  }, [localMap, onClose]);

  // --------------------------------------------------------------------------
  // 1. AUTO-SAVE HELPER: Persists a profile directly to DB API (POST /api/streamers)
  // --------------------------------------------------------------------------
  const executeAutoSave = useCallback(
    async (profile: StreamerProfile, actionLabel?: string) => {
      setAutoSaveStatus('저장 중...');
      try {
        const serverList = await saveStreamerProfilesBatchAsync([profile], { replace: false });
        if (serverList && serverList.length > 0) {
          const dict = mapProfilesToDict(serverList);
          setLocalMap(dict);
          onProfilesUpdatedRef.current(serverList);
        }
        setAutoSaveStatus('자동 저장됨 ✓');
        setSavedIndicatorName(profile.name);
        setTimeout(() => setSavedIndicatorName(null), 2500);

        if (actionLabel) {
          onToastRef.current(actionLabel);
        }
      } catch (err) {
        console.warn('[StreamerManageModal] Auto-save failed:', err);
        setAutoSaveStatus('저장 실패');
        onToastRef.current('서버 자동 저장에 실패했습니다.');
      }
    },
    []
  );

  // --------------------------------------------------------------------------
  // 2. SOOP ID Edit & Auto-Save (onBlur or Enter)
  // --------------------------------------------------------------------------
  const handleIdChange = (name: string, val: string) => {
    const key = name.toLowerCase().trim();
    setEditingIds((prev) => ({ ...prev, [key]: val }));
  };

  const handleIdCommit = async (name: string) => {
    const key = name.toLowerCase().trim();
    const target = localMap[key];
    if (!target) return;

    const currentEntered = (editingIds[key] ?? target.soop_id ?? '').trim();
    if (currentEntered === (target.soop_id || '').trim()) {
      return; // No change, do not trigger request
    }

    if (!isAdmin) {
      onToastRef.current('스트리머 수정은 관리자만 가능합니다.');
      // Revert editing input to current target soop_id
      setEditingIds((prev) => ({ ...prev, [key]: target.soop_id || '' }));
      return;
    }

    const updatedProfile: StreamerProfile = {
      ...target,
      soop_id: currentEntered,
      updated_at: new Date().toISOString(),
    };

    // Optimistically update localMap
    setLocalMap((prev) => ({
      ...prev,
      [key]: updatedProfile,
    }));

    await executeAutoSave(
      updatedProfile,
      currentEntered
        ? `'${target.name}' SOOP ID가 '${currentEntered}'(으)로 자동 저장되었습니다.`
        : `'${target.name}' SOOP ID가 삭제되었습니다.`
    );
  };

  // --------------------------------------------------------------------------
  // 3. Position Change & Auto-Save
  // --------------------------------------------------------------------------
  const handlePositionChange = async (name: string, newPosition: LineKey) => {
    if (!isAdmin) {
      onToastRef.current('포지션 변경은 관리자만 가능합니다.');
      return;
    }
    const key = name.toLowerCase().trim();
    const target = localMap[key];
    if (!target || target.main_position === newPosition) return;

    const updatedProfile: StreamerProfile = {
      ...target,
      main_position: newPosition,
      updated_at: new Date().toISOString(),
    };

    setLocalMap((prev) => ({
      ...prev,
      [key]: updatedProfile,
    }));

    await executeAutoSave(
      updatedProfile,
      `'${target.name}' 주 포지션이 ${LINE_LABELS[newPosition]}(으)로 변경되었습니다.`
    );
  };

  // --------------------------------------------------------------------------
  // 4. [숨기기 / 노출] 토글 & Auto-Save (전적 유무 상관없이 가능)
  // --------------------------------------------------------------------------
  const handleToggleHidden = async (name: string) => {
    if (!isAdmin) {
      onToastRef.current('숨김 설정은 관리자만 가능합니다.');
      return;
    }
    const key = name.toLowerCase().trim();
    const target = localMap[key];
    if (!target) return;

    const nextHidden = !target.is_hidden;
    const updatedProfile: StreamerProfile = {
      ...target,
      is_hidden: nextHidden,
      updated_at: new Date().toISOString(),
    };

    setLocalMap((prev) => ({
      ...prev,
      [key]: updatedProfile,
    }));

    await executeAutoSave(
      updatedProfile,
      nextHidden
        ? `'${target.name}' 스트리머가 숨김 처리되었습니다. (메인 라이브 및 찾기 목록 제외)`
        : `'${target.name}' 스트리머가 정상 노출로 변경되었습니다.`
    );
  };

  // --------------------------------------------------------------------------
  // 5. [개별 삭제 (휴지통)]: 전적 0건인 스트리머만 DB 완전 삭제 가능
  // --------------------------------------------------------------------------
  const handleRequestDelete = (name: string) => {
    if (!isAdmin) {
      onToastRef.current('삭제 권한이 없습니다. 관리자 로그인이 필요합니다.');
      return;
    }

    const key = name.toLowerCase().trim();
    const stat = matchStatsMap.get(key) || { total: 0, wins: 0, losses: 0, winRate: 0 };

    if (stat.total > 0) {
      onToastRef.current(
        `'${name}' 스트리머는 CK 전적(${stat.total}전)이 기록되어 있어 삭제할 수 없습니다. 대신 [숨기기]를 사용해주세요.`
      );
      return;
    }

    setDeleteTargetName(name);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetName || !isAdmin) return;

    setIsProcessing(true);
    setAutoSaveStatus('삭제 중...');
    const targetName = deleteTargetName;

    try {
      const serverList = await deleteStreamerProfileAsync(targetName);
      if (Array.isArray(serverList)) {
        const dict = mapProfilesToDict(serverList);
        setLocalMap(dict);
        onProfilesUpdatedRef.current(serverList);
      }
      setSelectedNames((prev) => {
        const next = new Set(prev);
        next.delete(targetName);
        return next;
      });
      setDeleteTargetName(null);
      setAutoSaveStatus('자동 저장됨 ✓');
      onToastRef.current(`'${targetName}' 스트리머가 서버 DB에서 완전히 삭제되었습니다.`);
    } catch {
      setAutoSaveStatus('삭제 실패');
      onToastRef.current('스트리머 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6. [CK일지 전적 기반 명단 정돈] (Requirement 2)
  // --------------------------------------------------------------------------
  const handleTidyStreamersFromCK = async () => {
    if (!isAdmin) {
      onToastRef.current('명단 정돈은 관리자만 실행할 수 있습니다.');
      return;
    }

    setIsProcessing(true);
    setAutoSaveStatus('명단 정돈 중...');
    try {
      const currentList = Object.values(localMap) as StreamerProfile[];
      const { updatedList, addedCount, ghostCount } = await tidyStreamersFromMatches(
        matches,
        currentList
      );

      const dict = mapProfilesToDict(updatedList);
      setLocalMap(dict);
      onProfilesUpdatedRef.current(updatedList);
      setAutoSaveStatus('정돈 완료 ✓');

      onToastRef.current(
        `CK일지 전적 기반 명단 정돈 완료! (출전 스트리머 +${addedCount}명 등록, 유령 데이터 ${ghostCount}건 정리)`
      );
    } catch (err) {
      console.warn('[StreamerManageModal] Tidy error:', err);
      setAutoSaveStatus('정돈 실패');
      onToastRef.current('CK일지 기반 명단 정돈 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // 7. [수동 추가] 신규 스트리머 등록 & Auto-Save (Requirement 3)
  // --------------------------------------------------------------------------
  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onToastRef.current('스트리머 추가는 관리자만 가능합니다.');
      return;
    }

    const cleanName = newName.trim();
    if (!cleanName) {
      onToastRef.current('스트리머 닉네임을 입력해 주세요.');
      return;
    }

    const key = cleanName.toLowerCase();
    if (localMap[key]) {
      onToastRef.current(`'${cleanName}' 스트리머가 이미 명단에 존재합니다.`);
      return;
    }

    const fallbackId = (SOOP_STREAMER_IDS[cleanName] || '').trim();
    const cleanId = newSoopId.trim() || fallbackId;

    const newProfile: StreamerProfile = {
      name: cleanName,
      soop_id: cleanId,
      main_position: newLine,
      is_hidden: false,
      updated_at: new Date().toISOString(),
    };

    setIsProcessing(true);
    setAutoSaveStatus('등록 중...');

    try {
      const serverList = await saveStreamerProfilesBatchAsync([newProfile], { replace: false });
      if (Array.isArray(serverList)) {
        const dict = mapProfilesToDict(serverList);
        setLocalMap(dict);
        onProfilesUpdatedRef.current(serverList);
      }

      setNewName('');
      setNewSoopId('');
      setIsAddingNew(false);
      setAutoSaveStatus('자동 저장됨 ✓');
      onToastRef.current(`새 스트리머 '${cleanName}'이 서버 DB에 등록 및 영구 저장되었습니다.`);
    } catch {
      setAutoSaveStatus('등록 실패');
      onToastRef.current('스트리머 등록 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --------------------------------------------------------------------------
  // 8. CHECKBOX SELECTION & BATCH ACTION LOGIC (체크박스 및 전체 선택 / 일괄 삭제)
  // --------------------------------------------------------------------------
  const handleToggleSelectOne = (name: string) => {
    setSelectedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Filtered List calculation
  const allStreamerProfiles: StreamerProfile[] = useMemo(() => {
    return (Object.values(localMap) as StreamerProfile[]).sort((a, b) => {
      if (a.name === '우리밍_' || a.name === '우리밍') return -1;
      if (b.name === '우리밍_' || b.name === '우리밍') return 1;
      return a.name.localeCompare(b.name, 'ko-KR');
    });
  }, [localMap]);

  const filteredProfiles = useMemo(() => {
    return allStreamerProfiles.filter((p) => {
      // 1. Line filter
      if (selectedLine !== 'ALL' && p.main_position !== selectedLine) return false;

      // 2. Status filter
      const isLive = Boolean(p.soop_id && liveUserIds.has(p.soop_id.toLowerCase().trim()));
      const stat = matchStatsMap.get(p.name.toLowerCase().trim()) || { total: 0, wins: 0, losses: 0, winRate: 0 };
      const hasMatches = stat.total > 0;

      if (filterMode === 'LIVE' && !isLive) return false;
      if (filterMode === 'VISIBLE' && p.is_hidden) return false;
      if (filterMode === 'HIDDEN' && !p.is_hidden) return false;
      if (filterMode === 'HAS_MATCHES' && !hasMatches) return false;
      if (filterMode === 'NO_MATCHES' && hasMatches) return false;
      if (filterMode === 'NO_ID' && p.soop_id?.trim()) return false;

      // 3. Search query filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const chosung = getChosung(p.name).toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q) || chosung.includes(q);
        const idMatch = (p.soop_id || '').toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }

      return true;
    });
  }, [allStreamerProfiles, selectedLine, filterMode, search, liveUserIds, matchStatsMap]);

  // Overall selection state for currently filtered list
  const isAllFilteredSelected = useMemo(() => {
    if (filteredProfiles.length === 0) return false;
    return filteredProfiles.every((p) => selectedNames.has(p.name));
  }, [filteredProfiles, selectedNames]);

  const isSomeFilteredSelected = useMemo(() => {
    if (isAllFilteredSelected) return false;
    return filteredProfiles.some((p) => selectedNames.has(p.name));
  }, [filteredProfiles, selectedNames, isAllFilteredSelected]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deselect all filtered items
      setSelectedNames((prev) => {
        const next = new Set(prev);
        for (const p of filteredProfiles) {
          next.delete(p.name);
        }
        return next;
      });
    } else {
      // Select all filtered items
      setSelectedNames((prev) => {
        const next = new Set(prev);
        for (const p of filteredProfiles) {
          next.add(p.name);
        }
        return next;
      });
    }
  };

  // Analyze selected items for batch delete vs hide
  const batchClassification = useMemo(() => {
    const selectedList: string[] = Array.from(selectedNames);
    const toDelete: string[] = [];
    const toHide: string[] = [];

    for (const name of selectedList) {
      const key = (name as string).toLowerCase().trim();
      const stat = matchStatsMap.get(key) || { total: 0, wins: 0, losses: 0, winRate: 0 };
      const isBenchmark = name === '우리밍_' || name === '우리밍';

      if (stat.total === 0 && !isBenchmark) {
        toDelete.push(name);
      } else {
        toHide.push(name);
      }
    }

    return { toDelete, toHide, totalSelected: selectedList.length };
  }, [selectedNames, matchStatsMap]);

  // Execute batch delete & hide with safe DB synchronization
  const handleExecuteBatchDeleteAndHide = async () => {
    if (selectedNames.size === 0) return;
    if (!isAdmin) {
      onToastRef.current('일괄 작업은 관리자만 실행할 수 있습니다.');
      return;
    }

    setIsProcessing(true);
    setAutoSaveStatus('일괄 처리 중...');

    try {
      const currentList = Object.values(localMap) as StreamerProfile[];
      const deleteSet = new Set(batchClassification.toDelete);
      const hideSet = new Set(batchClassification.toHide);
      const nowIso = new Date().toISOString();

      // 1. Build new clean array:
      // - Exclude items in deleteSet (permanently deleted from DB)
      // - Switch is_hidden = true for items in hideSet (preserved history, hidden from live)
      const updatedList: StreamerProfile[] = [];

      for (const p of currentList) {
        if (deleteSet.has(p.name)) {
          continue; // Deleted
        }
        if (hideSet.has(p.name)) {
          updatedList.push({
            ...p,
            is_hidden: true,
            updated_at: nowIso,
          });
        } else {
          updatedList.push(p);
        }
      }

      // 2. Persist directly to backend DB with atomic replace
      const serverList = await saveStreamerProfilesBatchAsync(updatedList, { replace: true });
      await fetch('/api/soop/live/invalidate', { method: 'POST' }).catch(() => {});

      if (Array.isArray(serverList)) {
        const dict = mapProfilesToDict(serverList);
        setLocalMap(dict);
        onProfilesUpdatedRef.current(serverList);
        if (onSaveCompleteRef.current) {
          try {
            await onSaveCompleteRef.current(serverList);
          } catch {}
        }
      }

      const delCount = batchClassification.toDelete.length;
      const hideCount = batchClassification.toHide.length;

      setSelectedNames(new Set());
      setIsBatchConfirmOpen(false);
      setAutoSaveStatus('일괄 처리 완료 ✓');

      let toastNotice = '';
      if (delCount > 0 && hideCount > 0) {
        toastNotice = `일괄 처리 완료! 전적 없는 ${delCount}명 영구 삭제, 전적 있는 ${hideCount}명 [숨김] 전환 완료 ☁`;
      } else if (delCount > 0) {
        toastNotice = `일괄 삭제 완료! 전적 없는 ${delCount}명이 서버 DB에서 영구 삭제되었습니다. ☁`;
      } else if (hideCount > 0) {
        toastNotice = `일괄 숨김 완료! 전적 보존을 위해 ${hideCount}명이 [숨김] 상태로 안전하게 전환되었습니다.`;
      } else {
        toastNotice = '선택된 항목이 처리되었습니다.';
      }

      onToastRef.current(toastNotice);
    } catch (err) {
      console.warn('[StreamerManageModal] Batch action failed:', err);
      setAutoSaveStatus('처리 실패');
      onToastRef.current('일괄 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Summary counts
  const totalCount = allStreamerProfiles.length;
  const visibleCount = allStreamerProfiles.filter((p) => !p.is_hidden).length;
  const hiddenCount = allStreamerProfiles.filter((p) => p.is_hidden).length;
  const liveCount = allStreamerProfiles.filter(
    (p) => p.soop_id && liveUserIds.has(p.soop_id.toLowerCase().trim())
  ).length;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s]">
      <div className="relative w-full max-w-[960px] h-[92vh] max-h-[880px] bg-[#0e0e16] border border-[#222234] rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_40px_rgba(139,92,246,0.15)] flex flex-col overflow-hidden text-[#e6e6ef]">
        {/* ================================================================= */}
        {/* 1. MODAL HEADER & AUTO-SAVE STATUS                                */}
        {/* ================================================================= */}
        <div className="px-5 sm:px-6 py-4 border-b border-[#1e1e2c] bg-[#12121c] flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8b5cf6]/30 to-[#3b82f6]/20 border border-[#8b5cf6]/40 flex items-center justify-center shadow-inner">
              <Radio size={20} className="text-[#a78bfa] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-[17px] text-white tracking-tight">
                  SOOP ID & 스트리머 관리
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
                  DB 실시간 직통 연동
                </span>
              </div>
              <p className="text-[11px] text-[#8a8aa0] mt-0.5">
                수정 즉시 서버 DB에 자동 저장(Auto-Save)되며, 메인 라이브 및 멤버 목록에 실시간 반영됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {/* Auto-Save Live Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-[#181826] border border-[#26263a] rounded-full text-[11px] font-mono text-[#a0a0c0]">
              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span>{autoSaveStatus}</span>
            </div>

            <button
              type="button"
              onClick={handleModalClose}
              className="w-8 h-8 rounded-full bg-[#1a1a28] hover:bg-[#28283e] text-[#a0a0b8] hover:text-white border border-[#2a2a3e] flex items-center justify-center transition-all cursor-pointer"
              title="모달 닫기 (자동 갱신 반영)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. TOP ACTION BAR ([CK일지 기반 명단 정돈] + [새 스트리머 추가])    */}
        {/* ================================================================= */}
        <div className="px-5 sm:px-6 py-3 bg-[#141420]/80 border-b border-[#1f1f30] flex flex-wrap items-center justify-between gap-2.5">
          {/* Summary Pills */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium flex-wrap">
            <span className="px-2.5 py-1 bg-[#1a1a2a] text-[#d0d0e0] rounded-lg border border-[#2a2a3e]">
              총 <strong className="text-white font-bold">{totalCount}</strong>명
            </span>
            <span className="px-2.5 py-1 bg-[#10b981]/10 text-[#34d399] rounded-lg border border-[#10b981]/25">
              노출 <strong className="font-bold">{visibleCount}</strong>명
            </span>
            <span className="px-2.5 py-1 bg-[#f59e0b]/10 text-[#fbbf24] rounded-lg border border-[#f59e0b]/25">
              숨김 <strong className="font-bold">{hiddenCount}</strong>명
            </span>
            <span className="px-2.5 py-1 bg-[#ec4899]/10 text-[#f472b6] rounded-lg border border-[#ec4899]/25 flex items-center gap-1">
              <Radio size={11} className="animate-pulse" />
              <span>방송 중 {liveCount}명</span>
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* [CK일지 전적 기반 명단 정돈] */}
            <button
              type="button"
              onClick={handleTidyStreamersFromCK}
              disabled={isProcessing || isSyncing}
              className="h-[34px] px-3.5 bg-gradient-to-r from-[#8b5cf6]/20 to-[#6366f1]/25 hover:from-[#8b5cf6]/35 hover:to-[#6366f1]/40 border border-[#8b5cf6]/50 text-[#c4b5fd] hover:text-white rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all shadow-[0_2px_10px_rgba(139,92,246,0.15)] disabled:opacity-50 cursor-pointer"
              title="CK일지 경기 기록 DB에 존재하는 실제 출전 스트리머를 자동 추출하고 미등록 유령 데이터를 정돈합니다"
            >
              <Sparkles size={14} className={isProcessing ? 'animate-spin' : 'text-[#a78bfa]'} />
              <span>CK일지 전적 기반 명단 정돈</span>
            </button>

            {/* [새 스트리머 수동 추가] */}
            <button
              type="button"
              onClick={() => setIsAddingNew((prev) => !prev)}
              className={`h-[34px] px-3.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isAddingNew
                  ? 'bg-[#3b82f6] text-white border-[#3b82f6]'
                  : 'bg-[#181828] hover:bg-[#222238] text-[#c0c0d8] hover:text-white border-[#2c2c42]'
              }`}
            >
              <Plus size={14} className={isAddingNew ? 'rotate-45 transition-transform' : ''} />
              <span>{isAddingNew ? '추가 닫기' : '새 스트리머 추가'}</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2.5 BATCH ACTION BAR (WHEN ITEMS ARE SELECTED VIA CHECKBOXES)     */}
        {/* ================================================================= */}
        {selectedNames.size > 0 && (
          <div className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-[#2a1324] via-[#20152e] to-[#16162a] border-b border-[#ef4444]/40 flex flex-wrap items-center justify-between gap-3 animate-[fadeIn_0.15s]">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping" />
              <div className="text-[12px]">
                <strong className="text-white font-bold">{selectedNames.size}명</strong>
                <span className="text-[#d0d0e0]"> 선택됨 </span>
                <span className="text-[11px] text-[#a0a0b8] font-mono">
                  (전적 없음: <strong className="text-[#f87171]">{batchClassification.toDelete.length}명 삭제 대상</strong> / 전적 있음: <strong className="text-[#fbbf24]">{batchClassification.toHide.length}명 숨김 전환</strong>)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedNames(new Set())}
                className="h-[32px] px-3 bg-[#1e1e30] hover:bg-[#282842] text-[#a0a0b8] hover:text-white rounded-xl text-[11px] font-medium border border-[#32324a]"
              >
                선택 해제
              </button>

              <button
                type="button"
                onClick={() => setIsBatchConfirmOpen(true)}
                disabled={isProcessing}
                className="h-[32px] px-4 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white font-bold rounded-xl text-[12px] shadow-[0_2px_12px_rgba(239,68,68,0.35)] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={13} />
                <span>선택한 스트리머 일괄 삭제 / 숨김 ({selectedNames.size}명)</span>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 3. COLLAPSIBLE MANUAL ADD FORM (수동 추가 기능)                     */}
        {/* ================================================================= */}
        {isAddingNew && (
          <form
            onSubmit={handleAddNewSubmit}
            className="px-5 sm:px-6 py-4 bg-[#161626] border-b border-[#282840] animate-[fadeIn_0.15s] flex flex-col md:flex-row items-center gap-3"
          >
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] text-[#8a8aa0] uppercase font-bold mb-1 ml-1">
                  스트리머 닉네임 *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 김세아"
                  className="w-full h-[36px] bg-[#0c0c14] border border-[#2a2a40] focus:border-[#8b5cf6] rounded-xl px-3 text-[12px] text-white placeholder-[#606078] outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#8a8aa0] uppercase font-bold mb-1 ml-1">
                  SOOP 아이디 (선택)
                </label>
                <input
                  type="text"
                  value={newSoopId}
                  onChange={(e) => setNewSoopId(e.target.value)}
                  placeholder="예: kimseah94"
                  className="w-full h-[36px] bg-[#0c0c14] border border-[#2a2a40] focus:border-[#8b5cf6] rounded-xl px-3 text-[12px] text-white placeholder-[#606078] outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-[#8a8aa0] uppercase font-bold mb-1 ml-1">
                  주 포지션
                </label>
                <select
                  value={newLine}
                  onChange={(e) => setNewLine(e.target.value as LineKey)}
                  className="w-full h-[36px] bg-[#0c0c14] border border-[#2a2a40] focus:border-[#8b5cf6] rounded-xl px-3 text-[12px] text-white outline-none cursor-pointer"
                >
                  {LINE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {LINE_LABELS[k]} ({k.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto self-end mt-1 md:mt-0">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="h-[36px] px-3.5 bg-[#1f1f30] hover:bg-[#2a2a40] text-[#a0a0b8] rounded-xl text-[12px] font-medium"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isProcessing || !newName.trim()}
                className="h-[36px] px-5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-xl text-[12px] shadow-[0_2px_12px_rgba(139,92,246,0.3)] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>DB에 즉시 등록</span>
              </button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* 4. SEARCH & FILTER CONTROLS (WITH SELECT ALL BUTTON)              */}
        {/* ================================================================= */}
        <div className="px-5 sm:px-6 py-3 bg-[#10101a] border-b border-[#1b1b28] space-y-2.5">
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {/* Search Input with Chosung support */}
            <div className="relative flex-1 w-full">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#656580]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="스트리머 닉네임, 초성(ㄱㅅㅇ), 또는 SOOP ID 검색..."
                className="w-full h-[36px] bg-[#090910] border border-[#202030] focus:border-[#8b5cf6]/60 rounded-xl pl-9 pr-8 text-[12px] text-white placeholder-[#555568] outline-none"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#707088] hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Line Filter */}
            <div className="flex items-center gap-1 p-1 bg-[#090910] border border-[#202030] rounded-xl shrink-0 overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setSelectedLine('ALL')}
                className={`h-[28px] px-3 rounded-lg text-[11px] font-bold transition-all ${
                  selectedLine === 'ALL'
                    ? 'bg-[#8b5cf6] text-white'
                    : 'text-[#808098] hover:text-white'
                }`}
              >
                전체 라인
              </button>
              {LINE_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedLine(k)}
                  className={`h-[28px] px-2.5 rounded-lg text-[11px] font-bold transition-all ${
                    selectedLine === k
                      ? `${LINE_COLOR_CLASSES[k].bg} ${LINE_COLOR_CLASSES[k].text} border ${LINE_COLOR_CLASSES[k].border}`
                      : 'text-[#808098] hover:text-white'
                  }`}
                >
                  {LINE_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-bar: Status Filter Chips + [전체 선택] 체크박스 버튼 */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 text-[11px]">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-[#606078] font-bold mr-1 shrink-0">상태:</span>
              {[
                { id: 'ALL', label: '전체' },
                { id: 'LIVE', label: '🔴 방송 중' },
                { id: 'VISIBLE', label: '👁 정상 노출' },
                { id: 'HIDDEN', label: '🔒 숨김' },
                { id: 'HAS_MATCHES', label: '⚔ 전적 있음' },
                { id: 'NO_MATCHES', label: '신규 (전적 0)' },
                { id: 'NO_ID', label: 'ID 미입력' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id as any)}
                  className={`h-[26px] px-2.5 rounded-lg font-medium border transition-all shrink-0 cursor-pointer ${
                    filterMode === f.id
                      ? 'bg-[#8b5cf6]/20 text-[#c4b5fd] border-[#8b5cf6]/50 shadow-sm'
                      : 'bg-[#12121e] text-[#808098] border-[#1e1e2c] hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* [전체 선택] 체크박스 버튼 */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              disabled={filteredProfiles.length === 0}
              className={`h-[26px] px-2.5 rounded-lg font-bold border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                isAllFilteredSelected
                  ? 'bg-[#8b5cf6] text-white border-[#8b5cf6] shadow-sm'
                  : isSomeFilteredSelected
                  ? 'bg-[#8b5cf6]/20 text-[#c4b5fd] border-[#8b5cf6]/40'
                  : 'bg-[#141422] text-[#9090aa] border-[#222236] hover:text-white hover:border-[#383852]'
              }`}
            >
              {isAllFilteredSelected ? (
                <CheckSquare size={13} className="text-white" />
              ) : isSomeFilteredSelected ? (
                <MinusSquare size={13} className="text-[#a78bfa]" />
              ) : (
                <Square size={13} className="text-[#707088]" />
              )}
              <span>전체 선택 ({filteredProfiles.length}명)</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 5. STREAMER LIST (CARDS / ROWS WITH CHECKBOXES & AUTO-SAVE)       */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-2.5 divide-y divide-[#181826]">
          {filteredProfiles.length === 0 ? (
            <div className="py-16 text-center text-[#606078] text-[13px] flex flex-col items-center gap-2">
              <Search size={28} className="opacity-40" />
              <span>검색 조건과 일치하는 스트리머가 없습니다.</span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mt-2 text-[12px] text-[#a78bfa] underline cursor-pointer"
                >
                  검색어 초기화
                </button>
              )}
            </div>
          ) : (
            filteredProfiles.map((streamer, index) => {
              const streamerKey = streamer.name.toLowerCase().trim();
              const isBenchmark = streamer.name === '우리밍_' || streamer.name === '우리밍';
              const isLive = Boolean(streamer.soop_id && liveUserIds.has(streamer.soop_id.toLowerCase().trim()));
              const currentInputVal = editingIds[streamerKey] !== undefined ? editingIds[streamerKey] : streamer.soop_id || '';
              const stat = matchStatsMap.get(streamerKey) || { total: 0, wins: 0, losses: 0, winRate: 0 };
              const hasMatches = stat.total > 0;
              const isIndicatorActive = savedIndicatorName === streamer.name;
              const isChecked = selectedNames.has(streamer.name);

              return (
                <div
                  key={streamer.name}
                  className={`pt-3 first:pt-0 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 rounded-2xl transition-all ${
                    isChecked
                      ? 'bg-[#1b1528] border-2 border-[#8b5cf6]/70 shadow-[0_0_15px_rgba(139,92,246,0.18)]'
                      : streamer.is_hidden
                      ? 'bg-[#12121a]/50 opacity-70 hover:opacity-100 border border-[#20202e]'
                      : 'bg-[#13131e]/90 hover:bg-[#161624] border border-[#1e1e2c]'
                  } ${isIndicatorActive ? 'ring-1 ring-[#10b981]/50' : ''}`}
                >
                  {/* Left: Checkbox + Number + Avatar + Name + Stats */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggleSelectOne(streamer.name)}
                      className="p-1 rounded-lg hover:bg-white/5 text-[#a0a0b8] hover:text-white transition-all cursor-pointer shrink-0"
                      title={isChecked ? '선택 해제' : '선택'}
                    >
                      {isChecked ? (
                        <CheckSquare size={17} className="text-[#8b5cf6]" />
                      ) : (
                        <Square size={17} className="text-[#555570]" />
                      )}
                    </button>

                    <span className="text-[11px] font-mono font-bold text-[#505068] w-[18px] text-right shrink-0">
                      {index + 1}
                    </span>

                    <div className="relative shrink-0">
                      <StreamerAvatar name={streamer.name} size={38} shape="circle" />
                      {isLive && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#ec4899] rounded-full border-2 border-[#13131e] animate-pulse"
                          title="현재 방송 중"
                        />
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[13px] text-white">
                          {streamer.name}
                        </span>

                        {isBenchmark && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/40">
                            기준 원딜
                          </span>
                        )}

                        {isLive && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#ec4899]/20 text-[#f472b6] border border-[#ec4899]/40 flex items-center gap-0.5 animate-pulse">
                            <Radio size={8} /> LIVE
                          </span>
                        )}

                        {streamer.is_hidden && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b]/40">
                            숨김
                          </span>
                        )}
                      </div>

                      {/* Match Record Badge (CK일지 전적 표시) */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {hasMatches ? (
                          <span className="text-[10px] text-[#9090aa] font-mono flex items-center gap-1">
                            <Swords size={10} className="text-[#8b5cf6]" />
                            <strong className="text-[#c4b5fd] font-bold">{stat.total}전</strong> {stat.wins}승 {stat.losses}패
                            <span className={`font-bold ml-0.5 ${stat.winRate >= 60 ? 'text-[#34d399]' : stat.winRate >= 50 ? 'text-[#60a5fa]' : 'text-[#f87171]'}`}>
                              ({stat.winRate}%)
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#606078] font-mono bg-[#181824] px-1.5 py-0.2 rounded border border-[#222234]">
                            전적 0건 (미출전)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center: Position selector + SOOP ID Input (Auto-Save onBlur/Enter) */}
                  <div className="flex-1 w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Position dropdown */}
                    <div className="relative shrink-0">
                      <select
                        value={streamer.main_position || 'mid'}
                        onChange={(e) => handlePositionChange(streamer.name, e.target.value as LineKey)}
                        disabled={!isAdmin}
                        className={`h-[34px] pl-2.5 pr-7 rounded-xl text-[11px] font-bold border appearance-none outline-none cursor-pointer transition-all ${
                          LINE_COLOR_CLASSES[streamer.main_position || 'mid'].bg
                        } ${LINE_COLOR_CLASSES[streamer.main_position || 'mid'].text} ${
                          LINE_COLOR_CLASSES[streamer.main_position || 'mid'].border
                        }`}
                      >
                        {LINE_KEYS.map((k) => (
                          <option key={k} value={k} className="bg-[#12121a] text-white">
                            {LINE_LABELS[k]} ({k.toUpperCase()})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={12}
                        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                      />
                    </div>

                    {/* SOOP ID input with real-time onBlur/Enter Auto-Save */}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={currentInputVal}
                        onChange={(e) => handleIdChange(streamer.name, e.target.value)}
                        onBlur={() => handleIdCommit(streamer.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        disabled={!isAdmin}
                        placeholder="SOOP ID (user_id 입력 후 Enter 또는 포커스 아웃)"
                        className={`w-full h-[34px] bg-[#0a0a12] border rounded-xl px-3 text-[12px] font-mono text-white placeholder-[#505068] outline-none transition-all ${
                          isIndicatorActive
                            ? 'border-[#10b981] bg-[#10b981]/5 ring-1 ring-[#10b981]'
                            : 'border-[#222234] focus:border-[#8b5cf6]'
                        }`}
                      />
                      {currentInputVal && (
                        <a
                          href={`https://bj.afreecatv.com/${encodeURIComponent(currentInputVal)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#707088] hover:text-[#a78bfa] transition-colors"
                          title="SOOP 방송국 새 창 열기"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Right: [숨기기 토글] vs [개별 삭제 분기] */}
                  <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                    {/* [숨기기 / 노출 토글]: 모든 스트리머 가능 */}
                    <button
                      type="button"
                      onClick={() => handleToggleHidden(streamer.name)}
                      disabled={!isAdmin}
                      className={`h-[34px] px-3 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                        streamer.is_hidden
                          ? 'bg-[#f59e0b]/15 hover:bg-[#f59e0b]/25 text-[#fbbf24] border-[#f59e0b]/40 shadow-sm'
                          : 'bg-[#181826] hover:bg-[#202034] text-[#a0a0b8] hover:text-white border-[#26263a]'
                      }`}
                      title={
                        streamer.is_hidden
                          ? '현재 숨김 상태입니다. 클릭 시 메인 라이브 및 멤버 목록에 다시 노출됩니다.'
                          : '현재 노출 상태입니다. 클릭 시 메인 라이브 및 찾기 목록에서 숨김 처리됩니다.'
                      }
                    >
                      {streamer.is_hidden ? (
                        <>
                          <EyeOff size={13} className="text-[#fbbf24]" />
                          <span>숨김 (노출X)</span>
                        </>
                      ) : (
                        <>
                          <Eye size={13} className="text-[#34d399]" />
                          <span>정상 노출</span>
                        </>
                      )}
                    </button>

                    {/* [삭제 vs 보호 분기] */}
                    {hasMatches ? (
                      /* CK일지 전적 있는 스트리머: 데이터 보호 위해 삭제 불가 (락 아이콘) */
                      <div
                        className="h-[34px] px-2.5 rounded-xl bg-[#1a1418] border border-[#301e24] text-[#805058] flex items-center gap-1 text-[11px] font-medium cursor-not-allowed select-none"
                        title={`전적(${stat.total}전)이 기록된 스트리머는 데이터 보존을 위해 삭제할 수 없습니다. 대신 [숨기기]를 사용하세요.`}
                      >
                        <Lock size={12} className="text-[#a05058]" />
                        <span className="hidden sm:inline">삭제 불가</span>
                      </div>
                    ) : (
                      /* 전적 0건인 스트리머: 완전 삭제 가능 */
                      <button
                        type="button"
                        onClick={() => handleRequestDelete(streamer.name)}
                        disabled={!isAdmin || isBenchmark}
                        className="h-[34px] px-2.5 rounded-xl bg-[#181216] hover:bg-[#ef4444]/20 text-[#a05058] hover:text-[#f87171] border border-[#2a1a20] hover:border-[#ef4444]/40 flex items-center gap-1 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40"
                        title="전적이 없는 스트리머입니다. 클릭 시 DB에서 완전히 삭제됩니다."
                      >
                        <Trash2 size={13} />
                        <span className="hidden sm:inline">삭제</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ================================================================= */}
        {/* 6. MODAL FOOTER                                                   */}
        {/* ================================================================= */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#12121c] border-t border-[#1e1e2c] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[#8a8aa0]">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span>
              모든 변경 사항은 <strong>DB 서버에 실시간 Auto-Save</strong>되며, 모달 닫기 시 메인 화면이 최신 상태로 재동기화됩니다.
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={handleModalClose}
              className="h-[38px] px-6 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-bold rounded-xl text-[13px] shadow-[0_4px_16px_rgba(139,92,246,0.3)] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 size={15} />
              <span>완료 및 닫기</span>
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 7. INDIVIDUAL DELETE CONFIRMATION DIALOG (For 0-match single)     */}
        {/* ================================================================= */}
        {deleteTargetName && (
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.15s]">
            <div className="relative w-full max-w-[360px] bg-[#12121a] border border-[#2a2a3a] rounded-2xl p-5 shadow-2xl">
              <div className="flex items-center gap-2 text-[#f87171] mb-2 font-bold text-[14px]">
                <AlertCircle size={18} />
                <span>스트리머 삭제 확인</span>
              </div>
              <p className="text-[12px] text-[#c0c0d0] leading-relaxed mb-4">
                <strong>'{deleteTargetName}'</strong> 스트리머는 CK일지 전적이 없습니다.
                <br />
                서버 DB 및 목록에서 영구적으로 삭제하시겠습니까?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetName(null)}
                  disabled={isProcessing}
                  className="flex-1 h-[36px] bg-[#1a1a28] hover:bg-[#26263a] text-[#a0a0b8] rounded-xl text-[12px] font-medium cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isProcessing}
                  className="flex-1 h-[36px] bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold rounded-xl text-[12px] shadow-lg shadow-[#ef4444]/20 cursor-pointer"
                >
                  {isProcessing ? '삭제 중...' : '영구 삭제'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* 8. BATCH DELETE & HIDE CONFIRMATION DIALOG (선택 일괄 삭제 확인)  */}
        {/* ================================================================= */}
        {isBatchConfirmOpen && (
          <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-[fadeIn_0.15s]">
            <div className="relative w-full max-w-[480px] bg-[#13131e] border border-[#ef4444]/50 rounded-[22px] p-6 shadow-2xl flex flex-col gap-4 text-[#e6e6ef]">
              <div className="flex items-center gap-2 text-[#f87171] font-extrabold text-[16px]">
                <ShieldAlert size={22} className="text-[#ef4444]" />
                <span>선택 스트리머 일괄 삭제 & 숨김 처리</span>
              </div>

              <p className="text-[12px] text-[#c0c0d8] leading-relaxed">
                선택하신 총 <strong className="text-white font-bold">{batchClassification.totalSelected}명</strong>의 스트리머에 대해 데이터 안전 보존 규칙에 따라 분기 처리가 적용됩니다:
              </p>

              {/* Group 1: 0-match delete list */}
              <div className="p-3.5 bg-[#1f131a] border border-[#ef4444]/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[12px] font-bold text-[#f87171]">
                  <span className="flex items-center gap-1.5">
                    <Trash2 size={14} />
                    <span>서버 DB 영구 삭제 ({batchClassification.toDelete.length}명)</span>
                  </span>
                  <span className="text-[10px] bg-[#ef4444]/20 px-2 py-0.5 rounded font-mono">
                    CK 전적 0건
                  </span>
                </div>
                {batchClassification.toDelete.length === 0 ? (
                  <p className="text-[11px] text-[#806070]">삭제 대상 스트리머가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pt-1">
                    {batchClassification.toDelete.map((name) => (
                      <span
                        key={name}
                        className="text-[11px] bg-[#2a1622] text-[#fca5a5] border border-[#ef4444]/40 px-2 py-0.5 rounded-lg"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-[#a06875]">
                  * 서버 DB(server/streamers.json)에서 즉시 영구 삭제되며, 되돌릴 수 없습니다.
                </p>
              </div>

              {/* Group 2: >0-match hide list */}
              <div className="p-3.5 bg-[#1c1822] border border-[#f59e0b]/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[12px] font-bold text-[#fbbf24]">
                  <span className="flex items-center gap-1.5">
                    <EyeOff size={14} />
                    <span>[숨김] 상태로 안전 전환 ({batchClassification.toHide.length}명)</span>
                  </span>
                  <span className="text-[10px] bg-[#f59e0b]/20 px-2 py-0.5 rounded font-mono">
                    CK 전적 보존
                  </span>
                </div>
                {batchClassification.toHide.length === 0 ? (
                  <p className="text-[11px] text-[#706880]">숨김 전환 대상 스트리머가 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-[100px] overflow-y-auto pt-1">
                    {batchClassification.toHide.map((name) => {
                      const totalGames = matchStatsMap.get(name.toLowerCase().trim())?.total || 0;
                      return (
                        <span
                          key={name}
                          className="text-[11px] bg-[#282030] text-[#fde68a] border border-[#f59e0b]/40 px-2 py-0.5 rounded-lg flex items-center gap-1"
                        >
                          <span>{name}</span>
                          <span className="text-[9px] text-[#f59e0b] font-mono">({totalGames}전)</span>
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] text-[#a09070]">
                  * 기존 경기 일지 전적 데이터 보존을 위해 삭제되지 않고 <strong>[숨김]</strong> 처리됩니다. (메인 라이브 목록 및 멤버 찾기에서 제외)
                </p>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchConfirmOpen(false)}
                  disabled={isProcessing}
                  className="flex-1 h-[38px] bg-[#1a1a28] hover:bg-[#252538] text-[#a0a0b8] hover:text-white rounded-xl text-[12px] font-medium cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatchDeleteAndHide}
                  disabled={isProcessing || batchClassification.totalSelected === 0}
                  className="flex-1 h-[38px] bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#dc2626] hover:to-[#b91c1c] text-white font-bold rounded-xl text-[12px] shadow-lg shadow-[#ef4444]/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span>실행 중...</span>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>확인 및 일괄 실행</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LineKey, LINE_KEYS, LINE_LABELS, Match, StreamerProfile } from '../types';
import {
  saveStreamerProfile,
  saveStreamerProfilesBatch,
  saveStreamerProfilesBatchAsync,
  deleteStreamerProfile,
  deleteStreamerProfileAsync,
  autoCollectStreamersFromMatches,
  syncStreamersFromBackend,
} from '../lib/streamerApi';
import { StreamerAvatar, SOOP_STREAMER_IDS } from './StreamerAvatar';
import { getChosung } from '../lib/championSearch';
import {
  X,
  Search,
  Plus,
  ExternalLink,
  Save,
  CheckCircle2,
  Radio,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Trash2,
  Eye,
  EyeOff,
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
 * Robust streamer dictionary mapper that preserves SOOP IDs and utilizes SOOP_STREAMER_IDS fallbacks
 * preventing any blanking out or overwriting with empty string.
 */
function mapStreamersToDict(
  profiles: StreamerProfile[],
  prevMap?: Record<string, StreamerProfile>
): Record<string, StreamerProfile> {
  const result: Record<string, StreamerProfile> = {};
  for (const p of profiles) {
    if (!p?.name?.trim()) continue;
    const cleanName = p.name.trim();
    const key = cleanName.toLowerCase();
    const prev = prevMap ? prevMap[key] : undefined;
    const serverId = typeof p.soop_id === 'string' ? p.soop_id.trim() : '';
    const prevId = (prev?.soop_id || '').trim();
    const fallbackId = (SOOP_STREAMER_IDS[cleanName] || '').trim();
    const effectiveId = serverId || prevId || fallbackId;

    result[key] = {
      name: cleanName,
      soop_id: effectiveId,
      main_position: p.main_position || prev?.main_position || 'mid',
      is_hidden: p.is_hidden !== undefined ? Boolean(p.is_hidden) : Boolean(prev?.is_hidden),
      memo: p.memo || prev?.memo,
      updated_at: p.updated_at || prev?.updated_at,
    };
  }

  // Preserve any locally tracked streamers
  if (prevMap) {
    for (const [key, prevItem] of Object.entries(prevMap)) {
      if (!result[key]) {
        result[key] = prevItem;
      }
    }
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
  const [search, setSearch] = useState('');
  const [selectedLine, setSelectedLine] = useState<'ALL' | LineKey>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'LIVE' | 'VISIBLE' | 'HIDDEN' | 'NO_ID'>('ALL');

  // Confirmation state for deleting a streamer
  const [deleteTargetName, setDeleteTargetName] = useState<string | null>(null);

  // Local state for editing multiple profiles
  const [localMap, setLocalMap] = useState<Record<string, StreamerProfile>>(() => {
    return mapStreamersToDict(allProfiles);
  });

  // New streamer addition inputs
  const [newName, setNewName] = useState('');
  const [newSoopId, setNewSoopId] = useState('');
  const [newLine, setNewLine] = useState<LineKey>('mid');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingWithServer, setIsSyncingWithServer] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('synced');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Stable references for parent callback props to prevent re-creation loops
  const onProfilesUpdatedRef = React.useRef(onProfilesUpdated);
  useEffect(() => {
    onProfilesUpdatedRef.current = onProfilesUpdated;
  }, [onProfilesUpdated]);

  const onToastRef = React.useRef(onToast);
  useEffect(() => {
    onToastRef.current = onToast;
  }, [onToast]);

  const isSyncingRef = React.useRef(false);

  // Authoritative server DB fetch & sync handler (Single Source of Truth: server/streamers.json)
  const handleSyncFromServer = useCallback(
    async (showToastNotice = false) => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      setIsSyncingWithServer(true);
      setSyncStatus('syncing');

      try {
        const serverProfiles = await syncStreamersFromBackend(true);
        if (serverProfiles && serverProfiles.length > 0) {
          setLocalMap((prev) => mapStreamersToDict(serverProfiles, prev));
          setLastSyncTime(new Date());
          setSyncStatus('synced');
          onProfilesUpdatedRef.current(serverProfiles);
          if (showToastNotice) {
            onToastRef.current(`서버 DB에서 최신 스트리머 프로필(${serverProfiles.length}명)을 동기화했습니다.`);
          }
        } else {
          setSyncStatus('synced');
        }
      } catch (err) {
        console.warn('[StreamerManageModal] Server sync error:', err);
        setSyncStatus('error');
        if (showToastNotice) {
          onToastRef.current('서버 데이터 동기화 중 오류가 발생했습니다.');
        }
      } finally {
        isSyncingRef.current = false;
        setIsSyncingWithServer(false);
      }
    },
    []
  );

  // Sync directly from DB server API when modal opens (isOpen === true)
  useEffect(() => {
    if (isOpen) {
      setDeleteTargetName(null);
      handleSyncFromServer(false);
    }
  }, [isOpen, handleSyncFromServer]);

  // Synchronize localMap with allProfiles when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setLocalMap(mapStreamersToDict(allProfiles));
    }
  }, [allProfiles, isOpen]);

  if (!isOpen) return null;

  const profileList: StreamerProfile[] = (Object.values(localMap) as StreamerProfile[]).sort((a, b) => {
    if (a.name === '우리밍_' || a.name === '우리밍') return -1;
    if (b.name === '우리밍_' || b.name === '우리밍') return 1;
    return a.name.localeCompare(b.name, 'ko-KR');
  });

  // Filtered list
  const filteredProfiles: StreamerProfile[] = profileList.filter((p) => {
    // Line filter
    if (selectedLine !== 'ALL' && p.main_position !== selectedLine) return false;

    // Status filter
    const isLive = Boolean(p.soop_id && liveUserIds.has(p.soop_id.toLowerCase().trim()));
    if (filterMode === 'LIVE' && !isLive) return false;
    if (filterMode === 'VISIBLE' && p.is_hidden) return false;
    if (filterMode === 'HIDDEN' && !p.is_hidden) return false;
    if (filterMode === 'NO_ID' && p.soop_id?.trim()) return false;

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const chosung = getChosung(p.name).toLowerCase();
      const nameMatch = p.name.toLowerCase().includes(q) || chosung.includes(q);
      const idMatch = (p.soop_id || '').toLowerCase().includes(q);
      if (!nameMatch && !idMatch) return false;
    }

    return true;
  });

  const handleFieldChange = (name: string, field: keyof StreamerProfile, value: any) => {
    if (!isAdmin) {
      onToast('스트리머 정보 수정은 관리자만 가능합니다.');
      return;
    }
    setLocalMap((prev) => {
      const key = name.toLowerCase().trim();
      const existing: StreamerProfile = prev[key] || { name, soop_id: '', main_position: 'mid' };
      return {
        ...prev,
        [key]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleToggleHidden = async (name: string) => {
    if (!isAdmin) {
      onToast('숨김 설정은 관리자만 가능합니다.');
      return;
    }
    const key = name.toLowerCase().trim();
    const target = localMap[key];
    if (!target) return;
    const nextHidden = !target.is_hidden;
    const updatedTarget: StreamerProfile = {
      ...target,
      is_hidden: nextHidden,
      updated_at: new Date().toISOString(),
    };

    setIsSaving(true);
    try {
      await saveStreamerProfilesBatchAsync([updatedTarget], { replace: false });
      const fresh = await syncStreamersFromBackend(true);
      setLocalMap((prev) => mapStreamersToDict(fresh, prev));
      setLastSyncTime(new Date());
      setSyncStatus('synced');
      onProfilesUpdatedRef.current(fresh);
      if (onSaveComplete) {
        await onSaveComplete(fresh);
      }
      onToastRef.current(
        nextHidden
          ? `'${target.name}' 스트리머가 숨김 처리되었습니다. (CK멤버 라이브 목록에서 제외)`
          : `'${target.name}' 스트리머가 정상 노출로 변경되었습니다.`
      );
    } catch {
      onToastRef.current('숨김 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSingle = async (name: string) => {
    if (!isAdmin) {
      onToastRef.current('저장 권한이 없습니다. 관리자 로그인이 필요합니다.');
      return;
    }
    const key = name.toLowerCase().trim();
    const target = localMap[key];
    if (!target) return;
    const cleanTarget: StreamerProfile = {
      ...target,
      name: target.name.trim(),
      soop_id: (target.soop_id ?? '').trim(),
      main_position: target.main_position || 'mid',
      is_hidden: Boolean(target.is_hidden),
      updated_at: new Date().toISOString(),
    };
    setIsSaving(true);
    try {
      await saveStreamerProfilesBatchAsync([cleanTarget], { replace: false });
      const fresh = await syncStreamersFromBackend(true);
      setLocalMap((prev) => mapStreamersToDict(fresh, prev));
      setLastSyncTime(new Date());
      setSyncStatus('synced');
      onProfilesUpdatedRef.current(fresh);
      if (onSaveComplete) {
        await onSaveComplete(fresh);
      }
      onToastRef.current(`'${target.name}' 스트리머 정보가 서버에 영구 저장 및 동기화되었습니다.`);
    } catch {
      onToastRef.current('스트리머 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async () => {
    if (!isAdmin) {
      onToastRef.current('저장 권한이 없습니다. 관리자 로그인이 필요합니다.');
      return;
    }
    const rawList = Object.values(localMap) as StreamerProfile[];
    const list: StreamerProfile[] = rawList.map((item) => ({
      ...item,
      name: item.name.trim(),
      soop_id: (item.soop_id ?? '').trim(),
      main_position: item.main_position || 'mid',
      is_hidden: Boolean(item.is_hidden),
      updated_at: new Date().toISOString(),
    }));
    setIsSaving(true);
    try {
      await saveStreamerProfilesBatchAsync(list, { replace: true });
      const fresh = await syncStreamersFromBackend(true);
      setLocalMap(mapStreamersToDict(fresh));
      setLastSyncTime(new Date());
      setSyncStatus('synced');
      onProfilesUpdatedRef.current(fresh);
      if (onSaveComplete) {
        await onSaveComplete(fresh);
      }
      onToastRef.current(`총 ${fresh.length}명의 스트리머 정보가 서버에 영구 저장 완료되었습니다.`);
    } catch {
      onToastRef.current('전체 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async (name: string) => {
    if (!isAdmin) {
      onToastRef.current('삭제 권한이 없습니다. 관리자 로그인이 필요합니다.');
      return;
    }
    setIsSaving(true);
    try {
      await deleteStreamerProfileAsync(name);
      const fresh = await syncStreamersFromBackend(true);
      setLocalMap(mapStreamersToDict(fresh));
      setLastSyncTime(new Date());
      setSyncStatus('synced');
      onProfilesUpdatedRef.current(fresh);
      if (onSaveComplete) {
        await onSaveComplete(fresh);
      }
      setDeleteTargetName(null);
      onToastRef.current(`'${name}' 스트리머가 목록 및 서버 DB에서 완전히 삭제되었습니다.`);
    } catch {
      onToastRef.current('스트리머 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onToastRef.current('스트리머 추가는 관리자만 가능합니다.');
      return;
    }
    if (!newName.trim()) {
      onToastRef.current('스트리머 이름을 입력해 주세요.');
      return;
    }
    const cleanName = newName.trim();
    const fallbackId = (SOOP_STREAMER_IDS[cleanName] || '').trim();
    const cleanId = newSoopId.trim() || fallbackId;
    const newProfile: StreamerProfile = {
      name: cleanName,
      soop_id: cleanId,
      main_position: newLine,
      is_hidden: false,
      updated_at: new Date().toISOString(),
    };
    setIsSaving(true);
    try {
      await saveStreamerProfilesBatchAsync([newProfile], { replace: false });
      const fresh = await syncStreamersFromBackend(true);
      setLocalMap((prev) => mapStreamersToDict(fresh, prev));
      setLastSyncTime(new Date());
      setSyncStatus('synced');
      onProfilesUpdatedRef.current(fresh);
      if (onSaveComplete) {
        await onSaveComplete(fresh);
      }
      setNewName('');
      setNewSoopId('');
      setIsAddingNew(false);
      onToastRef.current(`새 스트리머 '${cleanName}'이 서버 DB에 등록 및 영구 저장되었습니다.`);
    } catch {
      onToastRef.current('새 스트리머 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoCollect = async () => {
    if (!isAdmin) {
      onToastRef.current('경기 일지 자동 수집은 관리자만 가능합니다.');
      return;
    }
    const currentList: StreamerProfile[] = Object.values(localMap) as StreamerProfile[];
    const { updatedList, addedCount } = autoCollectStreamersFromMatches(matches, currentList);
    if (addedCount > 0) {
      setIsSaving(true);
      try {
        await saveStreamerProfilesBatchAsync(updatedList, { replace: false });
        const fresh = await syncStreamersFromBackend(true);
        setLocalMap((prev) => mapStreamersToDict(fresh, prev));
        setLastSyncTime(new Date());
        setSyncStatus('synced');
        onProfilesUpdatedRef.current(fresh);
        if (onSaveComplete) {
          await onSaveComplete(fresh);
        }
        onToastRef.current(`경기 기록에서 새로운 스트리머 ${addedCount}명을 자동으로 수집 및 영구 저장했습니다!`);
      } catch {
        onToastRef.current('자동 수집 저장 중 오류가 발생했습니다.');
      } finally {
        setIsSaving(false);
      }
    } else {
      onToastRef.current('경기 기록에서 누락된 새로운 스트리머가 없습니다.');
    }
  };

  const totalRegistered = profileList.length;
  const mappedCount = profileList.filter((p) => Boolean(p.soop_id?.trim())).length;
  const liveCount = profileList.filter(
    (p) => !p.is_hidden && Boolean(p.soop_id && liveUserIds.has(p.soop_id.toLowerCase().trim()))
  ).length;
  const hiddenCount = profileList.filter((p) => Boolean(p.is_hidden)).length;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        className="relative z-[10000] w-full max-w-[900px] bg-[#12121a] border border-[#1e1e2a] rounded-[24px] p-4 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e1e2a]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[17px] sm:text-[19px] font-black text-white tracking-tight flex items-center gap-2">
                <Radio className="text-[#8b5cf6]" size={20} />
                CK 스트리머 SOOP ID 관리
              </span>
              <span className="text-[11px] bg-[#8b5cf6]/20 border border-[#8b5cf6]/40 text-[#c4b5fd] font-bold px-2 py-0.5 rounded-full">
                숲TV 라이브 연동 및 노출 설정
              </span>
            </div>
            <p className="text-[12px] text-[#8a8aa0] mt-1">
              스트리머의 SOOP user_id 및 주 포지션을 등록하고, 삭제 또는 숨김(라이브 노출 제외)을 관리합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-[32px] h-[32px] bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-full flex items-center justify-center transition shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Read-Only Warning Banner for Non-Admin Guests */}
        {!isAdmin && (
          <div className="my-2.5 p-3 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/35 flex items-center gap-2.5 text-[#fca5a5] text-[12px] shadow-sm">
            <AlertCircle size={16} className="shrink-0 text-[#ef4444]" />
            <span>
              <strong>조회 전용 모드:</strong> 관리자 로그인이 되어 있지 않아 읽기 전용으로 표시됩니다. 스트리머 추가, 정보 수정, 삭제는 관리자만 가능합니다.
            </span>
          </div>
        )}

        {/* Stats Summary & Quick Action Bar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-2.5 bg-[#0a0a10] -mx-4 sm:-mx-6 px-4 sm:px-6 border-b border-[#1e1e2a] text-[11px] sm:text-[12px]">
          <div className="flex items-center gap-2.5 text-[#a0a0b8] flex-wrap">
            <span>
              전체: <strong className="text-white font-black">{totalRegistered}</strong>명
            </span>
            <span>•</span>
            <span>
              ID 등록: <strong className="text-[#10b981] font-black">{mappedCount}</strong>명
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
              LIVE: <strong className="text-[#ef4444] font-black">{liveCount}</strong>명
            </span>
            {hiddenCount > 0 && (
              <>
                <span>•</span>
                <span className="text-[#fca5a5] flex items-center gap-1">
                  <EyeOff size={12} />
                  숨김: <strong className="font-bold">{hiddenCount}</strong>명
                </span>
              </>
            )}
            <span>•</span>
            {/* Server Sync Status Badge */}
            <span className="flex items-center gap-1">
              {isSyncingWithServer || syncStatus === 'syncing' ? (
                <span className="text-[#38bdf8] font-bold flex items-center gap-1 bg-[#38bdf8]/10 border border-[#38bdf8]/30 px-2 py-0.5 rounded-full text-[10.5px]">
                  <RefreshCw size={11} className="animate-spin" />
                  서버 동기화 중...
                </span>
              ) : syncStatus === 'error' ? (
                <span className="text-[#f87171] font-bold flex items-center gap-1 bg-[#ef4444]/10 border border-[#ef4444]/30 px-2 py-0.5 rounded-full text-[10.5px]">
                  <AlertCircle size={11} />
                  연동 재시도 필요
                </span>
              ) : (
                <span
                  className="text-[#10b981] font-bold flex items-center gap-1 bg-[#10b981]/10 border border-[#10b981]/30 px-2 py-0.5 rounded-full text-[10.5px]"
                  title={
                    lastSyncTime
                      ? `서버 DB(streamers.json) 동기화 완료: ${lastSyncTime.toLocaleTimeString()}`
                      : '서버 DB(streamers.json) 최신 데이터 연동됨'
                  }
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                  서버 연동됨
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Manual Server Sync button: directly fetches latest streamers from server DB */}
            <button
              type="button"
              onClick={() => handleSyncFromServer(true)}
              disabled={isSyncingWithServer}
              title="서버 DB(server/streamers.json)에서 최신 스트리머 프로필, SOOP ID 및 숨김 상태를 실시간 재조회합니다"
              className="h-[30px] px-3 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#38bdf8] border border-[#38bdf8]/30 hover:border-[#38bdf8]/60 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={isSyncingWithServer ? 'animate-spin' : ''} />
              <span>{isSyncingWithServer ? '동기화 중...' : '서버 데이터 동기화'}</span>
            </button>

            {/* Admin-only action buttons */}
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleAutoCollect}
                  title="모든 경기 일지(CK 일지)를 분석하여 아직 등록되지 않은 스트리머를 자동 등록합니다"
                  className="h-[30px] px-3 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c4b5fd] rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>경기 일지 자동 수집</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNew((prev) => !prev)}
                  className="h-[30px] px-3 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>{isAddingNew ? '추가 닫기' : '새 스트리머 추가'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Collapsible: Add New Streamer Form */}
        {isAddingNew && (
          <form
            onSubmit={handleAddNew}
            className="p-3.5 my-3 bg-[#161622] border border-[#8b5cf6]/40 rounded-[16px] animate-[fadeIn_0.2s] space-y-3"
          >
            <div className="text-[12px] font-bold text-white flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#a78bfa]" />
              <span>신규 스트리머 등록</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-4">
                <label className="text-[10px] text-[#8a8aa0] mb-1 block">닉네임 / 이름 *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="예: 우리밍_, 김민교, 서리"
                  className="w-full h-[34px] bg-[#0a0a10] border border-[#2a2a3a] rounded-xl px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]"
                  required
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-[10px] text-[#8a8aa0] mb-1 block">SOOP ID (user_id)</label>
                <input
                  type="text"
                  value={newSoopId}
                  onChange={(e) => setNewSoopId(e.target.value)}
                  placeholder="예: kmj05317, minkyo1994"
                  className="w-full h-[34px] bg-[#0a0a10] border border-[#2a2a3a] rounded-xl px-3 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] text-[#8a8aa0] mb-1 block">주 포지션</label>
                <select
                  value={newLine}
                  onChange={(e) => setNewLine(e.target.value as LineKey)}
                  className="w-full h-[34px] bg-[#0a0a10] border border-[#2a2a3a] rounded-xl px-2 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6]"
                >
                  {LINE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {LINE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full h-[34px] bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-[12px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>등록</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="py-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7a7a90]"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="스트리머 검색 (초성 검색 가능: ㄱㅁㄱ, ㄷㅎ, ㅅㄹ)"
                className="w-full h-[34px] bg-[#0a0a10] border border-[#1e1e2a] rounded-full pl-9 pr-8 text-[12px] text-white focus:outline-none focus:border-[#8b5cf6] placeholder-[#5a5a70]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7a7a90] hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  { id: 'ALL', label: '전체' },
                  { id: 'LIVE', label: `🔴 LIVE (${liveCount})` },
                  { id: 'VISIBLE', label: '👁 노출중' },
                  { id: 'HIDDEN', label: `🙈 숨김 (${hiddenCount})` },
                  { id: 'NO_ID', label: 'ID 미등록' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setFilterMode(mode.id)}
                  className={`h-[28px] px-3 rounded-full text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                    filterMode === mode.id
                      ? 'bg-[#8b5cf6] text-white'
                      : 'bg-[#161622] text-[#8a8aa0] hover:text-white border border-[#1e1e2a]'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Line Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] text-[#7a7a90] font-semibold mr-1 shrink-0">포지션:</span>
            <button
              type="button"
              onClick={() => setSelectedLine('ALL')}
              className={`h-[26px] px-3 rounded-full text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                selectedLine === 'ALL'
                  ? 'bg-white text-black'
                  : 'bg-[#161622] text-[#8a8aa0] hover:text-white border border-[#1e1e2a]'
              }`}
            >
              전체 ({profileList.length})
            </button>
            {LINE_KEYS.map((k) => {
              const count = profileList.filter((p) => p.main_position === k).length;
              const isSelected = selectedLine === k;
              const cl = LINE_COLOR_CLASSES[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedLine(k)}
                  className={`h-[26px] px-3 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 cursor-pointer border ${
                    isSelected
                      ? `${cl.bg} ${cl.text} ${cl.border} ring-1 ring-white/20`
                      : 'bg-[#161622] text-[#8a8aa0] hover:text-white border-[#1e1e2a]'
                  }`}
                >
                  <span>{LINE_LABELS[k]}</span>
                  <span className="text-[9.5px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Streamers List / Table */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
          {isSyncingWithServer && profileList.length === 0 ? (
            <div className="p-12 text-center text-[#7a7a90] bg-[#0a0a10] rounded-[16px] border border-[#1e1e2a] flex flex-col items-center justify-center">
              <RefreshCw size={26} className="animate-spin text-[#8b5cf6] mb-3" />
              <p className="text-[13px] font-bold text-white mb-1">서버 DB에서 최신 스트리머 목록을 동기화하는 중입니다...</p>
              <p className="text-[11px] text-[#7a7a90]">잠시만 기다려 주세요.</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-10 text-center text-[#7a7a90] bg-[#0a0a10] rounded-[16px] border border-[#1e1e2a]">
              <AlertCircle size={28} className="mx-auto mb-2 text-[#5a5a70]" />
              <p className="text-[13px] font-bold text-white mb-1">조건에 맞는 스트리머가 없습니다.</p>
              <p className="text-[11px]">검색어를 비우거나 다른 필터를 선택해 보세요.</p>
            </div>
          ) : (
            filteredProfiles.map((p) => {
              const cleanId = (p.soop_id || '').toLowerCase().trim();
              const isLive = Boolean(cleanId && liveUserIds.has(cleanId));
              const isWooriming = p.name === '우리밍_' || p.name === '우리밍';

              return (
                <div
                  key={p.name}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[16px] border transition ${
                    isWooriming
                      ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/40'
                      : p.is_hidden
                      ? 'bg-[#121218]/60 border-[#262636] opacity-75'
                      : isLive
                      ? 'bg-[#ef4444]/5 border-[#ef4444]/30'
                      : 'bg-[#0f0f18] border-[#1e1e2a] hover:border-[#2a2a3e]'
                  }`}
                >
                  {/* Left: Avatar, Name, Live & Hidden status */}
                  <div className="flex items-center gap-3 min-w-[210px]">
                    <div className="relative">
                      <StreamerAvatar name={p.name} size={36} shape="circle" />
                      {isLive && !p.is_hidden && (
                        <span
                          className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#ef4444] border-2 border-[#12121a] rounded-full animate-ping"
                          title="현재 방송 중!"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[13px] font-black truncate ${p.is_hidden ? 'text-[#a0a0b0]' : 'text-white'}`}>
                          {p.name}
                        </span>
                        {isWooriming && (
                          <span className="text-[9.5px] bg-[#8b5cf6] text-white font-extrabold px-1.5 py-0.2 rounded-full">
                            👑 기준
                          </span>
                        )}
                        {p.is_hidden ? (
                          <span className="text-[9px] bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#fca5a5] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                            <EyeOff size={10} />
                            숨김
                          </span>
                        ) : isLive ? (
                          <span className="text-[9.5px] bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#f87171] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[9.5px] bg-[#1e1e2a] text-[#7a7a90] px-1.5 py-0.2 rounded-full">
                            OFFLINE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#7a7a90] truncate">
                        {p.soop_id ? `@${p.soop_id}` : 'SOOP ID 미등록'}
                      </div>
                    </div>
                  </div>

                  {/* Center: Position selector + SOOP ID input */}
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                    {/* Position Pills */}
                    <div className="flex items-center gap-1 shrink-0">
                      {LINE_KEYS.map((k) => {
                        const isCurrent = p.main_position === k;
                        const cl = LINE_COLOR_CLASSES[k];
                        return (
                          <button
                            key={k}
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => handleFieldChange(p.name, 'main_position', k)}
                            className={`h-[26px] px-2 rounded-lg text-[10px] font-bold transition border ${
                              isCurrent
                                ? `${cl.bg} ${cl.text} ${cl.border} shadow-sm font-black`
                                : 'bg-[#161622] text-[#6a6a80] hover:text-[#9a9ab0] border-transparent'
                            } ${!isAdmin ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                          >
                            {LINE_LABELS[k]}
                          </button>
                        );
                      })}
                    </div>

                    {/* SOOP ID input */}
                    <div className="relative flex-1 min-w-[150px]">
                      <input
                        type="text"
                        readOnly={!isAdmin}
                        value={p.soop_id ?? ''}
                        onChange={(e) => handleFieldChange(p.name, 'soop_id', e.target.value)}
                        onBlur={() => {
                          if (isAdmin) handleSaveSingle(p.name);
                        }}
                        placeholder="SOOP ID (user_id)"
                        className={`w-full h-[32px] bg-[#08080c] border border-[#222232] rounded-xl px-3 text-[11px] text-white focus:outline-none focus:border-[#8b5cf6] placeholder-[#4a4a60] ${
                          !isAdmin ? 'cursor-not-allowed opacity-75' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Right Actions: Hide/Show Toggle, Station Link, Save, Delete */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap justify-end">
                    {/* Hide / Show Toggle Button */}
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => handleToggleHidden(p.name)}
                      title={
                        !isAdmin
                          ? '관리자만 숨김/노출을 변경할 수 있습니다'
                          : p.is_hidden
                          ? '현재 숨김 상태입니다 (클릭하여 CK멤버 탭에 노출)'
                          : '현재 노출 상태입니다 (클릭하여 CK멤버 탭에서 숨김)'
                      }
                      className={`h-[32px] px-2.5 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 border ${
                        !isAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
                      } ${
                        p.is_hidden
                          ? 'bg-[#ef4444]/15 border-[#ef4444]/30 text-[#fca5a5] hover:bg-[#ef4444]/25'
                          : 'bg-[#1e1e28] hover:bg-[#262638] text-[#a0a0b8] hover:text-white border-[#2a2a3e]'
                      }`}
                    >
                      {p.is_hidden ? (
                        <>
                          <EyeOff size={13} className="text-[#f87171]" />
                          <span>숨김됨</span>
                        </>
                      ) : (
                        <>
                          <Eye size={13} className="text-[#34d399]" />
                          <span>노출</span>
                        </>
                      )}
                    </button>

                    {/* Station Link */}
                    {p.soop_id ? (
                      <a
                        href={`https://play.sooplive.co.kr/${p.soop_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="SOOP 방송국 바로가기 (새 창)"
                        className="h-[32px] px-2 bg-[#161622] hover:bg-[#222234] border border-[#26263a] text-[#c4b5fd] rounded-xl text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        <ExternalLink size={12} />
                        <span className="hidden sm:inline">방송국</span>
                      </a>
                    ) : null}

                    {/* Single Save - Admin only */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleSaveSingle(p.name)}
                        title="이 스트리머 설정 저장"
                        className="h-[32px] px-2.5 bg-[#1e1e2a] hover:bg-[#8b5cf6] text-[#c4b5fd] hover:text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Save size={13} />
                        <span className="hidden sm:inline">저장</span>
                      </button>
                    )}

                    {/* Delete Streamer Button - Admin only */}
                    {isAdmin && !isWooriming && (
                      <button
                        type="button"
                        onClick={() => setDeleteTargetName(p.name)}
                        title="스트리머 목록 및 DB에서 완전히 삭제"
                        className="h-[32px] w-[32px] bg-[#1e1e2a] hover:bg-[#ef4444]/20 hover:text-[#f87171] text-[#7a7a90] border border-[#2a2a3a] hover:border-[#ef4444]/40 rounded-xl flex items-center justify-center transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-[#1e1e2a] flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#7a7a90] truncate">
            {isAdmin
              ? '* SOOP ID를 빈값으로 비우거나 수정하면 해당 값이 저장되며, 숨김 처리 시 CK멤버 라이브 목록에서 제외됩니다.'
              : '* 일반 사용자(게스트) 모드입니다. 스트리머 정보 등록 및 수정은 관리자 로그인 후 이용 가능합니다.'}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-[36px] px-4 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-white rounded-xl text-[12px] font-bold transition cursor-pointer"
            >
              닫기
            </button>
            {isAdmin && (
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  await handleSaveAll();
                  onClose();
                }}
                className="h-[36px] px-5 bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] hover:from-[#7c3aed] hover:to-[#4f46e5] text-white rounded-xl text-[12px] font-black shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{isSaving ? '저장 중...' : '전체 저장 완료'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetName && (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.1s]"
          onClick={() => setDeleteTargetName(null)}
        >
          <div
            className="bg-[#161622] border border-[#ef4444]/40 rounded-[22px] p-5 max-w-[400px] w-full shadow-2xl text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#ef4444]/15 border border-[#ef4444]/30 text-[#ef4444] flex items-center justify-center mx-auto">
              <Trash2 size={22} />
            </div>
            <div>
              <h4 className="text-[16px] font-black text-white">스트리머 영구 삭제</h4>
              <p className="text-[13px] text-[#c0c0d0] mt-2 leading-relaxed">
                '<strong className="text-white font-bold">{deleteTargetName}</strong>' 스트리머를 DB 및 관리 목록에서 완전히 삭제하시겠습니까?
              </p>
              <p className="text-[11px] text-[#ef4444] mt-1.5">
                * 삭제 시 관리 목록과 실시간 라이브 연동에서 즉시 제거됩니다.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetName(null)}
                className="h-[36px] px-4 bg-[#262638] hover:bg-[#32324a] text-white rounded-xl text-[12px] font-bold transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete(deleteTargetName)}
                className="h-[36px] px-5 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-xl text-[12px] font-bold transition shadow-lg shadow-[#ef4444]/30"
              >
                삭제 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

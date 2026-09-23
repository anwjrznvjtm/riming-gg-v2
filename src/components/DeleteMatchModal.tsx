import React, { useState } from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';
import { PASSCODE } from '../data/initialMatches';

interface DeleteMatchModalProps {
  isOpen: boolean;
  matchId: string | null;
  isAdmin: boolean;
  onClose: () => void;
  onConfirmDelete: (id: string) => void;
  onToast: (msg: string) => void;
}

export const DeleteMatchModal: React.FC<DeleteMatchModalProps> = ({
  isOpen,
  matchId,
  isAdmin,
  onClose,
  onConfirmDelete,
  onToast,
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !matchId) return null;

  const handleDelete = () => {
    if (!isAdmin) {
      const clean = passcode.trim().toLowerCase();
      if (!clean) {
        setError('삭제를 위해 관리자 패스코드를 입력해주세요.');
        return;
      }
      if (clean !== PASSCODE.toLowerCase()) {
        setError('패스코드가 올바르지 않습니다.');
        return;
      }
    }

    onConfirmDelete(matchId);
    onToast('경기가 성공적으로 삭제되었습니다.');
    setPasscode('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-[fadeIn_0.15s]"
      onClick={onClose}
    >
      <div
        className="relative z-[10000] w-full max-w-[400px] bg-[#12121a] border border-[#2a1a1e] rounded-[20px] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2.5 text-[#ef4444]">
            <div className="w-9 h-9 rounded-full bg-[#ef4444]/15 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-white">경기 삭제 확인</h3>
              <p className="text-[11px] text-[#8e8ea0]">선택한 CK 경기 데이터를 삭제합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 bg-[#1e1e2a] hover:bg-[#2a2a3a] rounded-full flex items-center justify-center text-[#8e8ea0] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-[12px] text-[#c0c0d0] mb-4 bg-black/40 p-3 rounded-xl border border-white/5">
          정말로 이 경기를 삭제하시겠습니까? 삭제된 경기 데이터는 복구할 수 없으며 전체 세트 스코어와 통계에 즉시 반영됩니다.
        </p>

        {!isAdmin && (
          <div className="mb-4">
            <label className="text-[11px] text-[#8e8ea0] block mb-1.5 font-medium">관리자 패스코드</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDelete();
              }}
              placeholder="패스코드"
              className="w-full h-[38px] bg-[#08080c] border border-[#2a2a3a] rounded-xl px-3.5 text-[12px] text-white focus:outline-none focus:border-[#ef4444]"
            />
          </div>
        )}

        {error && (
          <div className="text-[11px] text-[#ef4444] mb-3 bg-[#ef4444]/10 p-2 rounded-lg border border-[#ef4444]/20">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#1e1e2a] hover:bg-[#2a2a3a] text-[#c0c0d0] rounded-xl text-[12px] font-medium transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl text-[12px] font-bold transition flex items-center gap-1.5 shadow-lg shadow-[#dc2626]/30"
          >
            <Trash2 size={13} />
            <span>삭제하기</span>
          </button>
        </div>
      </div>
    </div>
  );
};

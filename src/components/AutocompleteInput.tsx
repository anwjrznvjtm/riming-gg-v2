import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { searchChampionsDetailed, searchStreamersDetailed, SearchMatchDetail } from '../lib/championSearch';
import { ChampionIcon } from './ChampionIcon';
import { StreamerAvatar } from './StreamerAvatar';
import { X, Search, Sparkles, Check } from 'lucide-react';

export interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  onSelect?: (val: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  sourceList: string[];
  type?: 'champion' | 'streamer';
  disabled?: boolean;
  autoFocus?: boolean;
  isDuplicate?: boolean;
  isHighlight?: boolean;
  clearable?: boolean;
  showIconInInput?: boolean;
  maxSuggestions?: number;
  dropdownPlacement?: 'bottom' | 'top';
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  className = '',
  inputClassName = '',
  sourceList,
  type = 'champion',
  disabled = false,
  autoFocus = false,
  isDuplicate = false,
  isHighlight = false,
  clearable = true,
  showIconInInput = true,
  maxSuggestions = 8,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Compute detailed matches via Fuse.js, Chosung, Alias & QWERTY algorithms
  const suggestions: SearchMatchDetail[] = useMemo(() => {
    if (!value || !value.trim()) return [];
    if (type === 'champion') {
      return searchChampionsDetailed(value, sourceList).slice(0, maxSuggestions);
    }
    return searchStreamersDetailed(value, sourceList).slice(0, maxSuggestions);
  }, [value, sourceList, type, maxSuggestions]);

  // Reset highlight index when suggestion list updates
  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions]);

  // Ensure highlighted element is visible in scroll container
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightIndex, isOpen]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((selectedVal: string) => {
    onChange(selectedVal);
    if (onSelect) {
      onSelect(selectedVal);
    }
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  }, [onChange, onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if ((e.key === 'ArrowDown' || e.key === 'Enter') && value.trim()) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      if (suggestions[highlightIndex]) {
        e.preventDefault();
        handleSelect(suggestions[highlightIndex].name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'Tab') {
      // Auto-select on tab if highlighted
      if (suggestions[highlightIndex]) {
        handleSelect(suggestions[highlightIndex].name);
      }
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Badge label & color for match types
  const getBadgeInfo = (match: SearchMatchDetail) => {
    switch (match.matchType) {
      case 'alias':
        return { label: `별칭: ${match.aliasLabel || ''}`, bg: 'bg-[#8b5cf6]/25 text-[#c4b5fd]' };
      case 'chosung':
        return { label: '초성', bg: 'bg-[#3b82f6]/25 text-[#93c5fd]' };
      case 'fuzzy':
        return { label: '유사', bg: 'bg-[#10b981]/25 text-[#6ee7b7]' };
      case 'qwerty':
        return { label: '영타', bg: 'bg-[#f59e0b]/25 text-[#fcd34d]' };
      case 'exact':
        return { label: '일치', bg: 'bg-[#8b5cf6]/20 text-[#a78bfa]' };
      default:
        return { label: type === 'champion' ? '챔피언' : '스트리머', bg: 'bg-[#1e1e2a] text-[#8a8aa0]' };
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className || 'w-full'}`}
    >
      <div className="relative flex items-center w-full">
        {/* Optional mini icon preview when input has valid selection */}
        {showIconInInput && value.trim() && (
          <div className="absolute left-2.5 pointer-events-none z-10 flex items-center">
            {type === 'champion' ? (
              <ChampionIcon name={value.trim()} size={16} shape="square" />
            ) : (
              <StreamerAvatar name={value.trim()} size={16} shape="square" />
            )}
          </div>
        )}

        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck="false"
          className={`w-full text-white placeholder:text-[#4a4a5a] focus:outline-none transition-all duration-150 ${
            showIconInInput && value.trim() ? 'pl-7' : 'px-3'
          } ${clearable && value.trim() && !disabled ? 'pr-7' : 'pr-3'} ${
            isDuplicate
              ? 'border-[#ef4444] bg-[#ef4444]/15 text-[#fca5a5] ring-1 ring-[#ef4444]/50 font-bold'
              : isHighlight
              ? 'border-[#8b5cf6] font-bold text-[#a78bfa]'
              : ''
          } ${inputClassName}`}
        />

        {/* Clear Button */}
        {clearable && value.trim() && !disabled && (
          <button
            type="button"
            id={id ? `${id}-clear-btn` : undefined}
            onClick={handleClear}
            className="absolute right-2 text-[#6a6a80] hover:text-[#e0e0f0] p-0.5 rounded-full hover:bg-[#2a2a3a] transition"
            title="지우기"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Duplicate Badge */}
      {isDuplicate && (
        <span
          className="absolute -top-1.5 -right-1 text-[8px] bg-[#ef4444] text-white px-1.5 py-0.2 rounded-full font-black shadow pointer-events-none z-20"
          title="중복되었습니다"
        >
          중복
        </span>
      )}

      {/* Dropdown Suggestions Menu */}
      {isOpen && (
        <div
          id={id ? `${id}-dropdown` : undefined}
          className="absolute left-0 top-[calc(100%+4px)] w-max min-w-[180px] max-w-[280px] bg-[#12121a]/98 backdrop-blur-md border border-[#2a2a3a] rounded-[12px] shadow-2xl py-1 z-[120] animate-[fadeIn_0.12s_ease-out]"
          style={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.6))' }}
        >
          {suggestions.length > 0 ? (
            <>
              {/* Header Label */}
              <div className="px-3 py-1 text-[9px] font-semibold text-[#6a6a80] tracking-wider uppercase border-b border-[#1e1e2a]/80 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Sparkles size={10} className="text-[#8b5cf6]" />
                  <span>{type === 'champion' ? '추천 챔피언' : '추천 스트리머'}</span>
                </span>
                <span className="text-[#5a5a6a]">{suggestions.length}개</span>
              </div>

              {/* Suggestions List */}
              <div ref={listRef} className="max-h-[220px] overflow-y-auto py-1 custom-scrollbar">
                {suggestions.map((item, idx) => {
                  const isHighlighted = idx === highlightIndex;
                  const isCurrentExact = item.name.toLowerCase() === value.trim().toLowerCase();
                  const badge = getBadgeInfo(item);

                  return (
                    <button
                      key={`${item.name}-${idx}`}
                      type="button"
                      id={id ? `${id}-option-${idx}` : undefined}
                      onMouseDown={(e) => {
                        e.preventDefault(); // Prevent input blur before selection
                        handleSelect(item.name);
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`w-full text-left px-2.5 py-1.5 text-[11px] font-medium flex items-center justify-between gap-2 transition-colors duration-100 ${
                        isHighlighted
                          ? 'bg-[#8b5cf6] text-white font-semibold'
                          : 'text-[#e0e0f0] hover:bg-[#1e1e2a]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {type === 'champion' ? (
                          <ChampionIcon
                            name={item.name}
                            size={20}
                            shape="square"
                            className="shrink-0 rounded-[4px] border border-black/30"
                          />
                        ) : (
                          <StreamerAvatar
                            name={item.name}
                            size={20}
                            shape="square"
                            className="shrink-0 rounded-[4px] border border-black/30"
                          />
                        )}
                        <span className="truncate">{item.name}</span>
                        {isCurrentExact && (
                          <Check size={12} className={isHighlighted ? 'text-white' : 'text-[#8b5cf6]'} />
                        )}
                      </div>

                      {/* Match Badge */}
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-[4px] font-semibold shrink-0 transition-colors ${
                          isHighlighted
                            ? 'bg-white/20 text-white'
                            : badge.bg
                        }`}
                      >
                        {badge.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Footer Helper Note */}
              <div className="px-2.5 py-1 border-t border-[#1e1e2a]/80 text-[9px] text-[#6a6a80] flex items-center justify-between bg-[#0b0b10]/60 rounded-b-[11px]">
                <span>↑↓ 이동 / Enter 선택</span>
                <span className="text-[#5a5a6a]">ESC 닫기</span>
              </div>
            </>
          ) : (
            <div className="p-3 text-center">
              <Search size={16} className="mx-auto text-[#4a4a5a] mb-1" />
              <div className="text-[11px] text-[#8a8aa0] font-medium">검색 결과가 없습니다</div>
              <div className="text-[9px] text-[#5a5a6a] mt-0.5">초성이나 영타로도 검색할 수 있습니다</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

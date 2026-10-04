import React, { useState, useEffect } from 'react';
import { getChampionIconUrl, getChampionFallbackUrl, getChampionEnName } from '../lib/champions';
import { subscribePatchVersion, getActivePatch } from '../lib/riotPatch';

interface Props {
  name: string;
  size?: number;
  shape?: "circle" | "square";
  showLock?: boolean;
  className?: string;
  version?: string;
}

export const ChampionIcon: React.FC<Props> = ({
  name,
  size = 24,
  shape = "circle",
  showLock = false,
  className = "",
  version,
}) => {
  const [currentPatch, setCurrentPatch] = useState<string>(version || getActivePatch());
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    if (version) {
      setCurrentPatch(version);
      return;
    }
    const unsub = subscribePatchVersion((v) => {
      setCurrentPatch(v);
      setFailed(false);
      setUseFallback(false);
    });
    return () => unsub();
  }, [version]);
  
  const cleanName = (name || "").trim();
  if (!cleanName) {
    return <div style={{ width: size, height: size }} className={`bg-[#1e1e2a] rounded-full ${className}`} />;
  }

  const enName = getChampionEnName(cleanName);
  const primaryUrl = getChampionIconUrl(cleanName, version || currentPatch);
  const fallbackUrl = getChampionFallbackUrl(cleanName);
  const url = useFallback && fallbackUrl ? fallbackUrl : primaryUrl;

  if (failed || !url || !enName) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`${shape === "circle" ? "rounded-full" : "rounded-[4px]"} bg-[#1e1e2a] border border-[#2a2a3a] flex items-center justify-center text-[8px] text-[#a0a6bd] font-bold ${className}`}
        title={cleanName}
      >
        {cleanName.slice(0, 2)}
      </div>
    );
  }

  return (
    <div style={{ width: size, height: size }} className={`relative shrink-0 ${className}`}>
      <img
        src={url}
        alt={cleanName}
        width={size}
        height={size}
        className={`${shape === "circle" ? "rounded-full" : "rounded-[4px]"} border border-[#2a2a3a] object-cover bg-[#12121a] w-full h-full`}
        onError={() => {
          if (!useFallback && fallbackUrl && fallbackUrl !== primaryUrl) {
            setUseFallback(true);
          } else {
            setFailed(true);
          }
        }}
        loading="lazy"
      />
      {showLock && (
        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
          <span className="text-[10px]">🔒</span>
        </div>
      )}
    </div>
  );
};
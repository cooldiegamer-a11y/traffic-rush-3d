import { Check, Lock, Sparkles, X } from 'lucide-react';
import { BIRD_SKINS } from '../data/gameConfig';
import { BirdSkin } from '../types/game';
import { BirdPreview } from './BirdPreview';

interface BirdHangarModalProps {
  isOpen: boolean;
  onClose: () => void;
  seeds: number;
  bestScore: number;
  unlockedSkinIds: string[];
  selectedSkinId: string;
  onSelectSkin: (skinId: string) => void;
  onUnlockSkin: (skin: BirdSkin) => void;
}

export function BirdHangarModal({
  isOpen,
  onClose,
  seeds,
  bestScore,
  unlockedSkinIds,
  selectedSkinId,
  onSelectSkin,
  onUnlockSkin,
}: BirdHangarModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hangar-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 id="hangar-title" className="font-display text-xl font-bold text-slate-900">
              Bird Roster
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {seeds} seeds available · Best score {bestScore}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            aria-label="Close Bird Roster"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto divide-y divide-slate-100">
          {BIRD_SKINS.map((skin) => {
            const isUnlocked = unlockedSkinIds.includes(skin.id);
            const isSelected = selectedSkinId === skin.id;
            const canAffordSeeds = seeds >= skin.unlockSeeds;

            return (
              <div
                key={skin.id}
                className="py-3.5 first:pt-1 last:pb-1 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected
                        ? 'bg-slate-900/5 border-slate-900'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <BirdPreview skin={skin} size={52} locked={!isUnlocked} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-sm text-slate-900 truncate">
                        {skin.name}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{skin.tagline}</p>
                    {!isUnlocked && (
                      <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                        {skin.unlockSeeds} seeds or score {skin.unlockScore}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => onSelectSkin(skin.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      {isSelected ? 'Equipped' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAffordSeeds}
                      onClick={() => onUnlockSkin(skin)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${
                        canAffordSeeds
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {canAffordSeeds ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                      {canAffordSeeds ? `Unlock (${skin.unlockSeeds})` : `${skin.unlockSeeds} Seeds`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

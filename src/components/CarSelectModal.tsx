import { ArrowLeft, Check, Coins, Lock } from 'lucide-react';
import { SPORTS_CARS } from '../data/cars';
import { CarSpec } from '../types/traffic';

interface CarSelectModalProps {
  selectedCar: CarSpec;
  unlockedCarIds: string[];
  totalCoins: number;
  onPreviewCar: (car: CarSpec) => void;
  onUnlockCar: (car: CarSpec) => void;
  onClose: () => void;
  onStartRace: () => void;
}

export function CarSelectModal({
  selectedCar,
  unlockedCarIds,
  totalCoins,
  onPreviewCar,
  onUnlockCar,
  onClose,
  onStartRace,
}: CarSelectModalProps) {
  const isUnlocked = unlockedCarIds.includes(selectedCar.id);
  const canAfford = totalCoins >= selectedCar.unlockCoins;

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 pointer-events-none">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 pointer-events-auto">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#090d18]/85 border border-white/15 text-white text-sm font-semibold hover:bg-[#111827] transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="px-4 py-2.5 min-h-[44px] rounded-xl bg-[#090d18]/85 border border-white/15 text-sm font-semibold flex items-center gap-2 tabular-nums">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-mono-tabular text-amber-300">{totalCoins}</span>
          <span className="text-slate-400 text-xs">Coins</span>
        </div>
      </div>

      {/* Bottom Garage Selector Dock (leaves center 3D car unobstructed) */}
      <div className="w-full max-w-4xl mx-auto bg-[#090d18]/90 border border-white/15 rounded-2xl p-4 sm:p-5 pointer-events-auto shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Selected Car Specs */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                style={{ backgroundColor: selectedCar.primaryColor }}
                aria-hidden="true"
              />
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white truncate">
                {selectedCar.name}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 line-clamp-1">
              {selectedCar.tagline}
            </p>

            {/* Stat Bars */}
            <div className="mt-3 grid grid-cols-3 gap-3 max-w-md text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1 tabular-nums">
                  <span>Speed</span>
                  <span className="text-white font-mono-tabular">
                    {selectedCar.topSpeedKmh}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-amber-400"
                    style={{
                      width: `${Math.min(100, (selectedCar.topSpeedKmh / 330) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1 tabular-nums">
                  <span>Handling</span>
                  <span className="text-white font-mono-tabular">
                    {selectedCar.handling}/10
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${selectedCar.handling * 10}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1 tabular-nums">
                  <span>Nitro</span>
                  <span className="text-white font-mono-tabular">
                    {selectedCar.nitroPower}/10
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${selectedCar.nitroPower * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {isUnlocked ? (
              <button
                type="button"
                onClick={onStartRace}
                className="px-6 py-3 min-h-[46px] rounded-xl bg-amber-500 text-slate-950 font-display font-bold text-sm sm:text-base hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
              >
                Race With Car
              </button>
            ) : (
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => onUnlockCar(selectedCar)}
                className={`px-5 py-3 min-h-[46px] rounded-xl font-display font-bold text-sm flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  canAfford
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Unlock ({selectedCar.unlockCoins} Coins)</span>
              </button>
            )}
          </div>
        </div>

        {/* Car Strip */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2.5 overflow-x-auto pb-1">
          {SPORTS_CARS.map((car) => {
            const unlocked = unlockedCarIds.includes(car.id);
            const active = car.id === selectedCar.id;
            return (
              <button
                key={car.id}
                type="button"
                onClick={() => onPreviewCar(car)}
                className={`px-3.5 py-2 min-h-[44px] rounded-xl border text-left transition-colors shrink-0 flex items-center gap-2.5 ${
                  active
                    ? 'bg-white/15 border-amber-400 text-white'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/30"
                  style={{ backgroundColor: car.primaryColor }}
                  aria-hidden="true"
                />
                <span className="font-display text-xs sm:text-sm font-semibold whitespace-nowrap">
                  {car.name}
                </span>
                {unlocked ? (
                  active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <span className="text-[11px] font-mono-tabular text-amber-300 whitespace-nowrap">
                    {car.unlockCoins}c
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

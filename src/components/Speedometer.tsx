interface SpeedometerProps {
  speedKmh: number;
  maxSpeedKmh: number;
  nitroPct: number;
  isNitroActive: boolean;
  isBraking: boolean;
}

export function Speedometer({
  speedKmh,
  maxSpeedKmh,
  nitroPct,
  isNitroActive,
  isBraking,
}: SpeedometerProps) {
  const speedRatio = Math.min(1, speedKmh / Math.max(240, maxSpeedKmh));
  const arcRadius = 34;
  const circumference = Math.PI * arcRadius; // semicircle
  const dashOffset = circumference * (1 - speedRatio);

  return (
    <div className="bg-[#090d18]/85 border border-white/15 rounded-2xl px-4 py-2.5 flex items-center gap-4 shadow-lg">
      {/* Semicircle Speed Gauge */}
      <div className="relative w-20 h-11 flex items-end justify-center shrink-0">
        <svg
          viewBox="0 0 80 44"
          className="w-full h-full overflow-visible"
          aria-hidden="true"
        >
          <path
            d="M 6 40 A 34 34 0 0 1 74 40"
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 6 40 A 34 34 0 0 1 74 40"
            fill="none"
            stroke={
              isNitroActive
                ? '#06b6d4'
                : isBraking
                  ? '#ef4444'
                  : '#f59e0b'
            }
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center leading-none">
          <span className="font-display text-lg font-extrabold text-white tabular-nums">
            {speedKmh}
          </span>
          <span className="block text-[9px] font-semibold text-slate-400 tracking-wider">
            KM/H
          </span>
        </div>
      </div>

      {/* Nitro Bar */}
      <div className="w-24 sm:w-28">
        <div className="flex items-center justify-between text-[11px] font-semibold mb-1 tabular-nums">
          <span className={isNitroActive ? 'text-cyan-400' : 'text-slate-300'}>
            NITRO
          </span>
          <span className="font-mono-tabular text-slate-200">{nitroPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className={`h-full transition-[width] duration-75 ${
              isNitroActive ? 'bg-cyan-400' : 'bg-sky-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, nitroPct))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

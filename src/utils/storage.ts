import { BIRD_SKINS, STORAGE_KEY } from '../data/gameConfig';
import { SavedProgress } from '../types/game';

const DEFAULT_PROGRESS: SavedProgress = {
  bestScore: 0,
  seeds: 0,
  unlockedSkinIds: ['cardinal'],
  selectedSkinId: 'cardinal',
  totalGames: 0,
  totalBounces: 0,
  muted: false,
};

export function loadProgress(): SavedProgress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const validSkinIds = new Set(BIRD_SKINS.map((s) => s.id));
    const unlocked = Array.isArray(parsed.unlockedSkinIds)
      ? parsed.unlockedSkinIds.filter((id) => validSkinIds.has(id))
      : ['cardinal'];
    if (!unlocked.includes('cardinal')) unlocked.unshift('cardinal');

    const selected =
      parsed.selectedSkinId && unlocked.includes(parsed.selectedSkinId)
        ? parsed.selectedSkinId
        : 'cardinal';

    return {
      bestScore: typeof parsed.bestScore === 'number' && parsed.bestScore >= 0 ? parsed.bestScore : 0,
      seeds: typeof parsed.seeds === 'number' && parsed.seeds >= 0 ? parsed.seeds : 0,
      unlockedSkinIds: unlocked,
      selectedSkinId: selected,
      totalGames: typeof parsed.totalGames === 'number' && parsed.totalGames >= 0 ? parsed.totalGames : 0,
      totalBounces:
        typeof parsed.totalBounces === 'number' && parsed.totalBounces >= 0 ? parsed.totalBounces : 0,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export function saveProgress(progress: SavedProgress): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore quota or storage restriction errors
  }
}

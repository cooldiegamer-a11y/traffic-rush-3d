import { SPORTS_CARS, TRAFFIC_STORAGE_KEY } from '../data/cars';
import { SavedTrafficData } from '../types/traffic';

const DEFAULT_SAVE: SavedTrafficData = {
  highScore: 0,
  bestDistanceM: 0,
  coins: 0,
  unlockedCarIds: ['apex_gtr'],
  selectedCarId: 'apex_gtr',
  timeOfDay: 'DAY',
  muted: false,
};

export function loadTrafficSave(): SavedTrafficData {
  if (typeof window === 'undefined') return DEFAULT_SAVE;
  try {
    const raw = window.localStorage.getItem(TRAFFIC_STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw) as Partial<SavedTrafficData>;
    const validIds = new Set(SPORTS_CARS.map((c) => c.id));
    const unlocked = Array.isArray(parsed.unlockedCarIds)
      ? parsed.unlockedCarIds.filter((id) => validIds.has(id))
      : ['apex_gtr'];
    if (!unlocked.includes('apex_gtr')) unlocked.unshift('apex_gtr');

    const selected =
      parsed.selectedCarId && unlocked.includes(parsed.selectedCarId)
        ? parsed.selectedCarId
        : 'apex_gtr';

    return {
      highScore: typeof parsed.highScore === 'number' && parsed.highScore >= 0 ? parsed.highScore : 0,
      bestDistanceM:
        typeof parsed.bestDistanceM === 'number' && parsed.bestDistanceM >= 0
          ? parsed.bestDistanceM
          : 0,
      coins: typeof parsed.coins === 'number' && parsed.coins >= 0 ? parsed.coins : 0,
      unlockedCarIds: unlocked,
      selectedCarId: selected,
      timeOfDay: parsed.timeOfDay === 'NIGHT' ? 'NIGHT' : 'DAY',
      muted: Boolean(parsed.muted),
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function saveTrafficData(data: SavedTrafficData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TRAFFIC_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota restrictions
  }
}

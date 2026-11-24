export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type CrestStyle = 'tuft' | 'crown' | 'sleek' | 'crest' | 'plume' | 'mohawk';

export interface BirdSkin {
  id: string;
  name: string;
  bodyColor: string;
  bellyColor: string;
  wingColor: string;
  beakColor: string;
  eyeColor: string;
  crestStyle: CrestStyle;
  unlockSeeds: number;
  unlockScore: number;
  tagline: string;
}

export interface ArenaPalette {
  minScore: number;
  name: string;
  bg: string;
  gridLine: string;
  wall: string;
  spike: string;
  spikeEdge: string;
  scoreCircle: string;
  scoreText: string;
  accent: string;
  isDark?: boolean;
}

export interface SavedProgress {
  bestScore: number;
  seeds: number;
  unlockedSkinIds: string[];
  selectedSkinId: string;
  totalGames: number;
  totalBounces: number;
  muted: boolean;
}

export interface RunSummary {
  score: number;
  seedsEarned: number;
  isNewBest: boolean;
  newlyUnlockedSkins: BirdSkin[];
}

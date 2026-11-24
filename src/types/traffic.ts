export type GameMode =
  | 'START_MENU'
  | 'CAR_SELECT'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER';

export type TimeOfDay = 'DAY' | 'NIGHT';

export type CarBodyStyle = 'coupe' | 'hyper' | 'gt' | 'muscle' | 'track';

export type TrafficKind = 'sedan' | 'suv' | 'pickup' | 'truck' | 'bus';

export interface CarSpec {
  id: string;
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  caliperColor: string;
  bodyStyle: CarBodyStyle;
  topSpeedKmh: number;
  handling: number; // 1-10
  nitroPower: number; // 1-10
  unlockCoins: number;
}

export interface ControlState {
  left: boolean;
  right: boolean;
  brake: boolean;
  nitro: boolean;
}

export interface HudTelemetry {
  speedKmh: number;
  maxSpeedKmh: number;
  distanceM: number;
  score: number;
  runCoins: number;
  nitroPct: number;
  isNitroActive: boolean;
  isBraking: boolean;
  overtakeStreak: number;
}

export interface OvertakeEvent {
  id: number;
  label: string;
  points: number;
}

export interface SavedTrafficData {
  highScore: number;
  bestDistanceM: number;
  coins: number;
  unlockedCarIds: string[];
  selectedCarId: string;
  timeOfDay: TimeOfDay;
  muted: boolean;
}

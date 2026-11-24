import { ArenaPalette, BirdSkin } from '../types/game';

export const ARENA_WIDTH = 440;
export const ARENA_HEIGHT = 640;

export const WALL_THICKNESS = 22;
export const TOP_BOTTOM_SPIKE_HEIGHT = 20;
export const TOP_BOTTOM_SPIKE_WIDTH = 28;

// Vertical wall spike grid
export const SIDE_SPIKE_SLOTS = 11;
export const SIDE_SPIKE_BASE = 38;
export const SIDE_SPIKE_HEIGHT = 24;
export const SIDE_SPIKE_TOP_MARGIN = 68;

// Physics constants (pixels & seconds)
export const GRAVITY = 1560;
export const FLAP_IMPULSE = -475;
export const MAX_FALL_SPEED = 660;
export const BASE_SPEED_X = 242;
export const SPEED_X_INCREMENT = 2.6;
export const MAX_SPEED_X = 355;

export const BIRD_RADIUS = 17;

export const STORAGE_KEY = 'spike_bounce_progress_v1';

export const BIRD_SKINS: BirdSkin[] = [
  {
    id: 'cardinal',
    name: 'Crimson Jay',
    bodyColor: '#EF4444',
    bellyColor: '#FCA5A5',
    wingColor: '#B91C1C',
    beakColor: '#F59E0B',
    eyeColor: '#0F172A',
    crestStyle: 'tuft',
    unlockSeeds: 0,
    unlockScore: 0,
    tagline: 'Balanced flyer built for crisp wall rebounds.',
  },
  {
    id: 'cobalt',
    name: 'Cobalt Swift',
    bodyColor: '#2563EB',
    bellyColor: '#93C5FD',
    wingColor: '#1D4ED8',
    beakColor: '#FBBF24',
    eyeColor: '#0F172A',
    crestStyle: 'sleek',
    unlockSeeds: 5,
    unlockScore: 8,
    tagline: 'Aerodynamic crest tuned for tight spike gaps.',
  },
  {
    id: 'sunburst',
    name: 'Sunburst Finch',
    bodyColor: '#F59E0B',
    bellyColor: '#FDE68A',
    wingColor: '#D97706',
    beakColor: '#EA580C',
    eyeColor: '#0F172A',
    crestStyle: 'crown',
    unlockSeeds: 12,
    unlockScore: 15,
    tagline: 'Bright golden plumage that pops against slate walls.',
  },
  {
    id: 'emerald',
    name: 'Mint Swallow',
    bodyColor: '#10B981',
    bellyColor: '#A7F3D0',
    wingColor: '#047857',
    beakColor: '#F59E0B',
    eyeColor: '#0F172A',
    crestStyle: 'plume',
    unlockSeeds: 20,
    unlockScore: 24,
    tagline: 'Nimble forest glider with a sweeping tail plume.',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Crow',
    bodyColor: '#1E293B',
    bellyColor: '#64748B',
    wingColor: '#0F172A',
    beakColor: '#F97316',
    eyeColor: '#0F172A',
    crestStyle: 'mohawk',
    unlockSeeds: 30,
    unlockScore: 35,
    tagline: 'Stealth charcoal feathers with a sharp amber beak.',
  },
  {
    id: 'royal',
    name: 'Royal Toucan',
    bodyColor: '#0F766E',
    bellyColor: '#5EEAD4',
    wingColor: '#115E59',
    beakColor: '#FB7185',
    eyeColor: '#0F172A',
    crestStyle: 'crest',
    unlockSeeds: 45,
    unlockScore: 50,
    tagline: 'High-altitude champion with a coral-tipped crest.',
  },
];

export const ARENA_PALETTES: ArenaPalette[] = [
  {
    minScore: 0,
    name: 'Slate Mist',
    bg: '#F3F5F8',
    gridLine: 'rgba(15, 23, 42, 0.045)',
    wall: '#64748B',
    spike: '#475569',
    spikeEdge: '#334155',
    scoreCircle: '#FFFFFF',
    scoreText: '#475569',
    accent: '#EF4444',
  },
  {
    minScore: 5,
    name: 'Sage Breeze',
    bg: '#ECFDF5',
    gridLine: 'rgba(6, 95, 70, 0.05)',
    wall: '#059669',
    spike: '#047857',
    spikeEdge: '#065F46',
    scoreCircle: '#FFFFFF',
    scoreText: '#047857',
    accent: '#10B981',
  },
  {
    minScore: 12,
    name: 'Harbor Blue',
    bg: '#EFF6FF',
    gridLine: 'rgba(30, 64, 175, 0.05)',
    wall: '#2563EB',
    spike: '#1D4ED8',
    spikeEdge: '#1E40AF',
    scoreCircle: '#FFFFFF',
    scoreText: '#1D4ED8',
    accent: '#3B82F6',
  },
  {
    minScore: 20,
    name: 'Amber Sun',
    bg: '#FFFBEB',
    gridLine: 'rgba(180, 83, 9, 0.055)',
    wall: '#D97706',
    spike: '#B45309',
    spikeEdge: '#92400E',
    scoreCircle: '#FFFFFF',
    scoreText: '#B45309',
    accent: '#F59E0B',
  },
  {
    minScore: 30,
    name: 'Teal Tide',
    bg: '#F0FDFA',
    gridLine: 'rgba(15, 118, 110, 0.055)',
    wall: '#0D9488',
    spike: '#0F766E',
    spikeEdge: '#115E59',
    scoreCircle: '#FFFFFF',
    scoreText: '#0F766E',
    accent: '#14B8A6',
  },
  {
    minScore: 42,
    name: 'Midnight Vault',
    bg: '#1E293B',
    gridLine: 'rgba(248, 250, 252, 0.05)',
    wall: '#0F172A',
    spike: '#F43F5E',
    spikeEdge: '#E11D48',
    scoreCircle: '#0F172A',
    scoreText: '#F8FAFC',
    accent: '#F43F5E',
    isDark: true,
  },
];

export function getPaletteForScore(score: number): ArenaPalette {
  let current = ARENA_PALETTES[0];
  for (const palette of ARENA_PALETTES) {
    if (score >= palette.minScore) {
      current = palette;
    }
  }
  return current;
}

import { CarSpec } from '../types/traffic';

export const ROAD_WIDTH = 15.6;
export const LANE_WIDTH = 3.6;
export const LANE_CENTERS = [-5.4, -1.8, 1.8, 5.4] as const;
export const PLAYER_X_LIMIT = 6.25;

export const TRAFFIC_STORAGE_KEY = 'traffic_rush_3d_save_v1';

export const SPORTS_CARS: CarSpec[] = [
  {
    id: 'apex_gtr',
    name: 'Apex GT-R',
    tagline: 'Balanced twin-turbo street coupe with crisp cornering.',
    primaryColor: '#EF4444',
    accentColor: '#111827',
    caliperColor: '#F59E0B',
    bodyStyle: 'coupe',
    topSpeedKmh: 255,
    handling: 8,
    nitroPower: 7,
    unlockCoins: 0,
  },
  {
    id: 'cobalt_rs',
    name: 'Cobalt RS',
    tagline: 'Track-tuned chassis with twin racing stripes and quick lane snap.',
    primaryColor: '#2563EB',
    accentColor: '#F8FAFC',
    caliperColor: '#06B6D4',
    bodyStyle: 'gt',
    topSpeedKmh: 272,
    handling: 9,
    nitroPower: 8,
    unlockCoins: 25,
  },
  {
    id: 'solaris_v8',
    name: 'Solaris V8',
    tagline: 'Wide-body amber muscle machine built for sustained high speed.',
    primaryColor: '#F59E0B',
    accentColor: '#0F172A',
    caliperColor: '#EF4444',
    bodyStyle: 'muscle',
    topSpeedKmh: 286,
    handling: 7,
    nitroPower: 9,
    unlockCoins: 60,
  },
  {
    id: 'emerald_spyder',
    name: 'Viper Emerald',
    tagline: 'Low-drag endurance GT with active carbon rear wing.',
    primaryColor: '#10B981',
    accentColor: '#064E3B',
    caliperColor: '#FBBF24',
    bodyStyle: 'track',
    topSpeedKmh: 302,
    handling: 9,
    nitroPower: 9,
    unlockCoins: 110,
  },
  {
    id: 'hyperion_x',
    name: 'Hyperion X',
    tagline: 'Flagship titanium hypercar with maximum velocity and nitro thrust.',
    primaryColor: '#F8FAFC',
    accentColor: '#DC2626',
    caliperColor: '#EF4444',
    bodyStyle: 'hyper',
    topSpeedKmh: 325,
    handling: 10,
    nitroPower: 10,
    unlockCoins: 180,
  },
];

export const TRAFFIC_COLORS = [
  '#CBD5E1', // silver
  '#334155', // dark slate
  '#1D4ED8', // royal blue
  '#B91C1C', // crimson
  '#D97706', // amber
  '#0F766E', // teal
  '#F8FAFC', // pearl white
  '#475569', // gunmetal
];

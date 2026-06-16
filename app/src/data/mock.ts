import type { Fairy, Pillar } from '../lib/types';

export type FairyId = Fairy;
export type PillarId = Pillar;

export const FAIRIES: Record<
  FairyId,
  { name: string; pillar: PillarId; tagline: string; emoji: string; seed: string; colors: { from: string; to: string } }
> = {
  bloom: {
    name: 'Bloom',
    pillar: 'bloom',
    tagline: 'Hero · Core Leadership',
    emoji: '🌸',
    seed: 'bloom-fairy-fire',
    colors: { from: '#ffb7e9', to: '#ff5fa2' },
  },
  stella: {
    name: 'Stella',
    pillar: 'stella',
    tagline: 'Glow · Personal Balance',
    emoji: '☀️',
    seed: 'stella-sun-shine',
    colors: { from: '#ffd7f0', to: '#ffaa3a' },
  },
  flora: {
    name: 'Flora',
    pillar: 'flora',
    tagline: 'Healer · Health & Wellness',
    emoji: '🌿',
    seed: 'flora-nature-bloom',
    colors: { from: '#b1dd00', to: '#7cc400' },
  },
  musa: {
    name: 'Musa',
    pillar: 'musa',
    tagline: 'Muse · Communication',
    emoji: '🎵',
    seed: 'musa-melody-wave',
    colors: { from: '#f8b1e2', to: '#c75dff' },
  },
  tecna: {
    name: 'Tecna',
    pillar: 'tecna',
    tagline: 'Tech · Engineering & Data',
    emoji: '💎',
    seed: 'tecna-tech-prism',
    colors: { from: '#94f1fb', to: '#00bcd4' },
  },
  layla: {
    name: 'Layla',
    pillar: 'bloom',
    tagline: 'Flow · Wildcard Energy',
    emoji: '✨',
    seed: 'layla-flow-wild',
    colors: { from: '#a78bfa', to: '#6366f1' },
  },
};

export const PILLAR_COLORS: Record<PillarId, { bg: string; text: string; glow: string; ring: string }> = {
  tecna: { bg: 'bg-[#94f1fb]/30', text: 'text-[#006f78]', glow: 'shadow-glow-blue', ring: 'ring-[#94f1fb]' },
  flora: { bg: 'bg-[#b1dd00]/30', text: 'text-[#4a5e00]', glow: 'shadow-glow-lime', ring: 'ring-[#b1dd00]' },
  musa: { bg: 'bg-[#f8b1e2]/30', text: 'text-[#6a335d]', glow: 'shadow-glow-pink', ring: 'ring-[#f8b1e2]' },
  bloom: { bg: 'bg-[#ffb7e9]/30', text: 'text-[#7c436e]', glow: 'shadow-glow-pink', ring: 'ring-[#ffb7e9]' },
  stella: { bg: 'bg-[#ffd7f0]/30', text: 'text-[#854b76]', glow: 'shadow-glow-pink', ring: 'ring-[#ffd7f0]' },
};

export const PILLAR_LABELS: Record<PillarId, string> = {
  tecna: 'Tecna · Engineering',
  flora: 'Flora · Wellness',
  musa: 'Musa · Language',
  bloom: 'Bloom · Leadership',
  stella: 'Stella · Balance',
};

export const PILLAR_EMOJI: Record<PillarId, string> = {
  tecna: '💎',
  flora: '🌿',
  musa: '🎵',
  bloom: '🌸',
  stella: '☀️',
};

export type Task = {
  id: string;
  day: number;
  week: number;
  month: number;
  date: string;
  description: string;
  pillar: PillarId;
  hours: number;
  energy: 'low' | 'medium' | 'high';
  done: boolean;
};

export const MOCK_PLAN = {
  id: 'plan-month-2-neuro',
  title: "Month 2 · Medical Neuroscience + AI Resection",
  startDate: '2026-02-01',
  endDate: '2026-02-28',
  totalDays: 28,
  tasks: [
    { id: 't1', day: 1, week: 1, month: 1, date: 'Mon Feb 1', description: 'Read neuro module 1 — synaptic transmission', pillar: 'flora', hours: 2, energy: 'medium', done: true },
    { id: 't2', day: 1, week: 1, month: 1, date: 'Mon Feb 1', description: 'Dataset prep — clean brain MRI scans batch 01', pillar: 'tecna', hours: 3, energy: 'high', done: true },
    { id: 't3', day: 2, week: 1, month: 1, date: 'Tue Feb 2', description: 'Code review — PR #42 on resection pipeline', pillar: 'tecna', hours: 1.5, energy: 'medium', done: true },
    { id: 't4', day: 2, week: 1, month: 1, date: 'Tue Feb 2', description: 'English podcast — BBC 6min neuro episode', pillar: 'musa', hours: 0.5, energy: 'low', done: true },
    { id: 't5', day: 3, week: 1, month: 1, date: 'Wed Feb 3', description: 'Cardio — 30min cycling + 10min stretch', pillar: 'stella', hours: 0.5, energy: 'low', done: false },
    { id: 't6', day: 3, week: 1, month: 1, date: 'Wed Feb 3', description: 'Read neuro module 2 — cortical columns', pillar: 'flora', hours: 2, energy: 'medium', done: false },
    { id: 't7', day: 4, week: 1, month: 1, date: 'Thu Feb 4', description: 'Build resection inference notebook', pillar: 'tecna', hours: 4, energy: 'high', done: false },
    { id: 't8', day: 4, week: 1, month: 1, date: 'Thu Feb 4', description: 'Cold outreach — 5 SaaS Chatty leads', pillar: 'bloom', hours: 1, energy: 'medium', done: false },
    { id: 't9', day: 5, week: 1, month: 1, date: 'Fri Feb 5', description: 'Swimming — 45min laps', pillar: 'stella', hours: 0.75, energy: 'medium', done: false },
    { id: 't10', day: 5, week: 1, month: 1, date: 'Fri Feb 5', description: 'Academic journal reading — Nature Neuro', pillar: 'musa', hours: 1.5, energy: 'medium', done: false },
    { id: 't11', day: 8, week: 2, month: 1, date: 'Mon Feb 8', description: 'Module 3 — deep brain stimulation', pillar: 'flora', hours: 2, energy: 'medium', done: false },
    { id: 't12', day: 8, week: 2, month: 1, date: 'Mon Feb 8', description: 'Setup ablation study script', pillar: 'tecna', hours: 3, energy: 'high', done: false },
  ] as Task[],
};

export const USER_PROFILE = {
  name: 'Raisha',
  level: 7,
  currentXp: 730,
  nextLevelXp: 1000,
  streak: 7,
  longestStreak: 14,
  pillarXp: {
    tecna: 580,
    flora: 420,
    musa: 310,
    bloom: 240,
    stella: 880,
  } as Record<PillarId, number>,
  xpPerLevel: 1000,
  xpPerTask: 50,
  streakBonus: 200,
};

export const XP_PER_LEVEL = 1000;
export const XP_PER_TASK = 50;

export const VELOCITY_DATA = [
  { month: 'Nov', tasks: 18, xp: 900 },
  { month: 'Dec', tasks: 24, xp: 1200 },
  { month: 'Jan', tasks: 31, xp: 1550 },
  { month: 'Feb', tasks: 12, xp: 600 },
];

export const ACTIVE_PLANS = [
  { id: 'p1', title: 'Month 2 · Neuroscience + AI Resection', day: 12, total: 90, progress: 13, emoji: '🧠' },
  { id: 'p2', title: 'SaaS Chatty Launch', day: 4, total: 30, progress: 13, emoji: '🚀' },
];

export const TIMEFRAMES = ['1 month', '3 months', '6 months', 'Custom'];
export const ENERGIES = [
  { id: 'deep', label: 'Deep Work', emoji: '🧠' },
  { id: 'physical', label: 'Physical', emoji: '💪' },
  { id: 'creative', label: 'Creative', emoji: '✨' },
];

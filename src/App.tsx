/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QuizQuestion, ENGLISH_QUIZ_QUESTIONS, MATH_QUIZ_QUESTIONS, FRENCH_QUIZ_QUESTIONS, GERMAN_QUIZ_QUESTIONS } from './lib/quizData';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  Hand, 
  Plus, 
  Minus,
  History as HistoryIcon, 
  ChevronRight, 
  X, 
  GraduationCap, 
  Edit3, 
  User,
  Settings,
  AlertTriangle,
  Terminal,
  Zap,
  TrendingUp,
  Award,
  Calendar,
  BarChart3,
  LayoutDashboard,
  Trash2,
  Clock,
  Moon,
  Sun,
  Target,
  Maximize,
  Minimize,
  Medal,
  Lock,
  Flame,
  Download,
  BookOpen,
  Menu,
  Users,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Dumbbell,
  Globe,
  Check,
  Languages,
  Brain,
  Gamepad2,
  Swords,
  Ghost,
  Bell,
  ListTodo,
  ChevronLeft,
  Smartphone,
  Heart,
  MessageCircle,
  Share2,
  Home,
  Plus,
  User as UserIcon,
  ImagePlus
} from 'lucide-react';
import { SOCIAL_POSTS, SocialPost } from './lib/socialPosts';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LineChart,
  Line
} from 'recharts';

// --- Types ---

type Grade = 1 | 2 | 3 | 4 | 5 | 6;

interface HistoryEntry {
  id: string;
  type: 'participation' | 'grade' | 'challenge' | 'homework' | 'penalty' | 'vocab';
  value: number | Grade | string;
  points: number;
  date: number;
  comment?: string;
  subject?: string;
  focusNote?: string;
  focusDuration?: number;
}

interface VocabWord {
  id: string;
  front: string;
  back: string;
  lastTested?: number;
  correctCount: number;
  wrongCount: number;
}

interface VocabList {
  id: string;
  title: string;
  subject: string;
  words: VocabWord[];
  createdAt: number;
}

interface ScheduleSlot {
  id: string;
  subject: string;
  time: string;
}

interface BotData {
  name: string;
  dailyPoints: number[];
}

interface MultiplayerData {
  leagueLevel: number;
  weekStart: number;
  lastChallengeUpdateDate?: number;
  onlineChallenges?: BotOnlineChallenge[];
  lastResults?: {
     promoted: boolean;
     relegated: boolean;
     rank: number;
     leagueName: string;
  };
  leagueHistory?: {
    date: number;
    rank: number;
    points: number;
    promoted: boolean;
    relegated: boolean;
    leagueName: string;
  }[];
  bots: BotData[];
}

interface PersonalGoal {
  id: string;
  type: 'practice_minutes' | 'participations';
  target: number;
  period: 'daily' | 'weekly' | 'monthly';
  createdAt: number;
  lastClaimedAt?: number;
}

interface BotOnlineChallenge {
  id: string;
  host: string;
  type: 'grade_1' | 'participations' | 'practice' | 'custom';
  title: string;
  description: string;
  rewardPoints: number;
  target: number;
  subject?: string;
  participants: { name: string; score: number; isBot: boolean; joinedAt?: number }[];
}

interface CalendarEvent {
  id: string;
  date: number; // Start of day timestamp
  title: string;
  type: 'exam' | 'term' | 'other';
  reminderDate?: number; // Start of day timestamp for reminder
}

interface Homework {
  id: string;
  subject: string;
  task?: string;
  dueDate: number;
  createdAt: number;
  completed?: boolean;
  missed?: boolean;
}

interface UserProfile {
  name: string;
  gradeLevel: string;
  points: number;
  streak: number;
  lastLoginDate: number;
  history: HistoryEntry[];
  schedule: Record<number, ScheduleSlot[]>; // 0 = Mon, 1 = Tue, etc.
  diary?: { id: string; date: number; text: string }[];
  lastRecapDate?: number;
  estimatedGrades?: Record<string, number>;
  unlockedAchievements?: string[];
  multiplayer?: MultiplayerData;
  goals?: PersonalGoal[];
  homework?: Homework[];
  vocabLists?: VocabList[];
  vocabStreak?: number;
  lastVocabDate?: number;
  calendarEvents?: CalendarEvent[];
  dismissedReminders?: string[]; // IDs of events we already reminded about today
}

type Tab = 'dashboard' | 'schedule' | 'stats' | 'achievements' | 'multiplayer' | 'online-challenges' | 'dev';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (profile: UserProfile) => boolean;
}

const getPeriodStart = (period: 'daily' | 'weekly' | 'monthly') => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'daily') return d.getTime();
  if (period === 'weekly') {
    const day = d.getDay() || 7; 
    return d.getTime() - (day - 1) * 24 * 60 * 60 * 1000;
  }
  if (period === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return 0;
};

const getGoalReward = (goal: PersonalGoal) => {
  if (goal.period === 'daily') return 25;
  if (goal.period === 'weekly') return 100;
  if (goal.period === 'monthly') return 300;
  return 0;
};

const getOnlineChallengeScore = (profile: UserProfile, challenge: BotOnlineChallenge): number => {
  if (!profile.multiplayer) return 0;
  const start = profile.multiplayer.weekStart;
  const history = profile.history.filter(h => h.date >= start);
  
  if (challenge.type === 'grade_1') {
    return history.filter(h => h.type === 'grade' && h.value === 1).length;
  }
  if (challenge.type === 'practice') {
    return history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session')
      .reduce((acc, h) => acc + (h.focusDuration || 0), 0);
  }
  if (challenge.type === 'participations') {
    return history.filter(h => h.type === 'participation').length;
  }
  return 0;
};
const getGoalProgress = (goal: PersonalGoal, profile: UserProfile) => {
  const periodStart = getPeriodStart(goal.period);
  const relevantHistory = profile.history.filter(h => h.date >= periodStart);
  
  if (goal.type === 'participations') {
    return relevantHistory.filter(h => h.type === 'participation').length;
  }
  if (goal.type === 'practice_minutes') {
    return relevantHistory
      .filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session')
      .reduce((acc, h) => acc + (h.focusDuration || (h.points / 2) || 25), 0); // fallback if missing
  }
  return 0;
};

const getAvailableSubjects = (profile: UserProfile): string[] => {
  const subjects = new Set<string>();
  Object.values(profile.schedule).forEach(day => {
    day.forEach(slot => {
      if (slot.subject) subjects.add(slot.subject);
    });
  });
  profile.history.forEach(h => {
    if (h.subject) subjects.add(h.subject);
  });
  return Array.from(subjects).sort();
};

const getTrendGrade = (subject: string, baseGrade: number, history: HistoryEntry[]): number => {
  const subjectHistory = history.filter(h => h.subject === subject);
  const examGrades = subjectHistory.filter(h => h.type === 'grade');
  const participations = subjectHistory.filter(h => h.type === 'participation');
  
  let grade = baseGrade;
  
  // Sort exams by date ascending to apply them progressively
  const sortedExams = [...examGrades].sort((a, b) => a.date - b.date);
  
  for (const h of sortedExams) {
    const type = h.comment || 'arbeit';
    const factor = type === 'vokabeltest' ? 0.125 : type === 'test' ? 0.25 : 0.75;
    const diff = grade - Number(h.value);
    
    // Eine 1 (bei baseGrade 3) bringt:
    // Vokabeltest (diff=2): 2 * 0.125 = 0.25
    // Test (diff=2): 2 * 0.25 = 0.5
    // Arbeit (diff=2): 2 * 0.75 = 1.5
    grade = grade - (diff * factor);
  }
  
  // Participations consistency and time-decay logic
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  
  // Group by day to prevent spam in a single hour
  const participationsByDay: Record<string, { count: number, date: number }> = {};
  participations.forEach(p => {
    const day = new Date(p.date).toDateString();
    if (!participationsByDay[day]) {
      participationsByDay[day] = { count: 0, date: p.date };
    }
    participationsByDay[day].count++;
  });
  
  let validParticipationScore = 0;
  
  Object.values(participationsByDay).forEach(({ count, date }) => {
    // Cap at 3 participations per day to reward consistency rather than burst
    const effectiveCount = Math.min(count, 3);
    
    // Time decay: participations lose value over time (e.g. over 8 weeks = 56 days)
    const daysOld = Math.max(0, (now - date) / msPerDay);
    
    // Weight goes from 1.0 (today) down to 0.0 (56+ days old)
    const timeWeight = Math.max(0, 1 - (daysOld / 56));
    
    validParticipationScore += effectiveCount * timeWeight;
  });
  
  // Each valid, recent participation improves the grade by 0.04
  grade = grade - (validParticipationScore * 0.04);
  
  return Math.max(1, Math.min(6, grade)); // Grades from 1.0 to 6.0
};

const ACHIEVEMENTS: Achievement[] = [
  // --- Meldungen (14) ---
  { id: 'first_participation', title: 'Erste Meldung', description: 'Du hast dich zum ersten Mal gemeldet.', icon: '🙋', condition: (p) => p.history.some(h => h.type === 'participation') },
  { id: '10_participations', title: '10 Meldungen', description: 'Du hast dich 10 Mal gemeldet!', icon: '🗣️', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 10 },
  { id: '25_participations', title: 'Diskussionsfreudig', description: 'Du hast dich 25 Mal gemeldet!', icon: '💬', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 25 },
  { id: '50_participations', title: 'Quasselstrippe', description: 'Du hast dich unglaubliche 50 Mal gemeldet.', icon: '🦜', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 50 },
  { id: '100_participations', title: 'Megaphon', description: 'Legendär! Du hast dich 100 Mal gemeldet.', icon: '📢', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 100 },
  { id: '150_participations', title: 'Stimmgewalt', description: 'Du hast dich schon 150 Mal gemeldet!', icon: '📣', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 150 },
  { id: '200_participations', title: 'Radio-Moderator', description: 'Unglaubliche 200 Meldungen. Respekt!', icon: '🎙️', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 200 },
  { id: '300_participations', title: 'Unüberhörbar', description: '300 Meldungen! Die Klasse hört nur noch dich.', icon: '🔊', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 300 },
  { id: '400_participations', title: 'Dauermeldung', description: '400 Mal den Finger oben. Ist dein Arm schon schwer?', icon: '💪', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 400 },
  { id: '500_participations', title: 'Halber Tausender', description: '500 Meldungen! Du bist der Star der Mitarbeit.', icon: '⭐', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 500 },
  { id: '600_participations', title: 'Wissensquelle', description: '600 Mal beigetragen. Wahnsinn!', icon: '🌊', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 600 },
  { id: '750_participations', title: 'Mitarbeits-König', description: '750 Meldungen! Du regierst das Klassenzimmer.', icon: '🏰', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 750 },
  { id: '900_participations', title: 'Fast am Ziel', description: '900 Meldungen. Die 1000 ist nah!', icon: '⚡', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 900 },
  { id: '1000_participations', title: 'Meldungs-Gott', description: '1000 Meldungen! Du bist eine lebende Legende.', icon: '💎', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 1000 },

  // --- Noten & Fächer (24) ---
  { id: 'first_grade_1', title: 'Musterschüler', description: 'Du hast deine erste 1 geschrieben.', icon: '🌟', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1) },
  { id: '3_grades_1', title: 'Streber', description: 'Du hast schon drei 1er geschrieben.', icon: '🤓', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 1).length >= 3 },
  { id: '5_grades_1', title: 'Noten-Sammler', description: 'Fünf Einsen! Dein Zeugnis wird glänzen.', icon: '✨', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 1).length >= 5 },
  { id: '10_grades_1', title: 'Einsen-Maschine', description: 'Zehn Mal die Bestnote. Wie machst du das?', icon: '🦾', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 1).length >= 10 },
  { id: '25_grades_1', title: 'Perfektionist', description: '25 Einsen! Du bist unschlagbar.', icon: '🏅', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 1).length >= 25 },
  { id: '50_grades_1', title: 'Überflieger', description: '50 Einsen! Du brauchst ein größeres Regal für Urkunden.', icon: '🏆', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 1).length >= 50 },
  { id: '10_grades_2', title: 'Solider Zweier', description: 'Du hast zehn Mal eine 2 geschrieben.', icon: '🥈', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 2).length >= 10 },
  { id: '25_grades_not_bad', title: 'Keine Aussetzer', description: '25 Noten eingetragen, die 3 oder besser sind.', icon: '🛡️', condition: (p) => p.history.filter(h => h.type === 'grade' && Number(h.value) <= 3).length >= 25 },
  { id: 'first_grade_improve', title: 'Comeback', description: 'Eine 3 oder besser geschrieben.', icon: '📈', condition: (p) => p.history.some(h => h.type === 'grade' && h.value !== undefined && Number(h.value) <= 3) },
  { id: 'improve_twice', title: 'Aufwärtstrend', description: 'Zwei Mal hintereinander verbessert.', icon: '🎢', condition: (p) => {
    const grades = p.history.filter(h => h.type === 'grade');
    if (grades.length < 2) return false;
    return Number(grades[0].value) <= Number(grades[1].value);
  }},
  { id: 'subject_math', title: 'Mathe-Genie', description: 'Eine 1 in Mathematik.', icon: '📐', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('mathe')) },
  { id: 'subject_german', title: 'Dichter & Denker', description: 'Eine 1 in Deutsch.', icon: '🖋️', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('deutsch')) },
  { id: 'subject_english', title: 'Native Speaker', description: 'Eine 1 in Englisch.', icon: '🇬🇧', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('englisch')) },
  { id: 'subject_science', title: 'Forscher', description: 'Eine 1 in Bio, Physik oder Chemie.', icon: '🧪', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && (h.subject?.toLowerCase().includes('bio') || h.subject?.toLowerCase().includes('physik') || h.subject?.toLowerCase().includes('chemie'))) },
  { id: 'subject_history', title: 'Zeitmanager', description: 'Eine 1 in Geschichte.', icon: '⏳', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('geschicht')) },
  { id: 'subject_geography', title: 'Weltenbummler', description: 'Eine 1 in Erdkunde/Geographie.', icon: '🌍', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && (h.subject?.toLowerCase().includes('erdkunde') || h.subject?.toLowerCase().includes('geo'))) },
  { id: 'subject_art', title: 'Picasso', description: 'Eine 1 in Kunst.', icon: '🎨', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('kunst')) },
  { id: 'subject_music', title: 'Virtuose', description: 'Eine 1 in Musik.', icon: '🎵', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('musik')) },
  { id: 'subject_pe', title: 'Athlet', description: 'Eine 1 in Sport.', icon: '🏃', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && h.subject?.toLowerCase().includes('sport')) },
  { id: 'subject_religion', title: 'Heiligenschein', description: 'Eine 1 in Religion oder Ethik.', icon: '🕊️', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1 && (h.subject?.toLowerCase().includes('reli') || h.subject?.toLowerCase().includes('ethik'))) },
  { id: 'total_grades_10', title: 'Ergebnis-Sammler', description: '10 Noten eingetragen.', icon: '📁', condition: (p) => p.history.filter(h => h.type === 'grade').length >= 10 },
  { id: 'total_grades_25', title: 'Archivar', description: '25 Noten eingetragen.', icon: '📦', condition: (p) => p.history.filter(h => h.type === 'grade').length >= 25 },
  { id: 'total_grades_50', title: 'Zahlenjongleur', description: '50 Noten eingetragen.', icon: '🤹', condition: (p) => p.history.filter(h => h.type === 'grade').length >= 50 },
  { id: 'grade_variety', title: 'Allrounder', description: 'Noten in 8 verschiedenen Fächern.', icon: '🌈', condition: (p) => new Set(p.history.filter(h => h.type === 'grade').map(h => h.subject)).size >= 8 },

  // --- Challenges (10) ---
  { id: '5_challenges', title: 'Anfänger-Glück', description: '5 Daily Challenges geschafft.', icon: '🌱', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 5 },
  { id: '10_challenges', title: 'Herausforderer', description: 'Du hast 10 Daily Challenges geschafft.', icon: '⚔️', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 10 },
  { id: '25_challenges', title: 'Konsequent', description: '25 Daily Challenges gemeistert.', icon: '🛡️', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 25 },
  { id: '50_challenges', title: 'Challenge-Meister', description: 'Du hast 50 Daily Challenges gemeistert!', icon: '🎯', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 50 },
  { id: '75_challenges', title: 'Zielstrebig', description: '75 Daily Challenges in der Täsch.', icon: '🏹', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 75 },
  { id: '100_challenges', title: 'Hundert-Heros', description: '100 Daily Challenges! Wow!', icon: '💯', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 100 },
  { id: '150_challenges', title: 'Ausdauernd', description: '150 Challenges. Du gibst nie auf.', icon: '🔋', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 150 },
  { id: '200_challenges', title: 'Profi-Herausforderer', description: '200 Challenges gemeistert.', icon: '🎩', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 200 },
  { id: '300_challenges', title: 'Challenge-Gott', description: '300 Challenges. Ein wahres Vorbild.', icon: '🕍', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 300 },
  { id: '500_challenges', title: 'Unbesiegbar', description: '500 Challenges. Du hast das Spiel durchgespielt.', icon: '♾️', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 500 },

  // --- Streaks (12) ---
  { id: 'streak_3', title: 'Am Ball bleiben', description: 'Du warst 3 Tage in Folge aktiv.', icon: '🔥', condition: (p) => p.streak >= 3 },
  { id: 'streak_7', title: 'Wochenmeister', description: 'Du warst 7 Tage in Folge aktiv.', icon: '📅', condition: (p) => p.streak >= 7 },
  { id: 'streak_14', title: 'Halbzeit', description: 'Du warst 14 Tage in Folge aktiv.', icon: '⏱️', condition: (p) => p.streak >= 14 },
  { id: 'streak_21', title: 'Routine', description: '21 Tage. Es ist jetzt eine Gewohnheit.', icon: '🔄', condition: (p) => p.streak >= 21 },
  { id: 'streak_30', title: 'Unaufhaltsam', description: 'Ein ganzer Monat ununterbrochen aktiv!', icon: '🏆', condition: (p) => p.streak >= 30 },
  { id: 'streak_60', title: 'Doppel-Monat', description: '60 Tage Streak! Beeindruckend.', icon: '💎', condition: (p) => p.streak >= 60 },
  { id: 'streak_90', title: 'Quartal', description: '90 Tage. Ein Vierteljahr Motivation.', icon: '🧱', condition: (p) => p.streak >= 90 },
  { id: 'streak_100', title: 'Legende', description: '100 Tage in Folge aktiv!', icon: '👑', condition: (p) => p.streak >= 100 },
  { id: 'streak_150', title: 'Eisern', description: '150 Tage ohne Pause. Wahnsinn.', icon: '🧊', condition: (p) => p.streak >= 150 },
  { id: 'streak_180', title: 'Halbes Jahr', description: '180 Tage Streak! Du bist verrückt!', icon: '🌓', condition: (p) => p.streak >= 180 },
  { id: 'streak_250', title: 'Marathon', description: '250 Tage. Fast geschafft!', icon: '🏃', condition: (p) => p.streak >= 250 },
  { id: 'streak_365', title: 'Ein Jahr Road to Success', description: '365 Tage am Stück! Ein echtes Jahr voller Erfolg.', icon: '🎆', condition: (p) => p.streak >= 365 },

  // --- Punkte & Ränge (9) ---
  { id: 'rank_2', title: 'Aufsteiger', description: 'Du hast den zweiten Rang erreicht.', icon: '🚀', condition: (p) => p.points >= 500 },
  { id: 'rank_3', title: 'Fortgeschritten', description: 'Rang 3 erreicht.', icon: '🎖️', condition: (p) => p.points >= 1500 },
  { id: 'rank_4', title: 'Intelektuell', description: 'Rang 4 erreicht.', icon: '🧠', condition: (p) => p.points >= 3500 },
  { id: 'rank_5', title: 'Meister', description: 'Rang 5 erreicht.', icon: '🔱', condition: (p) => p.points >= 7000 },
  { id: 'rank_6', title: 'Genie', description: 'Den höchsten Rang erreicht!', icon: '🌌', condition: (p) => p.points >= 15000 },
  { id: 'points_10k', title: 'Punktestand über 9000!', description: 'Du hast über 9000 Punkte gesammelt.', icon: '🔥', condition: (p) => p.points >= 9001 },
  { id: 'points_50k', title: 'Highscore', description: 'Du hast 50.000 Punkte gesammelt.', icon: '💰', condition: (p) => p.points >= 50000 },
  { id: 'points_100k', title: 'Sechsstellig', description: '100.000 Punkte! Unglaublich.', icon: '🏦', condition: (p) => p.points >= 100000 },
  { id: 'points_500k', title: 'Halbe Millionär', description: '500.000 Punkte gesammelt.', icon: '💸', condition: (p) => p.points >= 500000 },

  // --- Tagebuch & Reflexion (10) ---
  { id: 'first_diary', title: 'Tagebuchschreiber', description: 'Du hast deinen ersten Tagebucheintrag geschrieben.', icon: '📓', condition: (p) => !!p.diary && p.diary.length >= 1 },
  { id: '7_diary', title: 'Reflektiert', description: 'Du hast 7 Tagebucheinträge verfasst.', icon: '✍️', condition: (p) => !!p.diary && p.diary.length >= 7 },
  { id: '15_diary', title: 'Gedankensammler', description: '15 Tagebucheinträge.', icon: '💭', condition: (p) => !!p.diary && p.diary.length >= 15 },
  { id: '30_diary', title: 'Chronist', description: '30 Tagebucheinträge! Gibst du bald ein Buch heraus?', icon: '📚', condition: (p) => !!p.diary && p.diary.length >= 30 },
  { id: '50_diary', title: 'Blogger', description: '50 Einträge verfasst.', icon: '💻', condition: (p) => !!p.diary && p.diary.length >= 50 },
  { id: '100_diary', title: 'Autor', description: '100 Tagebucheinträge! Eine stolze Sammlung.', icon: '🖋️', condition: (p) => !!p.diary && p.diary.length >= 100 },
  { id: '150_diary', title: 'Tiefgründig', description: '150 Einträge.', icon: '🕳️', condition: (p) => !!p.diary && p.diary.length >= 150 },
  { id: '200_diary', title: 'Philosoph', description: '200 Einträge im Tagebuch.', icon: '🧘', condition: (p) => !!p.diary && p.diary.length >= 200 },
  { id: '250_diary', title: 'Weiser', description: '250 Einträge.', icon: '📜', condition: (p) => !!p.diary && p.diary.length >= 250 },
  { id: '365_diary', title: 'Ein Jahr Reflexion', description: '365 Tagebucheinträge. Du kennst dich selbst am besten.', icon: '🗿', condition: (p) => !!p.diary && p.diary.length >= 365 },

  // --- Prognosen (5) ---
  { id: 'first_estimation', title: 'Wahrsager', description: 'Du hast deine erste Noten-Prognose gemacht.', icon: '🔮', condition: (p) => !!p.estimatedGrades && Object.keys(p.estimatedGrades).length >= 1 },
  { id: '5_estimations', title: 'Zukunftsblick', description: 'Du hast Prognosen für 5 verschiedene Fächer abgegeben.', icon: '👁️', condition: (p) => !!p.estimatedGrades && Object.keys(p.estimatedGrades).length >= 5 },
  { id: '10_estimations', title: 'Analyst', description: 'Prognosen für 10 Fächer.', icon: '📊', condition: (p) => !!p.estimatedGrades && Object.keys(p.estimatedGrades).length >= 10 },
  { id: '15_estimations', title: 'Vorhersehung', description: 'Prognosen für 15 Fächer.', icon: '🌌', condition: (p) => !!p.estimatedGrades && Object.keys(p.estimatedGrades).length >= 15 },
  { id: '20_estimations', title: 'Orakel', description: 'Prognosen für 20 Fächer abgegeben.', icon: '⛩️', condition: (p) => !!p.estimatedGrades && Object.keys(p.estimatedGrades).length >= 20 },

  // --- Fokus & Study Timer (10) ---
  { id: 'first_focus', title: 'Fokusiert', description: 'Deine erste Fokus-Session beendet.', icon: '🧘', condition: (p) => p.history.some(h => h.type === 'challenge' && h.comment === 'Fokus-Session') },
  { id: '5_focus', title: 'Konzentriert', description: '5 Fokus-Sessions absolviert.', icon: '🎯', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 5 },
  { id: '10_focus', title: 'Tunnelblick', description: '10 Fokus-Sessions.', icon: '🚇', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 10 },
  { id: '25_focus', title: 'Produktivitäts-Monster', description: '25 Fokus-Sessions.', icon: '👾', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 25 },
  { id: '50_focus', title: 'Flow-Zustand', description: '50 Fokus-Sessions geschafft.', icon: '🌊', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 50 },
  { id: '75_focus', title: 'Tiefenarbeit', description: '75 Fokus-Sessions.', icon: '💎', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 75 },
  { id: '100_focus', title: 'Meister der Zeit', description: '100 Fokus-Sessions!', icon: '⏳', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 100 },
  { id: '250_focus', title: 'Arbeitstier', description: '250 Fokus-Sessions. Du lebst förmlich am Schreibtisch.', icon: '🐗', condition: (p) => p.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length >= 250 },
  { id: 'focus_night', title: 'Nachteule', description: 'Eine Fokus-Session nach 21 Uhr beendet.', icon: '🦉', condition: (p) => p.history.some(h => h.type === 'challenge' && h.comment === 'Fokus-Session' && new Date(h.date).getHours() >= 21) },
  { id: 'focus_morning', title: 'Frühaufsteher', description: 'Eine Fokus-Session vor 8 Uhr morgens beendet.', icon: '🌅', condition: (p) => p.history.some(h => h.type === 'challenge' && h.comment === 'Fokus-Session' && new Date(h.date).getHours() <= 8) },

  // --- Multiplayer & Verschiedenes ---
  { id: 'reached_bronze', title: 'Aufgeschlagen', description: 'Bronze Liga erreicht.', icon: '🥉', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 1 },
  { id: 'reached_silver', title: 'Glänzend', description: 'Silber Liga erreicht.', icon: '🥈', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 2 },
  { id: 'reached_gold', title: 'Goldschmied', description: 'Gold Liga erreicht.', icon: '🥇', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 3 },
  { id: 'reached_platinum', title: 'Platin-Status', description: 'Platin Liga erreicht.', icon: '💎', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 4 },
  { id: 'reached_legend', title: 'Legende der Liga', description: 'Legenden Liga erreicht. Zeig ihnen wer der Boss ist!', icon: '👺', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 6 },
  { id: 'reached_god', title: 'Road to Success Gott', description: 'Du hast den Status eines Gottes erreicht.', icon: '⚡', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 12 },
  { id: 'reached_infinity', title: 'Die Unendlichkeit', description: 'Du hast die letzte bekannte Liga erreicht. Was kommt jetzt?', icon: '♾️', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 15 },
  { id: 'multiplayer_first_place', title: 'Spitzenreiter', description: 'Als Erster aufgestiegen!', icon: '👑', condition: (p) => !!p.multiplayer?.leagueHistory?.some(h => h.promoted && h.rank === 1) },
  { id: 'multiplayer_back_to_back', title: 'Durchmarsch', description: 'Zwei Wochen in Folge aufgestiegen.', icon: '🚀', condition: (p) => !!(p.multiplayer?.leagueHistory && p.multiplayer.leagueHistory.length >= 2 && p.multiplayer.leagueHistory[p.multiplayer.leagueHistory.length - 1].promoted && p.multiplayer.leagueHistory[p.multiplayer.leagueHistory.length - 2].promoted) },
  { id: 'multiplayer_close_call', title: 'Zitterpartie', description: 'Klassenerhalt auf dem letzten sicheren Platz (Rang 7) geschafft.', icon: '😅', condition: (p) => !!p.multiplayer?.leagueHistory?.some(h => !h.promoted && !h.relegated && h.rank === 7) },
  { id: 'multiplayer_podium', title: 'Treppchen', description: 'Liga auf dem Podium (Top 3) beendet.', icon: '🏗️', condition: (p) => !!p.multiplayer?.leagueHistory?.some(h => h.rank <= 3) },
  { id: 'weekend_warrior', title: 'Wochenend-Krieger', description: 'Aktivität am Samstag oder Sonntag.', icon: '⚔️', condition: (p) => p.history.some(h => {
    const day = new Date(h.date).getDay();
    return day === 0 || day === 6;
  }) },
];

// --- Constants ---

const CHALLENGE_POOL = [
  { id: 'p3', type: 'participation', target: 3, title: 'Beteilige dich 3x am Unterricht' },
  { id: 'p5', type: 'participation', target: 5, title: 'Beteilige dich 5x am Unterricht' },
  { id: 'p7', type: 'participation', target: 7, title: 'Beteilige dich 7x am Unterricht' },
  { id: 'p8', type: 'participation', target: 8, title: 'Beteilige dich 8x am Unterricht' },
  { id: 'p10', type: 'participation', target: 10, title: 'Beteilige dich 10x am Unterricht' },
  { id: 'p12', type: 'participation', target: 12, title: 'Beteilige dich 12x am Unterricht' },
  { id: 'p15', type: 'participation', target: 15, title: 'Beteilige dich 15x am Unterricht' },
  { id: 'p18', type: 'participation', target: 18, title: 'Beteilige dich 18x am Unterricht' },
  { id: 'p20', type: 'participation', target: 20, title: 'Beteilige dich 20x am Unterricht' },
  { id: 'g1', type: 'grade', target: 1, title: 'Trage eine neue Note ein' },
  { id: 'g2', type: 'grade', target: 2, title: 'Trage heute 2 Noten ein' },
  { id: 'g1_best', type: 'grade_excellent', target: 1, title: 'Erreiche heute eine Eins' },
  { id: 'g1_good', type: 'grade_good', target: 1, title: 'Erreiche heute eine Note 2 oder besser' },
  { id: 'f1', type: 'focus', target: 1, title: 'Beende 1 Fokus-Session' },
  { id: 'f2', type: 'focus', target: 2, title: 'Beende 2 Fokus-Sessions' },
  { id: 'f3', type: 'focus', target: 3, title: 'Beende 3 Fokus-Sessions' },
  { id: 'f4', type: 'focus', target: 4, title: 'Beende 4 Fokus-Sessions' },
  { id: 'f5', type: 'focus', target: 5, title: 'Beende 5 Fokus-Sessions' },
  { id: 'd1', type: 'diary', target: 1, title: 'Schreibe einen Tagebucheintrag' },
  { id: 'pts50', type: 'points', target: 50, title: 'Sammle heute 50 Punkte' },
  { id: 'pts75', type: 'points', target: 75, title: 'Sammle heute 75 Punkte' },
  { id: 'pts100', type: 'points', target: 100, title: 'Sammle heute 100 Punkte' },
  { id: 'pts125', type: 'points', target: 125, title: 'Sammle heute 125 Punkte' },
  { id: 'pts150', type: 'points', target: 150, title: 'Sammle heute 150 Punkte' },
  { id: 'pts200', type: 'points', target: 200, title: 'Sammle heute 200 Punkte' },
  { id: 'pts250', type: 'points', target: 250, title: 'Sammle heute 250 Punkte' },
  { id: 'pts300', type: 'points', target: 300, title: 'Sammle heute 300 Punkte' },
  { id: 'm_math', type: 'subject_participation', subject: 'Mathematik', target: 3, title: 'Melde dich 3x in Mathe' },
  { id: 'm_de', type: 'subject_participation', subject: 'Deutsch', target: 3, title: 'Melde dich 3x in Deutsch' },
  { id: 'm_en', type: 'subject_participation', subject: 'Englisch', target: 3, title: 'Melde dich 3x in Englisch' },
  { id: 'm_bio', type: 'subject_participation', subject: 'Biologie', target: 3, title: 'Melde dich 3x in Bio' },
  { id: 'm_ph', type: 'subject_participation', subject: 'Physik', target: 3, title: 'Melde dich 3x in Physik' },
  { id: 'm_ch', type: 'subject_participation', subject: 'Chemie', target: 3, title: 'Melde dich 3x in Chemie' },
  { id: 'm_hi', type: 'subject_participation', subject: 'Geschichte', target: 3, title: 'Melde dich 3x in Geschichte' },
  { id: 'm_ge', type: 'subject_participation', subject: 'Erdkunde', target: 3, title: 'Melde dich 3x in Erdkunde' },
  { id: 'm_sp', type: 'subject_participation', subject: 'Sport', target: 3, title: 'Melde dich 3x in Sport' },
  { id: 'm_ku', type: 'subject_participation', subject: 'Kunst', target: 3, title: 'Melde dich 3x in Kunst' },
  { id: 'm_mu', type: 'subject_participation', subject: 'Musik', target: 3, title: 'Melde dich 3x in Musik' },
  { id: 'm_re', type: 'subject_participation', subject: 'Religion', target: 3, title: 'Melde dich 3x in Religion' },
  { id: 'multi_s2', type: 'multi_subject', target: 2, title: 'Beteilige dich in 2 verschiedenen Fächern' },
  { id: 'multi_s3', type: 'multi_subject', target: 3, title: 'Beteilige dich in 3 verschiedenen Fächern' },
  { id: 'multi_s4', type: 'multi_subject', target: 4, title: 'Beteilige dich in 4 verschiedenen Fächern' },
  { id: 'type_test', type: 'grade_type', target: 'test', title: 'Trage einen Test ein' },
  { id: 'type_vok', type: 'grade_type', target: 'vokabeltest', title: 'Trage einen Vokabeltest ein' },
  { id: 'type_kl', type: 'grade_type', target: 'klausur', title: 'Trage eine Klausur ein' },
  { id: 'f_late', type: 'focus_late', target: 1, title: 'Beende eine Fokus-Session nach 18 Uhr' },
  { id: 'f_early', type: 'focus_early', target: 1, title: 'Beende eine Fokus-Session vor 9 Uhr' },
  { id: 'p_streak_2', type: 'participation_streak', target: 2, title: 'Beteilige dich in 2 aufeinanderfolgenden Stunden' },
  { id: 'p_5_math', type: 'subject_participation', subject: 'Mathematik', target: 5, title: 'Melde dich 5x in Mathematik' },
  { id: 'p_5_de', type: 'subject_participation', subject: 'Deutsch', target: 5, title: 'Melde dich 5x in Deutsch' },
  { id: 'p_5_en', type: 'subject_participation', subject: 'Englisch', target: 5, title: 'Melde dich 5x in Englisch' },
  { id: 'g_math', type: 'subject_grade', subject: 'Mathematik', target: 1, title: 'Erhalte eine Note in Mathe' },
  { id: 'g_de', type: 'subject_grade', subject: 'Deutsch', target: 1, title: 'Erhalte eine Note in Deutsch' },
  { id: 'g_en', type: 'subject_grade', subject: 'Englisch', target: 1, title: 'Erhalte eine Note in Englisch' },
  { id: 'f_long', type: 'focus_count', target: 3, title: 'Absolute 3 Fokus-Sessions' },
  { id: 'p25', type: 'participation', target: 25, title: 'Beteilige dich 25x am Unterricht' },
  { id: 'p30', type: 'participation', target: 30, title: 'Beteilige dich 30x am Unterricht' },
  { id: 'p_double', type: 'double_participation', target: 2, title: 'Trage in einem Fach doppelte Meldungen ein' },
  { id: 'pts400', type: 'points', target: 400, title: 'Sammle heute 400 Punkte' },
  { id: 'pts500', type: 'points', target: 500, title: 'Sammle heute 500 Punkte' },
  { id: 'pts1000', type: 'points', target: 1000, title: 'Sammle heute 1000 Punkte (Legendär!)' },
  { id: 'g_no_bad', type: 'no_bad_grade', target: 1, title: 'Keine Note schlechter als 3 heute' },
  { id: 'g_improve', type: 'grade_improve', target: 1, title: 'Verbessere dich in einer Note' },
  { id: 'd_long', type: 'diary_long', target: 50, title: 'Schreibe ein Tagebucheintrag (min. 50 Zeichen)' },
  { id: 'f_total_60', type: 'focus_minutes', target: 60, title: 'Insgesamt 60 Min Fokus heute' },
  { id: 'f_total_120', type: 'focus_minutes', target: 120, title: 'Insgesamt 120 Min Fokus heute' },
  { id: 'm_all_core', type: 'core_participation', target: 3, title: 'Melde dich in Mathe, Deutsch UND Englisch' },
  { id: 'p_morning', type: 'participation_morning', target: 5, title: '5 Meldungen vor 11 Uhr' },
  { id: 'p_afternoon', type: 'participation_afternoon', target: 5, title: '5 Meldungen nach 11 Uhr' },
  { id: 'p_even', type: 'participation_even', target: 10, title: 'Erreiche eine gerade Anzahl an Meldungen' },
  { id: 'p_odd', type: 'participation_odd', target: 11, title: 'Erreiche eine ungerade Anzahl an Meldungen' },
  { id: 'grade_1_2', type: 'grade_range', target: [1, 2], title: 'Trage eine 1 oder 2 ein' },
  { id: 'grade_2_3', type: 'grade_range', target: [2, 3], title: 'Trage eine 2 oder 3 ein' },
  { id: 'focus_streak', type: 'focus_streak', target: 2, title: '2 Fokus-Sessions hintereinander' },
  { id: 'diary_morning', type: 'diary_time', target: 'morning', title: 'Schreibe früh morgens ins Tagebuch' },
  { id: 'diary_evening', type: 'diary_time', target: 'evening', title: 'Schreibe spät abends ins Tagebuch' },
  { id: 'points_speed', type: 'points_speed', target: 100, title: 'Erhalte 100 Punkte innerhalb einer Stunde' },
  { id: 'p_5_subject', type: 'any_subject_participation', target: 5, title: '5 Meldungen in einem beliebigen Fach' },
  { id: 'p_10_subject', type: 'any_subject_participation', target: 10, title: '10 Meldungen in einem beliebigen Fach' },
  { id: 'g_2_subjects', type: 'two_subject_grades', target: 2, title: 'Noten in 2 verschiedenen Fächern' },
  { id: 'f_3_hours', type: 'focus_minutes', target: 180, title: 'Insgesamt 3 Stunden Fokus heute' },
  { id: 'p_lunch', type: 'participation_lunch', target: 3, title: '3 Meldungen um die Mittagszeit' },
  { id: 'p_const', type: 'participation_constant', target: 3, title: 'In den ersten 3 Stunden je 2 Meldungen' },
  { id: 'g_top_3', type: 'grade_limit', target: 3, title: 'Nur Noten 1-3 heute' },
  { id: 'pts_round', type: 'points_round', target: 100, title: 'Erreiche exakt eine Hundertermarke an Punkten' },
  { id: 'm_science', type: 'science_participation', target: 5, title: '5 Meldungen in Naturwissenschaften' },
  { id: 'm_languages', type: 'language_participation', target: 5, title: '5 Meldungen in Fremdsprachen' },
  { id: 'f_break', type: 'focus_break', target: 1, title: 'Nutze eine volle Pause nach dem Fokus' },
  { id: 'g_vok_1', type: 'grade_vok_1', target: 1, title: 'Eine 1 in einem Vokabeltest' },
  { id: 'p_max', type: 'participation_max', target: 15, title: 'Erreiche dein Tagesziel an Meldungen' },
  { id: 'pts_double', type: 'points_double', target: 2, title: 'Verdopple deine heutigen Punkte in einer Stunde' },
  { id: 'f_no_skip', type: 'focus_no_skip', target: 2, title: '2 Fokus-Sessions ohne Abbruch' },
  { id: 'g_lucky', type: 'grade_lucky', target: 1, title: 'Trage eine Note ein (Glückstag!)' },
  { id: 'p_start', type: 'participation_start', target: 1, title: 'Erste Meldung direkt in der 1. Stunde' },
  { id: 'p_end', type: 'participation_end', target: 1, title: 'Letzte Meldung in der letzten Stunde' },
  { id: 'diary_pos', type: 'diary_positive', target: 1, title: 'Schreibe etwas Positives ins Tagebuch' },
  { id: 'f_weekend', type: 'focus_weekend', target: 1, title: 'Wochenend-Fokus (Samstag/Sonntag)' },
  { id: 'pts_777', type: 'points_lucky', target: 7, title: 'Sammle eine Zahl mit einer 7 drin' },
  { id: 'g_final', type: 'grade_final', target: 1, title: 'Trage deine Abschlussnote ein' },
  { id: 'p_100_total', type: 'participation_total', target: 100, title: 'Erreiche insgesamt 100 Meldungen (All-Time)' }
];

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

const BOT_NAMES = [
  "Leon", "Paul", "Jonas", "Finn", "Elias", "Luis", "Noah", "Felix", "Lukas", "Maximilian",
  "Emil", "Oskar", "Anton", "Julian", "Liam", "Jacob", "Moritz", "Linus", "Tim", "Philipp",
  "Mia", "Emma", "Hannah", "Sofia", "Anna", "Emilia", "Lina", "Marie", "Lena", "Mila",
  "Lea", "Leonie", "Amelie", "Sophie", "Lilly", "Luisa", "Johanna", "Clara", "Lara", "Maya",
  "Max", "Tom", "Jan", "Erik", "Nick", "Ben", "Lotte", "Nora", "Pia", "Ida"
];

const LEAGUES = [
  { level: 0, name: "Holz Liga", color: "text-amber-800", bg: "bg-amber-800/10", border: "border-amber-800/20" },
  { level: 1, name: "Bronze Liga", color: "text-orange-700", bg: "bg-orange-700/10", border: "border-orange-700/20" },
  { level: 2, name: "Silber Liga", color: "text-slate-400", bg: "bg-slate-400/10", border: "border-slate-400/20" },
  { level: 3, name: "Gold Liga", color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
  { level: 4, name: "Platin Liga", color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
  { level: 5, name: "Diamant Liga", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { level: 6, name: "Legenden Liga", color: "text-purple-600", bg: "bg-purple-600/10", border: "border-purple-600/20" },
  { level: 7, name: "Titanen Liga", color: "text-indigo-600", bg: "bg-indigo-600/10", border: "border-indigo-600/20" },
  { level: 8, name: "Meister Liga", color: "text-red-600", bg: "bg-red-600/10", border: "border-red-600/20" },
  { level: 9, name: "Galaktische Liga", color: "text-blue-800", bg: "bg-blue-800/10", border: "border-blue-800/20" },
  { level: 10, name: "Mystische Liga", color: "text-fuchsia-600", bg: "bg-fuchsia-600/10", border: "border-fuchsia-600/20" },
  { level: 11, name: "Kosmische Liga", color: "text-rose-600", bg: "bg-rose-600/10", border: "border-rose-600/20" },
  { level: 12, name: "Road to Success Gott", color: "text-yellow-600", bg: "bg-yellow-600/10", border: "border-yellow-600/20" },
  { level: 13, name: "Absolute Existenz", color: "text-slate-900 dark:text-slate-100", bg: "bg-slate-900/10 dark:bg-slate-100/10", border: "border-slate-900/20 dark:border-slate-100/20" },
  { level: 14, name: "Jenseits der Zeit", color: "text-cyan-600", bg: "bg-cyan-600/10", border: "border-cyan-600/20" },
  { level: 15, name: "Unendlichkeit", color: "text-violet-600", bg: "bg-violet-600/10", border: "border-violet-600/20" }
];

function getMonday(nowMs: number) {
  const d = new Date(nowMs);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff).getTime();
}

function initMultiplayerData(leagueLevel: number, weekStart: number): MultiplayerData {
  const bots: BotData[] = [];
  const shuffledNames = [...BOT_NAMES].sort(() => 0.5 - Math.random());
  for(let i=0; i<9; i++) {
    const dailyPoints = [];
    const avgPointsPerDay = 20 + Math.pow(1.6, leagueLevel) * 15; 
    const botSkillModifier = 0.7 + (Math.random() * 0.6); 
    
    for(let d=0; d<7; d++) {
      if (Math.random() < 0.2) {
         dailyPoints.push(0);
      } else {
         const pts = Math.floor(Math.random() * avgPointsPerDay * botSkillModifier * 1.5);
         dailyPoints.push(pts);
      }
    }
    bots.push({
      name: shuffledNames[i],
      dailyPoints
    });
  }

  // Generate 100 Initial Online Challenges
  const SUBJECTS = ['Englisch', 'Mathe', 'Deutsch', 'Geschichte', 'Physik', 'Chemie', 'Biologie', 'Informatik', 'Kunst', 'Musik', 'Sport'];
  const challengeDefinitions = [
    { type: 'participations', targets: [10, 25, 50, 100], rewardMult: 10 },
    { type: 'practice', targets: [60, 120, 300, 600], rewardMult: 2 },
    { type: 'grade_1', targets: [1, 2, 3, 5], rewardMult: 100 },
  ];
  
  const onlineChallenges: BotOnlineChallenge[] = [];
  for (let i = 0; i < 100; i++) {
    const def = challengeDefinitions[Math.floor(Math.random() * challengeDefinitions.length)];
    const target = def.targets[Math.floor(Math.random() * def.targets.length)];
    const isSubjectSpecific = Math.random() > 0.4;
    const subject = isSubjectSpecific ? SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)] : undefined;
    const host = shuffledNames[i % shuffledNames.length];
    
    let title = '';
    let description = '';
    if (def.type === 'participations') {
       title = subject ? `${subject} Experte` : `Melde-Maschine`;
       description = `Melde dich ${target} mal ${subject ? `in ${subject}` : 'im Unterricht'}.`;
    } else if (def.type === 'practice') {
       title = subject ? `${subject} Fokus` : `Lern-Marathon`;
       description = `Übe für ${target} Minuten ${subject ? `in ${subject}` : 'insgesamt'}.`;
    } else if (def.type === 'grade_1') {
       title = subject ? `${subject} Genie` : `Top-Schüler`;
       description = `Schreibe ${target} mal eine Eins ${subject ? `in ${subject}` : ''}.`;
    }

    const participants = bots.slice(0, 2 + Math.floor(Math.random() * 5)).map(b => ({
       name: b.name,
       score: Math.floor(Math.random() * target * 0.4), // start with some progress
       isBot: true
    }));
    
    onlineChallenges.push({
      id: `chal_${Date.now()}_${i}`,
      host,
      type: def.type as any,
      target,
      subject,
      title,
      description,
      rewardPoints: target * def.rewardMult,
      participants
    });
  }

  return {
    leagueLevel,
    weekStart,
    bots,
    onlineChallenges
  };
}

const RANKS = [
  { name: 'Neuling', min: 0, color: 'text-slate-500 dark:text-slate-400', icon: '🐣' },
  { name: 'Lehrling', min: 500, color: 'text-blue-500', icon: '📚' },
  { name: 'Gelehrter', min: 1500, color: 'text-green-500', icon: '📜' },
  { name: 'Akademiker', min: 3500, color: 'text-purple-500', icon: '🎓' },
  { name: 'Dozent', min: 7000, color: 'text-orange-500', icon: '⚖️' },
  { name: 'Mastermind', min: 15000, color: 'text-red-600', icon: '🧠' },
];

const GRADE_POINTS: Record<Grade, number> = {
  1: 500,
  2: 250,
  3: 50,
  4: -50,
  5: -250,
  6: -500,
};

const PARTICIPATION_POINTS = 5;

// --- Helper Components ---

function AuthScreen({ onAuth }: { onAuth: (username: string, profile: UserProfile) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Bitte ausfüllen');
      return;
    }

    setLoading(true);
    setError('');

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
      } catch (e) {
        // Network error (offline or server not available)
        res = null;
      }

      let data;
      let isFallback = false;

      if (res) {
        const text = await res.text();
        try {
          data = JSON.parse(text);
        } catch (e) {
          isFallback = true;
        }
      } else {
        isFallback = true;
      }

      if (isFallback) {
         // LocalStorage Fallback for static deployments (e.g. Netlify)
         const localUsers = JSON.parse(localStorage.getItem('kh_users') || '{}');
         if (isRegister) {
            if (localUsers[username]) throw new Error('Benutzername bereits vergeben');
            localUsers[username] = {
              password,
              profile: {
                name: username,
                gradeLevel: "10b",
                points: 0,
                streak: 0,
                lastLoginDate: 0,
                history: [],
                schedule: { 0: [], 1: [], 2: [], 3: [], 4: [] },
                diary: [],
                estimatedGrades: {}
              }
            };
            localStorage.setItem('kh_users', JSON.stringify(localUsers));
            data = { profile: localUsers[username].profile };
         } else {
            const user = localUsers[username];
            if (!user || user.password !== password) {
               throw new Error('Falscher Benutzername oder Passwort');
            }
            data = { profile: user.profile };
         }
      } else {
         if (!res!.ok) throw new Error(data.error || 'Fehler aufgetreten');
      }
      
      onAuth(username, data.profile);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800"
      >
        <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mx-auto mb-6">
          <Trophy className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-2xl font-display font-bold text-center text-slate-900 dark:text-white mb-2">
          Road to Success
        </h1>
        <p className="text-center text-sm text-slate-500 mb-8 font-medium">
          Sammle Punkte und werde zum Mastermind deiner Klasse.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Benutzername</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-xl text-sm font-semibold outline-none transition-all duration-300"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Passwort</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-xl text-sm font-semibold outline-none transition-all duration-300"
            />
          </div>

          {error && <p className="text-danger text-xs font-bold">{error}</p>}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 mt-2"
          >
            {loading ? 'Lädt...' : (isRegister ? 'Registrieren' : 'Anmelden')}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-400 font-medium">
          {isRegister ? 'Schon einen Account? ' : 'Noch keinen Account? '}
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-primary font-bold hover:underline cursor-pointer"
          >
            {isRegister ? 'Anmelden' : 'Registrieren'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        className={`h-full ${color} transition-all duration-1000 ease-out`}
      />
    </div>
  );
}

// --- Main Component ---

export default function App() {
  const [authUsername, setAuthUsername] = useState<string | null>(() => localStorage.getItem('auth_username'));

  const [multiplayerViewMode, setMultiplayerViewMode] = useState<'standings' | 'stats'>('standings');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('theme_color') || 'blue';
  });

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('klassenheld_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.schedule) parsed.schedule = { 0: [], 1: [], 2: [], 3: [], 4: [] };
      if (typeof parsed.streak !== 'number') parsed.streak = 0;
      if (typeof parsed.lastLoginDate !== 'number') parsed.lastLoginDate = 0;
      if (!parsed.diary) parsed.diary = [];
      if (!parsed.estimatedGrades) parsed.estimatedGrades = {};
      return parsed;
    }
    return {
      name: 'Schüler',
      gradeLevel: '10b',
      points: 0,
      streak: 0,
      lastLoginDate: 0,
      history: [],
      schedule: { 0: [], 1: [], 2: [], 3: [], 4: [] },
      diary: [],
      estimatedGrades: {}
    };
  });

  // Check multiplayer progression
  useEffect(() => {
    if (authUsername && profile.name) {
      const nowMs = Date.now();
      const currentWeekStart = getMonday(nowMs);
      
      setProfile(prev => {
        if (!prev.multiplayer) {
          return { ...prev, multiplayer: initMultiplayerData(0, currentWeekStart) };
        }
        
        if (prev.multiplayer.weekStart < currentWeekStart) {
          const prevWeekStart = prev.multiplayer.weekStart;
          const userWeeklyPts = prev.history.filter(h => h.date >= prevWeekStart && h.date < prevWeekStart + 7*24*60*60*1000).reduce((acc, h) => acc + (h.points || 0), 0);
          
          const botsFinal = prev.multiplayer.bots.map(b => ({
            name: b.name,
            points: b.dailyPoints.reduce((a,c)=>a+c,0)
          }));
          
          const leaderboard = [...botsFinal, { name: prev.name, points: userWeeklyPts, isUser: true }].sort((a,b) => b.points - a.points);
          const userRank = leaderboard.findIndex((x: any) => x.isUser) + 1;
          
          let newLevel = prev.multiplayer.leagueLevel;
          let promoted = false;
          let relegated = false;
          
          if (userRank <= 3) {
            newLevel = Math.min(LEAGUES.length - 1, newLevel + 1);
            promoted = true;
          } else if (userRank >= 8) {
            newLevel = Math.max(0, newLevel - 1);
            relegated = true;
          }
          
          const leagueName = LEAGUES[Math.min(LEAGUES.length - 1, prev.multiplayer.leagueLevel)].name;
          const newData = initMultiplayerData(newLevel, currentWeekStart);
          newData.lastResults = { promoted, relegated, rank: userRank, leagueName };
          
          let additionalPoints = 0;
          let wonChallenges = 0;
          let newHistoryItems: any[] = [];
          
          if (prev.multiplayer.onlineChallenges) {
            prev.multiplayer.onlineChallenges.forEach(chal => {
               // Calculate final score
               const userScore = getOnlineChallengeScore(prev, chal);
               const displayParticipants = [...chal.participants, { name: prev.name, score: userScore, isBot: false }]
                   .sort((a,b) => b.score - a.score);
                   
               if (displayParticipants[0] && !displayParticipants[0].isBot) {
                  wonChallenges++;
                  additionalPoints += chal.rewardPoints;
                  newHistoryItems.push({
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'challenge',
                    value: 1,
                    date: currentWeekStart - 1, // just before the new week
                    points: chal.rewardPoints,
                    comment: `Online Challenge gewonnen: ${chal.title}!`
                  });
               }
            });
          }
          
          const newHistoryEntry = {
            date: currentWeekStart,
            rank: userRank,
            points: userWeeklyPts,
            promoted,
            relegated,
            leagueName
          };
          newData.leagueHistory = [...(prev.multiplayer.leagueHistory || []), newHistoryEntry].slice(-10);
          
          return { 
            ...prev, 
            points: prev.points + additionalPoints,
            history: [...newHistoryItems, ...prev.history].slice(0, 100),
            multiplayer: newData 
          };
        }
        
        return prev;
      });
    }
  }, [authUsername, profile.name]);

  // Check for Weekly Recap on Sunday
  useEffect(() => {
    if (authUsername && profile.name) {
      const now = new Date();
      const isSunday = now.getDay() === 0;
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const lastRecap = profile.lastRecapDate || 0;

      if (isSunday && lastRecap < todayStart) {
        setIsWeeklyRecapOpen(true);
        setProfile(prev => ({ ...prev, lastRecapDate: todayStart }));
      }
    }
  }, [authUsername, profile.name, profile.lastRecapDate]);

  // Daily bit simulation for global challenges
  useEffect(() => {
    if (authUsername) {
      setProfile(prev => {
        if (!prev.multiplayer || !prev.multiplayer.onlineChallenges || prev.multiplayer.onlineChallenges.length === 0) return prev;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lastUpdate = prev.multiplayer.lastChallengeUpdateDate || 0;
        
        if (lastUpdate < today) {
           const updatedChallenges = prev.multiplayer.onlineChallenges.map(chal => {
               const newParticipants = chal.participants.map(p => {
                   if (!p.isBot) return p;
                   if (Math.random() < 0.1) {
                      return { ...p, score: chal.target };
                   } else {
                      return { ...p, score: Math.min(chal.target, p.score + Math.floor(Math.random() * (chal.target * 0.25))) };
                   }
               });
               return { ...chal, participants: newParticipants };
           }).filter(chal => {
               return !chal.participants.some(p => p.isBot && p.score >= chal.target);
           });
  
           return {
              ...prev,
              multiplayer: {
                 ...prev.multiplayer,
                 onlineChallenges: updatedChallenges,
                 lastChallengeUpdateDate: today
              }
           };
        }
        return prev;
      });
    }
  }, [authUsername]);

  // Check and update streak
  useEffect(() => {
    if (authUsername) {
      setProfile(prev => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const lastLogin = new Date(prev.lastLoginDate || 0);
        const lastLoginDay = prev.lastLoginDate ? new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate()).getTime() : 0;
        const oneDay = 24 * 60 * 60 * 1000;
        
        let newStreak = prev.streak || 0;
        
        // Überprüfen, ob es überhaupt eingetragene Fächer im Stundenplan gibt
        const hasAnySchedule = (Object.values(prev.schedule) as ScheduleSlot[][]).some(day => day && day.length > 0);

        // Zähle verpasste Schultage
        let missedSchoolDays = 0;
        if (lastLoginDay > 0 && today > lastLoginDay) {
          let curr = new Date(lastLoginDay + oneDay);
          while (curr.getTime() < today) {
            const day = curr.getDay(); // 0 = Sonntag, 6 = Samstag
            const isWeekend = day === 0 || day === 6;
            
            let isSchoolFree = isWeekend;
            if (!isWeekend && hasAnySchedule) {
              // Falls ein Stundenplan existiert, aber an diesem Wochentag keine Fächer eingetragen sind -> schulfrei
              const scheduleDayIndex = day - 1; // 1 (Mon) -> 0, etc.
              if (!prev.schedule[scheduleDayIndex] || prev.schedule[scheduleDayIndex].length === 0) {
                isSchoolFree = true;
              }
            }

            if (!isSchoolFree) {
              missedSchoolDays++;
            }
            curr.setDate(curr.getDate() + 1);
          }
        }

        if (lastLoginDay === 0) {
          newStreak = 1;
        } else if (today - lastLoginDay === oneDay) {
          newStreak += 1;
        } else if (today - lastLoginDay > oneDay) {
          if (missedSchoolDays === 0) {
            // Es wurden nur Wochenenden oder schulfreie Tage verpasst -> Streak bleibt erhalten & erhöht sich, da er sich heute einloggt
            newStreak += 1;
          } else {
            // Echte Schultage verpasst -> Streak bricht
            newStreak = 1;
          }
        } else if (today === lastLoginDay && newStreak === 0) {
          newStreak = 1;
        }
        
        let updatedHomework = [...(prev.homework || [])];
        let homeworkPenalty = 0;
        let newHistoryEntries: HistoryEntry[] = [];

        updatedHomework = updatedHomework.map(hw => {
            if (!hw.completed && !hw.missed && new Date(hw.dueDate).getTime() < today) {
                homeworkPenalty += 25;
                newHistoryEntries.push({
                   id: Math.random().toString(36).substr(2, 9),
                   type: 'penalty',
                   date: today,
                   points: -25,
                   value: -25,
                   comment: `Hausaufgabe verpasst: ${hw.subject}`
                });
                return { ...hw, missed: true };
            }
            return hw;
        });

        // Vocab Streak zurücksetzen, falls abgelaufen
        let newVocabStreak = prev.vocabStreak || 0;
        if (prev.lastVocabDate) {
            const lastVocabDay = new Date(new Date(prev.lastVocabDate).getFullYear(), new Date(prev.lastVocabDate).getMonth(), new Date(prev.lastVocabDate).getDate()).getTime();
            if (today - lastVocabDay > oneDay) {
                newVocabStreak = 0;
            }
        }

        // Reminders checken
        if (prev.calendarEvents) {
            const reminders = prev.calendarEvents.filter(ev => {
               if (ev.reminderDate && ev.reminderDate <= today) {
                   return !(prev.dismissedReminders || []).includes(ev.id);
               }
               return false;
            });
            if (reminders.length > 0) {
               setRemindersToShow(reminders);
            }
        }

        if (prev.lastLoginDate !== today || prev.streak !== newStreak || homeworkPenalty > 0 || newVocabStreak !== prev.vocabStreak) {
          return { 
            ...prev, 
            lastLoginDate: today, 
            streak: newStreak, 
            vocabStreak: newVocabStreak,
            homework: updatedHomework,
            points: Math.max(0, prev.points - homeworkPenalty),
            history: [...newHistoryEntries, ...prev.history]
          };
        }
        return prev;
      });
    }
  }, [authUsername]);

  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [isParticipationConfirmOpen, setIsParticipationConfirmOpen] = useState(false);
  const [pendingParticipationData, setPendingParticipationData] = useState<{mode: 'total' | 'subjects', total?: number, subjects?: Record<string, number>} | null>(null);
  const [gradeType, setGradeType] = useState<'vokabeltest' | 'test' | 'arbeit'>('arbeit');
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);
  const [practiceDuration, setPracticeDuration] = useState(25);
  const [practiceSubject, setPracticeSubject] = useState("");
  const [practiceNote, setPracticeNote] = useState("");
  const [isAddGoalModalOpen, setIsAddGoalModalOpen] = useState(false);
  const [newGoalType, setNewGoalType] = useState<'practice_minutes' | 'participations'>('participations');
  const [newGoalTarget, setNewGoalTarget] = useState(5);
  const [newGoalPeriod, setNewGoalPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHomeworkOpen, setIsHomeworkOpen] = useState(false);
  const [isAddingHomework, setIsAddingHomework] = useState(false);
  const [homeworkSubject, setHomeworkSubject] = useState('');
  const [homeworkTask, setHomeworkTask] = useState('');
  const [homeworkDate, setHomeworkDate] = useState('');
  
  // Vocab State
  const [isVocabOpen, setIsVocabOpen] = useState(false);
  
  // Calendar State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<'exam' | 'term' | 'other'>('exam');
  const [newEventReminder, setNewEventReminder] = useState<number | null>(null); // days before
  const [remindersToShow, setRemindersToShow] = useState<CalendarEvent[]>([]);
  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [socialView, setSocialView] = useState<'fyp' | 'create' | 'profile'>('fyp');
  const [socialProfileTab, setSocialProfileTab] = useState<'posts' | 'likes'>('posts');
  const [viewingSocialPost, setViewingSocialPost] = useState<SocialPost | null>(null);
  const [userSocialPosts, setUserSocialPosts] = useState<SocialPost[]>([]);
  const [socialFollowers, setSocialFollowers] = useState(() => Math.floor(Math.random() * 50) + 10);
  const [createPostContent, setCreatePostContent] = useState('');
  const [createPostMediaUrl, setCreatePostMediaUrl] = useState<string | null>(null);
  const [createPostMediaType, setCreatePostMediaType] = useState<'image' | 'video' | null>(null);

  // Quiz VS State
  const [isQuizVsOpen, setIsQuizVsOpen] = useState(false);
  const [quizVsView, setQuizVsView] = useState<'subject_select' | 'difficulty_select' | 'play'>('subject_select');
  const [quizVsSubject, setQuizVsSubject] = useState<string>('Englisch');
  const [quizVsSession, setQuizVsSession] = useState<{
    questions: QuizQuestion[];
    currentIndex: number;
    userScore: number;
    botScore: number;
    botName: string;
    difficulty: 'easy' | 'medium' | 'hard';
    gameStatus: 'playing' | 'question_finished' | 'game_over';
    questionWinner: 'user' | 'bot' | null;
    selectedOptions: Record<string, boolean>; // track which options user already clicked wrong for current question
  } | null>(null);

  const [vocabView, setVocabView] = useState<'lists' | 'create_list' | 'edit_list' | 'learn' | 'stats' | 'versus_setup' | 'versus_play'>('lists');
  const [versusSession, setVersusSession] = useState<{
    listId: string;
    words: VocabWord[];
    currentIndex: number;
    userScore: number;
    botScore: number;
    botName: string;
    difficulty: 'easy' | 'medium' | 'hard';
    gameStatus: 'playing' | 'word_finished' | 'game_over';
    wordWinner: 'user' | 'bot' | null;
    currentInput: string;
    targetIsFront: boolean;
  } | null>(null);
  const [currentVocabList, setCurrentVocabList] = useState<VocabList | null>(null);
  const [newVocabListTitle, setNewVocabListTitle] = useState('');
  const [newVocabListSubject, setNewVocabListSubject] = useState('');
  const [newVocabWords, setNewVocabWords] = useState<{front: string, back: string}[]>([{front: '', back: ''}]);
  const [learnSession, setLearnSession] = useState<{
    listId: string;
    words: VocabWord[];
    currentIndex: number;
    flipped: boolean;
    correct: number;
    wrong: number;
  } | null>(null);

  const [isWeeklyRecapOpen, setIsWeeklyRecapOpen] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [devResetClicks, setDevResetClicks] = useState(0);
  const [isDevPasswordModalOpen, setIsDevPasswordModalOpen] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState('');
  
  const [isChallengeProgressModalOpen, setIsChallengeProgressModalOpen] = useState(false);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [challengeProgressInput, setChallengeProgressInput] = useState<number>(0);
  
  const [partMode, setPartMode] = useState<'total' | 'subject'>('total');
  const [partTotal, setPartTotal] = useState<number>(1);
  const [partSubjects, setPartSubjects] = useState<Record<string, number>>({});

  useEffect(() => {
    if (vocabView === 'versus_play' && versusSession?.gameStatus === 'playing') {
      let minTime, maxTime;
      if (versusSession.difficulty === 'easy') { minTime = 10000; maxTime = 15000; }
      else if (versusSession.difficulty === 'medium') { minTime = 7000; maxTime = 12000; }
      else { minTime = 5000; maxTime = 8000; }

      const botDelay = Math.random() * (maxTime - minTime) + minTime;

      const botTimeout = setTimeout(() => {
        setVersusSession(prev => {
          if (!prev || prev.gameStatus !== 'playing') return prev;
          return {
            ...prev,
            gameStatus: 'word_finished',
            botScore: prev.botScore + 1,
            wordWinner: 'bot',
          };
        });
      }, botDelay);

      return () => clearTimeout(botTimeout);
    }
  }, [vocabView, versusSession?.gameStatus, versusSession?.currentIndex, versusSession?.difficulty]);

  useEffect(() => {
    if (quizVsView === 'play' && quizVsSession?.gameStatus === 'playing') {
      let minTime, maxTime;
      if (quizVsSession.difficulty === 'easy') { minTime = 10000; maxTime = 15000; }
      else if (quizVsSession.difficulty === 'medium') { minTime = 7000; maxTime = 12000; }
      else { minTime = 5000; maxTime = 8000; }

      const botDelay = Math.random() * (maxTime - minTime) + minTime;

      const botTimeout = setTimeout(() => {
        setQuizVsSession(prev => {
          if (!prev || prev.gameStatus !== 'playing') return prev;
          return {
            ...prev,
            gameStatus: 'question_finished',
            botScore: prev.botScore + 1,
            questionWinner: 'bot',
          };
        });
      }, botDelay);

      return () => clearTimeout(botTimeout);
    }
  }, [quizVsView, quizVsSession?.gameStatus, quizVsSession?.currentIndex, quizVsSession?.difficulty]);

  useEffect(() => {
    if (vocabView === 'versus_play' && versusSession?.gameStatus === 'word_finished') {
      const nextTimeout = setTimeout(() => {
        setVersusSession(prev => {
          if (!prev) return prev;
          if (prev.currentIndex + 1 < prev.words.length) {
            return {
              ...prev,
              currentIndex: prev.currentIndex + 1,
              gameStatus: 'playing',
              wordWinner: null,
              currentInput: '',
              targetIsFront: Math.random() > 0.5
            };
          } else {
            return {
              ...prev,
              gameStatus: 'game_over'
            };
          }
        });
      }, 2500);
      return () => clearTimeout(nextTimeout);
    }
  }, [vocabView, versusSession?.gameStatus, versusSession?.currentIndex]);

  useEffect(() => {
    if (quizVsView === 'play' && quizVsSession?.gameStatus === 'question_finished') {
      const nextTimeout = setTimeout(() => {
        setQuizVsSession(prev => {
          if (!prev) return prev;
          if (prev.currentIndex + 1 < prev.questions.length) {
            return {
              ...prev,
              currentIndex: prev.currentIndex + 1,
              gameStatus: 'playing',
              questionWinner: null,
              selectedOptions: {}
            };
          } else {
            return {
              ...prev,
              gameStatus: 'game_over'
            };
          }
        });
      }, 2500);
      return () => clearTimeout(nextTimeout);
    }
  }, [quizVsView, quizVsSession?.gameStatus, quizVsSession?.currentIndex]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isGradesOpen, setIsGradesOpen] = useState(false);
  const [subjectDetails, setSubjectDetails] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [tempEstGrade, setTempEstGrade] = useState<number>(3);
  const [diaryText, setDiaryText] = useState("");
  const [statsTimeFilter, setStatsTimeFilter] = useState<'week' | 'month' | 'halfyear' | 'all'>('all');
  const [bestSubjectsSort, setBestSubjectsSort] = useState<'trend' | 'participations' | 'grades' | 'points'>('trend');
  const [isAddSlotOpen, setIsAddSlotOpen] = useState<{ open: boolean; day: number }>({ open: false, day: 0 });
  const [newSlot, setNewSlot] = useState({ subject: '', time: '' });
  
  const [tempName, setTempName] = useState(profile.name);
  const [tempGrade, setTempGrade] = useState(profile.gradeLevel);

  const [isSyncing, setIsSyncing] = useState(false);
  const [celebrationInfo, setCelebrationInfo] = useState<{title: string, subtitle?: string} | null>(null);

  // Timer State
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [timerMode, setTimerMode] = useState<'focus' | 'break'>('focus');
  const [timerDuration, setTimerDuration] = useState(25);
  const [timerSubject, setTimerSubject] = useState("");
  const [timerNote, setTimerNote] = useState("");
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isTimerActive && timeLeft === 0) {
      setIsTimerActive(false);
      if (timerMode === 'focus') {
        // Calculate points based on duration
        const pointsEarned = timerDuration * 2; // 2 points per minute
        triggerCelebration('Fokus-Session beendet!', `+${pointsEarned} Punkte`);
        setProfile(prev => ({
          ...prev,
          points: prev.points + pointsEarned,
          history: [...prev.history, {
            id: Math.random().toString(36).substr(2, 9),
            type: 'challenge',
            value: 1,
            points: pointsEarned,
            date: Date.now(),
            comment: 'Fokus-Session',
            subject: timerSubject,
            focusNote: timerNote,
            focusDuration: timerDuration
          }]
        }));
        setTimerMode('break');
        setTimeLeft(5 * 60);
      } else {
        triggerCelebration('Pause beendet!', 'Bereit für die nächste Session?');
        setTimerMode('focus');
        setTimeLeft(timerDuration * 60);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timeLeft, timerMode, timerDuration, timerSubject, timerNote]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const triggerCelebration = (title: string, subtitle?: string) => {
    setCelebrationInfo({ title, subtitle });
    confetti({
      particleCount: 200,
      spread: 120,
      origin: { y: 0.6 },
      zIndex: 9999,
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']
    });
    setTimeout(() => setCelebrationInfo(null), 3500);
  };

  useEffect(() => {
    localStorage.setItem('klassenheld_profile', JSON.stringify(profile));

    // Sync to server if authenticated
    if (authUsername) {
      setIsSyncing(true);
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authUsername, profile })
      })
      .then(async (res) => {
         const text = await res.text();
         try {
            JSON.parse(text);
         } catch(e) {
            // HTML response = static hosting fallback
            const localUsers = JSON.parse(localStorage.getItem('kh_users') || '{}');
            if (localUsers[authUsername]) {
               localUsers[authUsername].profile = profile;
               localStorage.setItem('kh_users', JSON.stringify(localUsers));
            }
         }
      })
      .catch((e) => {
         if (e.message !== "Failed to fetch") {
           console.error("API error, falling back locally", e);
         }
         const localUsers = JSON.parse(localStorage.getItem('kh_users') || '{}');
         if (localUsers[authUsername]) {
            localUsers[authUsername].profile = profile;
            localStorage.setItem('kh_users', JSON.stringify(localUsers));
         }
      })
      .finally(() => setIsSyncing(false));
    }
  }, [profile, authUsername]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeColor);
    localStorage.setItem('theme_color', themeColor);
  }, [themeColor]);

  // --- Derived State ---

  const currentRankIndex = useMemo(() => {
    const sortedRanks = [...RANKS].sort((a, b) => b.min - a.min);
    const index = sortedRanks.findIndex(r => profile.points >= r.min);
    const safeIndex = index === -1 ? sortedRanks.length - 1 : index;
    return RANKS.indexOf(sortedRanks[safeIndex]);
  }, [profile.points]);

  const currentRank = RANKS[currentRankIndex];
  const nextRank = RANKS[currentRankIndex + 1];

  const rankProgress = useMemo(() => {
    if (!nextRank) return 100;
    const range = nextRank.min - currentRank.min;
    const progress = profile.points - currentRank.min;
    return (progress / range) * 100;
  }, [profile.points, currentRank, nextRank]);

  // Participation Stats (Last 7 Days)
  const participationStats = useMemo(() => {
    const dailyCounts: Record<string, number> = {};
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return {
        label: i === 0 ? 'Heute' : d.toLocaleDateString('de-DE', { weekday: 'short' }),
        dateStr: d.toDateString(),
        isToday: i === 0
      };
    }).reverse();

    last7Days.forEach(day => dailyCounts[day.label] = 0);

    profile.history
      .filter(e => e.type === 'participation')
      .forEach(e => {
        const dateStr = new Date(e.date).toDateString();
        const found = last7Days.find(d => d.dateStr === dateStr);
        if (found) {
          dailyCounts[found.label]++;
        }
      });

    return last7Days.map(d => ({ name: d.label, count: dailyCounts[d.label], isToday: d.isToday }));
  }, [profile.history]);

  // Multiplayer Standings
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const monday = getMonday(now.getTime());
    const weekHistory = profile.history.filter(h => h.date >= monday);

    const pts = weekHistory.reduce((acc, h) => acc + (h.points || 0), 0);
    const parts = weekHistory.filter(h => h.type === 'participation').length;
    const grades = weekHistory.filter(h => h.type === 'grade');
    const avg = grades.length > 0 ? (grades.reduce((acc, g) => acc + Number(g.value), 0) / grades.length).toFixed(1) : null;
    const best = grades.length > 0 ? Math.min(...grades.map(g => Number(g.value))) : null;
    const days = new Set(weekHistory.map(h => new Date(h.date).toDateString())).size;

    return { points: pts, participations: parts, avgGrade: avg, bestGrade: best, activeDays: days };
  }, [profile.history]);

  const multiplayerStandings = useMemo(() => {
    if (!profile.multiplayer) return [];
    const now = new Date();
    let todayIndex = now.getDay() - 1;
    if (todayIndex === -1) todayIndex = 6; // Sunday
    
    // Distribute points based on the current hour of the day
    const hourOfDay = now.getHours() + (now.getMinutes() / 60);
    
    const botsWithCurrentPoints = profile.multiplayer.bots.map(b => {
      let pts = 0;
      for (let i = 0; i < todayIndex; i++) {
         pts += b.dailyPoints[i];
      }
      // partial points for today
      const todayPts = b.dailyPoints[todayIndex];
      pts += Math.floor(todayPts * (hourOfDay / 24));
      
      return { name: b.name, points: pts, isUser: false };
    });
    
    const userPts = profile.history.filter(h => h.date >= profile.multiplayer!.weekStart).reduce((acc, h) => acc + (h.points || 0), 0);
    
    const all = [...botsWithCurrentPoints, { name: profile.name, points: userPts, isUser: true }];
    all.sort((a,b) => b.points - a.points);
    return all;
  }, [profile.history, profile.multiplayer]);

  // Grade Stats by Subject
  const gradeStats = useMemo(() => {
    const subjectGrades: Record<string, number[]> = {};
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    const limits = {
       week: now - 7 * dayInMs,
       month: now - 30 * dayInMs,
       halfyear: now - 180 * dayInMs,
       all: 0
    };
    const limit = limits[statsTimeFilter];

    profile.history.filter(h => h.type === 'grade' && h.subject && h.date >= limit).forEach(h => {
       if (!subjectGrades[h.subject!]) subjectGrades[h.subject!] = [];
       subjectGrades[h.subject!].push(Number(h.value));
    });

    return Object.entries(subjectGrades).map(([subject, grades]) => {
       const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
       return { 
          name: subject.length > 8 ? subject.substring(0, 8) + '...' : subject, 
          avg: Number(avg.toFixed(1)),
          grades
       };
    });
  }, [profile.history, statsTimeFilter]);

  const bestSubjects = useMemo(() => {
    const subjects = getAvailableSubjects(profile);
    const data = subjects.map(subject => {
      const subjectHistory = profile.history.filter(h => h.subject === subject);
      const participations = subjectHistory.filter(h => h.type === 'participation').length;
      const gradesCount = subjectHistory.filter(h => h.type === 'grade').length;
      const points = subjectHistory.reduce((sum, h) => sum + (h.points || 0), 0);
      const baseGrade = profile.estimatedGrades?.[subject] || 3.0;
      const trend = getTrendGrade(subject, baseGrade, profile.history);
      
      return { subject, participations, gradesCount, points, trend };
    });

    return data.sort((a, b) => {
      if (bestSubjectsSort === 'trend') return a.trend - b.trend; // lower is better
      if (bestSubjectsSort === 'participations') return b.participations - a.participations;
      if (bestSubjectsSort === 'grades') return b.gradesCount - a.gradesCount;
      if (bestSubjectsSort === 'points') return b.points - a.points;
      return 0;
    });
  }, [profile, bestSubjectsSort]);

  const focusStats = useMemo(() => {
    const focusSessions = profile.history.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session');
    
    const subjectMins: Record<string, number> = {};
    const subjectCounts: Record<string, number> = {};
    const notes: Array<{ date: number, subject: string, note: string, duration: number }> = [];
    
    let totalMinutes = 0;
    
    focusSessions.forEach(f => {
      const minutes = f.focusDuration || 25;
      totalMinutes += minutes;
      
      const subj = f.subject || 'Ohne Fach';
      subjectMins[subj] = (subjectMins[subj] || 0) + minutes;
      subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
      
      if (f.focusNote) {
        notes.push({
          date: f.date,
          subject: subj,
          note: f.focusNote,
          duration: minutes
        });
      }
    });

    notes.sort((a, b) => b.date - a.date);
    
    const bySubject = Object.keys(subjectMins).map(subj => ({
      subject: subj,
      minutes: subjectMins[subj],
      count: subjectCounts[subj]
    })).sort((a, b) => b.minutes - a.minutes);
    
    return {
      totalMinutes,
      totalSessions: focusSessions.length,
      bySubject,
      notes
    };
  }, [profile.history]);

  // Daily Challenges Logic
  const dailyChallenges = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    // Simple hash for stable daily selection
    let hash = 0;
    for (let i = 0; i < todayStr.length; i++) {
        hash = ((hash << 5) - hash) + todayStr.charCodeAt(i);
        hash |= 0;
    }
    const index = Math.abs(hash) % CHALLENGE_POOL.length;
    const challengeTemplate = CHALLENGE_POOL[index];

    const todayHistory = profile.history.filter(h => new Date(h.date).toDateString() === todayStr);
    
    let current = 0;
    const type = challengeTemplate.type;
    const target = challengeTemplate.target;

    switch(type) {
      case 'participation':
        current = todayHistory.filter(h => h.type === 'participation').length;
        break;
      case 'grade':
        current = todayHistory.filter(h => h.type === 'grade').length;
        break;
      case 'grade_excellent':
        current = todayHistory.some(h => h.type === 'grade' && h.value === 1) ? 1 : 0;
        break;
      case 'grade_good':
        current = todayHistory.some(h => h.type === 'grade' && Number(h.value) <= 2) ? 1 : 0;
        break;
      case 'focus':
      case 'focus_count':
        current = todayHistory.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length;
        break;
      case 'diary':
      case 'diary_long':
        const todayDiary = (profile.diary || []).filter(d => new Date(d.date).toDateString() === todayStr);
        if (type === 'diary_long') {
          current = todayDiary.some(d => d.text.length >= (target as number)) ? 1 : 0;
        } else {
          current = todayDiary.length;
        }
        break;
      case 'points':
        current = todayHistory.reduce((sum, h) => sum + (h.points || 0), 0);
        break;
      case 'subject_participation':
        current = todayHistory.filter(h => h.type === 'participation' && h.subject === (challengeTemplate as any).subject).length;
        break;
      case 'multi_subject':
        current = new Set(todayHistory.filter(h => h.type === 'participation' && h.subject).map(h => h.subject)).size;
        break;
      case 'grade_type':
        current = todayHistory.some(h => h.type === 'grade' && h.comment === target) ? 1 : 0;
        break;
      case 'focus_late':
        current = todayHistory.some(h => h.type === 'challenge' && h.comment === 'Fokus-Session' && new Date(h.date).getHours() >= 18) ? 1 : 0;
        break;
      case 'focus_early':
        current = todayHistory.some(h => h.type === 'challenge' && h.comment === 'Fokus-Session' && new Date(h.date).getHours() < 9) ? 1 : 0;
        break;
      case 'focus_minutes':
        current = todayHistory.filter(h => h.type === 'challenge' && h.comment === 'Fokus-Session').length * 25;
        break;
      case 'subject_grade':
        current = todayHistory.some(h => h.type === 'grade' && h.subject === (challengeTemplate as any).subject) ? 1 : 0;
        break;
      case 'any_subject_participation':
        const subjCounts: Record<string, number> = {};
        todayHistory.filter(h => h.type === 'participation' && h.subject).forEach(h => {
          subjCounts[h.subject!] = (subjCounts[h.subject!] || 0) + 1;
        });
        current = Object.keys(subjCounts).length > 0 ? Math.max(...Object.values(subjCounts)) : 0;
        break;
      case 'grade_range':
        current = todayHistory.some(h => h.type === 'grade' && (target as number[]).includes(h.value as any)) ? 1 : 0;
        break;
      case 'participation_morning':
        current = todayHistory.filter(h => h.type === 'participation' && new Date(h.date).getHours() < 11).length;
        break;
      case 'participation_afternoon':
        current = todayHistory.filter(h => h.type === 'participation' && new Date(h.date).getHours() >= 11).length;
        break;
      case 'science_participation':
        const science = ['Biologie', 'Physik', 'Chemie', 'Naturwissenschaften'];
        current = todayHistory.filter(h => h.type === 'participation' && science.includes(h.subject || '')).length;
        break;
      case 'language_participation':
        const langs = ['Englisch', 'Französisch', 'Spanisch', 'Latein', 'Deutsch'];
        current = todayHistory.filter(h => h.type === 'participation' && langs.includes(h.subject || '')).length;
        break;
      case 'no_bad_grade':
        const todayGrades = todayHistory.filter(h => h.type === 'grade');
        current = (todayGrades.length > 0 && todayGrades.every(h => Number(h.value) <= 3)) ? 1 : 0;
        break;
      case 'grade_limit':
        const grds = todayHistory.filter(h => h.type === 'grade');
        current = (grds.length > 0 && grds.every(h => Number(h.value) <= (target as number))) ? 1 : 0;
        break;
      case 'core_participation':
        const core = ['Mathematik', 'Deutsch', 'Englisch'];
        const coreMet = core.every(s => todayHistory.some(h => h.type === 'participation' && h.subject === s));
        current = coreMet ? 1 : 0;
        break;
      case 'participation_total':
        current = profile.history.filter(h => h.type === 'participation').length;
        break;
      default:
        current = todayHistory.filter(h => h.type === 'participation').length;
    }

    const completed = todayHistory.some(h => h.type === 'challenge' && h.comment === challengeTemplate.id);
    
    // Return an array with exactly one challenge (UI expects array)
    return [{
       ...challengeTemplate,
       current: Math.min(typeof current === 'number' ? current : 0, typeof target === 'number' ? target : 1),
       completed,
       points: 50
    }];
  }, [profile]);

  useEffect(() => {
    let awarded = false;
    const newEntries: HistoryEntry[] = [];
    let earnedPoints = 0;

    dailyChallenges.forEach(c => {
      const isTargetMet = typeof c.target === 'number' ? c.current >= (c.target as number) : c.current >= 1;
      if (isTargetMet && !c.completed) {
        awarded = true;
        earnedPoints += 50; // Always 50 as requested
        newEntries.push({
           id: Math.random().toString(36).substr(2, 9),
           type: 'challenge',
           value: typeof c.target === 'number' ? c.target : 1,
           points: 50,
           date: Date.now(),
           comment: c.id
        });
      }
    });

    if (awarded) {
      setTimeout(() => {
        setProfile(prev => ({
           ...prev,
           points: prev.points + earnedPoints,
           history: [...newEntries, ...prev.history].slice(0, 50)
        }));
      }, 0);
    }
  }, [dailyChallenges]);

  useEffect(() => {
    let newUnlocked: string[] = [];
    ACHIEVEMENTS.forEach(ach => {
      const isUnlocked = ach.condition(profile);
      if (isUnlocked && (!profile.unlockedAchievements || !profile.unlockedAchievements.includes(ach.id))) {
        newUnlocked.push(ach.id);
      }
    });

    if (newUnlocked.length > 0) {
      setProfile(prev => ({
        ...prev,
        unlockedAchievements: [...(prev.unlockedAchievements || []), ...newUnlocked]
      }));
      const ach = ACHIEVEMENTS.find(a => a.id === newUnlocked[0]);
      if (ach) {
        triggerCelebration('Stark!', `Erfolg freigeschaltet: ${ach.title}`);
      }
    }
  }, [profile.history, profile.points, profile.streak, profile.schedule, profile.diary, profile.estimatedGrades]);


  const availableSubjects = useMemo(() => {
    const sched = (Object.values(profile.schedule) as ScheduleSlot[][]).flat().map(s => s.subject);
    const hist = profile.history.filter(h => h.type === 'grade' && h.subject).map(h => h.subject!);
    return Array.from(new Set([...sched, ...hist])).filter(Boolean);
  }, [profile.schedule, profile.history]);

  const todayIndex = new Date().getDay() - 1;
  const validTodayIndex = (todayIndex >= 0 && todayIndex <= 4) ? todayIndex : -1;
  const todaySubjects = useMemo(() => {
    if (validTodayIndex === -1) return [];
    return Array.from(new Set(profile.schedule[validTodayIndex]?.map(s => s.subject) || []));
  }, [profile.schedule, validTodayIndex]);

  const achievementProgress = useMemo(() => {
    const unlockedCount = ACHIEVEMENTS.filter(a => a.condition(profile)).length;
    return { unlocked: unlockedCount, total: ACHIEVEMENTS.length };
  }, [profile]);

  const sortedAchievements = useMemo(() => {
    return [...ACHIEVEMENTS].sort((a, b) => {
      const aUnlocked = a.condition(profile);
      const bUnlocked = b.condition(profile);
      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;
      return 0;
    });
  }, [profile]);

  // --- Dev Mode Actions ---
  const handleDevPointsChange = (amount: number) => {
    setProfile(prev => ({ ...prev, points: prev.points + amount }));
  };

  const handleDevSkipDay = () => {
    setProfile(prev => ({
      ...prev,
      streak: prev.streak + 1,
      history: [
        { id: Date.now().toString(), date: Date.now(), type: 'challenge', points: 0, value: 0, comment: 'Tag übersprungen (Dev)' },
        ...prev.history
      ].slice(0, 100)
    }));
  };

  // --- Actions ---

  const openPartModal = () => {
    setIsPartModalOpen(true);
    setPartMode('total');
    setPartTotal(1);
    setPartSubjects({});
  };

  const submitParticipation = (confirmed = false) => {
    let totalToSubmit: number = 0;
    if (partMode === 'total') {
      totalToSubmit = partTotal;
    } else {
      totalToSubmit = (Object.values(partSubjects) as number[]).reduce((a, b) => a + (b || 0), 0);
    }

    if (totalToSubmit > 50 && !confirmed) {
      setPendingParticipationData({
        mode: partMode,
        total: partTotal,
        subjects: { ...partSubjects }
      });
      setIsParticipationConfirmOpen(true);
      return;
    }

    // Check for penalty
    const today = new Date().toISOString().split('T')[0];
    const todayCount = profile.history
      .filter(h => h.type === 'participation' && new Date(h.date).toISOString().split('T')[0] === today)
      .length;

    if (todayCount + totalToSubmit > 50) {
      const highActivityDays = new Set(
        profile.history
          .filter(h => h.type === 'participation')
          .map(h => new Date(h.date).toISOString().split('T')[0])
          .filter(date => {
             const count = profile.history.filter(h => h.type === 'participation' && new Date(h.date).toISOString().split('T')[0] === date).length;
             return count > 50;
          })
      );
      
      // Add today if it exceeds 50
      if (todayCount + totalToSubmit > 50) highActivityDays.add(today);

      if (highActivityDays.size >= 5 && profile.multiplayer) {
        setProfile(prev => ({
          ...prev,
          multiplayer: {
            ...prev.multiplayer!,
            leagueLevel: Math.max(0, prev.multiplayer!.leagueLevel - 2)
          }
        }));
        triggerCelebration('Achtung!', 'Strafe wegen unnatürlicher Aktivität: -2 Ligen!');
      }
    }

    let newEntries: HistoryEntry[] = [];
    let earnedPoints = 0;

    if (partMode === 'total') {
      if (partTotal > 0) {
        for(let i=0; i<partTotal; i++) {
           newEntries.push({
             id: Math.random().toString(36).substr(2, 9),
             type: 'participation',
             value: 1,
             points: PARTICIPATION_POINTS,
             date: Date.now()
           });
           earnedPoints += PARTICIPATION_POINTS;
        }
      }
    } else {
      Object.entries(partSubjects).forEach(([subject, count]: [string, number]) => {
        if (count > 0) {
          for(let i=0; i<count; i++) {
             newEntries.push({
               id: Math.random().toString(36).substr(2, 9),
               type: 'participation',
               value: 1,
               points: PARTICIPATION_POINTS,
               date: Date.now(),
               subject: subject
             });
             earnedPoints += PARTICIPATION_POINTS;
          }
        }
      });
    }

    if (newEntries.length > 0) {
       setProfile(prev => ({
         ...prev,
         points: prev.points + earnedPoints,
         history: [...newEntries, ...prev.history].slice(0, 100)
       }));
       if (newEntries.length >= 3) {
           triggerCelebration('Klasse!', `${newEntries.length} Meldungen eingetragen.`);
       }
    }
    
    setIsPartModalOpen(false);
    setIsParticipationConfirmOpen(false);
    setPendingParticipationData(null);
  };

  const submitPractice = () => {
    if (practiceDuration <= 0) return;
    
    // Calculate points based on duration like study timer
    const pointsEarned = practiceDuration * 2; // 2 points per minute
    
    setProfile(prev => ({
      ...prev,
      points: prev.points + pointsEarned,
      history: [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'challenge',
        value: 1,
        points: pointsEarned,
        date: Date.now(),
        comment: 'Fokus-Session',
        subject: practiceSubject,
        focusNote: practiceNote,
        focusDuration: practiceDuration
      }, ...prev.history].slice(0, 100)
    }));
    
    triggerCelebration('Geübt!', `+${pointsEarned} Punkte für ${practiceDuration} Min Fokus`);
    
    setIsPracticeModalOpen(false);
    setPracticeDuration(25);
    setPracticeSubject("");
    setPracticeNote("");
  };

  const startQuizVsMatch = (difficulty: 'easy' | 'medium' | 'hard') => {
     let allQuestions = quizVsSubject === 'Mathe' ? MATH_QUIZ_QUESTIONS : quizVsSubject === 'Französisch' ? FRENCH_QUIZ_QUESTIONS : quizVsSubject === 'Deutsch' ? GERMAN_QUIZ_QUESTIONS : ENGLISH_QUIZ_QUESTIONS;
     const suitableQ = allQuestions.filter(q => q.difficulty === difficulty).sort(() => 0.5 - Math.random()).slice(0, 5);
     // Fallback if not enough questions available for the difficulty
     if (suitableQ.length < 5) {
        const extra = allQuestions.filter(q => !suitableQ.includes(q)).sort(() => 0.5 - Math.random()).slice(0, 5 - suitableQ.length);
        suitableQ.push(...extra);
     }
     const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
     setQuizVsSession({
        questions: suitableQ,
        currentIndex: 0,
        userScore: 0,
        botScore: 0,
        botName,
        difficulty,
        gameStatus: 'playing',
        questionWinner: null,
        selectedOptions: {}
     });
     setQuizVsView('play');
  };

  const handleQuizVsAnswer = (option: string) => {
     if (!quizVsSession || quizVsSession.gameStatus !== 'playing') return;
     const currentQ = quizVsSession.questions[quizVsSession.currentIndex];
     if (option === currentQ.correctAnswer) {
        setQuizVsSession(prev => {
          if (!prev) return prev;
          return {
             ...prev,
             userScore: prev.userScore + 1,
             gameStatus: 'question_finished',
             questionWinner: 'user'
          };
        });
     } else {
        setQuizVsSession(prev => {
          if (!prev) return prev;
          return {
             ...prev,
             botScore: prev.botScore + 1,
             gameStatus: 'question_finished',
             questionWinner: 'bot',
             selectedOptions: {
                ...prev.selectedOptions,
                [option]: true
             }
          };
        });
     }
  };

  const handleAddGoal = () => {
    const newGoal: PersonalGoal = {
      id: Math.random().toString(36).substr(2, 9),
      type: newGoalType,
      target: newGoalTarget,
      period: newGoalPeriod,
      createdAt: Date.now()
    };
    setProfile(prev => ({ ...prev, goals: [...(prev.goals || []), newGoal] }));
    setIsAddGoalModalOpen(false);
  };

  const claimGoal = (goal: PersonalGoal) => {
    const periodStart = getPeriodStart(goal.period);
    if (goal.lastClaimedAt && goal.lastClaimedAt >= periodStart) return; // already claimed for this period

    const points = getGoalReward(goal);
    setProfile(prev => {
      const now = Date.now();
      const goals = (prev.goals || []).map(g => g.id === goal.id ? { ...g, lastClaimedAt: now } : g);
      return {
        ...prev,
        goals,
        points: prev.points + points,
        history: [{
          id: Math.random().toString(36).substr(2, 9),
          type: 'challenge',
          value: 1,
          date: now,
          points,
          comment: 'Ziel erreicht!'
        }, ...prev.history].slice(0, 100)
      };
    });
    triggerCelebration('Ziel erreicht!', `+${points} Punkte`);
  };

  const removeGoal = (id: string) => {
    if (confirm('Möchtest du dieses Ziel wirklich löschen?')) {
      setProfile(prev => ({ ...prev, goals: (prev.goals || []).filter(g => g.id !== id) }));
    }
  };

  const handleJoinChallenge = (chalId: string) => {
    setProfile(prev => {
      if (!prev.multiplayer || !prev.multiplayer.onlineChallenges) return prev;
      const chals = prev.multiplayer.onlineChallenges.map(c => {
         if (c.id === chalId) {
            return {
               ...c,
               participants: [
                 ...c.participants,
                 { name: prev.name || "Du", score: 0, isBot: false, joinedAt: Date.now() }
               ]
            };
         }
         return c;
      });
      return { ...prev, multiplayer: { ...prev.multiplayer, onlineChallenges: chals } };
    });
  };

  const handleSubmitChallengeProgress = () => {
    if (!selectedChallengeId || challengeProgressInput <= 0) return;
    
    setProfile(prev => {
       if (!prev.multiplayer || !prev.multiplayer.onlineChallenges) return prev;
       let pointsEarned = 0;
       let challengeTitle = '';
       let challengeCompleted = false;

       const chals = prev.multiplayer.onlineChallenges.map(c => {
          if (c.id === selectedChallengeId) {
             const userP = c.participants.find(p => !p.isBot);
             if (userP) {
                const newScore = userP.score + challengeProgressInput;
                if (newScore >= c.target) {
                   challengeCompleted = true;
                   pointsEarned = c.rewardPoints;
                   challengeTitle = c.title;
                   return {
                      ...c,
                      participants: c.participants.map(p => !p.isBot ? { ...p, score: c.target } : p)
                   };
                } else {
                   return {
                      ...c,
                      participants: c.participants.map(p => !p.isBot ? { ...p, score: newScore } : p)
                   };
                }
             }
          }
          return c;
       }).filter(c => {
          if (c.id === selectedChallengeId && challengeCompleted) return false;
          return true;
       });

       const nextPrev = {
           ...prev,
           multiplayer: {
              ...prev.multiplayer,
              onlineChallenges: chals
           }
       };

       if (challengeCompleted) {
           triggerCelebration('Challenge geschafft!', `+${pointsEarned} XP`);
           return {
              ...nextPrev,
              points: nextPrev.points + pointsEarned,
              history: [{
                 id: Math.random().toString(36).substr(2, 9),
                 type: 'challenge',
                 value: 1,
                 date: Date.now(),
                 points: pointsEarned,
                 comment: `Online Challenge absolviert: ${challengeTitle}`
              }, ...nextPrev.history].slice(0, 100)
           };
       }

       return nextPrev;
    });

    setIsChallengeProgressModalOpen(false);
    setSelectedChallengeId(null);
    setChallengeProgressInput(0);
  };

  const addGradeResult = (grade: Grade) => {
    if (!selectedSubject) return;
    const multiplier = gradeType === 'vokabeltest' ? 0.2 : gradeType === 'test' ? 0.5 : 1;
    const points = Math.round(GRADE_POINTS[grade] * multiplier);
    const entry: HistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'grade',
      value: grade,
      points: points,
      date: Date.now(),
      subject: selectedSubject,
      comment: gradeType
    };

    setProfile(prev => ({
      ...prev,
      points: prev.points + points,
      history: [entry, ...prev.history].slice(0, 50)
    }));

    if (grade === 1) {
      triggerCelebration('Super Note!', 'Eine Eins! Wahnsinn!');
    } else if (grade === 2) {
      triggerCelebration('Toll!', 'Eine Zwei! Sehr gut gemacht.');
    }

    setIsGradeModalOpen(false);
    setSelectedSubject("");
  };

  const saveSettings = () => {
    setProfile(prev => ({ ...prev, name: tempName, gradeLevel: tempGrade }));
    setIsSettingsOpen(false);
  };

  const addDiaryEntry = () => {
    if (!diaryText.trim()) return;
    setProfile(prev => ({
      ...prev,
      diary: [
        {
          id: Math.random().toString(36).substr(2, 9),
          date: Date.now(),
          text: diaryText.trim()
        },
        ...(prev.diary || [])
      ]
    }));
    setDiaryText("");
  };

  const saveEstimatedGrade = (subject: string, grade: number) => {
    setProfile(prev => ({
      ...prev,
      estimatedGrades: {
        ...(prev.estimatedGrades || {}),
        [subject]: grade
      }
    }));
    setEditingSubject(null);
  };

  const addScheduleSlot = () => {
    if (!newSlot.subject) return;
    
    const slot: ScheduleSlot = {
      id: Math.random().toString(36).substr(2, 9),
      subject: newSlot.subject,
      time: newSlot.time || ''
    };

    setProfile(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [isAddSlotOpen.day]: [...(prev.schedule[isAddSlotOpen.day] || []), slot].sort((a, b) => a.time.localeCompare(b.time))
      }
    }));

    setNewSlot({ subject: '', time: '' });
    setIsAddSlotOpen({ open: false, day: 0 });
  };

  const deleteScheduleSlot = (day: number, id: string) => {
    setProfile(prev => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: prev.schedule[day].filter(s => s.id !== id)
      }
    }));
  };

  const openGradeModal = () => {
    setIsGradeModalOpen(true);
    setSelectedSubject(""); // Reset selection
    setGradeType('arbeit');
  };
  
  const handleAuth = (username: string, returnedProfile: UserProfile) => {
    localStorage.setItem('auth_username', username);
    setAuthUsername(username);
    setProfile(returnedProfile);
    setTempName(returnedProfile.name);
    setTempGrade(returnedProfile.gradeLevel);
  };

  const logout = () => {
    localStorage.removeItem('auth_username');
    setAuthUsername(null);
  };

  if (!authUsername) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-32 transition-colors duration-300 ${isDevMode ? 'ring-[12px] ring-amber-500/10 ring-inset' : ''}`}>
      {isDevMode && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-[10px] font-black uppercase tracking-[0.2em] text-center py-1 flex items-center justify-center gap-4 px-4 overflow-hidden">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 2 }} className="flex items-center gap-1">
            <Terminal className="w-3 h-3" />
            DEVELOPER MODE ACTIVE — UNAUTHORIZED ACCESS PROHIBITED
            <Terminal className="w-3 h-3" />
          </motion.div>
          <div className="flex-1 overflow-hidden whitespace-nowrap opacity-30 select-none hidden sm:block">
            {Array(10).fill('DEBUG_SESSION_LOG_ENTRY_ID_0x7F2A_SYSTEM_OVERRIDE_ACTIVE').join(' | ')}
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 px-4 py-4 md:px-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Trophy className="text-primary w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight uppercase tracking-tight text-slate-900 dark:text-white transition-colors">
                {activeTab === 'dashboard' ? 'Road to Success' : activeTab === 'schedule' ? 'Stundenplan' : activeTab === 'stats' ? 'Statistiken' : 'Erfolge'}
              </h1>
              <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold flex items-center gap-2">
                {profile.gradeLevel} • {profile.name}
                {isSyncing && <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="inline-block"><Clock className="w-3 h-3 text-primary" /></motion.span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsDark(!isDark)}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={toggleFullscreen}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              title="Vollbild umschalten"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
            <button 
              id="settings-btn"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Greeting */}
              <div className="space-y-1 px-2 pt-2">
                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Heute ist {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                  Willkommen zurück, {profile.name}!
                </h2>
              </div>

              {/* Progress Card */}
              <section className="card space-y-6 overflow-hidden relative" id="progress-card">
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="space-y-1 py-1">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Aktueller Rang</span>
                    <div className="flex items-center gap-2">
                      <span className="text-3xl">{currentRank.icon}</span>
                      <h2 className={`text-2xl font-display font-bold ${currentRank.color}`}>
                        {currentRank.name}
                      </h2>
                    </div>
                  </div>
                  <div className="text-center py-1">
                    <span className="flex items-center justify-center gap-1 block text-2xl font-display font-bold text-orange-500 dark:text-orange-400">
                      <Flame className="w-5 h-5 -mt-0.5" /> {profile.streak}
                    </span>
                    <span className="text-[10px] font-bold text-orange-400/80 uppercase tracking-widest">Streak</span>
                  </div>
                  <div className="text-right py-1">
                    <span className="block text-2xl font-display font-bold text-slate-900 dark:text-white">{profile.points}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Punkte</span>
                  </div>
                </div>

                <div className="space-y-3 relative z-10">
                  <div className="flex justify-between items-end text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-400">Fortschritt</span>
                    <span className="text-primary">{nextRank ? `Nächster Rank: ${nextRank.name} (+${nextRank.min - profile.points})` : 'Maximaler Rank erreicht!'}</span>
                  </div>
                  <ProgressBar progress={rankProgress} color="bg-primary" />
                </div>
              </section>

              {/* Action Buttons */}
              <section className="space-y-4" id="actions">
                <div className="grid grid-cols-3 gap-3">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={openPartModal}
                    className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                    id="participation-btn"
                  >
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Hand className="text-blue-500 w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-sm text-center text-slate-900 dark:text-white transition-colors">Gemeldet</span>
                    <span className="text-[10px] text-blue-500 font-bold mt-1">+{PARTICIPATION_POINTS} Pkt</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsPracticeModalOpen(true)}
                    className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Dumbbell className="text-indigo-500 w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-sm text-center text-slate-900 dark:text-white transition-colors">Geübt</span>
                    <span className="text-[10px] text-indigo-500 font-bold mt-1">Bonuspunkte</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={openGradeModal}
                    className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                    id="grade-btn"
                  >
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <GraduationCap className="text-green-500 w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-sm text-center text-slate-900 dark:text-white transition-colors">Note</span>
                    <span className="text-[10px] text-green-500 font-bold mt-1">Bonuspunkte</span>
                  </motion.button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsDiaryOpen(true)}
                    className="flex items-center gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <BookOpen className="text-purple-500 w-5 h-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <span className="block font-display font-bold text-slate-900 dark:text-white truncate">Tagebuch</span>
                      <span className="text-[10px] text-purple-500 font-bold block truncate">Tagesrückblick</span>
                    </div>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsGradesOpen(true)}
                    className="flex items-center gap-3 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <TrendingUp className="text-orange-500 w-5 h-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <span className="block font-display font-bold text-slate-900 dark:text-white truncate">Noten</span>
                      <span className="text-[10px] text-orange-500 font-bold block truncate">Prognose</span>
                    </div>
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsTimerOpen(true)}
                  className="w-full flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Timer className="text-indigo-500 w-6 h-6" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <span className="block font-display font-bold text-slate-900 dark:text-white truncate">Study Timer</span>
                    <span className="text-[10px] text-indigo-500 font-bold block truncate">Fokussiert lernen (+XP)</span>
                  </div>
                  <div className="text-right">
                     {isTimerActive ? (
                       <span className="text-sm font-bold text-primary tabular-nums tracking-tighter">{formatTime(timeLeft)}</span>
                     ) : (
                       <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 py-1 px-2 rounded-lg">Start</span>
                     )}
                  </div>
                </motion.button>
              </section>

              {/* Daily Challenge */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-slate-400" />
                    Daily Challenge
                  </h3>
                </div>
                <div className="space-y-3">
                  {dailyChallenges.map((challenge, i) => (
                    <div key={i} className="card py-4 px-5 flex items-center gap-4 border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                       <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${challenge.completed ? 'bg-primary/10 text-primary' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                         {challenge.completed ? <Award className="w-6 h-6" /> : <Target className="w-6 h-6" />}
                       </div>
                       <div className="flex-1">
                         <div className="flex justify-between items-center mb-1">
                           <p className="font-bold text-sm text-slate-900 dark:text-white">{challenge.title}</p>
                           <span className="text-xs font-bold text-primary">+{challenge.points} XP</span>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                             <div 
                               className={`h-full transition-all duration-500 ${challenge.completed ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`} 
                               style={{ width: `${(challenge.current / challenge.target) * 100}%` }} 
                             />
                           </div>
                           <span className="text-[10px] font-bold text-slate-400 w-8 text-right">{challenge.current} / {challenge.target}</span>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Meine Ziele */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-slate-400" />
                    Meine Ziele
                  </h3>
                  <button 
                    onClick={() => setIsAddGoalModalOpen(true)}
                    className="text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                  >
                    + Ziel hinzufügen
                  </button>
                </div>
                
                <div className="space-y-3">
                  {(!profile.goals || profile.goals.length === 0) ? (
                    <div className="text-center py-6 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50 dark:bg-slate-900/50">
                      <p className="text-slate-400 text-xs font-bold">Keine aktiven Ziele vorhanden.</p>
                      <button onClick={() => setIsAddGoalModalOpen(true)} className="mt-2 text-xs font-bold text-indigo-500 hover:underline">Jetzt Ziel erstellen</button>
                    </div>
                  ) : (
                    profile.goals.map((goal) => {
                      const progress = getGoalProgress(goal, profile);
                      const isTargetMet = progress >= goal.target;
                      const periodStart = getPeriodStart(goal.period);
                      const isClaimed = goal.lastClaimedAt ? goal.lastClaimedAt >= periodStart : false;
                      const title = goal.type === 'practice_minutes' ? `Üben (${goal.target} Min)` : `Melden (${goal.target} mal)`;
                      const icon = goal.type === 'practice_minutes' ? <Timer className="w-6 h-6" /> : <Hand className="w-6 h-6" />;
                      const reward = getGoalReward(goal);
                      
                      return (
                        <div key={goal.id} className="card py-4 px-5 flex items-center gap-4">
                          <button 
                            onClick={() => removeGoal(goal.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-slate-200 dark:bg-slate-700 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center text-slate-500 transition-colors z-10"
                            title="Ziel löschen"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isClaimed ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                            {isClaimed ? <Award className="w-6 h-6" /> : icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-1">
                              <p className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                {title}
                                <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex-shrink-0">
                                  {goal.period === 'daily' ? 'Tag' : goal.period === 'weekly' ? 'Woche' : 'Monat'}
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div 
                                  className={`h-full transition-all duration-500 ${isClaimed ? 'bg-indigo-500' : isTargetMet ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} 
                                  style={{ width: `${Math.min((progress / goal.target) * 100, 100)}%` }} 
                                />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 w-12 text-right">{progress} / {goal.target}</span>
                            </div>
                            
                            <div className="mt-2 flex justify-between items-center">
                              <span className="text-xs font-bold text-indigo-500">+{reward} XP</span>
                              {isTargetMet && !isClaimed && (
                                <button
                                  onClick={() => claimGoal(goal)}
                                  className="text-[10px] font-bold bg-indigo-500 text-white px-3 py-1 rounded-lg hover:bg-indigo-600 transition-colors shadow-md shadow-indigo-500/20"
                                >
                                  Einlösen!
                                </button>
                              )}
                              {isClaimed && (
                                <span className="text-[10px] font-bold text-green-500">Erledigt für diese Periode</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* History */}
              <section className="space-y-4" id="history-section">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <HistoryIcon className="w-4 h-4 text-slate-400" />
                    Letzte Aktivitäten
                  </h3>
                </div>

                <div className="space-y-3">
                  {profile.history.length === 0 ? (
                    <div className="text-center py-12 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                      <TrendingUp className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm font-medium">Noch keine Aktivitäten.</p>
                    </div>
                  ) : (
                    profile.history.map((entry) => (
                      <div key={entry.id} className="card flex items-center justify-between py-4 px-5">
                        <div className="flex items-center gap-4 relative">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            entry.type === 'participation' ? 'bg-blue-50 dark:bg-blue-500/10' : 
                            entry.type === 'challenge' ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-green-50 dark:bg-green-500/10'
                          }`}>
                            {entry.type === 'participation' ? <Hand className="w-5 h-5 text-blue-500" /> : 
                             entry.type === 'challenge' ? <Award className="w-5 h-5 text-orange-500" /> : <GraduationCap className="w-5 h-5 text-green-500" />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                              {entry.type === 'participation' ? 'Mitarbeit' : 
                               entry.type === 'challenge' ? 'Daily Challenge!' : `Note: ${entry.value}`}
                              {entry.subject && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-wider">{entry.subject}</span>}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                              {new Date(entry.date).toLocaleDateString()} um {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className={`font-display font-bold ml-4 ${entry.points >= 0 ? 'text-green-500' : 'text-danger'}`}>
                          {entry.points >= 0 ? '+' : ''}{entry.points}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div 
              key="schedule"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="card space-y-8">
                {DAYS.map((dayName, dayIndex) => (
                  <div key={dayName} className="space-y-4">
                    <div className="flex items-center justify-between border-l-4 border-primary pl-3">
                      <h3 className="font-display font-bold text-slate-900 dark:text-white uppercase tracking-wide">{dayName}</h3>
                      <button 
                        onClick={() => setIsAddSlotOpen({ open: true, day: dayIndex })}
                        className="bg-primary/5 hover:bg-primary/10 dark:bg-primary/20 dark:hover:bg-primary/30 text-primary p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {(!profile.schedule[dayIndex] || profile.schedule[dayIndex].length === 0) ? (
                        <p className="text-xs text-slate-400 font-medium italic pl-4">Keine Fächer eingetragen</p>
                      ) : (
                        profile.schedule[dayIndex].map((slot) => {
                          const pendingHomework = (profile.homework || []).filter(hw => hw.subject === slot.subject && !hw.completed);
                          const hasHomework = pendingHomework.length > 0;
                          const tmrw = new Date();
                          tmrw.setDate(tmrw.getDate() + 1);
                          const isTmrw = pendingHomework.some(hw => new Date(hw.dueDate).toDateString() === tmrw.toDateString());
                          const isToday = pendingHomework.some(hw => new Date(hw.dueDate).toDateString() === new Date().toDateString());
                          const isUrgent = isTmrw || isToday;
                          return (
                          <div 
                            key={slot.id} 
                            onClick={() => setSubjectDetails(slot.subject)}
                            className={`flex items-center justify-between p-3 rounded-2xl border group cursor-pointer hover:-translate-y-0.5 transition-all duration-300 ${hasHomework ? (isUrgent ? 'bg-red-50 dark:bg-red-900/10 border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.2)] hover:bg-red-100 dark:hover:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:bg-amber-100 dark:hover:bg-amber-900/20') : 'bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${hasHomework ? (isUrgent ? 'bg-red-100 dark:bg-red-800' : 'bg-amber-100 dark:bg-amber-800') : 'bg-white dark:bg-slate-900'}`}>
                                {hasHomework ? <BookOpen className={`w-4 h-4 ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} /> : <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{slot.subject}</p>
                                {slot.time && <p className={`text-[10px] font-bold uppercase ${hasHomework ? (isUrgent ? 'text-red-600/70 dark:text-red-400/70' : 'text-amber-600/70 dark:text-amber-400/70') : 'text-slate-400'}`}>{slot.time} Uhr</p>}
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteScheduleSlot(dayIndex, slot.id); }}
                              className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-600 hover:text-danger hover:bg-danger/10 rounded-full transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )})
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'stats' && (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Meldungen Chart */}
              <section className="card p-4 space-y-6">
                <div>
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 mb-1">Meldungen</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Die letzten 7 Tage</p>
                </div>
                
                <div className="h-64 w-full text-slate-600 dark:text-slate-400" id="stats-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={participationStats}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#94a3b8' : '#94a3b8', fontSize: 12, fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: isDark ? '1px solid #334155' : 'none',
                          backgroundColor: isDark ? '#0f172a' : '#fff',
                          color: isDark ? '#f8fafc' : '#000',
                          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 6, 6]}>
                        {participationStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isToday ? '#10b981' : (entry.count > 0 ? '#3b82f6' : (isDark ? '#334155' : '#e2e8f0'))} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              {/* Notendurchschnitt Chart */}
              {gradeStats.length > 0 && (
                <section className="card p-4 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 mb-1">Noten-Schnitt</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Zusammenfassung pro Fach</p>
                    </div>
                    <select 
                      value={statsTimeFilter} 
                      onChange={e => setStatsTimeFilter(e.target.value as any)}
                      className="bg-slate-50 dark:bg-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-1.5 outline-none border border-slate-100 dark:border-slate-700"
                    >
                      <option value="week">Woche</option>
                      <option value="month">Monat</option>
                      <option value="halfyear">Halbjahr</option>
                      <option value="all">Gesamt</option>
                    </select>
                  </div>
                  
                  <div className="h-56 w-full text-slate-600 dark:text-slate-400">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gradeStats}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: isDark ? '#94a3b8' : '#94a3b8', fontSize: 11, fontWeight: 600 }}
                          dy={10}
                        />
                        {/* Noten 1-6. Wir wollen 1 oben, 6 unten */}
                        <YAxis reversed domain={[1, 6]} hide />
                        <Tooltip 
                          cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className={`p-4 rounded-2xl shadow-xl ${isDark ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white border text-slate-900 border-slate-100'}`}>
                                  <p className="font-bold text-sm mb-1">{data.name}</p>
                                  <p className="text-xs">Ø Note: <span className="font-bold text-primary">{data.avg}</span></p>
                                  <div className="mt-3">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px] block mb-1">Noten-Verlauf</span>
                                    <div className="flex gap-1 flex-wrap max-w-[150px]">
                                      {data.grades.map((g: number, i: number) => (
                                        <span key={i} className={`w-6 h-6 flex items-center justify-center rounded-lg font-bold text-xs ${g <= 2.5 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500' : g <= 4.4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500'}`}>
                                          {g}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="avg" radius={[6, 6, 6, 6]}>
                          {gradeStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.avg <= 2.5 ? '#10b981' : entry.avg <= 4 ? '#f59e0b' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              <section className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ø Meldungen/Tag</span>
                  <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                    {(participationStats.reduce((acc, curr) => acc + curr.count, 0) / 7).toFixed(1)}
                  </p>
                </div>
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Meldungen total</span>
                  <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                    {profile.history.filter(h => h.type === 'participation').reduce((sum, h) => sum + (h.value || 1), 0)}
                  </p>
                </div>
                <div className="card p-5 space-y-2 col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Punkte</span>
                  <p className="text-2xl font-display font-bold text-primary">{profile.points}</p>
                </div>
              </section>

              {/* Beste Fächer Liste */}
              <section className="card p-4 space-y-4">
                <div className="flex flex-col space-y-3">
                  <div>
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 mb-1">Beste Fächer</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Deine Top-Fächer im Überblick</p>
                  </div>
                  
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 overflow-x-auto select-none no-scrollbar">
                    {[
                      { id: 'trend', label: 'Prognose', icon: TrendingUp },
                      { id: 'participations', label: 'Meldungen', icon: Hand },
                      { id: 'grades', label: 'Arbeiten', icon: GraduationCap },
                      { id: 'points', label: 'Punkte', icon: Trophy }
                    ].map(sort => (
                      <button
                        key={sort.id}
                        onClick={() => setBestSubjectsSort(sort.id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap
                          ${bestSubjectsSort === sort.id 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                          }`}
                      >
                        <sort.icon className="w-3.5 h-3.5" />
                        {sort.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 mt-2">
                  {bestSubjects.length > 0 ? bestSubjects.map((subj, idx) => (
                    <div key={subj.subject} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30' : 
                          idx === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700' : 
                          idx === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' :
                          'bg-white dark:bg-slate-900 text-slate-400 shadow-sm'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{subj.subject}</p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-0.5">
                            <span className="flex items-center gap-0.5"><Hand className="w-3 h-3 text-blue-500" /> {subj.participations}</span>
                            <span className="flex items-center gap-0.5"><GraduationCap className="w-3 h-3 text-green-500" /> {subj.gradesCount}</span>
                            <span className="flex items-center gap-0.5"><Trophy className="w-3 h-3 text-yellow-500" /> {subj.points}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-lg" style={{ color: subj.trend <= 2.5 ? '#10b981' : subj.trend <= 4.0 ? '#f59e0b' : '#ef4444' }}>
                          {subj.trend.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 text-center py-4 italic">Noch keine Fächer vorhanden.</p>
                  )}
                </div>
              </section>

              {/* Focus Stats */}
              <section className="card p-4 space-y-4">
                <div className="flex flex-col space-y-3">
                  <div>
                    <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 mb-1">Fokus & Timer</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">Deine Lern-Zeiten im Überblick</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-center">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-black">Insgesamt</p>
                    <p className="text-2xl font-display font-black text-indigo-600 dark:text-indigo-400">
                       {Math.floor(focusStats.totalMinutes / 60)}h {focusStats.totalMinutes % 60}m
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-center">
                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-black">Sessions</p>
                    <p className="text-2xl font-display font-black text-indigo-600 dark:text-indigo-400">
                       {focusStats.totalSessions}
                    </p>
                  </div>
                </div>

                {focusStats.bySubject.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2">Nach Fach</h4>
                    {focusStats.bySubject.filter(s => s.minutes > 0).slice(0, 5).map((subj, idx) => (
                      <div key={subj.subject} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">{subj.subject}</p>
                          <p className="text-[10px] font-bold text-slate-400">{subj.count} Sessions</p>
                        </div>
                        <p className="font-display font-bold text-sm text-indigo-500">
                          {Math.floor(subj.minutes / 60) > 0 && `${Math.floor(subj.minutes / 60)}h `}{subj.minutes % 60}m
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {focusStats.notes.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4 mb-2">Letzte Einträge</h4>
                    {focusStats.notes.slice(0, 3).map((note, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md">{note.subject}</span>
                          <span className="text-[10px] font-bold text-slate-400">{new Date(note.date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 italic">"{note.note}"</p>
                        <p className="text-[10px] font-bold text-slate-400 text-right mt-1">{note.duration} Min</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="card p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-yellow-50 dark:bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <Award className="w-8 h-8 text-yellow-500" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-900 dark:text-white">Fleiß-Zertifikat</h4>
                  <p className="text-sm text-slate-400 max-w-[200px]">Du bist auf dem Weg, {nextRank ? nextRank.name : 'eine absolute Legende'} zu werden!</p>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'achievements' && (
            <motion.div 
              key="achievements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Progress Header */}
              <div className="card p-6 flex items-center justify-between shadow-sm">
                <div>
                  <h3 className="text-xl font-bold font-display text-slate-800 dark:text-white">Deine Erfolge</h3>
                  <p className="text-sm text-slate-500 font-medium">{achievementProgress.unlocked} von {achievementProgress.total} freigeschaltet</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(achievementProgress.unlocked / achievementProgress.total) * 100}%` }}
                      className="h-full bg-primary"
                    />
                  </div>
                  <span className="text-sm font-bold text-primary">{Math.round((achievementProgress.unlocked / achievementProgress.total) * 100)}%</span>
                </div>
              </div>

              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sortedAchievements.map((achievement) => {
                  const unlocked = achievement.condition(profile);
                  return (
                    <div 
                      key={achievement.id}
                      className={`relative overflow-hidden p-6 rounded-3xl border-2 transition-all duration-300 ${
                        unlocked 
                          ? 'bg-white dark:bg-slate-900 border-primary/20 shadow-lg shadow-primary/5 hover:shadow-xl hover:-translate-y-1' 
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60 grayscale'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${unlocked ? 'bg-primary/10' : 'bg-slate-200 dark:bg-slate-800'}`}>
                          {achievement.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-display font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                            {achievement.title}
                            {!unlocked && <Lock className="w-4 h-4 text-slate-400" />}
                          </h4>
                          <p className="text-sm font-medium text-slate-500 mt-1 leading-relaxed">
                            {achievement.description}
                          </p>
                        </div>
                      </div>
                      {unlocked && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute -top-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"
                        />
                      )}
                    </div>
                  );
                })}
              </section>
            </motion.div>
          )}
          {activeTab === 'multiplayer' && (
            <motion.div 
              key="multiplayer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="card p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 ${profile.multiplayer ? LEAGUES[profile.multiplayer.leagueLevel].border + ' ' + LEAGUES[profile.multiplayer.leagueLevel].bg : ''}`}>
                  <Trophy className={`w-12 h-12 ${profile.multiplayer ? LEAGUES[profile.multiplayer.leagueLevel].color : ''}`} />
                </div>
                <div>
                  <h2 className="text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {profile.multiplayer ? LEAGUES[profile.multiplayer.leagueLevel].name : 'Laden...'}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">Endet diesen Sonntag um Mitternacht</p>
                </div>
                {profile.multiplayer?.lastResults && (
                   <div className="mt-2 text-sm px-5 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 font-bold">
                     Letzte Woche: Platz {profile.multiplayer.lastResults.rank} - {profile.multiplayer.lastResults.promoted ? 'Aufgestiegen! 🎉' : profile.multiplayer.lastResults.relegated ? 'Abgestiegen 😢' : 'Klassenerhalt'}
                   </div>
                )}
              </div>
              
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                <button
                  onClick={() => setMultiplayerViewMode('standings')}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${multiplayerViewMode === 'standings' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Aktuell
                </button>
                <button
                  onClick={() => setMultiplayerViewMode('stats')}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${multiplayerViewMode === 'stats' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Statistiken
                </button>
              </div>
              
              {multiplayerViewMode === 'standings' ? (
                <div className="space-y-3">
                  <div className="px-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                     <span className="flex-1">Platzierung</span>
                     <span className="flex-none">Wochenpunkte</span>
                  </div>
                  {multiplayerStandings.map((player, index) => (
                    <div key={`${player.name}-${index}`} className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden hover:shadow-md hover:-translate-y-0.5 ${
                       player.isUser ? 'bg-primary/10 border-primary/30 shadow-md' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                    }`}>
                      {index < 3 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500 rounded-l-2xl"></div>}
                      {index > 6 && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 rounded-l-2xl"></div>}
                      
                      <div className="flex items-center gap-4 pl-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          index === 0 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 ring-2 ring-yellow-400/50' :
                          index === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 ring-2 ring-slate-400/50' :
                          index === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 ring-2 ring-orange-400/50' :
                          'bg-slate-50 dark:bg-slate-800 text-slate-400'
                        }`}>
                           {index + 1}
                        </div>
                        <span className={`font-bold text-sm ${player.isUser ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                           {player.name} {player.isUser ? ' (Du)' : ''}
                        </span>
                      </div>
                      <span className="font-display font-bold text-xl text-slate-900 dark:text-white tracking-tight">
                        {player.points.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="card p-6 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Historische Ränge</h3>
                        <p className="text-xs text-slate-500">Dein Abschlussrang der letzten Wochen</p>
                      </div>
                    </div>
                    {(!profile.multiplayer?.leagueHistory || profile.multiplayer.leagueHistory.length === 0) ? (
                      <div className="py-12 text-center flex flex-col items-center opacity-50">
                        <BarChart3 className="w-12 h-12 mb-3 text-slate-400" />
                        <p className="text-sm font-bold text-slate-500">Noch keine Daten vorhanden</p>
                        <p className="text-xs text-slate-400">Beende eine Woche, um hier Statistiken zu sehen.</p>
                      </div>
                    ) : (
                      <div className="h-48 w-full -ml-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={profile.multiplayer?.leagueHistory.map((h, i) => ({ 
                            name: `W${i+1}`, 
                            rank: h.rank,
                            league: h.leagueName
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} 
                              dy={10} 
                            />
                            <YAxis 
                              reversed={true} 
                              domain={[1, 10]} 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} 
                              dx={-10}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                borderRadius: '12px', 
                                border: 'none',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                color: isDark ? '#f8fafc' : '#0f172a',
                                fontWeight: 'bold'
                              }}
                              formatter={(value: any, name: any, props: any) => [
                                `${value}. Platz (${props.payload.league})`, 'Rang'
                              ]}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="rank" 
                              stroke="#3b82f6" 
                              strokeWidth={3}
                              dot={{ r: 4, strokeWidth: 2, fill: isDark ? '#1e293b' : '#ffffff' }}
                              activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                  
                  <div className="card p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                        <Medal className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Aktuelle Erzrivalen</h3>
                        <p className="text-xs text-slate-500">Die stärksten Gegner deiner Liga</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {multiplayerStandings.filter(p => !p.isUser).slice(0, 3).map((bot, i) => (
                        <div key={bot.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                           <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                               #{i+1}
                             </div>
                             <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{bot.name}</span>
                           </div>
                           <span className="text-xs font-bold text-slate-500">{Math.round(bot.points).toLocaleString()} Pkt</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'online-challenges' && (
            <motion.div 
              key="online-challenges"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col gap-2 relative z-10 block mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/20 p-2 rounded-xl text-primary drop-shadow-sm">
                    <Globe className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                  <div className="flex flex-1 items-center justify-between">
                    <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white tracking-tight drop-shadow-sm">
                      Online Challenges
                    </h1>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-500 font-medium sm:text-lg">
                    Miss dich mit anderen Schülern weltweit
                  </p>
                </div>
              </div>

              {profile.multiplayer?.onlineChallenges?.length ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...(profile.multiplayer.onlineChallenges || [])].sort((a,b) => {
                     const aHas = a.participants.some(p => !p.isBot);
                     const bHas = b.participants.some(p => !p.isBot);
                     if (aHas && !bHas) return -1;
                     if (!aHas && bHas) return 1;
                     return 0;
                  }).map(chal => {
                    const userParticipant = chal.participants.find(p => !p.isBot);
                    const userScore = userParticipant?.score || 0;
                    
                    const displayParticipants = [...chal.participants].sort((a,b) => b.score - a.score);
                    const userRank = displayParticipants.findIndex(p => !p.isBot) + 1;
                    
                    return (
                      <div key={chal.id} className="card p-6 border-2 border-transparent hover:border-indigo-500/20 transition-all flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/10 to-transparent rounded-bl-full pointer-events-none" />
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{chal.title}</h3>
                            <p className="text-xs font-bold text-slate-400 mt-1">Host: @{chal.host}</p>
                          </div>
                          <div className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                            <Trophy className="w-3 h-3" />
                            {chal.rewardPoints} XP
                          </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 flex-1 relative z-10">
                          {chal.description}
                        </p>
                        
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl relative z-10">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                            <span>Live Ranking ({chal.target} Ziel)</span>
                            <span className="flex items-center gap-1 text-green-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse mt-0.5" />
                              Live
                            </span>
                          </h4>
                          {displayParticipants.slice(0, 3).map((p, i) => (
                            <div key={i} className={`flex items-center justify-between text-sm ${!p.isBot ? 'font-bold text-indigo-500' : 'text-slate-700 dark:text-slate-300'}`}>
                              <span className="flex items-center gap-2">
                                <span className="w-4 inline-block text-slate-400 text-xs font-bold">{i+1}.</span> 
                                <span className={!p.isBot ? '' : 'truncate max-w-[100px]'}>{p.name}</span>
                                {!p.isBot && <span className="text-[10px] bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 px-1.5 py-0.5 rounded ml-1">Du</span>}
                              </span>
                              <span className="font-bold font-mono text-xs">{p.score} <span className="text-[9px] text-slate-400">/ {chal.target}</span></span>
                            </div>
                          ))}
                          {userParticipant && userRank > 3 && (
                            <>
                              <div className="text-center text-slate-300 dark:text-slate-600 text-xs py-1">⋮</div>
                              <div className="flex items-center justify-between text-sm font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 -mx-2 px-2 py-1 rounded-lg">
                                <span className="flex items-center gap-2">
                                  <span className="w-4 inline-block text-indigo-400 text-xs">{userRank}.</span> 
                                  <span>{profile.name || "Du"}</span>
                                  <span className="text-[10px] bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 px-1.5 py-0.5 rounded ml-1">Du</span>
                                </span>
                                <span className="font-mono text-xs">{userParticipant.score} <span className="text-[9px] text-slate-400">/ {chal.target}</span></span>
                              </div>
                            </>
                          )}
                        </div>
                        
                        <div className="mt-4 flex flex-col gap-2 relative z-10">
                          {!userParticipant ? (
                             <button
                               onClick={() => handleJoinChallenge(chal.id)}
                               className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold py-3 rounded-xl transition-transform active:scale-95"
                             >
                               Teilnehmen
                             </button>
                          ) : (
                             <button
                               onClick={() => {
                                  if (userParticipant.joinedAt && new Date(userParticipant.joinedAt).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0)) {
                                     alert('Du kannst erst am nächsten Tag nach dem Beitritt Fortschritt eintragen!');
                                     return;
                                  }
                                  setSelectedChallengeId(chal.id);
                                  setIsChallengeProgressModalOpen(true);
                                  setChallengeProgressInput(0);
                               }}
                               className={`w-full font-bold py-3 rounded-xl transition-all shadow-lg ${
                                 userParticipant.joinedAt && new Date(userParticipant.joinedAt).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0)
                                   ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed shadow-none'
                                   : 'bg-indigo-500 text-white active:scale-95 shadow-indigo-500/20 hover:bg-indigo-600'
                               }`}
                             >
                               {userParticipant.joinedAt && new Date(userParticipant.joinedAt).setHours(0,0,0,0) >= new Date().setHours(0,0,0,0)
                                 ? 'Morgen Fortschritt eintragen'
                                 : 'Fortschritt eintragen'}
                             </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="card p-12 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Globe className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Keine Challenges aktiv</h3>
                  <p className="text-slate-500">Sobald die nächste Liga-Woche beginnt, findest du hier neue Host-Challenges von anderen Spielern.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'dev' && isDevMode && (
            <motion.div 
              key="dev"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="card p-8 bg-slate-900 text-white border-none shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Terminal size={120} />
                </div>
                <h2 className="text-3xl font-display font-black uppercase tracking-tighter mb-2 italic">Developer Console</h2>
                <p className="text-slate-400 font-mono text-sm">v1.2.0-debug | root@road-to-success</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="card p-6 space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Zap className="text-amber-500 w-5 h-5" />
                    Wirtschaft & Punkte
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleDevPointsChange(100)} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-primary hover:text-white transition-all text-xs">+100</button>
                    <button onClick={() => handleDevPointsChange(1000)} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-primary hover:text-white transition-all text-xs">+1k</button>
                    <button onClick={() => handleDevPointsChange(10000)} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-primary hover:text-white transition-all text-xs">+10k</button>
                    <button onClick={() => handleDevPointsChange(-1000)} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold hover:bg-danger hover:text-white transition-all text-xs text-danger">-1k</button>
                  </div>
                </div>

                <div className="card p-6 space-y-4">
                  <h3 className="font-bold flex items-center gap-2">
                    <Calendar className="text-primary w-5 h-5" />
                    Zeit-Simulation
                  </h3>
                  <button onClick={handleDevSkipDay} className="w-full py-4 bg-slate-100 dark:bg-slate-800 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary/10 transition-all border-2 border-transparent hover:border-primary/20 group">
                    <TrendingUp className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    Tag überspringen (+1 Streak)
                  </button>
                </div>
              </div>

              <div className="card p-6 space-y-4">
                <h3 className="font-bold text-danger flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Gefahrenbereich
                </h3>
                <div className="p-4 bg-danger/5 border border-danger/20 rounded-2xl">
                  <p className="text-xs text-danger font-medium">Diese Aktionen verändern die Datenbank permanent.</p>
                </div>
                <button
                  onClick={() => {
                     setProfile(prev => ({
                        ...prev,
                        multiplayer: initMultiplayerData(prev.multiplayer?.leagueLevel || 0, getMonday(Date.now()))
                     }));
                     triggerCelebration("Challenges generiert", "Entwickler-Feature");
                  }}
                  className="w-full py-4 border-2 border-indigo-500/20 text-indigo-500 font-bold rounded-2xl hover:bg-indigo-500 hover:text-white transition-all mb-4"
                >
                  Challenges neu generieren
                </button>
                <button 
                  onClick={() => {
                    if (devResetClicks < 4) {
                      setDevResetClicks(prev => prev + 1);
                    } else {
                      const confirmReset = window.confirm("Bist du sicher, dass du alle Daten löschen willst? Dies kann nicht rückgängig gemacht werden.");
                      if (confirmReset) {
                        localStorage.clear();
                        window.location.reload();
                      } else {
                        setDevResetClicks(0);
                      }
                    }
                  }}
                  className="w-full py-4 border-2 border-danger/20 text-danger font-bold rounded-2xl hover:bg-danger hover:text-white transition-all"
                >
                  Hard Reset (Local Data) {devResetClicks > 0 && `(${5 - devResetClicks} Klicks übrig)`}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 pb-safe">
        <div className="max-w-2xl mx-auto px-2 sm:px-6 h-20 flex items-center justify-around flex-row">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'schedule', icon: Calendar, label: 'Plan' },
            { id: 'multiplayer', icon: Trophy, label: 'Ligen' },
            { id: 'stats', icon: BarChart3, label: 'Stats' },
            { id: 'achievements', icon: Medal, label: 'Erfolge' },
            ...(isDevMode ? [{ id: 'dev', icon: Terminal, label: 'Dev' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative p-2 sm:py-2 sm:px-6 rounded-2xl cursor-pointer group flex-1 sm:flex-none ${
                activeTab === tab.id ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="nav-bg"
                  className="absolute inset-0 bg-primary/5 dark:bg-primary/10 rounded-2xl"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className={`w-6 h-6 transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110 group-hover:-translate-y-0.5'}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest transition-transform duration-300 group-hover:translate-y-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Modals */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div key="modal-sidebar" className="fixed inset-0 z-[60] flex">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-72 max-w-[80vw] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col z-10"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Trophy className="text-primary w-5 h-5" />
                  </div>
                  <span className="font-display font-bold text-lg text-slate-900 dark:text-white">Road to Success</span>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4">
                <div className="px-4 space-y-1">
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Spielen</p>
                  </div>
                  
                  <button onClick={() => { setActiveTab('multiplayer'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${activeTab === 'multiplayer' ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                    <Users className="w-5 h-5" />
                    <div className="flex-1">
                      <span className="font-bold flex items-center gap-2">Multiplayer Ligen</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <button onClick={() => { setActiveTab('online-challenges'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${activeTab === 'online-challenges' ? 'text-primary' : 'text-slate-600 dark:text-slate-300'}`}>
                    <Globe className="w-5 h-5" />
                    <div className="flex-1">
                      <span className="font-bold flex items-center gap-2">Online Challenges</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>

                  <div className="px-3 py-2 mt-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Schule</p>
                  </div>
                  <button onClick={() => { setIsHomeworkOpen(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group text-slate-600 dark:text-slate-300">
                    <BookOpen className="w-5 h-5" />
                    <div className="flex-1">
                      <span className="font-bold flex items-center gap-2">Hausaufgaben</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button onClick={() => { setIsVocabOpen(true); setVocabView('lists'); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group text-slate-600 dark:text-slate-300">
                    <Languages className="w-5 h-5" />
                    <div className="flex-1">
                      <span className="font-bold flex items-center gap-2">Vokabeln</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button onClick={() => { setIsCalendarOpen(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group text-slate-600 dark:text-slate-300">
                    <Calendar className="w-5 h-5" />
                    <div className="flex-1">
                      <span className="font-bold flex items-center gap-2">Kalender</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button onClick={() => { setIsQuizVsOpen(true); setQuizVsView('subject_select'); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20 group text-indigo-600 dark:text-indigo-400">
                    <Swords className="w-5 h-5" />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold">Versus Mode</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">Beta</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button onClick={() => { setIsSocialOpen(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-colors hover:bg-pink-50 dark:hover:bg-pink-900/20 group text-pink-600 dark:text-pink-400">
                    <Smartphone className="w-5 h-5" />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="font-bold">Social FYP</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400 px-2 py-0.5 rounded-full border border-pink-200 dark:border-pink-800">Beta</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isHomeworkOpen && (
          <div key="modal-homework" className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 flex flex-col pt-safe pb-safe"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                 <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
                   <BookOpen className="w-6 h-6 text-primary" />
                   Hausaufgaben
                 </h2>
                 <button onClick={() => setIsHomeworkOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                   <X className="w-6 h-6 text-slate-400" />
                 </button>
              </div>

              {!isAddingHomework ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[env(safe-area-inset-bottom)]">
                    {!(profile.homework?.filter(h => !h.completed)?.length) ? (
                      <div className="flex flex-col items-center justify-center h-full text-center mt-10">
                        <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Keine Hausaufgaben</h3>
                        <p className="text-slate-500">Du hast alles erledigt! Zurücklehnen und entspannen.</p>
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto space-y-3">
                        {[...(profile.homework || [])].filter(h => !h.completed).sort((a,b) => a.dueDate - b.dueDate).map(hw => {
                          const dateObj = new Date(hw.dueDate);
                          const isToday = new Date().toDateString() === dateObj.toDateString();
                          const isTmrw = (() => {
                             const tmrw = new Date();
                             tmrw.setDate(tmrw.getDate() + 1);
                             return tmrw.toDateString() === dateObj.toDateString();
                          })();

                          return (
                            <div key={hw.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-700 shadow-sm">
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-lg">{hw.subject}</h4>
                                {hw.task && <p className="text-slate-600 dark:text-slate-300">{hw.task}</p>}
                                <span className={`text-sm font-bold ${isTmrw || isToday ? 'text-danger' : 'text-slate-500'} mt-1 block`}>
                                  {isToday ? "Bis heute" : isTmrw ? "Bis morgen" : `Bis ${dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}`}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  setProfile(prev => ({
                                    ...prev,
                                    points: prev.points + 10,
                                    history: [
                                      {
                                        id: Math.random().toString(36).substr(2, 9),
                                        date: Date.now(),
                                        type: 'homework',
                                        points: 10,
                                        value: 10,
                                        comment: `Hausaufgabe erledigt: ${hw.subject}`
                                      },
                                      ...prev.history
                                    ],
                                    homework: (prev.homework || []).map(h => h.id === hw.id ? { ...h, completed: true } : h)
                                  }));
                                  triggerCelebration("Hausaufgabe erledigt!", "+10 Punkte gesammelt");
                                }}
                                className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:bg-success hover:text-white hover:border-success transition-all cursor-pointer bg-slate-50 dark:bg-slate-900"
                              >
                                <Check className="w-6 h-6" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="p-4 sm:p-6 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <button 
                      onClick={() => {
                         setIsAddingHomework(true);
                         setHomeworkSubject('');
                         setHomeworkTask('');
                         const d = new Date();
                         d.setDate(d.getDate() + 1);
                         setHomeworkDate(d.toISOString().split('T')[0]);
                      }}
                      className="w-full max-w-2xl mx-auto block bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Neue Hausaufgabe
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col p-4 sm:p-6 max-w-2xl w-full mx-auto pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                  <div className="space-y-8 flex-1 overflow-y-auto hide-scrollbar">
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Fach auswählen</label>
                      <div className="flex flex-wrap gap-2">
                        {getAvailableSubjects(profile).map(subj => (
                          <button
                            key={subj}
                            onClick={() => setHomeworkSubject(subj)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${homeworkSubject === subj ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
                          >
                            {subj}
                          </button>
                        ))}
                      </div>
                      {!getAvailableSubjects(profile).includes(homeworkSubject) && (
                        <input 
                          type="text" 
                          value={homeworkSubject}
                          onChange={(e) => setHomeworkSubject(e.target.value)}
                          placeholder="Anderes Fach..."
                          className="mt-3 w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Aufgabe (Optional)</label>
                      <input 
                        type="text" 
                        value={homeworkTask}
                        onChange={(e) => setHomeworkTask(e.target.value)}
                        placeholder="z.B. S. 42 Nr. 3 oder Vokabeln..."
                        className="w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Bis wann?</label>
                      <div className="flex overflow-x-auto pb-4 gap-3 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                        {Array.from({length: 14}).map((_, i) => {
                           const d = new Date();
                           d.setDate(d.getDate() + i + 1);
                           const dateString = d.toISOString().split('T')[0];
                           const isSelected = homeworkDate === dateString;
                           
                           let label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                           if (i === 0) label = 'Morgen';
                           
                           return (
                             <button
                               key={dateString}
                               onClick={() => setHomeworkDate(dateString)}
                               className={`flex-shrink-0 flex flex-col items-center justify-center py-3 px-5 rounded-2xl border-2 transition-all cursor-pointer ${isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                             >
                               <span className="font-bold whitespace-nowrap">{label}</span>
                             </button>
                           );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 shrink-0 pt-4 mt-auto">
                    <button 
                      onClick={() => setIsAddingHomework(false)}
                      className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                    >
                      Abbrechen
                    </button>
                    <button 
                      onClick={() => {
                        if (homeworkSubject.trim() && homeworkDate) {
                          setProfile(prev => ({
                            ...prev,
                            homework: [
                              ...(prev.homework || []),
                              {
                                id: Math.random().toString(36).substr(2, 9),
                                subject: homeworkSubject.trim(),
                                task: homeworkTask.trim(),
                                dueDate: new Date(homeworkDate).getTime(),
                                createdAt: Date.now(),
                                completed: false
                              }
                            ]
                          }));
                          setIsAddingHomework(false);
                        }
                      }}
                      disabled={!homeworkSubject.trim() || !homeworkDate}
                      className="flex-[2] bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                    >
                      Hinzufügen
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {isCalendarOpen && (
          <div key="modal-calendar" className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 flex flex-col pt-safe pb-safe"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                 <div className="flex items-center gap-3">
                   {selectedCalendarDate && (
                     <button onClick={() => setSelectedCalendarDate(null)} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                       <ChevronRight className="w-6 h-6 text-slate-400 rotate-180" />
                     </button>
                   )}
                   <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                     <Calendar className="w-6 h-6 text-indigo-500" />
                     {selectedCalendarDate ? selectedCalendarDate.toLocaleDateString() : 'Kalender'}
                   </h2>
                 </div>
                 <button onClick={() => { setIsCalendarOpen(false); setSelectedCalendarDate(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                   <X className="w-6 h-6 text-slate-400" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full">
                {!selectedCalendarDate ? (
                   <div>
                      <div className="flex justify-between items-center mb-6">
                        <button onClick={() => {
                          const newer = new Date(calendarDate);
                          newer.setMonth(newer.getMonth() - 1);
                          setCalendarDate(newer);
                        }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full">
                           <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="font-bold text-lg dark:text-white">
                          {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => {
                          const newer = new Date(calendarDate);
                          newer.setMonth(newer.getMonth() + 1);
                          setCalendarDate(newer);
                        }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full">
                           <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
                        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
                          <div key={d} className="text-center font-bold text-slate-400 text-sm py-2">{d}</div>
                        ))}
                        {(() => {
                          const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
                          const firstDay = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
                          const shift = firstDay === 0 ? 6 : firstDay - 1;
                          
                          const cells = [];
                          for (let i = 0; i < shift; i++) {
                            cells.push(<div key={`empty-${i}`} className="p-2" />);
                          }
                          for (let i = 1; i <= daysInMonth; i++) {
                            const dateObj = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i);
                            const tstamp = dateObj.setHours(0,0,0,0);
                            const isToday = new Date().setHours(0,0,0,0) === tstamp;
                            
                            const dayEvents = (profile.calendarEvents || []).filter(e => new Date(e.date).setHours(0,0,0,0) === tstamp);
                            
                            cells.push(
                              <button 
                                key={`day-${i}`}
                                onClick={() => {
                                   setSelectedCalendarDate(dateObj);
                                   setIsAddingEvent(false);
                                }}
                                className={`aspect-square p-1 sm:p-2 rounded-xl flex flex-col items-center border ${isToday ? 'border-primary outline-primary outline-2 bg-primary/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'} relative`}
                              >
                                <span className={`text-sm sm:text-base font-bold ${isToday ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{i}</span>
                                {dayEvents.length > 0 && (
                                  <div className="mt-1 flex gap-0.5 max-w-full flex-wrap justify-center overflow-hidden">
                                    {dayEvents.slice(0, 3).map((e, idx) => (
                                      <div key={idx} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${e.type === 'exam' ? 'bg-danger' : 'bg-indigo-500'}`} />
                                    ))}
                                    {dayEvents.length > 3 && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-400" />}
                                  </div>
                                )}
                              </button>
                            );
                          }
                          return cells;
                        })()}
                      </div>
                   </div>
                ) : (
                   <div className="space-y-6">
                      {/* Day Subjects */}
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-sm flex items-center gap-2">
                           <BookOpen className="w-4 h-4 text-slate-400" />
                           Fächer an diesem Tag
                        </h3>
                        {(() => {
                           const dayOfWeek = selectedCalendarDate.getDay();
                           // 0 = Sunday, 1 = Monday. We mapped schedule as 0 = Mon, 4 = Fri.
                           // Skip weekend.
                           if (dayOfWeek === 0 || dayOfWeek === 6) {
                             return <div className="text-slate-500 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl">Wochenende!</div>;
                           }
                           const scheduleDay = dayOfWeek - 1;
                           const slots = profile.schedule[scheduleDay] || [];
                           if (slots.length === 0) return <div className="text-slate-500 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl">Kein Stundenplan eingetragen.</div>;
                           
                           return (
                             <div className="flex flex-wrap gap-2">
                               {slots.map((s, idx) => (
                                 <span key={idx} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-700">
                                   {s.subject}
                                 </span>
                               ))}
                             </div>
                           );
                        })()}
                      </div>
                      
                      {/* Day Events */}
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 uppercase tracking-wider text-sm flex items-center gap-2">
                           <ListTodo className="w-4 h-4 text-slate-400" />
                           Einträge
                        </h3>
                        {(() => {
                           const tstamp = selectedCalendarDate.setHours(0,0,0,0);
                           const dayEvents = (profile.calendarEvents || []).filter(e => new Date(e.date).setHours(0,0,0,0) === tstamp);
                           if (dayEvents.length === 0) return <div className="text-slate-500 bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl text-sm italic">Keine Arbeiten oder Termine eingetragen.</div>;
                           
                           return (
                             <div className="space-y-3">
                               {dayEvents.map(e => (
                                 <div key={e.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl shadow-sm flex items-start justify-between">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${e.type === 'exam' ? 'bg-danger/10 text-danger' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                                          {e.type === 'exam' ? 'Arbeit/Test' : 'Termin'}
                                        </span>
                                      </div>
                                      <span className="font-bold text-slate-900 dark:text-white">{e.title}</span>
                                      {e.reminderDate && (
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                          <Bell className="w-3 h-3" /> Erinnerung am {new Date(e.reminderDate).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                    <button onClick={() => {
                                       setProfile(p => ({
                                          ...p,
                                          calendarEvents: (p.calendarEvents || []).filter(ev => ev.id !== e.id)
                                       }));
                                    }} className="p-2 hover:bg-danger/10 text-slate-400 hover:text-danger rounded-lg transition-colors">
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </div>
                               ))}
                             </div>
                           );
                        })()}
                      </div>
                      
                      {/* Add Event Form */}
                      {!isAddingEvent ? (
                        <button onClick={() => setIsAddingEvent(true)} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 py-4 rounded-2xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <Plus className="w-5 h-5" /> Eintrag hinzufügen
                        </button>
                      ) : (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-bold text-slate-900 dark:text-white mb-4">Neuer Eintrag</h4>
                          
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Titel / Fach</label>
                              <input 
                                type="text"
                                value={newEventTitle}
                                onChange={e => setNewEventTitle(e.target.value)}
                                placeholder="z.B. Klassenarbeit Mathe"
                                className="w-full bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Typ</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setNewEventType('exam')}
                                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors border ${newEventType === 'exam' ? 'bg-danger text-white border-danger' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'} `}
                                >
                                  Klassenarbeit
                                </button>
                                <button
                                  onClick={() => setNewEventType('term')}
                                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors border ${newEventType === 'term' ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'} `}
                                >
                                  Sonstiges
                                </button>
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Erinnere mich am ... (Optional)</label>
                              <input 
                                type="date"
                                onChange={e => {
                                  if (e.target.value) {
                                     setNewEventReminder(new Date(e.target.value).setHours(0,0,0,0));
                                  } else {
                                     setNewEventReminder(null);
                                  }
                                }}
                                className="w-full bg-white dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                              <button onClick={() => { setIsAddingEvent(false); setNewEventTitle(''); setNewEventReminder(null); }} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                                Abbrechen
                              </button>
                              <button 
                                onClick={() => {
                                  if (!newEventTitle.trim()) return;
                                  setProfile(p => ({
                                     ...p,
                                     calendarEvents: [
                                        ...(p.calendarEvents || []),
                                        {
                                          id: Math.random().toString(36).substr(2, 9),
                                          date: selectedCalendarDate.setHours(0,0,0,0),
                                          title: newEventTitle.trim(),
                                          type: newEventType,
                                          reminderDate: newEventReminder || undefined
                                        }
                                     ]
                                  }));
                                  setNewEventTitle('');
                                  setNewEventReminder(null);
                                  setIsAddingEvent(false);
                                }}
                                disabled={!newEventTitle.trim()}
                                className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all"
                              >
                                Speichern
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                   </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isSocialOpen && (
          <div key="modal-social" className="fixed inset-0 z-50 flex flex-col bg-black">
            {/* Header */}
            <div className={`absolute top-0 inset-x-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pt-safe pointer-events-none ${socialView !== 'fyp' ? 'bg-slate-900 pointer-events-auto shadow-md' : ''}`}>
              <div className="text-white font-bold text-lg flex items-center gap-2 pointer-events-auto">
                 <Smartphone className="w-5 h-5"/> FYP
                 <span className="text-[10px] uppercase tracking-wider font-bold bg-pink-500 text-white px-2 py-0.5 rounded-full">Beta</span>
              </div>
              <button onClick={() => setIsSocialOpen(false)} className="p-2 rounded-full hover:bg-white/20 transition pointer-events-auto">
                <X className="text-white w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 relative">
              {socialView === 'fyp' && (
                <div className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory hide-scrollbar">
                  {[...userSocialPosts, ...SOCIAL_POSTS].map((post) => (
                    <div key={post.id} className="min-h-[100dvh] h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-purple-900/20 to-black/80 pointer-events-none"></div>
                        {post.mediaUrl && post.mediaType === 'image' && (
                           <img src={post.mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                        )}
                        {post.mediaUrl && post.mediaType === 'video' && (
                           <video src={post.mediaUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60" />
                        )}
                        <div className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-12 pb-40 pr-24">
                          {post.content && (
                            <div className="text-2xl sm:text-4xl md:text-5xl font-display font-medium text-white max-w-3xl leading-snug w-full text-center md:text-left drop-shadow-md">
                              {post.content}
                            </div>
                          )}
                        </div>
                        
                        <div className="absolute bottom-20 right-4 sm:right-6 flex flex-col items-center gap-6 z-20 pb-safe">
                          <button className="flex flex-col items-center gap-1 group" onClick={(e) => {
                              const el = e.currentTarget.querySelector('svg');
                              if(el) { el.classList.remove('text-white'); el.classList.add('text-pink-500', 'fill-pink-500'); }
                          }}>
                            <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                              <Heart className="w-8 sm:w-10 h-8 sm:h-10 text-white transition-colors drop-shadow-md" />
                            </div>
                            <span className="text-white text-xs font-bold drop-shadow-md">
                              {post.likes > 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}
                            </span>
                          </button>
                          <button className="flex flex-col items-center gap-1 group">
                            <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                              <MessageCircle className="w-8 sm:w-10 h-8 sm:h-10 text-white drop-shadow-md" />
                            </div>
                            <span className="text-white text-xs font-bold drop-shadow-md">{post.comments}</span>
                          </button>
                          <button className="flex flex-col items-center gap-1 group">
                            <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                              <Share2 className="w-8 sm:w-10 h-8 sm:h-10 text-white drop-shadow-md" />
                            </div>
                            <span className="text-white text-xs font-bold drop-shadow-md">Teilen</span>
                          </button>
                        </div>
                        
                        <div className="absolute bottom-20 left-4 sm:left-6 right-24 text-left z-20 pb-safe">
                          <div className="font-bold text-white text-lg sm:text-xl flex items-center gap-2 drop-shadow-md">
                            {post.author} 
                            <Check className="w-4 h-4 text-white bg-blue-500 rounded-full p-0.5 drop-shadow-md" />
                          </div>
                          <div className="text-white/80 text-sm mt-2 flex gap-2 overflow-x-hidden whitespace-nowrap drop-shadow-md">
                            <span className="font-bold">#school</span> <span className="font-bold">#relatable</span> <span className="font-bold">#fyp</span>
                          </div>
                        </div>
                    </div>
                  ))}
                </div>
              )}

              {socialView === 'create' && (
                 <div className="absolute inset-0 bg-slate-900 pt-24 px-6 flex flex-col pb-safe overflow-y-auto">
                   <h2 className="text-white text-xl font-bold mb-4">Post erstellen</h2>
                   <textarea
                     className="w-full bg-slate-800 text-white rounded-xl p-4 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-pink-500 mb-4"
                     placeholder="Was möchtest du teilen?"
                     value={createPostContent}
                     onChange={(e) => setCreatePostContent(e.target.value)}
                   />
                   
                   <label className="w-full mb-6 border-2 border-dashed border-slate-700 hover:border-pink-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-slate-400 hover:text-pink-400">
                     <ImagePlus className="w-8 h-8 mb-2" />
                     <span className="font-medium text-sm">Foto oder Video hinzufügen (Optional)</span>
                     <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                       const file = e.target.files?.[0];
                       if (file) {
                         const reader = new FileReader();
                         reader.onloadend = () => {
                           setCreatePostMediaUrl(reader.result as string);
                           setCreatePostMediaType(file.type.startsWith('video/') ? 'video' : 'image');
                         };
                         reader.readAsDataURL(file);
                       }
                     }} />
                   </label>
                   
                   {createPostMediaUrl && createPostMediaType === 'image' && (
                     <div className="relative w-full h-48 mb-6 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                       <img src={createPostMediaUrl} className="max-w-full max-h-full object-contain" alt="Preview"/>
                       <button onClick={() => setCreatePostMediaUrl(null)} className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-full text-white">
                         <X className="w-4 h-4" />
                       </button>
                     </div>
                   )}
                   
                   {createPostMediaUrl && createPostMediaType === 'video' && (
                     <div className="relative w-full h-48 mb-6 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                       <video src={createPostMediaUrl} controls playsInline className="max-w-full max-h-full" />
                       <button onClick={() => setCreatePostMediaUrl(null)} className="absolute top-2 right-2 p-2 bg-black/70 hover:bg-black/90 rounded-full text-white z-10">
                         <X className="w-4 h-4" />
                       </button>
                     </div>
                   )}
                   
                   <div className="mt-auto pt-4 pb-20">
                     <button 
                       onClick={() => {
                          const likes = Math.floor(Math.random() * 1000) + 10;
                          const comments = Math.floor(Math.random() * 100) + 1;
                          const newFollowers = Math.floor(Math.random() * 200) + 20;
                          
                          const newPost = {
                            id: `user_${Date.now()}`,
                            author: `@${profile.name || 'User'}`,
                            content: createPostContent,
                            likes,
                            comments,
                            mediaUrl: createPostMediaUrl || undefined,
                            mediaType: (createPostMediaType as 'image' | 'video') || undefined
                          };
                          setUserSocialPosts([newPost, ...userSocialPosts]);
                          setSocialFollowers(prev => prev + newFollowers);
                          triggerCelebration("Post Online!", `Du hast ${newFollowers} neue Follower!`);
                          setCreatePostContent('');
                          setCreatePostMediaUrl(null);
                          setCreatePostMediaType(null);
                          setSocialView('profile');
                       }}
                       disabled={!createPostContent.trim() && !createPostMediaUrl}
                       className="w-full py-4 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:hover:bg-pink-600 transition-colors shadow-lg shadow-pink-600/30"
                     >
                       Posten
                     </button>
                   </div>
                 </div>
              )}

              {socialView === 'profile' && (
                 <div className="absolute inset-0 bg-slate-900 pt-24 px-6 flex flex-col items-center pb-safe overflow-y-auto">
                   <div className="w-24 h-24 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-3xl text-white font-bold mb-4 shadow-lg shadow-pink-500/20 border-4 border-slate-800">
                     {(profile.name || 'User').substring(0,2).toUpperCase()}
                   </div>
                   <h2 className="text-white text-xl font-bold flex items-center gap-1.5">
                     @{profile.name || 'User'} <Check className="w-4 h-4 text-white bg-blue-500 rounded-full p-0.5" />
                   </h2>
                   
                   <div className="flex gap-8 mt-6 w-full max-w-[280px]">
                     <div className="flex-1 flex flex-col items-center">
                       <span className="text-white font-bold text-lg">{userSocialPosts.length}</span>
                       <span className="text-slate-400 text-xs mt-1">Posts</span>
                     </div>
                     <div className="flex-1 flex flex-col items-center">
                       <span className="text-white font-bold text-lg">{socialFollowers}</span>
                       <span className="text-slate-400 text-xs mt-1">Follower</span>
                     </div>
                     <div className="flex-1 flex flex-col items-center">
                       <span className="text-white font-bold text-lg">
                         {userSocialPosts.reduce((sum, p) => sum + p.likes, 0)}
                       </span>
                       <span className="text-slate-400 text-xs mt-1">Likes</span>
                     </div>
                   </div>
                   
                   <div className="w-full mt-8 pb-20">
                     <div className="flex border-b border-slate-700/50 mb-4">
                        <button 
                          onClick={() => setSocialProfileTab('posts')}
                          className={`flex-1 pb-3 text-sm font-bold transition-colors ${socialProfileTab === 'posts' ? 'border-b-2 border-white text-white' : 'text-slate-500 hover:text-white'}`}
                        >Posts</button>
                        <button 
                          onClick={() => setSocialProfileTab('likes')}
                          className={`flex-1 pb-3 text-sm font-bold transition-colors ${socialProfileTab === 'likes' ? 'border-b-2 border-white text-white' : 'text-slate-500 hover:text-white'}`}
                        >Likes</button>
                     </div>
                     {socialProfileTab === 'posts' && (
                       userSocialPosts.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                            <ImagePlus className="w-12 h-12 mb-3 opacity-20" />
                            <p>Dein Profil ist noch leer.<br/>Erstelle deinen ersten Post!</p>
                         </div>
                       ) : (
                         <div className="grid grid-cols-3 gap-1">
                           {userSocialPosts.map(post => (
                             <div key={post.id} onClick={() => setViewingSocialPost(post)} className="aspect-[3/4] bg-slate-800 relative overflow-hidden group cursor-pointer active:scale-95 transition-transform">
                               {post.mediaUrl && post.mediaType === 'image' && <img src={post.mediaUrl} className="w-full h-full object-cover" />}
                               {post.mediaUrl && post.mediaType === 'video' && <video src={post.mediaUrl} className="w-full h-full object-cover" />}
                               <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                 <p className="text-white text-[10px] sm:text-xs font-bold text-center line-clamp-4 break-words px-1">{post.content}</p>
                               </div>
                               <div className="absolute bottom-1 left-1 flex items-center gap-1 drop-shadow-md">
                                 <Heart className="w-3 h-3 text-white" />
                                 <span className="text-white text-[10px] font-bold">{post.likes > 1000 ? (post.likes/1000).toFixed(1) + 'k' : post.likes}</span>
                               </div>
                             </div>
                           ))}
                         </div>
                       )
                     )}
                     {socialProfileTab === 'likes' && (
                       <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                          <Heart className="w-12 h-12 mb-3 opacity-20" />
                          <p>Deine gelikten Posts erscheinen hier.<br/>Bald verfügbar!</p>
                       </div>
                     )}
                   </div>
                 </div>
              )}
            </div>
            
            {/* Bottom Nav Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-black/90 backdrop-blur-md border-t border-white/10 pb-safe z-30">
              <div className="flex justify-around items-center h-16">
                <button 
                  onClick={() => setSocialView('fyp')}
                  className={`flex flex-col items-center flex-1 transition-colors ${socialView === 'fyp' ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                >
                  <Home className={`w-6 h-6 mb-1 ${socialView === 'fyp' ? 'fill-white' : ''}`} />
                  <span className="text-[10px] font-bold">Home</span>
                </button>
                
                <button 
                  onClick={() => setSocialView('create')}
                  className="flex items-center justify-center flex-1"
                >
                  <div className={`w-12 h-8 rounded-xl flex items-center justify-center transition-transform active:scale-95 border-2 ${socialView === 'create' ? 'bg-pink-500 text-white border-pink-500' : 'bg-transparent text-white border-white'}`}>
                    <Plus className="w-5 h-5" />
                  </div>
                </button>
                
                <button 
                  onClick={() => setSocialView('profile')}
                  className={`flex flex-col items-center flex-1 transition-colors ${socialView === 'profile' ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                >
                  <UserIcon className={`w-6 h-6 mb-1 ${socialView === 'profile' ? 'fill-white' : ''}`} />
                  <span className="text-[10px] font-bold">Profil</span>
                </button>
              </div>
            </div>
            {viewingSocialPost && (
              <div className="absolute inset-0 z-50 bg-black flex flex-col">
                <button onClick={() => setViewingSocialPost(null)} className="absolute top-safe pt-4 left-4 z-50 p-2 bg-black/50 hover:bg-black/80 rounded-full text-white">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 relative flex flex-col overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 via-purple-900/20 to-black/80 pointer-events-none z-0"></div>
                    {viewingSocialPost.mediaUrl && viewingSocialPost.mediaType === 'image' && (
                       <img src={viewingSocialPost.mediaUrl} className="absolute inset-0 w-full h-full object-cover opacity-60" alt="" />
                    )}
                    {viewingSocialPost.mediaUrl && viewingSocialPost.mediaType === 'video' && (
                       <video src={viewingSocialPost.mediaUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    )}
                    <div className="relative z-10 flex-1 flex items-center justify-center p-6 sm:p-12 pb-40 pr-24 pointer-events-none">
                      {viewingSocialPost.content && (
                        <div className="text-2xl sm:text-4xl md:text-5xl font-display font-medium text-white max-w-3xl leading-snug w-full text-center md:text-left drop-shadow-md">
                          {viewingSocialPost.content}
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute bottom-20 right-4 sm:right-6 flex flex-col items-center gap-6 z-20 pb-safe">
                      <button className="flex flex-col items-center gap-1 group" onClick={(e) => {
                          const el = e.currentTarget.querySelector('svg');
                          if(el) { el.classList.remove('text-white'); el.classList.add('text-pink-500', 'fill-pink-500'); }
                      }}>
                        <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                          <Heart className="w-8 sm:w-10 h-8 sm:h-10 text-white transition-colors drop-shadow-md" />
                        </div>
                        <span className="text-white text-xs font-bold drop-shadow-md">
                          {viewingSocialPost.likes > 1000 ? (viewingSocialPost.likes/1000).toFixed(1) + 'k' : viewingSocialPost.likes}
                        </span>
                      </button>
                      <button className="flex flex-col items-center gap-1 group">
                        <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                          <MessageCircle className="w-8 sm:w-10 h-8 sm:h-10 text-white drop-shadow-md" />
                        </div>
                        <span className="text-white text-xs font-bold drop-shadow-md">{viewingSocialPost.comments}</span>
                      </button>
                      <button className="flex flex-col items-center gap-1 group">
                        <div className="p-2 rounded-full group-hover:bg-white/10 transition-colors">
                          <Share2 className="w-8 sm:w-10 h-8 sm:h-10 text-white drop-shadow-md" />
                        </div>
                        <span className="text-white text-xs font-bold drop-shadow-md">Teilen</span>
                      </button>
                    </div>
                    
                    <div className="absolute bottom-20 left-4 sm:left-6 right-24 text-left z-20 pb-safe">
                      <div className="font-bold text-white text-lg sm:text-xl flex items-center gap-2 drop-shadow-md">
                        {viewingSocialPost.author} 
                        <Check className="w-4 h-4 text-white bg-blue-500 rounded-full p-0.5 drop-shadow-md" />
                      </div>
                      <div className="text-white/80 text-sm mt-2 flex gap-2 overflow-x-hidden whitespace-nowrap drop-shadow-md">
                        <span className="font-bold">#school</span> <span className="font-bold">#relatable</span> <span className="font-bold">#fyp</span>
                      </div>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isQuizVsOpen && (
          <div key="modal-quiz-vs" className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 flex flex-col pt-safe pb-safe"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                 <div className="flex items-center gap-3">
                   {quizVsView !== 'subject_select' && (
                     <button onClick={() => {
                        if (quizVsView === 'difficulty_select') setQuizVsView('subject_select');
                        else if (quizVsView === 'play') { setQuizVsView('subject_select'); setQuizVsSession(null); }
                     }} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                       <ChevronRight className="w-6 h-6 text-slate-400 rotate-180" />
                     </button>
                   )}
                   <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
                     <Swords className="w-6 h-6 text-indigo-500" />
                     {(quizVsView === 'subject_select' || quizVsView === 'difficulty_select') ? 'Quiz Versus Mode' : `Quiz: ${quizVsSubject}`}
                   </h2>
                 </div>
                 <button onClick={() => { setIsQuizVsOpen(false); setQuizVsSession(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                   <X className="w-6 h-6 text-slate-400" />
                 </button>
              </div>

              {quizVsView === 'subject_select' && (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[env(safe-area-inset-bottom)] max-w-4xl mx-auto w-full">
                     <div className="text-center mb-8 mt-4">
                        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-800 shadow-xl shadow-indigo-500/10">
                           <Swords className="w-10 h-10 text-indigo-500" />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Wähle ein Fach</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">Tritt gegen unsere klugen Bots an und sammle extra Punkte im Quiz Mode!</p>
                     </div>

                     <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-8">
                       <button 
                         onClick={() => {
                            setQuizVsSubject('Englisch');
                            setQuizVsView('difficulty_select');
                         }}
                         className="w-full flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700 last:border-0"
                       >
                         <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mr-4 shrink-0">
                           <Languages className="w-6 h-6" />
                         </div>
                         <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900 dark:text-white text-lg">Englisch</h4>
                           <p className="text-sm text-slate-500">Grammatik & Vokabeln</p>
                         </div>
                         <ChevronRight className="w-5 h-5 text-slate-300" />
                       </button>

                       <button 
                         onClick={() => {
                            setQuizVsSubject('Mathe');
                            setQuizVsView('difficulty_select');
                         }}
                         className="w-full flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700"
                       >
                         <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 mr-4 shrink-0">
                           <Trophy className="w-6 h-6" />
                         </div>
                         <div className="flex-1 text-left flex items-center gap-2">
                           <div>
                             <h4 className="font-bold text-slate-900 dark:text-white text-lg">Mathe</h4>
                             <p className="text-sm text-slate-500">Kopfrechnen</p>
                           </div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-slate-300" />
                       </button>

                       <button 
                         onClick={() => {
                            setQuizVsSubject('Französisch');
                            setQuizVsView('difficulty_select');
                         }}
                         className="w-full flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700"
                       >
                         <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mr-4 shrink-0">
                           <BookOpen className="w-6 h-6" />
                         </div>
                         <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900 dark:text-white text-lg">Französisch</h4>
                           <p className="text-sm text-slate-500">Grammatik & Wortschatz</p>
                         </div>
                         <ChevronRight className="w-5 h-5 text-slate-300" />
                       </button>

                       <button 
                         onClick={() => {
                            setQuizVsSubject('Deutsch');
                            setQuizVsView('difficulty_select');
                         }}
                         className="w-full flex items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-200 dark:border-slate-700 last:border-0"
                       >
                         <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/10 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 mr-4 shrink-0">
                           <BookOpen className="w-6 h-6" />
                         </div>
                         <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-900 dark:text-white text-lg">Deutsch</h4>
                           <p className="text-sm text-slate-500">Rechtschreibung & Stilmittel</p>
                         </div>
                         <ChevronRight className="w-5 h-5 text-slate-300" />
                       </button>
                     </div>
                  </div>
              )}

              {quizVsView === 'difficulty_select' && (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[env(safe-area-inset-bottom)] max-w-lg mx-auto w-full">
                     <div className="text-center mb-8 mt-4">
                        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-800 shadow-xl shadow-indigo-500/10">
                           <Ghost className="w-10 h-10 text-indigo-500" />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Schwierigkeit</h3>
                        <p className="text-slate-500 max-w-sm mx-auto">Wie gut sind deine {quizVsSubject}-Skills?</p>
                     </div>

                     <div className="space-y-4">
                        <button
                          onClick={() => startQuizVsMatch('easy')}
                          className="w-full bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-green-500 dark:hover:border-green-500 transition-colors group"
                        >
                           <div className="text-left">
                             <h4 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                               <span className="w-3 h-3 rounded-full bg-green-500"></span>
                               Einfach
                             </h4>
                             <p className="text-sm text-slate-500 mt-1">Langsamer Bot (1 Punkt pro Frage)</p>
                           </div>
                           <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-green-500 transition-colors" />
                        </button>
                        
                        <button
                          onClick={() => startQuizVsMatch('medium')}
                          className="w-full bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-yellow-500 dark:hover:border-yellow-500 transition-colors group"
                        >
                           <div className="text-left">
                             <h4 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                               <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                               Mittel
                             </h4>
                             <p className="text-sm text-slate-500 mt-1">Normaler Bot (2 Punkte pro Frage)</p>
                           </div>
                           <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-yellow-500 transition-colors" />
                        </button>

                        <button
                          onClick={() => startQuizVsMatch('hard')}
                          className="w-full bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between hover:border-danger dark:hover:border-danger transition-colors group"
                        >
                           <div className="text-left">
                             <h4 className="font-bold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                               <span className="w-3 h-3 rounded-full bg-danger"></span>
                               Schwer
                             </h4>
                             <p className="text-sm text-slate-500 mt-1">Schneller Bot (4 Punkte pro Frage)</p>
                           </div>
                           <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-danger transition-colors" />
                        </button>
                     </div>
                  </div>
              )}

              {quizVsView === 'play' && quizVsSession && (
                 <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 max-w-4xl mx-auto w-full">
                    {quizVsSession.gameStatus !== 'game_over' ? (
                       <div className="flex-1 flex flex-col h-full">
                          <div className="flex justify-between items-center mb-6 px-4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 shrink-0">
                             <div className="flex flex-col items-center flex-1">
                                <span className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-xl font-bold text-primary mb-1">
                                  {quizVsSession.userScore}
                                </span>
                                <span className="text-xs font-bold text-slate-500 uppercase">Du</span>
                             </div>

                             <div className="px-4 text-center">
                                <span className="text-2xl font-black text-slate-300 dark:text-slate-600 block">VS</span>
                             </div>

                             <div className="flex flex-col items-center flex-1">
                                <div className="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mb-1 relative">
                                  <span className="text-xl font-bold text-danger">{quizVsSession.botScore}</span>
                                  {quizVsSession.gameStatus === 'playing' && (
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 text-xs animate-bounce">🤔</div>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-slate-500 uppercase">{quizVsSession.botName}</span>
                             </div>
                          </div>
                          
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mb-8 overflow-hidden shrink-0">
                             <div 
                               className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                               style={{ width: `${(quizVsSession.currentIndex / quizVsSession.questions.length) * 100}%` }}
                             />
                          </div>

                          <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-1 bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-slate-200 border-b-8 border-r-8 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center p-6 sm:p-8 mb-6 overflow-y-auto">
                              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Frage {quizVsSession.currentIndex + 1} / {quizVsSession.questions.length}</span>
                              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-display font-medium text-slate-900 dark:text-white text-center break-words leading-tight">
                                {quizVsSession.questions[quizVsSession.currentIndex].question}
                              </h3>

                              {quizVsSession.gameStatus === 'question_finished' && (
                                <motion.div 
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`mt-8 px-6 py-3 rounded-xl font-bold text-lg ${quizVsSession.questionWinner === 'user' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}
                                >
                                  {quizVsSession.questionWinner === 'user' ? 'Richtig! Punkt für dich.' : `Zu langsam! ${quizVsSession.botName} hat gepunktet.`}
                                </motion.div>
                              )}
                            </div>
                            
                            <div className="space-y-3 shrink-0 pb-4">
                              {(() => {
                                 // Shuffle options only once per question by sorting with a seeded logic or we just randomize on start Match. 
                                 // Actually quizVsSession.questions has fixed options order, we should maybe shuffle options during start Quiz VS Match. Let's just use them as is, they are already fixed length. But we want random order. 
                                 // Simple way: derive random order from current question id.
                                 const currentQ = quizVsSession.questions[quizVsSession.currentIndex];
                                 const qHash = currentQ.question.length + quizVsSession.difficulty.length;
                                 let displayOptions = [...currentQ.options];
                                 if (qHash % 2 === 0) displayOptions = displayOptions.reverse();
                                 else if (qHash % 3 === 0) displayOptions = [displayOptions[1], displayOptions[2], displayOptions[0]];
                                 
                                 return displayOptions.map((opt, i) => {
                                    const isSelectedIncorrect = quizVsSession.selectedOptions[opt];
                                    const isCorrect = opt === currentQ.correctAnswer;
                                    const showCorrect = quizVsSession.gameStatus === 'question_finished' && isCorrect;
                                    const isWrongDisabled = quizVsSession.gameStatus === 'question_finished' && !isCorrect;
                                    
                                    let btnStyle = "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700";
                                    
                                    if (showCorrect) btnStyle = "bg-success text-white border-success ring-4 ring-success/20 scale-105 z-10 font-bold";
                                    else if (isSelectedIncorrect) btnStyle = "bg-danger/10 border-danger text-danger opacity-50 cursor-not-allowed";
                                    else if (isWrongDisabled) btnStyle = "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-50 cursor-not-allowed";
                                    
                                    return (
                                       <button
                                         key={i}
                                         onClick={() => handleQuizVsAnswer(opt)}
                                         disabled={quizVsSession.gameStatus !== 'playing' || isSelectedIncorrect}
                                         className={`w-full p-4 rounded-2xl border-2 shadow-sm transition-all text-lg font-bold text-center ${btnStyle} active:scale-[0.98] disabled:active:scale-100`}
                                       >
                                          {opt}
                                       </button>
                                    );
                                 });
                              })()}
                            </div>
                          </div>
                       </div>
                    ) : (
                       <div className="flex-1 flex items-center justify-center h-full">
                          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 sm:p-12 text-center shadow-xl border border-slate-200 dark:border-slate-700 max-w-md w-full relative overflow-hidden">
                             <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent"></div>
                             
                             {quizVsSession.userScore > quizVsSession.botScore ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-success/10 rounded-full flex flex-col items-center justify-center mx-auto mb-6 relative z-10 text-success border-4 border-white dark:border-slate-800 shadow-xl shadow-success/20">
                                   <Trophy className="w-12 h-12" />
                                </motion.div>
                             ) : quizVsSession.userScore < quizVsSession.botScore ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-danger/10 rounded-full flex flex-col items-center justify-center mx-auto mb-6 relative z-10 text-danger border-4 border-white dark:border-slate-800 shadow-xl shadow-danger/20">
                                   <Ghost className="w-12 h-12" />
                                </motion.div>
                             ) : (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex flex-col items-center justify-center mx-auto mb-6 relative z-10 text-slate-500 border-4 border-white dark:border-slate-800 shadow-xl shadow-slate-500/20">
                                   <Hand className="w-12 h-12" />
                                </motion.div>
                             )}

                             <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 relative z-10">
                                {quizVsSession.userScore > quizVsSession.botScore ? 'Gewonnen!' : quizVsSession.userScore < quizVsSession.botScore ? 'Verloren' : 'Unentschieden'}
                             </h3>
                             <p className="text-slate-500 font-medium mb-8 relative z-10">
                                {quizVsSession.userScore > quizVsSession.botScore 
                                   ? `Du warst schneller als ${quizVsSession.botName}.` 
                                   : quizVsSession.userScore < quizVsSession.botScore 
                                     ? `${quizVsSession.botName} war diesmal schlauer.`
                                     : `Ein starkes Kopf-an-Kopf Rennen.`}
                             </p>

                             <div className="flex justify-center gap-8 mb-8 relative z-10">
                                <div className="text-center">
                                   <div className={`text-4xl font-black ${quizVsSession.userScore > quizVsSession.botScore ? 'text-success' : 'text-slate-900 dark:text-white'}`}>{quizVsSession.userScore}</div>
                                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Du</div>
                                </div>
                                <div className="text-3xl text-slate-300 font-black mt-1">:</div>
                                <div className="text-center">
                                   <div className={`text-4xl font-black ${quizVsSession.userScore < quizVsSession.botScore ? 'text-danger' : 'text-slate-900 dark:text-white'}`}>{quizVsSession.botScore}</div>
                                   <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{quizVsSession.botName}</div>
                                </div>
                             </div>

                             <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-8 relative z-10 border border-slate-100 dark:border-slate-700/50">
                                <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                                  <span>Schwierigkeit</span>
                                  <span className={quizVsSession.difficulty === 'easy' ? 'text-green-500' : quizVsSession.difficulty === 'medium' ? 'text-yellow-500' : 'text-danger'}>
                                    {quizVsSession.difficulty === 'easy' ? 'Einfach' : quizVsSession.difficulty === 'medium' ? 'Mittel' : 'Schwer'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                   <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Punkte verdient</span>
                                   <span className="font-bold text-3xl font-display text-primary flex items-center gap-2">
                                      +{quizVsSession.userScore * (quizVsSession.difficulty === 'easy' ? 1 : quizVsSession.difficulty === 'medium' ? 2 : 4)} <Target className="w-6 h-6"/>
                                   </span>
                                </div>
                             </div>
                             
                             <button 
                               onClick={() => {
                                  const pointsMulti = quizVsSession.difficulty === 'easy' ? 1 : quizVsSession.difficulty === 'medium' ? 2 : 4;
                                  const pointsGained = quizVsSession.userScore * pointsMulti;
                                  if (pointsGained > 0) {
                                      setProfile(prev => {
                                         return {
                                            ...prev,
                                            points: prev.points + pointsGained,
                                            history: [
                                               {
                                                 id: Math.random().toString(36).substr(2, 9),
                                                 type: 'challenge',
                                                 date: Date.now(),
                                                 points: pointsGained,
                                                 value: quizVsSession.userScore,
                                                 comment: `Quiz VS Mode vs ${quizVsSession.botName} (${quizVsSession.userScore}/${quizVsSession.questions.length})`,
                                               },
                                               ...prev.history
                                            ]
                                         };
                                      });
                                      triggerCelebration("Quiz beendet!", `+${pointsGained} Punkte`);
                                  }
                                  setQuizVsView('subject_select');
                                  setQuizVsSession(null);
                               }}
                               className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all text-lg cursor-pointer relative z-10"
                             >
                               Punkte einsammeln & schließen
                             </button>
                          </div>
                       </div>
                    )}
                 </div>
              )}
            </motion.div>
          </div>
        )}

        {isVocabOpen && (
          <div key="modal-vocab" className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 flex flex-col pt-safe pb-safe"
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                 <div className="flex items-center gap-3">
                   {vocabView !== 'lists' && (
                     <button onClick={() => {
                        if (vocabView === 'learn' || vocabView === 'versus_play' || vocabView === 'versus_setup') {
                           setVocabView('lists');
                           setLearnSession(null);
                           setVersusSession(null);
                        } else {
                           setVocabView('lists');
                        }
                     }} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                       <ChevronRight className="w-6 h-6 text-slate-400 rotate-180" />
                     </button>
                   )}
                   <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-3">
                     <Languages className="w-6 h-6 text-primary" />
                     {vocabView === 'lists' ? 'Vokabeln' : vocabView === 'create_list' ? 'Neue Liste' : vocabView === 'edit_list' ? 'Liste bearbeiten' : vocabView === 'stats' ? 'Statistik' : vocabView === 'versus_setup' ? 'Versus Mode' : currentVocabList?.title}
                   </h2>
                 </div>
                 <button onClick={() => { setIsVocabOpen(false); setLearnSession(null); setVersusSession(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                   <X className="w-6 h-6 text-slate-400" />
                 </button>
              </div>

              {/* Lists View */}
              {vocabView === 'lists' && (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[env(safe-area-inset-bottom)] max-w-4xl mx-auto w-full">
                    <div className="flex justify-between items-center mb-6">
                       <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Deine Listen</h3>
                          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold shadow-sm border ${(profile.vocabStreak || 0) > 0 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}>
                            <Flame className={`w-4 h-4 ${(profile.vocabStreak || 0) > 0 ? 'text-orange-500 text-orange-400' : 'opacity-50'}`} /> {profile.vocabStreak || 0} Tag{(profile.vocabStreak || 0) === 1 ? '' : 'e'}
                          </div>
                       </div>
                       <button onClick={() => setVocabView('stats')} className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors">
                         <BarChart3 className="w-4 h-4" /> Statistik
                       </button>
                    </div>

                    {!(profile.vocabLists?.length) ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Languages className="w-16 h-16 text-slate-300 dark:text-slate-700 mb-4" />
                        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Noch keine Listen</h3>
                        <p className="text-slate-500 max-w-sm mt-2">Erstelle deine erste Vokabelliste und verdiene Punkte beim Lernen!</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(profile.vocabLists || []).map(list => (
                          <div key={list.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                               <div>
                                 <span className="text-xs font-bold text-primary uppercase tracking-wider mb-1 block">{list.subject}</span>
                                 <h4 className="font-bold text-slate-900 dark:text-white text-lg">{list.title}</h4>
                               </div>
                               <div className="flex gap-2">
                                   <button onClick={() => {
                                      setCurrentVocabList(list);
                                      setNewVocabListTitle(list.title);
                                      setNewVocabListSubject(list.subject);
                                      setNewVocabWords(list.words);
                                      setVocabView('edit_list');
                                   }} className="p-2 text-slate-400 hover:text-primary transition-colors">
                                     <Settings className="w-5 h-5" />
                                   </button>
                                   <button onClick={() => {
                                      if (confirm('Möchtest du diese Liste wirklich löschen?')) {
                                          setProfile(prev => ({
                                              ...prev,
                                              vocabLists: (prev.vocabLists || []).filter(l => l.id !== list.id)
                                          }));
                                      }
                                   }} className="p-2 text-slate-400 hover:text-danger transition-colors">
                                     <Trash2 className="w-5 h-5" />
                                   </button>
                               </div>
                            </div>
                            <p className="text-sm text-slate-500 font-medium mb-6">{list.words.length} {list.words.length === 1 ? 'Wort' : 'Wörter'}</p>
                            
                            <div className="flex gap-2 mt-auto pt-4">
                              <button 
                                onClick={() => {
                                   setCurrentVocabList(list);
                                   setLearnSession({
                                      listId: list.id,
                                      words: [...list.words].sort(() => Math.random() - 0.5), // simple shuffle
                                      currentIndex: 0,
                                      flipped: false,
                                      correct: 0,
                                      wrong: 0
                                   });
                                   setVocabView('learn');
                                }}
                                disabled={list.words.length === 0}
                                className="flex-1 bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
                              >
                                <Brain className="w-5 h-5" />
                                Lernen
                              </button>
                              <button 
                                onClick={() => {
                                   setCurrentVocabList(list);
                                   setVocabView('versus_setup');
                                }}
                                disabled={list.words.length === 0}
                                className="flex-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500 hover:text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer"
                              >
                                <Swords className="w-5 h-5" />
                                Versus
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
              )}

              {/* Lists View Footer */}
              {vocabView === 'lists' && (
                  <div className="p-4 sm:p-6 shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                    <button 
                      onClick={() => {
                         setNewVocabListTitle('');
                         setNewVocabListSubject(getAvailableSubjects(profile)[0] || '');
                         setNewVocabWords([{front: '', back: ''}]);
                         setVocabView('create_list');
                      }}
                      className="w-full max-w-4xl mx-auto flex items-center justify-center gap-2 bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <Plus className="w-5 h-5" /> Neue Liste erstellen
                    </button>
                  </div>
              )}

              {/* Create / Edit List View */}
              {(vocabView === 'create_list' || vocabView === 'edit_list') && (
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-2xl mx-auto w-full">
                     <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Titel der Liste</label>
                          <input 
                            type="text" 
                            value={newVocabListTitle}
                            onChange={(e) => setNewVocabListTitle(e.target.value)}
                            placeholder="z.B. Unit 1, Lektion 4..."
                            className="w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wider">Fach</label>
                          <div className="flex flex-wrap gap-2">
                             {getAvailableSubjects(profile).map(subj => (
                                <button
                                  key={subj}
                                  onClick={() => setNewVocabListSubject(subj)}
                                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${newVocabListSubject === subj ? 'bg-primary text-white border-primary shadow-md' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/50'}`}
                                >
                                  {subj}
                                </button>
                             ))}
                          </div>
                          {!getAvailableSubjects(profile).includes(newVocabListSubject) && (
                            <input 
                              type="text" 
                              value={newVocabListSubject}
                              onChange={(e) => setNewVocabListSubject(e.target.value)}
                              placeholder="Anderes Fach..."
                              className="mt-3 w-full p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 uppercase tracking-wider">Wörter ({newVocabWords.length})</label>
                          <div className="space-y-3">
                             {newVocabWords.map((word, idx) => (
                                <div key={idx} className="flex gap-2 items-center">
                                   <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                                   <div className="flex-1 grid grid-cols-2 gap-2">
                                     <input 
                                       type="text" 
                                       value={word.front}
                                       placeholder="Wort"
                                       onChange={(e) => {
                                          const w = [...newVocabWords];
                                          w[idx].front = e.target.value;
                                          setNewVocabWords(w);
                                       }}
                                       className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-primary transition-colors text-slate-900 dark:text-white"
                                     />
                                     <input 
                                       type="text" 
                                       value={word.back}
                                       placeholder="Übersetzung"
                                       onChange={(e) => {
                                          const w = [...newVocabWords];
                                          w[idx].back = e.target.value;
                                          setNewVocabWords(w);
                                       }}
                                       className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:border-primary transition-colors text-slate-900 dark:text-white"
                                     />
                                   </div>
                                   <button onClick={() => {
                                      const w = [...newVocabWords];
                                      w.splice(idx, 1);
                                      if (w.length === 0) w.push({front: '', back: ''});
                                      setNewVocabWords(w);
                                   }} className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer">
                                     <Trash2 className="w-5 h-5" />
                                   </button>
                                </div>
                             ))}
                          </div>
                          
                          <button onClick={() => {
                             setNewVocabWords([...newVocabWords, {front: '', back: ''}]);
                          }} className="mt-4 flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors w-full p-4 bg-primary/5 rounded-xl justify-center border border-primary/20 hover:bg-primary/10 cursor-pointer">
                            <Plus className="w-4 h-4" /> Weiteres Wort hinzufügen
                          </button>
                        </div>
                     </div>
                     <div className="mt-8">
                       <button
                         onClick={() => {
                            if (!newVocabListTitle.trim() || !newVocabListSubject) return;
                            const validWords = newVocabWords.filter(w => w.front.trim() && w.back.trim()).map(w => ({
                               id: Math.random().toString(36).substr(2, 9),
                               front: w.front.trim(),
                               back: w.back.trim(),
                               correctCount: 0,
                               wrongCount: 0,
                               ...(vocabView === 'edit_list' && currentVocabList?.words.find(cw => cw.front === w.front.trim()) 
                                   ? currentVocabList.words.find(cw => cw.front === w.front.trim()) 
                                   : {})
                            })) as VocabWord[];
                            
                            if (validWords.length === 0) return;

                            setProfile(prev => {
                               const lists = [...(prev.vocabLists || [])];
                               if (vocabView === 'create_list') {
                                 lists.push({
                                    id: Math.random().toString(36).substr(2, 9),
                                    title: newVocabListTitle.trim(),
                                    subject: newVocabListSubject,
                                    words: validWords,
                                    createdAt: Date.now()
                                 });
                               } else if (currentVocabList) {
                                 const index = lists.findIndex(l => l.id === currentVocabList.id);
                                 if (index !== -1) {
                                    lists[index] = {
                                       ...lists[index],
                                       title: newVocabListTitle.trim(),
                                       subject: newVocabListSubject,
                                       words: validWords
                                    };
                                 }
                               }
                               return { ...prev, vocabLists: lists };
                            });
                            setVocabView('lists');
                         }}
                         disabled={!newVocabListTitle.trim() || !newVocabListSubject || !newVocabWords.some(w => w.front.trim() && w.back.trim())}
                         className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                       >
                         {vocabView === 'create_list' ? 'Liste erstellen' : 'Änderungen speichern'}
                       </button>
                     </div>
                  </div>
              )}

              {/* Learn View */}
              {vocabView === 'learn' && learnSession && (
                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-xl mx-auto w-full flex flex-col">
                    {learnSession.currentIndex < learnSession.words.length ? (
                       <>
                         <div className="flex items-center justify-between mb-6">
                            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                              Wort {learnSession.currentIndex + 1} / {learnSession.words.length}
                            </span>
                            <div className="flex gap-4 text-base font-bold bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                               <span className="text-success flex items-center gap-1"><Check className="w-4 h-4"/> {learnSession.correct}</span>
                               <span className="text-danger flex items-center gap-1"><X className="w-4 h-4"/> {learnSession.wrong}</span>
                            </div>
                         </div>
                         
                         <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mb-8 overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300 rounded-full"
                              style={{ width: `${(learnSession.currentIndex / learnSession.words.length) * 100}%` }}
                            />
                         </div>

                         <div 
                           className="flex-1 bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-slate-200 border-b-8 border-r-8 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center p-8 mb-8 min-h-[400px] cursor-pointer"
                           onClick={() => setLearnSession({ ...learnSession, flipped: true })}
                         >
                           <h3 className="text-4xl sm:text-5xl font-display font-medium text-slate-900 dark:text-white text-center break-words">
                             {learnSession.words[learnSession.currentIndex].front}
                           </h3>
                           
                           {learnSession.flipped && (
                             <motion.div 
                               initial={{ opacity: 0, y: 20 }}
                               animate={{ opacity: 1, y: 0 }}
                               className="mt-12 pt-8 border-t-2 border-dashed border-slate-200 dark:border-slate-700 w-[80%] mx-auto text-center"
                             >
                                <h4 className="text-3xl sm:text-4xl font-display font-bold text-primary break-words">
                                  {learnSession.words[learnSession.currentIndex].back}
                                </h4>
                             </motion.div>
                           )}
                           
                           {!learnSession.flipped && (
                             <p className="mt-auto pt-8 text-sm font-bold uppercase tracking-widest text-slate-400">Tippen zum Aufdecken</p>
                           )}
                         </div>

                         {learnSession.flipped ? (
                           <motion.div 
                             initial={{ opacity: 0, y: 20 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="flex gap-4 shrink-0"
                           >
                              <button 
                                onClick={() => {
                                   setLearnSession({
                                      ...learnSession,
                                      wrong: learnSession.wrong + 1,
                                      currentIndex: learnSession.currentIndex + 1,
                                      flipped: false
                                   });
                                }}
                                className="flex-1 bg-white dark:bg-slate-800 text-danger border-2 border-slate-200 dark:border-slate-700 hover:border-danger hover:bg-danger/10 font-bold py-5 rounded-2xl active:scale-[0.98] transition-all text-lg shadow-sm cursor-pointer"
                              >
                                Nicht gewusst 😔
                              </button>
                              <button 
                                onClick={() => {
                                   setLearnSession({
                                      ...learnSession,
                                      correct: learnSession.correct + 1,
                                      currentIndex: learnSession.currentIndex + 1,
                                      flipped: false
                                   });
                                }}
                                className="flex-1 bg-primary text-white font-bold py-5 rounded-2xl active:scale-[0.98] transition-all text-lg shadow-xl shadow-primary/20 cursor-pointer"
                              >
                                Gewusst! 🥳
                              </button>
                           </motion.div>
                         ) : (
                           <div className="h-[76px] shrink-0" />
                         )}
                       </>
                    ) : (
                       <div className="flex-1 flex flex-col items-center justify-center text-center">
                          <Brain className="w-24 h-24 text-primary mb-6 animate-bounce" />
                          <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-2">Fertig!</h2>
                          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 font-medium">Du hast {learnSession.correct} von {learnSession.words.length} Wörtern gewusst.</p>
                          
                          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-2 border-slate-100 dark:border-slate-700 w-full mb-8 shadow-sm">
                             <div className="flex justify-between items-center mb-6">
                                <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Ergebnis</span>
                                <span className="font-bold text-3xl font-display text-slate-900 dark:text-white">{Math.round((learnSession.correct / learnSession.words.length) * 100)}%</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Punkte verdient</span>
                                <span className="font-bold text-3xl font-display text-primary flex items-center gap-2">+{learnSession.correct * 2} <Target className="w-6 h-6"/></span>
                             </div>
                          </div>
                          
                          <button 
                            onClick={() => {
                               const pointsGained = learnSession.correct * 2;
                               if (pointsGained > 0) {
                                   setProfile(prev => {
                                      const todayStr = new Date().toLocaleDateString();
                                      let newStreak = prev.vocabStreak || 0;
                                      if (prev.lastVocabDate) {
                                          const lastDate = new Date(prev.lastVocabDate);
                                          if (lastDate.toLocaleDateString() !== todayStr) {
                                              const diffDays = Math.round((new Date().setHours(0,0,0,0) - lastDate.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                                              if (diffDays === 1) newStreak++;
                                              else if (diffDays > 1) newStreak = 1;
                                          }
                                          if (newStreak === 0) newStreak = 1;
                                      } else {
                                          newStreak = 1;
                                      }
                                      return {
                                         ...prev,
                                         vocabStreak: newStreak,
                                         lastVocabDate: Date.now(),
                                         points: prev.points + pointsGained,
                                         history: [
                                            {
                                              id: Math.random().toString(36).substr(2, 9),
                                              type: 'vocab',
                                              date: Date.now(),
                                              points: pointsGained,
                                              value: learnSession.correct,
                                              comment: `Vokabeltest: ${currentVocabList?.title} (${learnSession.correct}/${learnSession.words.length})`,
                                            },
                                            ...prev.history
                                         ]
                                      };
                                   });
                                   triggerCelebration("Vokabeln gelernt!", `+${pointsGained} Punkte`);
                               }
                               setVocabView('lists');
                               setLearnSession(null);
                            }}
                            className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all text-lg cursor-pointer cursor-pointer"
                          >
                            Punkte einsammeln & schließen
                          </button>
                       </div>
                    )}
                 </div>
              )}

              {/* Versus Setup View */}
              {vocabView === 'versus_setup' && currentVocabList && (
                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-xl mx-auto w-full flex flex-col items-center justify-center">
                    <Ghost className="w-24 h-24 text-indigo-500 mb-6 drop-shadow-lg" />
                    <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Multiplayer (Bot-Gegner)</h2>
                    <p className="text-slate-600 dark:text-slate-300 text-center mb-8 max-w-sm">Tritt gegen einen KI-Gegner an! Wer zuerst die richtige Übersetzung eingibt, erhält den Punkt.</p>
                    
                    <div className="w-full space-y-4">
                       <button 
                         onClick={() => {
                            setVersusSession({
                               listId: currentVocabList.id,
                               words: [...currentVocabList.words].sort(() => Math.random() - 0.5),
                               currentIndex: 0,
                               userScore: 0,
                               botScore: 0,
                               botName: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
                               difficulty: 'easy',
                               gameStatus: 'playing',
                               wordWinner: null,
                               currentInput: '',
                               targetIsFront: Math.random() > 0.5
                            });
                            setVocabView('versus_play');
                         }}
                         className="w-full p-4 rounded-2xl border-2 border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20 text-left transition-all cursor-pointer flex justify-between items-center group"
                       >
                         <div>
                            <h4 className="font-bold text-green-700 dark:text-green-400 text-lg">Einfach</h4>
                            <p className="text-sm text-green-600/80 dark:text-green-400/80 font-medium">10-15s Reaktionszeit • 1 Punkt pro Wort</p>
                         </div>
                         <div className="w-10 h-10 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Gamepad2 className="w-5 h-5 text-green-700 dark:text-green-400" />
                         </div>
                       </button>
                       <button 
                         onClick={() => {
                            setVersusSession({
                               listId: currentVocabList.id,
                               words: [...currentVocabList.words].sort(() => Math.random() - 0.5),
                               currentIndex: 0,
                               userScore: 0,
                               botScore: 0,
                               botName: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
                               difficulty: 'medium',
                               gameStatus: 'playing',
                               wordWinner: null,
                               currentInput: '',
                               targetIsFront: Math.random() > 0.5
                            });
                            setVocabView('versus_play');
                         }}
                         className="w-full p-4 rounded-2xl border-2 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-left transition-all cursor-pointer flex justify-between items-center group"
                       >
                         <div>
                            <h4 className="font-bold text-amber-700 dark:text-amber-400 text-lg">Mittel</h4>
                            <p className="text-sm text-amber-600/80 dark:text-amber-400/80 font-medium">7-12s Reaktionszeit • 2 Punkte pro Wort</p>
                         </div>
                         <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Swords className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                         </div>
                       </button>
                       <button 
                         onClick={() => {
                            setVersusSession({
                               listId: currentVocabList.id,
                               words: [...currentVocabList.words].sort(() => Math.random() - 0.5),
                               currentIndex: 0,
                               userScore: 0,
                               botScore: 0,
                               botName: BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)],
                               difficulty: 'hard',
                               gameStatus: 'playing',
                               wordWinner: null,
                               currentInput: '',
                               targetIsFront: Math.random() > 0.5
                            });
                            setVocabView('versus_play');
                         }}
                         className="w-full p-4 rounded-2xl border-2 border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-left transition-all cursor-pointer flex justify-between items-center group"
                       >
                         <div>
                            <h4 className="font-bold text-red-700 dark:text-red-400 text-lg">Schwer</h4>
                            <p className="text-sm text-red-600/80 dark:text-red-400/80 font-medium">5-8s Reaktionszeit • 4 Punkte pro Wort</p>
                         </div>
                         <div className="w-10 h-10 rounded-full bg-red-200 dark:bg-red-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Flame className="w-5 h-5 text-red-700 dark:text-red-400" />
                         </div>
                       </button>
                    </div>
                 </div>
              )}

              {/* Versus Play View */}
              {vocabView === 'versus_play' && versusSession && (
                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-xl mx-auto w-full flex flex-col">
                    {versusSession.gameStatus !== 'game_over' ? (
                       <>
                         <div className="flex items-center justify-between mb-8 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex flex-col items-center flex-1">
                               <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-1">
                                 <span className="text-xl font-bold text-primary">{versusSession.userScore}</span>
                               </div>
                               <span className="text-xs font-bold text-slate-500 uppercase">Du</span>
                            </div>
                            
                            <div className="px-4">
                               <span className="text-2xl font-bold text-slate-300 dark:text-slate-600">vs</span>
                            </div>

                            <div className="flex flex-col items-center flex-1">
                               <div className="w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center mb-1 relative">
                                 <span className="text-xl font-bold text-danger">{versusSession.botScore}</span>
                                 {versusSession.gameStatus === 'playing' && (
                                   <div className="absolute -bottom-1 -right-1 w-4 h-4 text-xs animate-bounce">🤔</div>
                                 )}
                               </div>
                               <span className="text-xs font-bold text-slate-500 uppercase">{versusSession.botName}</span>
                            </div>
                         </div>
                         
                         <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mb-8 overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                              style={{ width: `${(versusSession.currentIndex / versusSession.words.length) * 100}%` }}
                            />
                         </div>

                         <div className="flex-1 flex flex-col">
                           <div className="flex-1 bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-slate-200 border-b-8 border-r-8 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center p-8 mb-8 min-h-[300px]">
                             <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Wort {versusSession.currentIndex + 1} / {versusSession.words.length}</span>
                             <h3 className="text-4xl sm:text-5xl font-display font-medium text-slate-900 dark:text-white text-center break-words">
                               {versusSession.targetIsFront ? versusSession.words[versusSession.currentIndex].back : versusSession.words[versusSession.currentIndex].front}
                             </h3>

                             {versusSession.gameStatus === 'word_finished' && (
                               <motion.div 
                                 initial={{ opacity: 0, scale: 0.8 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 className={`mt-8 px-6 py-3 rounded-xl font-bold text-lg ${versusSession.wordWinner === 'user' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}
                               >
                                 {versusSession.wordWinner === 'user' ? 'Gute Arbeit! Punkt für dich.' : `Zu langsam! ${versusSession.botName} hat gepunktet.`}
                               </motion.div>
                             )}
                             {versusSession.gameStatus === 'word_finished' && (
                               <motion.div 
                                 initial={{ opacity: 0, y: 10 }}
                                 animate={{ opacity: 1, y: 0 }}
                                 className="mt-6 pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-700 w-[80%] mx-auto text-center"
                               >
                                  <span className="text-sm text-slate-500 font-bold block mb-2">Lösung:</span>
                                  <h4 className="text-2xl font-display font-bold text-primary break-words">
                                    {versusSession.targetIsFront ? versusSession.words[versusSession.currentIndex].front : versusSession.words[versusSession.currentIndex].back}
                                  </h4>
                               </motion.div>
                             )}
                           </div>
                           
                           {versusSession.gameStatus === 'playing' ? (
                             <div className="flex gap-2">
                               <input
                                 type="text"
                                 autoFocus
                                 placeholder="Übersetzung eingeben..."
                                 value={versusSession.currentInput}
                                 onChange={(e) => setVersusSession({...versusSession, currentInput: e.target.value})}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter' && versusSession.currentInput.trim()) {
                                      const expected = versusSession.targetIsFront ? versusSession.words[versusSession.currentIndex].front : versusSession.words[versusSession.currentIndex].back;
                                      if (versusSession.currentInput.trim().toLowerCase() === expected.toLowerCase()) {
                                         setVersusSession({
                                            ...versusSession,
                                            userScore: versusSession.userScore + 1,
                                            gameStatus: 'word_finished',
                                            wordWinner: 'user'
                                         });
                                      } else {
                                         // wrong answer indication could be added, but for now we just let bots win or user retry until bot wins or user enters correct
                                         setVersusSession({
                                            ...versusSession,
                                            currentInput: ''
                                         });
                                      }
                                   }
                                 }}
                                 className="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 outline-none focus:border-primary text-slate-900 dark:text-white shadow-sm font-medium text-lg placeholder:text-slate-400"
                               />
                               <button 
                                 onClick={() => {
                                    if (versusSession.currentInput.trim()) {
                                      const expected = versusSession.targetIsFront ? versusSession.words[versusSession.currentIndex].front : versusSession.words[versusSession.currentIndex].back;
                                      if (versusSession.currentInput.trim().toLowerCase() === expected.toLowerCase()) {
                                         setVersusSession({
                                            ...versusSession,
                                            userScore: versusSession.userScore + 1,
                                            gameStatus: 'word_finished',
                                            wordWinner: 'user'
                                         });
                                      } else {
                                         setVersusSession({...versusSession, currentInput: ''});
                                      }
                                    }
                                 }}
                                 className="px-6 bg-primary text-white font-bold rounded-2xl active:scale-[0.98] transition-all cursor-pointer shadow-md"
                               >
                                 <ChevronRight className="w-6 h-6" />
                               </button>
                             </div>
                           ) : (
                             <div className="h-[64px] flex items-center justify-center">
                                <p className="text-slate-500 font-bold animate-pulse text-sm">Nächstes Wort wird vorbereitet...</p>
                             </div>
                           )}
                         </div>
                       </>
                    ) : (
                       <div className="flex-1 flex flex-col items-center justify-center text-center">
                          {versusSession.userScore > versusSession.botScore ? (
                            <Trophy className="w-24 h-24 text-amber-500 mb-6 drop-shadow-lg" />
                          ) : versusSession.userScore === versusSession.botScore ? (
                            <Swords className="w-24 h-24 text-slate-400 mb-6 drop-shadow-lg" />
                          ) : (
                            <Ghost className="w-24 h-24 text-danger mb-6 drop-shadow-lg" />
                          )}
                          
                          <h2 className="text-4xl font-display font-bold text-slate-900 dark:text-white mb-2">
                             {versusSession.userScore > versusSession.botScore ? 'Gewonnen!' : versusSession.userScore === versusSession.botScore ? 'Unentschieden!' : 'Verloren!'}
                          </h2>
                          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 font-medium">
                             Du hast {versusSession.userScore} : {versusSession.botScore} gegen {versusSession.botName} gespielt.
                          </p>
                          
                          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-2 border-slate-100 dark:border-slate-700 w-full mb-8 shadow-sm">
                             <div className="flex justify-between items-center mb-6">
                                <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Schwierigkeit</span>
                                <span className="font-bold text-lg font-display text-slate-900 dark:text-white capitalize">
                                   {versusSession.difficulty === 'easy' ? 'Einfach' : versusSession.difficulty === 'medium' ? 'Mittel' : 'Schwer'}
                                </span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-500 uppercase tracking-wider text-sm">Punkte verdient</span>
                                <span className="font-bold text-3xl font-display text-primary flex items-center gap-2">
                                   +{versusSession.userScore * (versusSession.difficulty === 'easy' ? 1 : versusSession.difficulty === 'medium' ? 2 : 4)} <Target className="w-6 h-6"/>
                                </span>
                             </div>
                          </div>
                          
                          <button 
                            onClick={() => {
                               const pointsMulti = versusSession.difficulty === 'easy' ? 1 : versusSession.difficulty === 'medium' ? 2 : 4;
                               const pointsGained = versusSession.userScore * pointsMulti;
                               if (pointsGained > 0) {
                                   setProfile(prev => {
                                      const todayStr = new Date().toLocaleDateString();
                                      let newStreak = prev.vocabStreak || 0;
                                      if (prev.lastVocabDate) {
                                          const lastDate = new Date(prev.lastVocabDate);
                                          if (lastDate.toLocaleDateString() !== todayStr) {
                                              const diffDays = Math.round((new Date().setHours(0,0,0,0) - lastDate.setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                                              if (diffDays === 1) newStreak++;
                                              else if (diffDays > 1) newStreak = 1;
                                          }
                                          if (newStreak === 0) newStreak = 1;
                                      } else {
                                          newStreak = 1;
                                      }
                                      return {
                                         ...prev,
                                         vocabStreak: newStreak,
                                         lastVocabDate: Date.now(),
                                         points: prev.points + pointsGained,
                                         history: [
                                            {
                                              id: Math.random().toString(36).substr(2, 9),
                                              type: 'vocab',
                                              date: Date.now(),
                                              points: pointsGained,
                                              value: versusSession.userScore,
                                              comment: `Versus Mode vs ${versusSession.botName} (${versusSession.userScore}/${versusSession.words.length})`,
                                            },
                                            ...prev.history
                                         ]
                                      };
                                   });
                                   triggerCelebration("Multiplayer beendet!", `+${pointsGained} Punkte`);
                               }
                               setVocabView('lists');
                               setVersusSession(null);
                            }}
                            className="w-full bg-primary text-white font-bold py-5 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all text-lg cursor-pointer"
                          >
                            Punkte einsammeln & schließen
                          </button>
                       </div>
                    )}
                 </div>
              )}

              {/* Stats View */}
              {vocabView === 'stats' && (
                 <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] max-w-2xl mx-auto w-full">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col mb-6">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                          <BarChart3 className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                           <h3 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Lern-Statistik</h3>
                           <p className="text-sm font-medium text-slate-500">Dein Fortschritt beim Vokabellernen</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Gelernte Wörter</span>
                           <span className="text-4xl font-display font-bold text-slate-900 dark:text-white">
                             {profile.history.filter(h => h.type === 'vocab').reduce((acc, curr) => acc + Number(curr.value || 0), 0)}
                           </span>
                        </div>
                        <div className="p-5 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20">
                           <span className="text-xs font-bold text-primary/70 uppercase tracking-wider block mb-2">Gesammelte Punkte</span>
                           <span className="text-4xl font-display font-bold text-primary">
                             {profile.history.filter(h => h.type === 'vocab').reduce((acc, curr) => acc + (curr.points || 0), 0)}
                           </span>
                        </div>
                      </div>
                    </div>
                 </div>
              )}

            </motion.div>
          </div>
        )}

        {isPartModalOpen && (
          <div key="modal-part" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPartModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Meldungen eintragen</h2>
                <button onClick={() => setIsPartModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
                <button 
                  onClick={() => setPartMode('total')}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${partMode === 'total' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Gesamt
                </button>
                <button 
                  onClick={() => setPartMode('subject')}
                  className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all cursor-pointer ${partMode === 'subject' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Pro Fach
                </button>
              </div>

              <div className="space-y-6">
                {partMode === 'total' ? (
                  <div className="flex flex-col items-center justify-center space-y-4 py-4">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Anzahl der Meldungen</span>
                    <div className="flex items-center gap-6">
                      <button onClick={() => setPartTotal(Math.max(1, partTotal - 1))} className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="text-4xl font-display font-bold text-slate-900 dark:text-white w-16 text-center">{partTotal}</span>
                      <button onClick={() => setPartTotal(partTotal + 1)} className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
                    {validTodayIndex === -1 ? (
                      <p className="text-center text-sm font-medium text-slate-400 py-8">Heute ist Wochenende! Keine Fächer im Plan.</p>
                    ) : todaySubjects.length === 0 ? (
                      <p className="text-center text-sm font-medium text-slate-400 py-8">Keine Fächer für heute im Stundenplan eingetragen.</p>
                    ) : (
                      todaySubjects.map(subject => (
                        <div key={subject} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{subject}</span>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setPartSubjects(p => ({...p, [subject]: Math.max(0, (p[subject] || 0) - 1)}))} className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-bold text-slate-900 dark:text-white w-6 text-center">{partSubjects[subject] || 0}</span>
                            <button onClick={() => setPartSubjects(p => ({...p, [subject]: (p[subject] || 0) + 1}))} className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
                
                <button 
                  onClick={submitParticipation}
                  disabled={partMode === 'subject' && (!todaySubjects.length || Object.values(partSubjects).reduce((a: number, b: number) => a + b, 0) === 0)}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 disabled:active:scale-100"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Hand className="w-5 h-5" />
                    Eintragen
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Participation Confirm Modal */}
        {isParticipationConfirmOpen && (
          <div key="modal-part-confirm" className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-amber-600 w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-center mb-2">Bist du dir sicher?</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-6">
                Du möchtest <span className="font-bold text-slate-900 dark:text-white">
                  {pendingParticipationData?.mode === 'total' 
                    ? pendingParticipationData.total 
                    : Object.values(pendingParticipationData?.subjects || {}).reduce((a: number, b) => a + (Number(b) || 0), 0)} Meldungen
                </span> eintragen. Das ist eine ungewöhnlich hohe Anzahl für einen Tag.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setIsParticipationConfirmOpen(false);
                    setPendingParticipationData(null);
                  }}
                  className="py-3 px-4 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  Nein, korrigieren
                </button>
                <button 
                  onClick={() => {
                    submitParticipation(true);
                  }}
                  className="py-3 px-4 rounded-xl font-bold bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                >
                  Ja, eintragen
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isGradeModalOpen && (
          <div key="modal-grade" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGradeModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Arbeit zurückerhalten?</h2>
                <button onClick={() => setIsGradeModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6">
                  <button onClick={() => setGradeType('vokabeltest')} className={`flex-1 py-3 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all ${gradeType === 'vokabeltest' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Vokabeltest</button>
                  <button onClick={() => setGradeType('test')} className={`flex-1 py-3 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all ${gradeType === 'test' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Test</button>
                  <button onClick={() => setGradeType('arbeit')} className={`flex-1 py-3 px-2 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all ${gradeType === 'arbeit' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>Arbeit</button>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Fach auswählen (Erforderlich)</label>
                  <input 
                    list="subject-list" 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    placeholder="Fach (z.B. Mathematik)"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-300"
                  />
                  <datalist id="subject-list">
                    {availableSubjects.map((s, i) => <option key={i} value={s} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {(Object.entries(GRADE_POINTS) as [string, number][]).map(([grade, pts]) => {
                    const multiplier = gradeType === 'vokabeltest' ? 0.2 : gradeType === 'test' ? 0.5 : 1;
                    const calculatedPts = Math.round(pts * multiplier);
                    return (
                      <button
                        key={grade}
                        onClick={() => addGradeResult(Number(grade) as Grade)}
                        disabled={!selectedSubject.trim()}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 hover:border-primary/20 dark:hover:border-primary/50 hover:bg-primary/5 hover:-translate-y-1 hover:shadow-md transition-all duration-300 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-50 disabled:dark:hover:border-slate-800 disabled:hover:bg-transparent disabled:hover:-translate-y-0 disabled:hover:shadow-none"
                      >
                        <span className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-1">{grade}</span>
                        <span className={`text-[10px] font-bold uppercase ${calculatedPts >= 0 ? 'text-green-500' : 'text-danger'}`}>
                          {calculatedPts > 0 ? '+' : ''}{calculatedPts}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isAddSlotOpen.open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddSlotOpen({ open: false, day: 0 })}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-tight">Fach hinzufügen</h2>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Fach (z.B. Mathematik)"
                  value={newSlot.subject}
                  onChange={(e) => setNewSlot(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-300"
                />
                <input 
                  type="time" 
                  value={newSlot.time}
                  onChange={(e) => setNewSlot(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-300 font-mono"
                />
                <button 
                  onClick={addScheduleSlot}
                  className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-xl shadow-primary/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Bestätigen
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isSettingsOpen && (
          <div key="modal-settings" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-6">Profil bearbeiten</h2>
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-300"
                />
                <input 
                  type="text" 
                  value={tempGrade}
                  onChange={(e) => setTempGrade(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-2xl text-sm font-semibold outline-none transition-all duration-300"
                />
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Themen Farbe</label>
                  <div className="flex gap-3">
                    {['blue', 'purple', 'green', 'rose', 'amber', 'orange'].map(color => (
                        <button
                          key={color}
                          onClick={() => setThemeColor(color)}
                          className={`w-8 h-8 rounded-full transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                            color === 'blue' ? 'bg-blue-500' :
                            color === 'purple' ? 'bg-purple-500' :
                            color === 'green' ? 'bg-green-500' :
                            color === 'rose' ? 'bg-rose-500' :
                            color === 'amber' ? 'bg-amber-500' : 
                            'bg-orange-500'
                          } ${themeColor === color ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ring-slate-400 dark:ring-slate-500 scale-110' : ''}`}
                        />
                    ))}
                  </div>
                </div>
                <button 
                  onClick={saveSettings}
                  className="w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Speichern
                </button>
                <button 
                  onClick={() => { setIsSettingsOpen(false); setIsApkModalOpen(true); }}
                  className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all cursor-pointer mt-3"
                >
                  <Download className="w-5 h-5" />
                  App herunterladen (APK/PWA)
                </button>
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  {!isDevMode ? (
                    <button 
                      onClick={() => { setIsDevPasswordModalOpen(true); }}
                      className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer text-sm"
                    >
                      <Terminal className="w-4 h-4" />
                      Developer Mode aktivieren
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setIsDevMode(false);
                        setDevResetClicks(0);
                      }}
                      className="w-full flex items-center justify-center gap-2 text-amber-500 font-bold py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 transition-all cursor-pointer"
                    >
                      <Zap className="w-5 h-5 fill-current" />
                      Developer Mode beenden
                    </button>
                  )}
                  <button 
                    onClick={() => { setIsSettingsOpen(false); logout(); }}
                    className="w-full text-danger font-bold py-3 rounded-2xl hover:bg-danger/10 transition-all cursor-pointer"
                  >
                    Abmelden (@{authUsername})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Developer Mode Password Modal */}
        {isDevPasswordModalOpen && (
          <div key="modal-dev-pwd" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Terminal className="text-primary w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-center mb-2">Entwicklerzugang</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-6 text-sm">
                Bitte gib das Administrator-Passwort ein, um den Developer Mode freizuschalten.
              </p>
              <input 
                type="password"
                placeholder="Passwort"
                value={devPasswordInput}
                onChange={(e) => setDevPasswordInput(e.target.value)}
                className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:border-primary/30 rounded-2xl mb-4 outline-none font-mono"
              />
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsDevPasswordModalOpen(false)}
                  className="py-4 px-4 rounded-2xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={() => {
                    if (devPasswordInput === 'dev12pas') {
                      setIsDevMode(true);
                      setIsDevPasswordModalOpen(false);
                      setDevPasswordInput('');
                      triggerCelebration('Dev Mode aktiv!', 'Willkommen, Administrator.');
                    } else {
                      triggerCelebration('Falsches Passwort', 'Zugriff verweigert.');
                    }
                  }}
                  className="py-4 px-4 rounded-2xl font-bold bg-primary text-white"
                >
                  Bestätigen
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Reminders Modal */}
        {remindersToShow.length > 0 && (
          <div key="modal-reminders" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white leading-tight">Erinnerungen!</h3>
                  <p className="text-sm text-slate-500 font-medium">Das steht bald an:</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto min-h-0 space-y-3 mb-6 pr-2 hide-scrollbar">
                {remindersToShow.map(r => (
                  <div key={r.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-xl flex items-start gap-3">
                    <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${r.type === 'exam' ? 'bg-danger/10 text-danger' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'}`}>
                      {r.type === 'exam' ? <Bell className="w-4 h-4" /> : <ListTodo className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5" style={{ color: r.type === 'exam' ? '#ef4444' : '#6366f1' }}>
                        {r.type === 'exam' ? 'Arbeit/Test' : 'Termin'}
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white leading-snug">{r.title}</div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
                        <Calendar className="w-3 h-3" /> Am {new Date(r.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={() => {
                  const dismissed = remindersToShow.map(r => r.id);
                  setProfile(p => ({
                    ...p,
                    dismissedReminders: [...(p.dismissedReminders || []), ...dismissed]
                  }));
                  setRemindersToShow([]);
                }} 
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-primary/20"
              >
                Okay, hab's gesehen
              </button>
            </motion.div>
          </div>
        )}

        {isWeeklyRecapOpen && (
          <div key="modal-weekly-recap" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              onClick={() => setIsWeeklyRecapOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center bg-gradient-to-br from-primary to-blue-600">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/30">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Wochen-Recap</h2>
                <p className="text-blue-100 font-bold opacity-80">Deine Erfolge der Woche</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Punkte</p>
                    <p className="text-2xl font-display font-black text-primary">+{weeklyStats.points.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Meldungen</p>
                    <p className="text-2xl font-display font-black text-slate-800 dark:text-white">{weeklyStats.participations}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Schnitt</p>
                    <p className="text-2xl font-display font-black text-emerald-500">{weeklyStats.avgGrade || '-'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl text-center border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-1">Aktive Tage</p>
                    <p className="text-2xl font-display font-black text-amber-500">{weeklyStats.activeDays}/7</p>
                  </div>
                </div>

                {weeklyStats.bestGrade && weeklyStats.bestGrade <= 2 && (
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-800 rounded-xl flex items-center justify-center text-emerald-600 font-black">1</div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Starke Leistung!</p>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80">Deine beste Note diese Woche war eine {weeklyStats.bestGrade}.</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setIsWeeklyRecapOpen(false)}
                  className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-900/10 dark:shadow-white/5"
                >
                  Weiter geht's!
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isApkModalOpen && (
          <div key="modal-apk" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsApkModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display font-bold text-xl dark:text-white flex items-center gap-2">
                  <Download className="text-secondary w-6 h-6" />
                  App installieren
                </h3>
                <button 
                  onClick={() => setIsApkModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-slate-600 dark:text-slate-300">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl">
                  <p className="text-sm font-semibold mb-2 text-primary">Direkter PWA-Download (Empfohlen)</p>
                  <p className="text-sm">
                    Du musst keine schwere APK herunterladen! Road to Success funktioniert als <b>Progressive Web App (PWA)</b> und lässt sich wie eine native App nutzen.
                  </p>
                  <ul className="text-sm mt-3 space-y-2 list-disc list-inside">
                    <li><b>Android (Chrome):</b> Tippe oben auf die 3 Punkte und wähle <span className="font-bold">„Zum Startbildschirm zufügen“</span> (oder „App installieren“).</li>
                    <li><b>iOS (Safari):</b> Tippe unten auf den Teilen-Button und wähle <span className="font-bold">„Zum Home-Bildschirm“</span>.</li>
                  </ul>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                  <p className="text-sm font-semibold mb-2">Echte APK erstellen</p>
                  <p className="text-[13px]">
                    Diese web-basierte Demo-Vorschau kann serverseitig keine APK-Datei kompilieren (dafür fehlen Java/Android Studio). 
                    <br/><br/>
                    Um selbst eine APK zu erstellen, exportiere diese App als ZIP und nutze Tools wie <a href="https://www.pwabuilder.com/" target="_blank" className="text-blue-500 underline">PWABuilder</a> oder <b>Capacitor/Cordova</b>, um dein Projekt lokal zu kompilieren.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <button 
                  onClick={() => setIsApkModalOpen(false)}
                  className="w-full bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Verstanden
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddGoalModalOpen && (
          <div key="modal-add-goal" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddGoalModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="text-indigo-500 w-6 h-6" />
                  Neues Ziel
                </h2>
                <button onClick={() => setIsAddGoalModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Art des Ziels</label>
                  <select 
                    value={newGoalType}
                    onChange={(e) => {
                      const type = e.target.value as any;
                      setNewGoalType(type);
                      setNewGoalTarget(type === 'practice_minutes' ? 30 : 5);
                    }}
                    className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="participations">Im Unterricht melden</option>
                    <option value="practice_minutes">Lernen / Üben</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Wie oft / Wie lange?</label>
                  {newGoalType === 'participations' ? (
                    <select 
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                      className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1">1 mal</option>
                      <option value="2">2 mal</option>
                      <option value="3">3 mal</option>
                      <option value="5">5 mal</option>
                      <option value="10">10 mal</option>
                      <option value="20">20 mal</option>
                      <option value="50">50 mal</option>
                    </select>
                  ) : (
                    <select 
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                      className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="15">15 Minuten</option>
                      <option value="30">30 Minuten</option>
                      <option value="60">1 Stunde</option>
                      <option value="120">2 Stunden</option>
                      <option value="300">5 Stunden</option>
                      <option value="600">10 Stunden</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Wann? (Periode)</label>
                  <select 
                    value={newGoalPeriod}
                    onChange={(e) => setNewGoalPeriod(e.target.value as any)}
                    className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="daily">Jeden Tag</option>
                    <option value="weekly">Jede Woche</option>
                    <option value="monthly">Jeden Monat</option>
                  </select>
                </div>
              </div>
              
              <button 
                onClick={handleAddGoal}
                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                Ziel hinzufügen
              </button>
            </motion.div>
          </div>
        )}

        {isChallengeProgressModalOpen && (
          <div key="modal-challenge-progress" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChallengeProgressModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="text-indigo-500 w-6 h-6" />
                  Fortschritt eintragen
                </h2>
                <button onClick={() => setIsChallengeProgressModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Wie viel hast du neu geschafft?</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Anzahl..."
                    value={challengeProgressInput === 0 ? '' : challengeProgressInput}
                    onChange={(e) => setChallengeProgressInput(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">Trage hier z.B. 1 ein, wenn du dich einmal neu gemeldet hast, oder 30 für 30 Minuten üben.</p>
                </div>
              </div>
              
              <button 
                onClick={handleSubmitChallengeProgress}
                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                Fortschritt speichern
              </button>
            </motion.div>
          </div>
        )}

        {isPracticeModalOpen && (
          <div key="modal-practice" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPracticeModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl dark:border dark:border-slate-800"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Dumbbell className="text-indigo-500 w-6 h-6" />
                  Geübt
                </h2>
                <button onClick={() => setIsPracticeModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Wie lange hast du geübt?</label>
                  <select 
                    value={practiceDuration}
                    onChange={(e) => setPracticeDuration(Number(e.target.value))}
                    className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="15">15 Minuten</option>
                    <option value="20">20 Minuten</option>
                    <option value="25">25 Minuten</option>
                    <option value="30">30 Minuten</option>
                    <option value="45">45 Minuten</option>
                    <option value="50">50 Minuten</option>
                    <option value="60">60 Minuten</option>
                    <option value="90">90 Minuten</option>
                    <option value="120">120 Minuten</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Welches Fach?</label>
                  <select
                    value={practiceSubject}
                    onChange={(e) => setPracticeSubject(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-bold appearance-none outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Kein Fach gewählt</option>
                    {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Was genau hast du gemacht? (Tagebuch)</label>
                  <textarea 
                    placeholder="Z.B. Vokabeln wiederholt, Mathe-Aufgaben gelöst..." 
                    value={practiceNote}
                    onChange={(e) => setPracticeNote(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-4 py-3 font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                  />
                </div>
              </div>
              
              <button 
                onClick={submitPractice}
                className="w-full bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
              >
                Eintragen (+{practiceDuration * 2} Pkt)
              </button>
            </motion.div>
          </div>
        )}

        {isTimerOpen && (
          <div key="modal-timer" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTimerOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-6 pb-2">
                <h3 className="font-display font-bold text-xl dark:text-white flex items-center gap-2">
                  <Timer className="text-indigo-500 w-6 h-6" />
                  Study Timer
                </h3>
                <button 
                  onClick={() => setIsTimerOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col items-center">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-6 w-full">
                  <button 
                    onClick={() => {
                      setTimerMode('focus');
                      setTimeLeft(timerDuration * 60);
                      setIsTimerActive(false);
                    }}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${timerMode === 'focus' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Fokus ({timerDuration}m)
                  </button>
                  <button 
                    onClick={() => {
                      setTimerMode('break');
                      setTimeLeft(5 * 60);
                      setIsTimerActive(false);
                    }}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${timerMode === 'break' ? 'bg-white dark:bg-slate-700 text-green-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Pause (5m)
                  </button>
                </div>

                {timerMode === 'focus' && (
                  <div className="w-full space-y-3 mb-6">
                    <div className="flex gap-2">
                      <select 
                        value={timerDuration}
                        onChange={(e) => { 
                          setTimerDuration(Number(e.target.value)); 
                          setTimeLeft(Number(e.target.value) * 60); 
                        }}
                        disabled={isTimerActive}
                        className="flex-1 bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 appearance-none text-center"
                      >
                        <option value="15">15 Min</option>
                        <option value="25">25 Min</option>
                        <option value="30">30 Min</option>
                        <option value="45">45 Min</option>
                        <option value="50">50 Min</option>
                        <option value="60">60 Min</option>
                        <option value="90">90 Min</option>
                      </select>
                      <select
                        value={timerSubject}
                        onChange={(e) => setTimerSubject(e.target.value)}
                        disabled={isTimerActive}
                        className="flex-[2] bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 appearance-none text-center"
                      >
                        <option value="">Kein Fach gewählt</option>
                        {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <input 
                      type="text" 
                      placeholder="Was übst du? (Tagebuch)" 
                      value={timerNote}
                      onChange={(e) => setTimerNote(e.target.value)}
                      disabled={isTimerActive}
                      className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                )}

                <div className="relative w-48 h-48 flex items-center justify-center mb-8">
                  <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                    <circle cx="96" cy="96" r="88" className="stroke-slate-100 dark:stroke-slate-800" strokeWidth="8" fill="none" />
                    <circle 
                      cx="96" 
                      cy="96" 
                      r="88" 
                      className={`transition-all duration-1000 ease-linear ${timerMode === 'focus' ? 'stroke-indigo-500' : 'stroke-green-500'}`} 
                      strokeWidth="8" 
                      fill="none" 
                      strokeDasharray={2 * Math.PI * 88}
                      strokeDashoffset={2 * Math.PI * 88 * (1 - timeLeft / (timerMode === 'focus' ? timerDuration * 60 : 5 * 60))}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="text-center z-10">
                    <span className="block text-5xl font-display font-bold text-slate-900 dark:text-white tabular-nums tracking-tighter">
                      {formatTime(timeLeft)}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {timerMode === 'focus' ? 'Bleib fokussiert' : 'Entspann dich'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full">
                  <button 
                    onClick={() => setIsTimerActive(!isTimerActive)}
                    className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all text-white ${timerMode === 'focus' ? (isTimerActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-500 hover:bg-indigo-600') : (isTimerActive ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600')}`}
                  >
                    {isTimerActive ? (
                      <>
                        <Pause className="w-5 h-5 fill-current" /> Pause
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" /> Start
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      setIsTimerActive(false);
                      setTimeLeft(timerMode === 'focus' ? timerDuration * 60 : 5 * 60);
                    }}
                    className="w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isDiaryOpen && (
          <div key="modal-diary" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDiaryOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="font-display font-bold text-xl dark:text-white flex items-center gap-2">
                  <BookOpen className="text-purple-500 w-6 h-6" />
                  Mein Tagebuch
                </h3>
                <button 
                  onClick={() => setIsDiaryOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 mb-4 pr-1">
                {profile.diary && profile.diary.length > 0 ? (
                  profile.diary.map(entry => (
                    <div key={entry.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <div className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-2">
                        {new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{entry.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Noch keine Einträge vorhanden.</p>
                  </div>
                )}
              </div>

              <div className="shrink-0 space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <textarea
                  value={diaryText}
                  onChange={(e) => setDiaryText(e.target.value)}
                  placeholder="Wie war dein Tag heute?"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-2 border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-primary/30 focus:shadow-md focus:-translate-y-0.5 rounded-2xl text-sm outline-none resize-none h-24 transition-all duration-300"
                />
                <button 
                  onClick={addDiaryEntry}
                  disabled={!diaryText.trim()}
                  className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  Eintrag speichern
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isGradesOpen && (
          <div key="modal-grades" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGradesOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="font-display font-bold text-xl dark:text-white flex items-center gap-2">
                  <TrendingUp className="text-orange-500 w-6 h-6" />
                  Noten-Prognose
                </h3>
                <button 
                  onClick={() => setIsGradesOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
                {getAvailableSubjects(profile).length > 0 ? (
                  getAvailableSubjects(profile).map(subject => {
                    const baseGrade = profile.estimatedGrades?.[subject] || 3.0;
                    const trend = getTrendGrade(subject, baseGrade, profile.history);
                    return (
                      <div key={subject} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-900 dark:text-white">{subject}</span>
                          <span className="font-display font-bold text-2xl" style={{ 
                            color: trend <= 2.5 ? '#10b981' : trend <= 4.0 ? '#f59e0b' : '#ef4444' 
                          }}>
                            {trend.toFixed(1)}
                          </span>
                        </div>
                        
                        {editingSubject === subject ? (
                          <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grundschätzung (1-6)</label>
                            <div className="flex items-center gap-3">
                              <input 
                                type="range" 
                                min="1" max="6" step="0.5" 
                                value={tempEstGrade} 
                                onChange={(e) => setTempEstGrade(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <span className="font-bold text-slate-700 dark:text-slate-300 w-8">{tempEstGrade.toFixed(1)}</span>
                            </div>
                            <button 
                              onClick={() => saveEstimatedGrade(subject, tempEstGrade)}
                              className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl transition-colors cursor-pointer"
                            >
                              Speichern
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Basis: <b>{baseGrade.toFixed(1)}</b>
                            </span>
                            <button 
                              onClick={() => { setTempEstGrade(baseGrade); setEditingSubject(subject); }}
                              className="text-xs font-bold text-orange-500 hover:text-orange-600 cursor-pointer"
                            >
                              Anpassen
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Füge zuerst Fächer im Stundenplan oder durch Meldungen hinzu.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {subjectDetails && (() => {
          const subjectHistory = profile.history.filter(h => h.subject === subjectDetails);
          const participations = subjectHistory.filter(h => h.type === 'participation');
          const grades = subjectHistory.filter(h => h.type === 'grade');
          const pointsInSubject = subjectHistory.reduce((sum, h) => sum + (h.points || 0), 0);
          const baseGrade = profile.estimatedGrades?.[subjectDetails] || 3.0;
          const trend = getTrendGrade(subjectDetails, baseGrade, profile.history);

          return (
            <motion.div key="subjectDetails" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSubjectDetails(null)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, y: 100, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.95 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]"
              >
                <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="font-display font-bold text-2xl dark:text-white flex items-center gap-2">
                      <BookOpen className="text-blue-500 w-6 h-6" />
                      {subjectDetails}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Fach-Details und Statistiken</p>
                  </div>
                  <button 
                    onClick={() => setSubjectDetails(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-3xl border border-orange-100 dark:border-orange-500/20">
                      <p className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Prognose
                      </p>
                      <p className="font-display font-bold text-3xl" style={{ color: trend <= 2.5 ? '#10b981' : trend <= 4.0 ? '#f59e0b' : '#ef4444' }}>
                        {trend.toFixed(1)}
                      </p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-500/10 p-4 rounded-3xl border border-yellow-100 dark:border-yellow-500/20">
                      <p className="text-yellow-600 dark:text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Trophy className="w-4 h-4" /> Punkte
                      </p>
                      <p className="font-display font-bold text-3xl text-yellow-600 dark:text-yellow-500">
                        {pointsInSubject}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                      <Hand className="w-5 h-5 text-blue-500" />
                      Meldungen ({participations.length})
                    </h4>
                    {participations.length > 0 ? (
                      <div className="space-y-3">
                        {participations.slice().reverse().slice(0, 5).map(p => (
                          <div key={p.id} className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                            <span className="text-slate-600 dark:text-slate-300">
                              {new Date(p.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}
                            </span>
                            <span className="font-bold text-blue-500">+{p.points} Pkt</span>
                          </div>
                        ))}
                        {participations.length > 5 && (
                          <p className="text-xs text-center text-slate-400 font-medium italic pt-2">
                            +{participations.length - 5} weitere Meldungen
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Noch keine Meldungen in diesem Fach.</p>
                    )}
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                      <GraduationCap className="w-5 h-5 text-green-500" />
                      Noten / Arbeiten ({grades.length})
                    </h4>
                    {grades.length > 0 ? (
                      <div className="space-y-3">
                        {grades.slice().reverse().map(g => (
                          <div key={g.id} className="flex justify-between items-center text-sm border-b border-slate-200 dark:border-slate-700 pb-2 last:border-0 last:pb-0">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-white">Note {g.value}</span>
                              <span className="text-xs text-slate-500">
                                {new Date(g.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              </span>
                            </div>
                            <span className="font-bold text-green-500">+{g.points} Pkt</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">Noch keine Noten in diesem Fach eingetragen.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Celebration Overlay */}
      <AnimatePresence>
        {celebrationInfo && (
          <div key="modal-celebration" className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1, y: -20 }}
              className="bg-white/90 dark:bg-slate-900/95 p-8 rounded-[3rem] shadow-2xl backdrop-blur-xl flex flex-col items-center border border-white/20 dark:border-slate-700 max-w-sm w-full text-center"
            >
              <motion.span 
                animate={{ rotate: [-10, 10, -10, 10, 0], scale: [1, 1.2, 1] }} 
                transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                className="text-7xl mb-6 shadow-sm"
              >
                🌟
              </motion.span>
              <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 uppercase tracking-tighter leading-tight">
                {celebrationInfo.title}
              </h2>
              {celebrationInfo.subtitle && (
                <p className="mt-3 text-lg font-bold text-slate-600 dark:text-slate-300">
                  {celebrationInfo.subtitle}
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

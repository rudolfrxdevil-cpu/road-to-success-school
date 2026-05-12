/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';

// --- Types ---

type Grade = 1 | 2 | 3 | 4 | 5 | 6;

interface HistoryEntry {
  id: string;
  type: 'participation' | 'grade' | 'challenge';
  value: number | Grade | string;
  points: number;
  date: number;
  comment?: string;
  subject?: string;
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
  lastResults?: {
     promoted: boolean;
     relegated: boolean;
     rank: number;
     leagueName: string;
  };
  bots: BotData[];
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
  estimatedGrades?: Record<string, number>;
  unlockedAchievements?: string[];
  multiplayer?: MultiplayerData;
}

type Tab = 'dashboard' | 'schedule' | 'stats' | 'achievements' | 'multiplayer' | 'dev';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (profile: UserProfile) => boolean;
}

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
  
  // Participations improve it slightly (subtract 0.05 per participation)
  grade = grade - (participations.length * 0.05);
  
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

  // --- Multiplayer & Verschiedenes (6) ---
  { id: 'reached_bronze', title: 'Aufgeschlagen', description: 'Bronze Liga erreicht.', icon: '🥉', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 1 },
  { id: 'reached_silver', title: 'Glänzend', description: 'Silber Liga erreicht.', icon: '🥈', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 2 },
  { id: 'reached_gold', title: 'Goldschmied', description: 'Gold Liga erreicht.', icon: '🥇', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 3 },
  { id: 'reached_platinum', title: 'Platin-Status', description: 'Platin Liga erreicht.', icon: '💎', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 4 },
  { id: 'reached_legend', title: 'Legende der Liga', description: 'Legenden Liga erreicht. Zeig ihnen wer der Boss ist!', icon: '👺', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 6 },
  { id: 'reached_god', title: 'Road to Success Gott', description: 'Du hast den Status eines Gottes erreicht.', icon: '⚡', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 12 },
  { id: 'reached_infinity', title: 'Die Unendlichkeit', description: 'Du hast die letzte bekannte Liga erreicht. Was kommt jetzt?', icon: '♾️', condition: (p) => !!p.multiplayer && p.multiplayer.leagueLevel >= 15 },
  { id: 'weekend_warrior', title: 'Wochenend-Krieger', description: 'Aktivität am Samstag oder Sonntag.', icon: '⚔️', condition: (p) => p.history.some(h => {
    const day = new Date(h.date).getDay();
    return day === 0 || day === 6;
  }) },
];

// --- Constants ---

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
    // Die Punkte skalieren mit steigender Liga immer stärker (exponentiell)
    // Level 0: ~35 Avg, Level 6: ~270 Avg
    const avgPointsPerDay = 20 + Math.pow(1.6, leagueLevel) * 15; 
    
    // Damit nicht alle gleich stark sind, bekommt jeder Bot einen kleinen Multiplikator
    const botSkillModifier = 0.7 + (Math.random() * 0.6); // 0.7 bis 1.3
    
    for(let d=0; d<7; d++) {
      if (Math.random() < 0.2) {
         // An manchen Tagen macht der Bot eine Pause
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
  return {
    leagueLevel,
    weekStart,
    bots
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
          
          return { ...prev, multiplayer: newData };
        }
        
        return prev;
      });
    }
  }, [authUsername, profile.name]);

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
        
        if (prev.lastLoginDate !== today || prev.streak !== newStreak) {
          return { ...prev, lastLoginDate: today, streak: newStreak };
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [devResetClicks, setDevResetClicks] = useState(0);
  const [isDevPasswordModalOpen, setIsDevPasswordModalOpen] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [partMode, setPartMode] = useState<'total' | 'subject'>('total');
  const [partTotal, setPartTotal] = useState<number>(1);
  const [partSubjects, setPartSubjects] = useState<Record<string, number>>({});
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
        triggerCelebration('Fokus-Session beendet!', '+50 Punkte');
        setProfile(prev => ({
          ...prev,
          points: prev.points + 50,
          history: [...prev.history, {
            id: Math.random().toString(36).substr(2, 9),
            type: 'challenge',
            value: 1,
            points: 50,
            date: Date.now(),
            comment: 'Fokus-Session'
          }]
        }));
        setTimerMode('break');
        setTimeLeft(5 * 60);
      } else {
        triggerCelebration('Pause beendet!', 'Bereit für die nächste Session?');
        setTimerMode('focus');
        setTimeLeft(25 * 60);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timeLeft, timerMode]);

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

  // Daily Challenges Logic
  const dailyChallenges = useMemo(() => {
    const todayStr = new Date().toDateString();
    const todayHistory = profile.history.filter(h => new Date(h.date).toDateString() === todayStr);
    const partCount = todayHistory.filter(h => h.type === 'participation').length;
    const gradeCount = todayHistory.filter(h => h.type === 'grade').length;

    const targets = [
      { id: 'p5', type: 'participation', target: 5, points: 50, title: '5x gemeldet', current: partCount },
      { id: 'p10', type: 'participation', target: 10, points: 100, title: '10x gemeldet', current: partCount },
      { id: 'g1', type: 'grade', target: 1, points: 50, title: 'Note eintragen', current: gradeCount }
    ];

    return targets.map(t => {
      const completed = todayHistory.some(h => h.type === 'challenge' && h.comment === t.id);
      return { ...t, current: Math.min(t.current, t.target), completed };
    });
  }, [profile.history]);

  useEffect(() => {
    let awarded = false;
    const newEntries: HistoryEntry[] = [];
    let earnedPoints = 0;

    dailyChallenges.forEach(c => {
      if (c.current >= c.target && !c.completed) {
        awarded = true;
        earnedPoints += c.points;
        newEntries.push({
           id: Math.random().toString(36).substr(2, 9),
           type: 'challenge',
           value: c.target,
           points: c.points,
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
                <div className="grid grid-cols-2 gap-4">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={openPartModal}
                    className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                    id="participation-btn"
                  >
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Hand className="text-blue-500 w-8 h-8" />
                    </div>
                    <span className="font-display font-bold text-slate-900 dark:text-white transition-colors">Gemeldet</span>
                    <span className="text-xs text-blue-500 font-bold mt-1">+{PARTICIPATION_POINTS} Punkte</span>
                  </motion.button>

                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={openGradeModal}
                    className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer"
                    id="grade-btn"
                  >
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <GraduationCap className="text-green-500 w-8 h-8" />
                    </div>
                    <span className="font-display font-bold text-slate-900 dark:text-white transition-colors">Arbeit/Test</span>
                    <span className="text-xs text-green-500 font-bold mt-1">Bonuspunkte</span>
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

              {/* Daily Challenges */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Target className="w-4 h-4 text-slate-400" />
                    Daily Challenges
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
                        profile.schedule[dayIndex].map((slot) => (
                          <div 
                            key={slot.id} 
                            onClick={() => setSubjectDetails(slot.subject)}
                            className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 group cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm hover:-translate-y-0.5 transition-all duration-300"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center shadow-sm">
                                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{slot.subject}</p>
                                {slot.time && <p className="text-[10px] text-slate-400 font-bold uppercase">{slot.time} Uhr</p>}
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteScheduleSlot(dayIndex, slot.id); }}
                              className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-600 hover:text-danger hover:bg-danger/10 rounded-full transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
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
          <div className="fixed inset-0 z-[60] flex">
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
                      <span className="font-bold flex items-center gap-2">Multiplayer</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isPartModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
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

        {isApkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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

        {isTimerOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-8 w-full">
                  <button 
                    onClick={() => {
                      setTimerMode('focus');
                      setTimeLeft(25 * 60);
                      setIsTimerActive(false);
                    }}
                    className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${timerMode === 'focus' ? 'bg-white dark:bg-slate-700 text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Fokus (25m)
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
                      strokeDashoffset={2 * Math.PI * 88 * (1 - timeLeft / (timerMode === 'focus' ? 25 * 60 : 5 * 60))}
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
                      setTimeLeft(timerMode === 'focus' ? 25 * 60 : 5 * 60);
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
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
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none p-4">
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

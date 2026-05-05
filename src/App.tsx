/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  BookOpen
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

interface UserProfile {
  name: string;
  gradeLevel: string;
  points: number;
  streak: number;
  lastLoginDate: number;
  history: HistoryEntry[];
  schedule: Record<number, ScheduleSlot[]>; // 0 = Mon, 1 = Tue, etc.
  diary?: { id: string; date: number; text: string }[];
}

type Tab = 'dashboard' | 'schedule' | 'stats' | 'achievements';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: (profile: UserProfile) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_participation', title: 'Erste Meldung', description: 'Du hast dich zum ersten Mal gemeldet.', icon: '🙋', condition: (p) => p.history.some(h => h.type === 'participation') },
  { id: '10_participations', title: '10 Meldungen', description: 'Du hast dich 10 Mal gemeldet!', icon: '🗣️', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 10 },
  { id: '50_participations', title: 'Quasselstrippe', description: 'Du hast dich unglaubliche 50 Mal gemeldet.', icon: '🦜', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 50 },
  { id: '100_participations', title: 'Megaphon', description: 'Legendär! Du hast dich 100 Mal gemeldet.', icon: '📢', condition: (p) => p.history.filter(h => h.type === 'participation').length >= 100 },
  { id: 'first_grade_1', title: 'Musterschüler', description: 'Du hast deine erste 1 geschrieben.', icon: '🌟', condition: (p) => p.history.some(h => h.type === 'grade' && h.value === 1) },
  { id: '3_grades_1', title: 'Streber', description: 'Du hast schon drei 1er geschrieben.', icon: '🤓', condition: (p) => p.history.filter(h => h.type === 'grade' && h.value === 1).length >= 3 },
  { id: '10_challenges', title: 'Herausforderer', description: 'Du hast 10 Daily Challenges geschafft.', icon: '⚔️', condition: (p) => p.history.filter(h => h.type === 'challenge').length >= 10 },
  { id: 'first_schedule', title: 'Organisiert', description: 'Du hast ein Fach in deinen Stundenplan eingetragen.', icon: '📅', condition: (p) => Object.values(p.schedule).some((day: any) => day && day.length > 0) },
  { id: 'streak_3', title: 'Am Ball bleiben', description: 'Du warst 3 Tage in Folge aktiv.', icon: '🔥', condition: (p) => p.streak >= 3 },
  { id: 'streak_7', title: 'Wochenmeister', description: 'Du warst 7 Tage in Folge aktiv.', icon: '📅', condition: (p) => p.streak >= 7 },
  { id: 'streak_30', title: 'Unaufhaltsam', description: 'Ein ganzer Monat ununterbrochen aktiv!', icon: '🏆', condition: (p) => p.streak >= 30 },
  { id: 'rank_2', title: 'Aufsteiger', description: 'Du hast den zweiten Rang erreicht.', icon: '🚀', condition: (p) => p.points >= 500 },
  { id: 'points_10k', title: 'Punktestand über 9000!', description: 'Du hast über 9000 Punkte gesammelt.', icon: '🔥', condition: (p) => p.points >= 9001 },
];

// --- Constants ---

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'];

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
                diary: []
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
          Klassenheld
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
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl text-sm font-semibold outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Passwort</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl text-sm font-semibold outline-none transition-all"
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

  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('klassenheld_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.schedule) parsed.schedule = { 0: [], 1: [], 2: [], 3: [], 4: [] };
      if (typeof parsed.streak !== 'number') parsed.streak = 0;
      if (typeof parsed.lastLoginDate !== 'number') parsed.lastLoginDate = 0;
      if (!parsed.diary) parsed.diary = [];
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
      diary: []
    };
  });

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
        if (lastLoginDay === 0) {
          newStreak = 1;
        } else if (today - lastLoginDay === oneDay) {
          newStreak += 1;
        } else if (today - lastLoginDay > oneDay) {
          newStreak = 1;
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
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [partMode, setPartMode] = useState<'total' | 'subject'>('total');
  const [partTotal, setPartTotal] = useState<number>(1);
  const [partSubjects, setPartSubjects] = useState<Record<string, number>>({});
  const [selectedSubject, setSelectedSubject] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [diaryText, setDiaryText] = useState("");
  const [statsTimeFilter, setStatsTimeFilter] = useState<'week' | 'month' | 'halfyear' | 'all'>('all');
  const [isAddSlotOpen, setIsAddSlotOpen] = useState<{ open: boolean; day: number }>({ open: false, day: 0 });
  const [newSlot, setNewSlot] = useState({ subject: '', time: '' });
  
  const [tempName, setTempName] = useState(profile.name);
  const [tempGrade, setTempGrade] = useState(profile.gradeLevel);

  const [isSyncing, setIsSyncing] = useState(false);

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
         console.error("API error, falling back locally", e);
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

  // --- Derived State ---

  const currentRankIndex = useMemo(() => {
    const sortedRanks = [...RANKS].sort((a, b) => b.min - a.min);
    const index = sortedRanks.findIndex(r => profile.points >= r.min);
    return RANKS.indexOf(sortedRanks[index]);
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

  // --- Actions ---

  const openPartModal = () => {
    setIsPartModalOpen(true);
    setPartMode('total');
    setPartTotal(1);
    setPartSubjects({});
  };

  const submitParticipation = () => {
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
         history: [...newEntries, ...prev.history].slice(0, 50)
       }));
    }
    
    setIsPartModalOpen(false);
  };

  const addGradeResult = (grade: Grade) => {
    if (!selectedSubject) return;
    const points = GRADE_POINTS[grade];
    const entry: HistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'grade',
      value: grade,
      points: points,
      date: Date.now(),
      subject: selectedSubject
    };

    setProfile(prev => ({
      ...prev,
      points: Math.max(0, prev.points + points),
      history: [entry, ...prev.history].slice(0, 50)
    }));
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans pb-32 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-40 px-4 py-4 md:px-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                    className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-pointer"
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
                    className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                    id="grade-btn"
                  >
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <GraduationCap className="text-green-500 w-8 h-8" />
                    </div>
                    <span className="font-display font-bold text-slate-900 dark:text-white transition-colors">Arbeit/Test</span>
                    <span className="text-xs text-green-500 font-bold mt-1">Bonuspunkte</span>
                  </motion.button>
                </div>
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsDiaryOpen(true)}
                  className="w-full flex items-center justify-between p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="text-purple-500 w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span className="block font-display font-bold text-slate-900 dark:text-white transition-colors">Tagebuch</span>
                      <span className="text-xs text-purple-500 font-bold mt-0.5">Wie war dein Tag?</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition-transform" />
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
                          <div key={slot.id} className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 group">
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
                              onClick={() => deleteScheduleSlot(dayIndex, slot.id)}
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

              <section className="grid grid-cols-2 gap-4">
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ø Meldungen/Tag</span>
                  <p className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                    {(participationStats.reduce((acc, curr) => acc + curr.count, 0) / 7).toFixed(1)}
                  </p>
                </div>
                <div className="card p-5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Punkte</span>
                  <p className="text-2xl font-display font-bold text-primary">{profile.points}</p>
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
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ACHIEVEMENTS.map((achievement) => {
                  const unlocked = achievement.condition(profile);
                  return (
                    <div 
                      key={achievement.id}
                      className={`relative overflow-hidden p-6 rounded-3xl border-2 transition-all ${
                        unlocked 
                          ? 'bg-white dark:bg-slate-900 border-primary/20 shadow-lg shadow-primary/5' 
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
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-slate-100 dark:border-slate-800 pb-safe">
        <div className="max-w-2xl mx-auto px-6 h-20 flex items-center justify-around flex-row">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'schedule', icon: Calendar, label: 'Plan' },
            { id: 'stats', icon: BarChart3, label: 'Stats' },
            { id: 'achievements', icon: Medal, label: 'Erfolge' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex flex-col items-center gap-1 transition-all relative py-2 px-6 rounded-2xl cursor-pointer ${
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
              <tab.icon className={`w-6 h-6 transition-transform ${activeTab === tab.id ? 'scale-110' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Modals */}
      <AnimatePresence>
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
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Fach auswählen (Erforderlich)</label>
                  <input 
                    list="subject-list" 
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    placeholder="Fach (z.B. Mathematik)"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-primary/30 border text-sm font-semibold rounded-2xl outline-none transition-all"
                  />
                  <datalist id="subject-list">
                    {availableSubjects.map((s, i) => <option key={i} value={s} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {(Object.entries(GRADE_POINTS) as [string, number][]).map(([grade, pts]) => (
                    <button
                      key={grade}
                      onClick={() => addGradeResult(Number(grade) as Grade)}
                      disabled={!selectedSubject.trim()}
                      className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-50 dark:border-slate-800 hover:border-primary/20 dark:hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-50 disabled:dark:hover:border-slate-800 disabled:hover:bg-transparent"
                    >
                      <span className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-1">{grade}</span>
                      <span className={`text-[10px] font-bold uppercase ${pts >= 0 ? 'text-green-500' : 'text-danger'}`}>
                        {pts > 0 ? '+' : ''}{pts}
                      </span>
                    </button>
                  ))}
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
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <input 
                  type="time" 
                  value={newSlot.time}
                  onChange={(e) => setNewSlot(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all font-mono"
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
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-sm font-semibold outline-none transition-all"
                />
                <input 
                  type="text" 
                  value={tempGrade}
                  onChange={(e) => setTempGrade(e.target.value)}
                  className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-sm font-semibold outline-none transition-all"
                />
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
                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
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
                    Du musst keine schwere APK herunterladen! Klassenheld funktioniert als <b>Progressive Web App (PWA)</b> und lässt sich wie eine native App nutzen.
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl text-sm outline-none resize-none h-24 transition-all"
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
      </AnimatePresence>
    </div>
  );
}

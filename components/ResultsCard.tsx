
import React, { useEffect, useState, useMemo } from 'react';
import { motion, animate } from 'framer-motion';
import {
  RefreshCcw, ExternalLink, Zap, Search, Globe,
  CheckCircle2, HelpCircle, ShieldCheck, AlertTriangle, Shield,
  Volume2, VolumeX, Languages
} from 'lucide-react';
import { AnalysisResult } from '../types';

interface ResultsCardProps {
  result: AnalysisResult;
  inputLang?: string;
  onReset: () => void;
}

const NumberCounter = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);
  return <span>{display}</span>;
};

// Small particle dots around the confidence ring
const RingParticles = ({ color }: { color: string }) => {
  const particles = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i / 8) * 360,
      delay: i * 0.3,
      size: 2 + Math.random() * 2,
    })), []);

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: color,
            top: '50%',
            left: '50%',
            transformOrigin: '0 0',
          }}
          animate={{
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
            rotate: [p.angle, p.angle + 360],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: p.delay,
            ease: 'linear',
          }}
        />
      ))}
    </>
  );
};

// Derive risk level from confidence and verdict
const getRiskLevel = (confidence: number, verdict: string): { level: string; className: string; icon: typeof Shield } => {
  if (verdict === 'REAL' && confidence >= 70) return { level: 'LOW', className: 'risk-badge-low', icon: Shield };
  if (verdict === 'FAKE' || (verdict === 'MISLEADING' && confidence >= 60)) return { level: 'HIGH', className: 'risk-badge-high', icon: AlertTriangle };
  return { level: 'MEDIUM', className: 'risk-badge-medium', icon: AlertTriangle };
};

const LANG_LABEL_MAP: Record<string, { label: string; bcp47: string }> = {
  'hi-IN': { label: 'हिन्दी (Hindi)', bcp47: 'hi-IN' },
  'hi': { label: 'हिन्दी (Hindi)', bcp47: 'hi-IN' },
  'te-IN': { label: 'తెలుగు (Telugu)', bcp47: 'te-IN' },
  'te': { label: 'తెలుగు (Telugu)', bcp47: 'te-IN' },
  'ta-IN': { label: 'தமிழ் (Tamil)', bcp47: 'ta-IN' },
  'ta': { label: 'தமிழ் (Tamil)', bcp47: 'ta-IN' },
  'kn-IN': { label: 'ಕನ್ನಡ (Kannada)', bcp47: 'kn-IN' },
  'kn': { label: 'ಕನ್ನಡ (Kannada)', bcp47: 'kn-IN' },
  'ml-IN': { label: 'മലയാളം (Malayalam)', bcp47: 'ml-IN' },
  'ml': { label: 'മലയാളം (Malayalam)', bcp47: 'ml-IN' },
  'mr-IN': { label: 'మరాఠీ (Marathi)', bcp47: 'mr-IN' },
  'mr': { label: 'మరాఠీ (Marathi)', bcp47: 'mr-IN' },
  'bn-IN': { label: 'বাংলা (Bengali)', bcp47: 'bn-IN' },
  'bn': { label: 'বাংলা (Bengali)', bcp47: 'bn-IN' },
  'es-ES': { label: 'Español (Spanish)', bcp47: 'es-ES' },
  'es': { label: 'Español (Spanish)', bcp47: 'es-ES' },
  'fr-FR': { label: 'Français (French)', bcp47: 'fr-FR' },
  'fr': { label: 'Français (French)', bcp47: 'fr-FR' },
  'de-DE': { label: 'Deutsch (German)', bcp47: 'de-DE' },
  'de': { label: 'Deutsch (German)', bcp47: 'de-DE' },
  'zh-CN': { label: '中文 (Chinese)', bcp47: 'zh-CN' },
  'zh': { label: '中文 (Chinese)', bcp47: 'zh-CN' },
  'ar-SA': { label: 'العربية (Arabic)', bcp47: 'ar-SA' },
  'ar': { label: 'العربية (Arabic)', bcp47: 'ar-SA' },
  'ru-RU': { label: 'Русский (Russian)', bcp47: 'ru-RU' },
  'ru': { label: 'Русский (Russian)', bcp47: 'ru-RU' },
  'ja-JP': { label: '日本語 (Japanese)', bcp47: 'ja-JP' },
  'ja': { label: '日本語 (Japanese)', bcp47: 'ja-JP' },
};

const ResultsCard: React.FC<ResultsCardProps> = ({ result, inputLang = 'en-US', onReset }) => {
  const activeLangCode = result?.targetLangCode || inputLang || 'en-US';

  const isInputEnglish = useMemo(() => {
    if (!activeLangCode) return true;
    return activeLangCode.toLowerCase().startsWith('en');
  }, [activeLangCode]);

  const targetLangInfo = useMemo(() => {
    if (isInputEnglish) return null;
    return LANG_LABEL_MAP[activeLangCode] || { label: result?.targetLangNative ? `${result.targetLangNative} (${result.targetLangName || 'Regional'})` : 'Regional Language', bcp47: activeLangCode };
  }, [activeLangCode, isInputEnglish, result]);

  // Set default language mode: if input is English -> 'en', if non-English -> 'regional'
  const [langMode, setLangMode] = useState<'en' | 'regional'>(() => (isInputEnglish ? 'en' : 'regional'));

  useEffect(() => {
    setLangMode(isInputEnglish ? 'en' : 'regional');
  }, [isInputEnglish]);

  const [isSpeaking, setIsSpeaking] = useState(false);

  // Safe field access with explicit defaults
  const safeVerdict = result?.verdict || 'UNVERIFIED';
  const safeConfidence = typeof result?.confidence === 'number' && isFinite(result.confidence)
    ? Math.max(0, Math.min(100, result.confidence))
    : 50;
  const safeCategories = {
    bias: typeof result?.categories?.bias === 'number' && isFinite(result.categories.bias) ? result.categories.bias : 0,
    sensationalism: typeof result?.categories?.sensationalism === 'number' && isFinite(result.categories.sensationalism) ? result.categories.sensationalism : 0,
    logicalConsistency: typeof result?.categories?.logicalConsistency === 'number' && isFinite(result.categories.logicalConsistency) ? result.categories.logicalConsistency : 50,
  };

  // Stop speech when unmounting or changing result/lang
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const regionalExplanation = result?.explanation_regional || result?.explanation_te;
  const regionalKeyPoints = (result?.keyPoints_regional && result.keyPoints_regional.length > 0)
    ? result.keyPoints_regional
    : (result?.keyPoints_te && result.keyPoints_te.length > 0 ? result.keyPoints_te : []);

  const currentExplanation = langMode === 'regional' && regionalExplanation
    ? regionalExplanation
    : (result?.explanation || 'Analysis complete.');

  const currentKeyPoints = langMode === 'regional' && regionalKeyPoints.length > 0
    ? regionalKeyPoints
    : (result?.keyPoints || []);

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const fullSpeechText = `${safeVerdict} verdict. ${currentExplanation}. Key findings: ${currentKeyPoints.join('. ')}`;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(fullSpeechText);
    utterance.lang = langMode === 'regional' ? (targetLangInfo?.bcp47 || 'hi-IN') : 'en-US';
    utterance.rate = 0.95;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const meta = {
    REAL: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.15)', glowStrong: 'rgba(16, 185, 129, 0.25)' },
    FAKE: { color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.15)', glowStrong: 'rgba(244, 63, 94, 0.25)' },
    MISLEADING: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.15)', glowStrong: 'rgba(245, 158, 11, 0.25)' },
    UNVERIFIED: { color: '#71717a', glow: 'rgba(113, 113, 122, 0.15)', glowStrong: 'rgba(113, 113, 122, 0.25)' },
  }[safeVerdict] ?? { color: '#71717a', glow: 'rgba(113, 113, 122, 0.15)', glowStrong: 'rgba(113, 113, 122, 0.25)' };

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeConfidence / 100) * circumference;
  const risk = getRiskLevel(safeConfidence, safeVerdict);

  const getFavicon = (uri: string) => {
    try { 
      if (!uri || uri === "#") return null;
      return `https://www.google.com/s2/favicons?domain=${new URL(uri).hostname}&sz=64`; 
    }
    catch { return null; }
  };

  const getHostname = (uri: string) => {
    try {
      if (!uri || uri === "#") return "Internal Node";
      return new URL(uri).hostname;
    } catch {
      return "External Source";
    }
  };

  // Staggered card animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const pointVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { duration: 0.5, delay: 0.8 + i * 0.1, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  return (
    <motion.div
      className="space-y-6 max-w-5xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header Verdict Card */}
      <motion.div
        variants={cardVariants}
        className="glass-strong rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-2xl"
      >
        {/* Glow orb */}
        <div
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px] pointer-events-none"
          style={{ backgroundColor: meta.glow }}
        />

        {/* Verdict glow border accent */}
        <div
          className="absolute inset-0 rounded-[2.5rem] pointer-events-none opacity-30"
          style={{
            boxShadow: `inset 0 0 40px ${meta.glow}, 0 0 60px ${meta.glow}`,
          }}
        />

        <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
          {/* Confidence Ring with particles */}
          <div className="relative w-36 h-36 md:w-44 md:h-44 flex items-center justify-center shrink-0">
            <RingParticles color={meta.color} />
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
              <motion.circle
                cx="50" cy="50" r={radius} fill="none" stroke={meta.color} strokeWidth="4"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${meta.color})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl md:text-5xl font-display font-black text-white tracking-tighter">
                <NumberCounter value={safeConfidence} />%
              </div>
              <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-[0.4em] mt-2">Confidence</span>
            </div>
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            {/* Status badge row */}
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
              <motion.div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/5"
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: meta.color }} />
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Analysis Complete</span>
              </motion.div>

              {/* Cache & Popularity Badges */}
              {result.cached && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-black uppercase tracking-widest"
                >
                  <Zap className="w-3 h-3" />
                  Verified Earlier
                </motion.div>
              )}
              {Boolean(result.search_count && result.search_count > 1) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] font-black uppercase tracking-widest"
                >
                  🔥 Checked by {result.search_count} users
                </motion.div>
              )}

              {/* Fake Risk Score Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${risk.className}`}
              >
                <risk.icon className="w-3 h-3" />
                {risk.level} Risk
              </motion.div>
            </div>

            <div className="space-y-1 pt-1">
              <motion.h2
                className="text-5xl md:text-7xl font-display font-black tracking-tighter leading-none"
                style={{ color: meta.color, textShadow: `0 0 40px ${meta.glow}` }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                {safeVerdict}
              </motion.h2>
              <p className="text-zinc-300 text-xs md:text-sm font-semibold tracking-wide opacity-90">
                {safeVerdict === 'REAL' ? 'Verified True Fact' : safeVerdict === 'FAKE' ? 'Debunked Claim (Fake News)' : safeVerdict === 'MISLEADING' ? 'Misleading Information' : 'Unverified Claim'}
              </p>
            </div>
          </div>

          <motion.button
            onClick={onReset}
            className="group p-4 glass rounded-2xl hover:bg-white/[0.06] transition-all border border-white/[0.06]"
            whileHover={{ y: -4, scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            title="New Analysis"
          >
            <RefreshCcw className="w-5 h-5 text-zinc-400 group-hover:text-white group-hover:rotate-180 transition-all duration-700" />
          </motion.button>
        </div>
      </motion.div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Executive Brief */}
        <motion.div
          variants={cardVariants}
          className="lg:col-span-7 glass-strong rounded-[2.5rem] p-8 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <h4 className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] flex items-center gap-2">
              <Zap className="w-3 h-3 text-indigo-400" /> Executive Brief
            </h4>

            <div className="flex items-center gap-2">
              {/* Language Switcher */}
              {isInputEnglish ? (
                <div className="flex items-center bg-indigo-600/20 px-3.5 py-1.5 rounded-xl border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  <Globe className="w-3.5 h-3.5 mr-1.5 text-indigo-400" /> English
                </div>
              ) : (
                <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setLangMode('en')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      langMode === 'en'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLangMode('regional')}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-wider transition-all ${
                      langMode === 'regional'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {targetLangInfo?.label || 'Regional Language'}
                  </button>
                </div>
              )}

              {/* Read Aloud Button */}
              <button
                type="button"
                onClick={handleSpeak}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  isSpeaking
                    ? 'bg-rose-500 text-white border-rose-400 shadow-lg shadow-rose-500/30 animate-pulse'
                    : 'bg-white/[0.04] text-indigo-300 border-white/[0.08] hover:bg-indigo-500/20'
                }`}
                title={isSpeaking ? "Stop Voice Output" : "Read Aloud (Voice)"}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-400" />}
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">
                  {isSpeaking ? 'Stop' : 'Listen'}
                </span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-2">
              Analysis Brief
            </h5>
            <p className="text-lg md:text-xl font-semibold leading-relaxed text-zinc-100">
              {currentExplanation}
            </p>
          </div>

          {/* Key Findings */}
          <div className="space-y-2.5 pt-2">
            <h5 className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
              Key Findings
            </h5>
            {currentKeyPoints.slice(0, 3).map((p, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={pointVariants}
                initial="hidden"
                animate="visible"
                className="px-4 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex gap-3.5 items-start hover:bg-white/[0.04] transition-all duration-300 group"
              >
                <span className="text-[10px] font-black text-indigo-400 pt-0.5 group-hover:text-cyan-400 transition-colors">0{i+1}</span>
                <p className="text-sm font-medium text-zinc-300 leading-relaxed">{p || "Verification detail pending..."}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Grounding Assets */}
        <motion.div
          variants={cardVariants}
          className="lg:col-span-5 glass-strong rounded-[2.5rem] p-8 space-y-6"
        >
          <h4 className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] flex items-center gap-2">
            <Search className="w-3 h-3 text-indigo-400" /> Grounding Assets
          </h4>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {(result?.sources || []).length > 0 ? (result?.sources || []).map((s, i) => (
              <motion.a
                key={i}
                href={s?.uri && s.uri !== '#' ? s.uri : undefined}
                target={s?.uri && s.uri !== '#' ? '_blank' : undefined}
                rel="noreferrer"
                className="flex items-center gap-4 p-3.5 glass rounded-2xl hover:bg-white/[0.05] transition-all group border border-transparent hover:border-white/[0.06] cursor-pointer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.1, duration: 0.4 }}
                whileHover={{ y: -2 }}
              >
                <div className="w-10 h-10 rounded-xl bg-black/50 flex items-center justify-center shrink-0 border border-white/5">
                  <img src={getFavicon(s?.uri || '') || ''} className="w-5 h-5 object-contain" alt="" onError={(e) => (e.currentTarget.style.display='none')} />
                  <Globe className="w-5 h-5 text-zinc-700 absolute" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-zinc-300 truncate uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{s?.title || "Verification Link"}</span>
                    {s?.verified ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <HelpCircle className="w-3 h-3 text-zinc-600 shrink-0" />}
                  </div>
                  <span className="text-[8px] font-mono text-zinc-700 truncate block">{getHostname(s?.uri || '')}</span>
                </div>
                <ExternalLink className="w-3 h-3 text-zinc-800 group-hover:text-indigo-400 transition-colors shrink-0" />
              </motion.a>
            )) : (
              <div className="py-12 text-center opacity-20 flex flex-col items-center gap-4 border border-dashed border-white/10 rounded-[2rem]">
                <ShieldCheck className="w-8 h-8" />
                <p className="text-[9px] font-bold uppercase tracking-widest">Neural Verification Only</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ResultsCard;

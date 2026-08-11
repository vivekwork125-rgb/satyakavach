
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Themed stages for AI fake-news detection ──────────────────────────────
const stages = [
  { label: 'Ingesting Source Content',     icon: '⬇', detail: 'Tokenizing article structure...' },
  { label: 'Cross-Referencing Headlines',  icon: '🔗', detail: 'Querying 2.4M verified news nodes...' },
  { label: 'Detecting Bias Signatures',    icon: '🎯', detail: 'Running sentiment & framing analysis...' },
  { label: 'Verifying Factual Claims',     icon: '🔍', detail: 'Matching claims against fact databases...' },
  { label: 'Analyzing Linguistic Patterns',icon: '🧠', detail: 'Scanning for manipulation markers...' },
  { label: 'Synthesizing Truth Score',     icon: '⚡', detail: 'Generating confidence matrix...' },
];

// Fake article fragments that scroll in the scanner
const articleFragments = [
  'BREAKING: Scientists discover revolutionary...',
  'According to unnamed sources close to...',
  'Experts warn that the government is hiding...',
  'This one trick that doctors don\'t want you...',
  'Leaked documents reveal shocking truth about...',
  'Millions of people are already doing this...',
  'The mainstream media won\'t tell you...',
  'Studies show 9 out of 10 people agree...',
];

// Randomly flickering "detection" words
const detectionWords = ['BIAS', 'CLAIM', 'FACT', 'EMOTION', 'SPIN', 'SOURCE', 'CONTEXT', 'FRAMING'];

// ─── Sub-components ─────────────────────────────────────────────────────────────

const ScannerPanel: React.FC = () => {
  const [lineIndex, setLineIndex] = useState(0);
  const [highlightPos, setHighlightPos] = useState(0);
  const [detectedWord, setDetectedWord] = useState('');
  const [showPing, setShowPing] = useState(false);

  useEffect(() => {
    const lineTimer = setInterval(() => {
      setLineIndex(p => (p + 1) % articleFragments.length);
    }, 1800);
    return () => clearInterval(lineTimer);
  }, []);

  useEffect(() => {
    const scanTimer = setInterval(() => {
      setHighlightPos(p => {
        const next = p + 7 + Math.random() * 10;
        if (next > 100) {
          setDetectedWord(detectionWords[Math.floor(Math.random() * detectionWords.length)]);
          setShowPing(true);
          setTimeout(() => setShowPing(false), 600);
          return 0;
        }
        return next;
      });
    }, 80);
    return () => clearInterval(scanTimer);
  }, []);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/[0.07] bg-black/40 backdrop-blur-sm">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-rose-500/70" />
          <div className="w-2 h-2 rounded-full bg-amber-500/70" />
          <div className="w-2 h-2 rounded-full bg-emerald-500/70" />
        </div>
        <span className="text-[9px] font-mono text-zinc-600 ml-1 uppercase tracking-widest">
          article_scan.txt — SatyaKavach Neural Scanner
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-indigo-400"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[8px] font-mono text-indigo-400 uppercase tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Document lines */}
      <div className="relative px-5 py-4 space-y-2 overflow-hidden" style={{ height: '140px' }}>
        {/* Horizontal scan line */}
        <motion.div
          className="absolute left-0 right-0 h-px pointer-events-none z-20"
          style={{
            top: `${highlightPos}%`,
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.8) 30%, rgba(6,182,212,0.8) 70%, transparent)',
            boxShadow: '0 0 12px rgba(99,102,241,0.6), 0 0 24px rgba(6,182,212,0.3)',
          }}
        />
        {/* Scan glow band */}
        <motion.div
          className="absolute left-0 right-0 h-8 pointer-events-none z-10"
          style={{
            top: `calc(${highlightPos}% - 16px)`,
            background: 'linear-gradient(180deg, transparent, rgba(99,102,241,0.04), rgba(6,182,212,0.06), transparent)',
          }}
        />

        {articleFragments.map((line, i) => (
          <motion.div
            key={line}
            className="flex items-center gap-2"
            initial={false}
          >
            <span className="text-[9px] font-mono text-zinc-700 w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/[0.03]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: i % 3 === 0
                    ? 'rgba(99,102,241,0.25)'
                    : i % 3 === 1
                    ? 'rgba(6,182,212,0.2)'
                    : 'rgba(244,63,94,0.15)',
                  width: `${40 + (i * 17) % 55}%`,
                }}
              />
            </div>
            <span className="text-[8px] font-mono text-zinc-700 shrink-0 w-20 truncate opacity-50">{line.split(' ').slice(0, 3).join(' ')}</span>
          </motion.div>
        ))}

        {/* Detected word ping */}
        <AnimatePresence>
          {showPing && (
            <motion.div
              key="ping"
              initial={{ opacity: 0, scale: 0.6, y: `${highlightPos}%` }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.4 }}
              transition={{ duration: 0.3 }}
              className="absolute right-4 z-30"
              style={{ top: `${Math.min(highlightPos, 80)}%` }}
            >
              <div className="px-2 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/50 text-[8px] font-black text-indigo-300 uppercase tracking-widest">
                {detectedWord}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Probability meters ──────────────────────────────────────────────────────
const meters = [
  { label: 'Credibility', color: '#10b981', target: 72 },
  { label: 'Bias Index',  color: '#f59e0b', target: 38 },
  { label: 'Manipulation',color: '#f43f5e', target: 21 },
];

const ProbabilityMeter: React.FC<{ label: string; color: string; target: number; delay: number }> = ({ label, color, target, delay }) => {
  const [value, setValue] = useState(0);
  const [noise, setNoise] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setValue(v => {
          const next = v + 2 + Math.random() * 4;
          if (next >= target) { clearInterval(interval); return target; }
          return next;
        });
        setNoise((Math.random() - 0.5) * 6);
      }, 40);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, delay]);

  const display = Math.round(Math.min(value + noise, 100));

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className="text-[10px] font-mono font-bold" style={{ color }}>{display}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ─── Neural node graph (mini) ────────────────────────────────────────────────
const NeuralGraph: React.FC = () => {
  const nodes = [
    { x: 50, y: 20, label: 'INPUT' },
    { x: 15, y: 55, label: 'BIAS' },
    { x: 50, y: 55, label: 'FACT' },
    { x: 85, y: 55, label: 'SRC' },
    { x: 50, y: 90, label: 'VERDICT' },
  ];
  const edges = [
    [0, 1], [0, 2], [0, 3], [1, 4], [2, 4], [3, 4],
  ];

  return (
    <div className="relative w-full h-28">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        {edges.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="rgba(99,102,241,0.3)"
            strokeWidth="0.8"
            strokeDasharray="4 2"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </svg>
      {nodes.map((n, i) => (
        <motion.div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${n.x}%`, top: `${n.y}%`, transform: 'translate(-50%, -50%)' }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 300 }}
        >
          <motion.div
            className="w-5 h-5 rounded-full border flex items-center justify-center"
            style={{
              borderColor: i === 4 ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.3)',
              backgroundColor: i === 4 ? 'rgba(99,102,241,0.2)' : 'rgba(0,0,0,0.5)',
            }}
            animate={i === 4 ? { boxShadow: ['0 0 0px rgba(99,102,241,0)', '0 0 12px rgba(99,102,241,0.6)', '0 0 0px rgba(99,102,241,0)'] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-indigo-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1 + i * 0.2, repeat: Infinity }}
            />
          </motion.div>
          <span className="text-[6px] font-black text-zinc-600 uppercase tracking-wider mt-0.5">{n.label}</span>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const AnalyzingOverlay: React.FC = () => {
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);

  const logMessages = [
    '> Initialized DeepScan™ v3.2.1',
    '> Connected to 12 fact-check APIs',
    '> Loaded 847K known fake-news patterns',
    '> Running NLP bias classifier...',
    '> Querying media-bias database...',
    '> Cross-referencing Reuters, AP, AFP...',
    '> Extracting named entities...',
    '> Checking claim against Snopes, PolitiFact...',
    '> Calculating credibility score...',
    '> Finalizing truth matrix...',
  ];

  useEffect(() => {
    const stageTimer = setInterval(() => {
      setStageIndex(p => (p + 1) % stages.length);
    }, 2200);
    return () => clearInterval(stageTimer);
  }, []);

  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress(p => {
        if (p >= 95) return p;
        return p + 0.6 + Math.random() * 1.2;
      });
    }, 80);
    return () => clearInterval(progressTimer);
  }, []);

  useEffect(() => {
    let idx = 0;
    const logTimer = setInterval(() => {
      if (idx < logMessages.length) {
        setLogLines(prev => [...prev.slice(-5), logMessages[idx]]);
        idx++;
      }
    }, 900);
    return () => clearInterval(logTimer);
  }, []);

  return (
    <motion.div
      className="w-full max-w-3xl mx-auto py-10"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* ── Title ── */}
      <div className="text-center mb-8 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-3">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-indigo-400"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em]">Neural Scan Active</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.h2
            key={stageIndex}
            className="text-lg font-black uppercase tracking-[0.2em] text-white"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <span className="text-indigo-400 mr-2">{stages[stageIndex].icon}</span>
            {stages[stageIndex].label}
          </motion.h2>
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.p
            key={`detail-${stageIndex}`}
            className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {stages[stageIndex].detail}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── Master progress bar ── */}
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
          <span>Truth Analysis Pipeline</span>
          <span>{Math.min(Math.round(progress), 95)}%</span>
        </div>
        <div className="h-1 w-full bg-white/[0.04] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(progress, 95)}%`,
              background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
              boxShadow: '0 0 12px rgba(99,102,241,0.5)',
            }}
            transition={{ ease: 'linear' }}
          />
        </div>
        {/* Stage ticks */}
        <div className="flex justify-between">
          {stages.map((s, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1"
            >
              <div
                className="w-1 h-1 rounded-full transition-all duration-500"
                style={{
                  backgroundColor: i <= stageIndex ? '#6366f1' : 'rgba(255,255,255,0.08)',
                  boxShadow: i === stageIndex ? '0 0 6px #6366f1' : 'none',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 3-column main body ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Col 1: Document Scanner */}
        <div className="md:col-span-2 space-y-3">
          <div className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-indigo-500" />
            Document Scanner
          </div>
          <ScannerPanel />

          {/* Terminal log */}
          <div className="rounded-xl bg-black/60 border border-white/[0.05] px-4 py-3 font-mono space-y-1 overflow-hidden" style={{ height: '80px' }}>
            <AnimatePresence>
              {logLines.map((line, i) => (
                <motion.p
                  key={line}
                  className="text-[9px] leading-relaxed"
                  style={{ color: i === logLines.length - 1 ? '#a5f3fc' : '#3f3f46' }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {line}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Col 2: Right panel */}
        <div className="space-y-4">
          {/* Neural graph */}
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-2">
            <div className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-500" />
              Neural Path
            </div>
            <NeuralGraph />
          </div>

          {/* Probability meters */}
          <div className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 space-y-3">
            <div className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.3em] flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-rose-500" />
              Live Scores
            </div>
            {meters.map((m, i) => (
              <ProbabilityMeter key={m.label} {...m} delay={400 + i * 300} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom status strip ── */}
      <div className="mt-6 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          {['Reuters API', 'PolitiFact', 'Snopes DB', 'AP Wire'].map((src, i) => (
            <motion.div
              key={src}
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.2 }}
            >
              <motion.div
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: '#10b981' }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
              />
              <span className="text-[8px] font-mono text-zinc-700 uppercase">{src}</span>
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-1 h-1 rounded-full bg-indigo-400"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default AnalyzingOverlay;

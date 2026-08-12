import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  AlertCircle,
  Zap,
  FileText,
  Mic,
  MicOff,
  Globe,
  ChevronDown,
  Check,
  Search,
  Sparkles
} from 'lucide-react';

interface InputFormProps {
  onAnalyze: (text: string) => void;
  error: string | null;
  isLoading: boolean;
}

export interface SpeechLanguage {
  code: string;
  name: string;
  native: string;
  flag: string;
  badge: string;
}

export const SUPPORTED_SPEECH_LANGUAGES: SpeechLanguage[] = [
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', flag: '🇮🇳', badge: 'TEL' },
  { code: 'en-US', name: 'English (US)', native: 'English', flag: '🇺🇸', badge: 'ENG' },
  { code: 'en-IN', name: 'English (India)', native: 'English', flag: '🇮🇳', badge: 'ENG' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', badge: 'HIN' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்', flag: '🇮🇳', badge: 'TAM' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳', badge: 'KAN' },
  { code: 'ml-IN', name: 'Malayalam', native: 'മലയാളം', flag: '🇮🇳', badge: 'MAL' },
  { code: 'mr-IN', name: 'Marathi', native: 'मराठी', flag: '🇮🇳', badge: 'MAR' },
  { code: 'bn-IN', name: 'Bengali', native: 'বাংলা', flag: '🇮🇳', badge: 'BEN' },
  { code: 'es-ES', name: 'Spanish', native: 'Español', flag: '🇪🇸', badge: 'SPA' },
  { code: 'fr-FR', name: 'French', native: 'Français', flag: '🇫🇷', badge: 'FRA' },
  { code: 'de-DE', name: 'German', native: 'Deutsch', flag: '🇩🇪', badge: 'GER' },
  { code: 'zh-CN', name: 'Chinese', native: '中文', flag: '🇨🇳', badge: 'CHI' },
  { code: 'ar-SA', name: 'Arabic', native: 'العربية', flag: '🇸🇦', badge: 'ARA' },
  { code: 'ru-RU', name: 'Russian', native: 'Русский', flag: '🇷🇺', badge: 'RUS' },
  { code: 'ja-JP', name: 'Japanese', native: '日本語', flag: '🇯🇵', badge: 'JPN' },
];

const InputForm: React.FC<InputFormProps> = ({ onAnalyze, error, isLoading }) => {
  const [text, setText] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedLang, setSelectedLang] = useState('te-IN'); // Default to Telugu
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const recognitionRef = useRef<any>(null);
  const lastSubmitTime = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close language dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSpeechSupported(false);
      return;
    }

    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = selectedLang;

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
      setIsListening(false);
    };

    rec.onresult = (e: any) => {
      let currentTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcriptChunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          setText((prev) => (prev ? `${prev} ${transcriptChunk.trim()}` : transcriptChunk.trim()));
        } else {
          currentTranscript += transcriptChunk;
        }
      }
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [selectedLang]);

  const toggleSpeechToText = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.lang = selectedLang;
        recognitionRef.current.start();
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  // Debounce lock release when loading finishes
  useEffect(() => {
    if (!isLoading && isLocked) {
      const timer = setTimeout(() => setIsLocked(false), 500); // 500ms safety lock
      return () => clearTimeout(timer);
    }
  }, [isLoading, isLocked]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (isListening && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const now = Date.now();
    const isDoubleClick = now - lastSubmitTime.current < 1000; // 1s cooldown

    if (text.trim().length < 10 || isLoading || isLocked || isDoubleClick) {
      return;
    }

    lastSubmitTime.current = now;
    setIsLocked(true);
    onAnalyze(text.trim());
  }, [text, isLoading, isLocked, isListening, onAnalyze]);

  const charCount = text.length;
  const isReady = text.trim().length >= 10 && !isLocked && !isLoading;

  const selectedLangObj =
    SUPPORTED_SPEECH_LANGUAGES.find((l) => l.code === selectedLang) || SUPPORTED_SPEECH_LANGUAGES[0];

  const filteredLanguages = SUPPORTED_SPEECH_LANGUAGES.filter(
    (lang) =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.native.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <motion.form
        onSubmit={handleSubmit}
        className={`input-vivid-wrapper rounded-[1.4rem] p-1.5 relative ${
          isLocked ? 'opacity-80' : ''
        }`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {/* Inner content area */}
        <div className="rounded-[1.1rem] overflow-hidden bg-black/40 backdrop-blur-md border border-white/[0.04]">
          {/* Header bar */}
          <div className="flex items-center justify-between px-5 pt-3.5 pb-1.5 border-b border-white/[0.04]">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">
                Verification Input
              </span>
            </div>

            {isListening && (
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                Listening ({selectedLangObj.native})
              </span>
            )}
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text, news article, or URL to verify..."
            className="input-vivid-textarea w-full h-36 bg-transparent border-none focus:ring-0 px-5 py-3 text-[15px] font-medium resize-none leading-relaxed relative z-10 outline-none placeholder:text-zinc-500"
            disabled={isLocked || isLoading}
          />

          {/* Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-black/50 gap-3">
            {/* Left: Character count */}
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-[10px] font-bold tracking-widest uppercase ${charCount >= 10 ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {charCount} characters
              </span>
              {charCount > 0 && charCount < 10 && (
                <span className="text-[9px] text-amber-400/80 font-bold uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Min 10 required
                </span>
              )}
            </div>

            {/* Right: Interactive Button Controls */}
            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              {/* Custom Animated Language Picker */}
              {speechSupported && (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsLangDropdownOpen((prev) => !prev)}
                    disabled={isListening || isLoading}
                    title="Select Speech Language"
                    className={`group border rounded-xl px-3 py-2 flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                      isLangDropdownOpen
                        ? 'bg-indigo-950/60 border-indigo-400/80 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-white/[0.04] border-white/[0.08] text-zinc-300 hover:bg-white/[0.08] hover:border-indigo-500/30 hover:text-white'
                    } ${isListening || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Globe className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-45 transition-transform duration-300 shrink-0" />
                    <span className="text-xs shrink-0">{selectedLangObj.flag}</span>
                    <span className="text-xs font-semibold text-zinc-200">
                      {selectedLangObj.native}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
                        isLangDropdownOpen ? 'rotate-180 text-indigo-300' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu Popover */}
                  <AnimatePresence>
                    {isLangDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute bottom-full mb-2 right-0 z-50 w-64 rounded-2xl bg-[#0b0f19]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/90 p-2.5 space-y-2"
                      >
                        {/* Search Input */}
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search language..."
                            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>

                        {/* Options List */}
                        <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                          {filteredLanguages.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-zinc-500 text-center">
                              No languages found
                            </div>
                          ) : (
                            filteredLanguages.map((lang) => {
                              const isSelected = lang.code === selectedLang;
                              return (
                                <button
                                  key={lang.code}
                                  type="button"
                                  onClick={() => {
                                    setSelectedLang(lang.code);
                                    setIsLangDropdownOpen(false);
                                    setSearchQuery('');
                                  }}
                                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all ${
                                    isSelected
                                      ? 'bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-500/40 text-white font-bold'
                                      : 'hover:bg-white/[0.06] text-zinc-300 hover:text-white border border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-base shrink-0">{lang.flag}</span>
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold truncate leading-tight">
                                        {lang.native}
                                      </div>
                                      <div className="text-[10px] text-zinc-400 truncate">
                                        {lang.name}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                                      {lang.badge}
                                    </span>
                                    {isSelected && (
                                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Icon-Only Speech Mic Button (Circular with Half-Glowing Outline Border) */}
              {speechSupported && (
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  className={`relative p-[1.5px] rounded-full transition-all duration-300 ${
                    isListening
                      ? 'bg-gradient-to-tr from-rose-500 via-pink-500 to-transparent shadow-[0_0_14px_rgba(244,63,94,0.7)] animate-pulse'
                      : 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-transparent shadow-[0_0_12px_rgba(6,182,212,0.45)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={toggleSpeechToText}
                    title={isListening ? "Stop Listening" : `Speak in ${selectedLangObj.name}`}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isListening
                        ? 'bg-[#180914] text-white'
                        : 'bg-[#090d16] text-cyan-300 hover:text-white'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-4 h-4 text-white" />
                    ) : (
                      <Mic className="w-4 h-4 text-cyan-400" />
                    )}
                  </button>
                </motion.div>
              )}

              {/* Analyze CTA Button */}
              <motion.button
                type="submit"
                disabled={!isReady}
                className={`px-5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${
                  !isReady
                    ? 'bg-zinc-900/90 text-zinc-600 cursor-not-allowed border border-white/[0.04]'
                    : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:shadow-xl'
                }`}
                whileHover={isReady ? { scale: 1.04, y: -1 } : {}}
                whileTap={isReady ? { scale: 0.97 } : {}}
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-[11px] uppercase tracking-wider font-extrabold">
                  {isLocked || isLoading ? "Processing..." : "Analyze"}
                </span>
                {isReady && <ArrowRight className="w-3.5 h-3.5" />}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.form>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 justify-center text-rose-400 text-[10px] font-bold uppercase tracking-widest bg-rose-500/10 px-4 py-3 rounded-xl border border-rose-500/20"
        >
          <AlertCircle className="w-4 h-4 text-rose-500" />
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default InputForm;


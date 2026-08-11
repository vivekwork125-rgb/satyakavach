import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, CheckCircle2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LanguageOption {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'Hindi (हिन्दी)' },
  { code: 'es-ES', name: 'Spanish (Español)' },
  { code: 'fr-FR', name: 'French (Français)' },
  { code: 'de-DE', name: 'German (Deutsch)' },
  { code: 'zh-CN', name: 'Chinese (中文)' },
  { code: 'ja-JP', name: 'Japanese (日本語)' },
  { code: 'ar-SA', name: 'Arabic (العربية)' },
  { code: 'bn-IN', name: 'Bengali (বাংলা)' },
  { code: 'ta-IN', name: 'Tamil (தமிழ்)' },
  { code: 'te-IN', name: 'Telugu (తెలుగు)' },
  { code: 'mr-IN', name: 'Marathi (मराठी)' },
  { code: 'gu-IN', name: 'Gujarati (ગુજરાતી)' },
  { code: 'kn-IN', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml-IN', name: 'Malayalam (മലയാളം)' },
  { code: 'pa-IN', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ru-RU', name: 'Russian (Русский)' },
  { code: 'pt-BR', name: 'Portuguese (Brasil)' },
  { code: 'it-IT', name: 'Italian (Italiano)' }
];

interface SpeechAssistantProps {
  onTranscript?: (text: string) => void;
  autoSpeak?: boolean;
}

const SpeechAssistant: React.FC<SpeechAssistantProps> = ({ onTranscript, autoSpeak = true }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en-US');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [spokenMessage, setSpokenMessage] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setIsSupported(false);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = selectedLanguage;
    rec.interimResults = false;
    rec.continuous = false;

    rec.onstart = () => {
      setIsListening(true);
    };

    rec.onend = () => {
      setIsListening(false);
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    rec.onresult = (e: any) => {
      const textInput = e.results[0][0].transcript;
      setTranscript(textInput);
      if (onTranscript) {
        onTranscript(textInput);
      }
      processData(textInput, selectedLanguage);
    };

    recognitionRef.current = rec;
  }, [onTranscript, selectedLanguage]);

  const processData = (input: string, langCode: string) => {
    const processedOutput = `I heard you say: "${input}"`;
    setSpokenMessage(processedOutput);

    if (autoSpeak && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(processedOutput);
      utterance.lang = langCode;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      setSpokenMessage('');
      recognitionRef.current.lang = selectedLanguage;
      recognitionRef.current.start();
    }
  };

  const stopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium text-center">
        Web Speech API is not supported in this browser. Please try Chrome, Edge, or Safari.
      </div>
    );
  }

  return (
    <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Multilingual Voice Assistant
          </span>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] px-3 py-1.5 rounded-xl">
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={isListening}
            className="bg-transparent text-xs font-semibold text-zinc-200 outline-none cursor-pointer border-none focus:ring-0"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-zinc-900 text-white">
                {lang.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {speaking && (
            <button
              onClick={stopAudio}
              className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-all text-xs flex items-center gap-1 font-bold"
              title="Stop Speech"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          )}

          <motion.button
            type="button"
            onClick={toggleListening}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
              isListening
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-3.5 h-3.5 animate-spin" />
                <span>Listening...</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Start Speaking</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" />
                <span>Transcribed Speech ({SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.name})</span>
              </div>
            </div>
            <p className="text-sm font-medium text-white leading-relaxed">{transcript}</p>
            {spokenMessage && (
              <p className="text-xs text-indigo-300 italic pt-1 border-t border-white/5 flex items-center gap-1">
                <Volume2 className="w-3 h-3 inline text-indigo-400" />
                {spokenMessage}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpeechAssistant;

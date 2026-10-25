import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  Square,
  Volume2,
  VolumeX,
  Sparkles,
  Send,
  AlertCircle,
  X,
  CheckCircle2,
  Compass,
  ArrowRight,
  Loader2,
  Languages,
} from 'lucide-react';
import { api } from '../../services/api';
import { AppModule, VoiceAssistantResponse, VoiceStatusResponse, VoiceAction } from '../../types';

interface VoiceAssistantWidgetProps {
  activeModule: AppModule;
  onNavigate: (module: AppModule) => void;
  onSelectIncident?: (incidentId: string) => void;
  onFocusMapLocation?: (lat: number, lng: number) => void;
}

type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

/** Detect the best MIME type supported by browser MediaRecorder */
function getSupportedAudioMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/wav',
  ];
  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

export const VoiceAssistantWidget: React.FC<VoiceAssistantWidgetProps> = ({
  activeModule,
  onNavigate,
  onSelectIncident,
  onFocusMapLocation,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<AssistantState>('idle');
  const [statusInfo, setStatusInfo] = useState<VoiceStatusResponse | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<'auto' | 'ta' | 'en'>('auto');

  // Conversation history
  const [transcript, setTranscript] = useState<string>('');
  const [response, setResponse] = useState<VoiceAssistantResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  // Audio recording state & diagnostics
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0 to 100 volume indicator
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const recordingStartTimeRef = useRef<number>(0);

  // Quick suggestion chips
  const suggestions = [
    'Ippo entha area romba critical-ah irukku?',
    'Road safety page open pannu',
    'Emergency response page open pannu',
    'Kathipara traffic status sollu',
    'Explain system data provenance in English',
  ];

  // Load voice status on mount
  useEffect(() => {
    api
      .getVoiceStatus()
      .then((data) => setStatusInfo(data))
      .catch((err) => console.warn('[VoiceWidget] Could not fetch voice status:', err));
  }, []);

  // Stop any active audio playback
  const stopAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    if (state === 'speaking') {
      setState('idle');
    }
  }, [state]);

  // Clean up Web Audio level analyzer
  const cleanupAudioAnalyser = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Clean up all recording hardware and timers
  const cleanupRecorderResources = useCallback(() => {
    cleanupAudioAnalyser();
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  }, [cleanupAudioAnalyser]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      cleanupRecorderResources();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, [stopAudio, cleanupRecorderResources]);

  // Play returned base64 audio
  const playAudioBase64 = useCallback((base64Data: string, mimeType = 'audio/wav') => {
    try {
      stopAudio();
      const audioUrl = `data:${mimeType};base64,${base64Data}`;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      setState('speaking');
      audio.onended = () => {
        setState('idle');
        currentAudioRef.current = null;
      };
      audio.onerror = (e) => {
        console.warn('[VoiceWidget] Audio playback error:', e);
        setState('idle');
      };
      audio.play().catch((err) => {
        console.warn('[VoiceWidget] Autoplay blocked or failed:', err);
        setState('idle');
      });
    } catch (err) {
      console.error('[VoiceWidget] Failed to initialize audio:', err);
      setState('idle');
    }
  }, [stopAudio]);

  // Execute UI Action safely from allowlist
  const executeAction = useCallback(
    (action: VoiceAction) => {
      if (!action) return;
      const actionType = action.type || action.action_type;

      if (actionType === 'navigate_to_page' && action.payload?.page) {
        const targetPage = action.payload.page as AppModule;
        const validPages: AppModule[] = [
          'overview',
          'map',
          'traffic-intelligence',
          'safety',
          'traffic',
          'explorer',
          'planning',
          'sustainability',
          'accessibility',
          'emergency',
          'settings',
        ];
        if (validPages.includes(targetPage)) {
          onNavigate(targetPage);
        }
      } else if (actionType === 'select_incident' && action.payload?.incident_id && onSelectIncident) {
        onSelectIncident(action.payload.incident_id);
      } else if (
        actionType === 'focus_map_location' &&
        action.payload?.latitude &&
        action.payload?.longitude &&
        onFocusMapLocation
      ) {
        onNavigate('map');
        onFocusMapLocation(action.payload.latitude, action.payload.longitude);
      }
    },
    [onNavigate, onSelectIncident, onFocusMapLocation]
  );

  // Send request to backend voice assistant API
  const handleProcessQuery = async (audioBlob?: Blob, manualText?: string) => {
    stopAudio();
    setState('processing');
    setErrorMessage(null);

    try {
      const result = await api.processVoiceAssistant({
        audio: audioBlob,
        text: manualText,
        language: selectedLanguage,
      });

      setResponse(result);
      if (result.transcript) {
        setTranscript(result.transcript);
      }

      // If backend returned an allowlisted UI action, execute it automatically!
      if (result.action) {
        executeAction(result.action);
      }

      // If synthesized audio is available, play it aloud
      if (result.audio_base64) {
        playAudioBase64(result.audio_base64, result.audio_mime_type || 'audio/wav');
      } else {
        setState('idle');
      }
    } catch (err: any) {
      console.error('[VoiceWidget] Processing error:', err);
      setState('error');
      setErrorMessage(
        err.message || 'Voice assistant request failed. Please check network and server logs.'
      );
    }
  };

  // Start recording microphone with full browser audio capture and visual analyzer
  const startRecording = async () => {
    stopAudio();
    setErrorMessage(null);
    isCancelledRef.current = false;
    isStoppingRef.current = false;
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setState('error');
      setErrorMessage('Audio recording is not supported in this browser. Please use text input.');
      return;
    }

    try {
      // Use standard constraints without forcing sampleRate which can break Windows drivers
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      // Setup Web Audio Analyser for live visual voice level meter
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateLevel = () => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const level = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(level);
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (audioCtxErr) {
        console.warn('[VoiceWidget] Analyser setup error (non-fatal):', audioCtxErr);
      }

      // Determine supported MIME type
      const mimeType = getSupportedAudioMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      const effectiveMimeType = recorder.mimeType || mimeType || 'audio/webm';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        cleanupRecorderResources();

        if (isCancelledRef.current) {
          audioChunksRef.current = [];
          setState('idle');
          return;
        }

        const durationMs = Date.now() - recordingStartTimeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMimeType });

        if (import.meta.env.DEV) {
          console.debug('[VoiceWidget] Recorded audio finalized:', {
            sizeBytes: audioBlob.size,
            chunkCount: audioChunksRef.current.length,
            mimeType: effectiveMimeType,
            durationMs,
          });
        }

        if (audioBlob.size === 0 || audioChunksRef.current.length === 0) {
          setState('error');
          setErrorMessage('Microphone returned 0 bytes. Please check your microphone input settings.');
          return;
        }

        if (durationMs < 250 && audioBlob.size < 60) {
          setState('error');
          setErrorMessage('Recording was too short. Please click the mic and speak.');
          return;
        }

        // Successfully captured audio! Send to backend
        handleProcessQuery(audioBlob);
      };

      recorder.onerror = (event: any) => {
        console.error('[VoiceWidget] MediaRecorder error:', event.error);
        cleanupRecorderResources();
        setState('error');
        setErrorMessage('Recording error occurred. Please try again.');
      };

      mediaRecorderRef.current = recorder;
      recordingStartTimeRef.current = Date.now();
      // Use 100ms timeslice to frequently buffer data chunks
      recorder.start(100);
      setState('listening');
      setRecordingSeconds(0);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 25) {
            stopRecording();
            return 25;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('[VoiceWidget] Microphone access denied or failed:', err);
      cleanupRecorderResources();
      setState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser or type below.');
      } else {
        setErrorMessage(`Microphone error: ${err.message || 'Could not access audio device.'}`);
      }
    }
  };

  // Stop recording microphone safely, ensuring buffer is flushed
  const stopRecording = () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        // Force flush pending audio data chunk before stopping
        if (typeof mediaRecorderRef.current.requestData === 'function') {
          mediaRecorderRef.current.requestData();
        }
      } catch (e) {
        console.warn('[VoiceWidget] requestData notice:', e);
      }
      try {
        mediaRecorderRef.current.stop();
      } catch (stopErr) {
        console.error('[VoiceWidget] Error stopping recorder:', stopErr);
      }
    }
  };

  // Cancel recording without sending
  const cancelRecording = () => {
    isCancelledRef.current = true;
    cleanupRecorderResources();

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    audioChunksRef.current = [];
    setState('idle');
  };

  // Handle direct text submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || state === 'processing') return;
    const q = textInput.trim();
    setTextInput('');
    setTranscript(q);
    handleProcessQuery(undefined, q);
  };

  return (
    <>
      {/* Persistent Floating Voice Assistant Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <button
          onClick={() => {
            if (isOpen && state === 'listening') {
              stopRecording();
            } else {
              setIsOpen((prev) => !prev);
            }
          }}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-full shadow-2xl font-medium text-sm transition-all duration-200 hover:scale-105 active:scale-95 border ${
            isOpen
              ? 'bg-blue-600 text-white border-blue-400 shadow-blue-500/30'
              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-100 border-slate-700/80 backdrop-blur-md shadow-black/40'
          }`}
          title="Open Multilingual Voice Assistant (Tamil / Thanglish / English)"
        >
          <div className="relative">
            <Mic className="w-5 h-5 text-blue-400 animate-pulse" />
            {state === 'listening' && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
            {state === 'speaking' && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </div>
          <span className="hidden sm:inline">Voice Assistant</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono border border-blue-500/30">
            தமிழ் / Eng
          </span>
        </button>
      </div>

      {/* Interactive Voice Assistant Modal / Console */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full sm:max-w-xl bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    Transport AI Voice Assistant
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Grounded
                    </span>
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 hidden sm:inline">
                      View: {activeModule}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tamil • Thanglish • English (Sarvam Saaras v4 + Gemini)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Language Preference Selector */}
                <div className="flex items-center bg-slate-800/80 rounded-lg p-1 border border-slate-700/60 text-xs">
                  <Languages className="w-3.5 h-3.5 text-slate-400 ml-1 mr-1" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value as any)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer pr-1"
                  >
                    <option value="auto" className="bg-slate-900 text-white">Auto (தமிழ்/Mix)</option>
                    <option value="ta" className="bg-slate-900 text-white">Tamil (தமிழ்)</option>
                    <option value="en" className="bg-slate-900 text-white">English</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    stopAudio();
                    cancelRecording();
                    setIsOpen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Workspace Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Audio & Interaction Status Card */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center relative overflow-hidden">
                {/* Listening State with Live Waveform / Volume Meter */}
                {state === 'listening' && (
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative">
                      {/* Ripple circle scaling with live voice volume */}
                      <div
                        className="w-20 h-20 rounded-full bg-red-500/20 absolute inset-0 transition-transform duration-75"
                        style={{
                          transform: `scale(${1 + (audioLevel / 100) * 0.6})`,
                        }}
                      ></div>
                      <button
                        onClick={stopRecording}
                        className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/40 relative z-10 transition-transform active:scale-95 cursor-pointer"
                        title="Click to finish speaking"
                      >
                        <Mic className="w-10 h-10 text-white animate-pulse" />
                      </button>
                    </div>

                    {/* Live Equalizer Voice Bars */}
                    <div className="flex items-center gap-1 h-6">
                      {[0.3, 0.7, 1.0, 0.6, 0.8, 0.4, 0.9, 0.5].map((factor, idx) => {
                        const barHeight = Math.max(4, Math.round((audioLevel / 100) * 24 * factor));
                        return (
                          <span
                            key={idx}
                            className="w-1 bg-red-400 rounded-full transition-all duration-75"
                            style={{ height: `${barHeight}px` }}
                          />
                        );
                      })}
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-red-400">
                        Listening... Speak now ({recordingSeconds}s / 25s)
                      </p>
                      <p className="text-xs text-slate-400">
                        Click red mic or "Done Speaking" when finished
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={stopRecording}
                        className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-red-600/30 cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5" /> Done Speaking
                      </button>
                      <button
                        onClick={cancelRecording}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Processing State */}
                {state === 'processing' && (
                  <div className="flex flex-col items-center space-y-3 py-4">
                    <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-200">
                        Transcribing & Querying Grounded Transport Services...
                      </p>
                      <p className="text-xs text-slate-400">
                        Analyzing incident ledger, TomTom traffic, and safety statistics
                      </p>
                    </div>
                  </div>
                )}

                {/* Speaking State */}
                {state === 'speaking' && (
                  <div className="flex flex-col items-center space-y-3 py-2">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <Volume2 className="w-8 h-8 text-emerald-400 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-emerald-400">
                        Speaking answer with Sarvam Bulbul v4 Flash...
                      </p>
                    </div>
                    <button
                      onClick={stopAudio}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                    >
                      <VolumeX className="w-3.5 h-3.5" /> Stop Audio Playback
                    </button>
                  </div>
                )}

                {/* Idle State */}
                {state === 'idle' && (
                  <div className="flex flex-col items-center space-y-3">
                    <button
                      onClick={startRecording}
                      className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 flex items-center justify-center shadow-xl shadow-blue-500/25 transition-transform hover:scale-105 active:scale-95 group cursor-pointer"
                      title="Click to speak"
                    >
                      <Mic className="w-9 h-9 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-slate-200">
                        Click microphone to speak
                      </p>
                      <p className="text-xs text-slate-400">
                        Try saying: "Ippo entha area romba critical-ah irukku?"
                      </p>
                    </div>
                  </div>
                )}

                {/* Error State */}
                {state === 'error' && (
                  <div className="flex flex-col items-center space-y-3 py-2">
                    <AlertCircle className="w-10 h-10 text-amber-400" />
                    <p className="text-xs text-amber-200 max-w-sm text-center">
                      {errorMessage || 'Something went wrong.'}
                    </p>
                    <button
                      onClick={startRecording}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer"
                    >
                      Try Speaking Again
                    </button>
                  </div>
                )}
              </div>

              {/* Transcript & Assistant Response Box */}
              {(transcript || response) && (
                <div className="space-y-3 pt-1">
                  {/* Recognized User Speech */}
                  {transcript && (
                    <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/60 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>Recognized Query</span>
                        <span className="text-blue-400 font-sans">
                          {response?.detected_language?.toUpperCase() || 'QUERY'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-100 font-medium">{transcript}</p>
                    </div>
                  )}

                  {/* Grounded Assistant Answer */}
                  {response && (
                    <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/40 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Grounded Answer
                        </span>
                        <div className="flex items-center gap-2">
                          {response.audio_base64 && (
                            <button
                              onClick={() => playAudioBase64(response.audio_base64!, response.audio_mime_type || 'audio/wav')}
                              className="text-xs text-blue-400 hover:text-blue-200 flex items-center gap-1 px-2 py-0.5 rounded bg-blue-900/40 border border-blue-700/50 cursor-pointer"
                              title="Listen again"
                            >
                              <Volume2 className="w-3 h-3" /> Replay
                            </button>
                          )}
                          <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                            {response.tool_invoked || 'grounded'}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-100 leading-relaxed">
                        {response.response_text}
                      </p>

                      {/* Executed / Recommended UI Action */}
                      {response.action && (
                        <div className="mt-2 pt-2 border-t border-blue-800/30 flex items-center justify-between">
                          <span className="text-xs text-slate-300 flex items-center gap-1.5">
                            <Compass className="w-3.5 h-3.5 text-blue-400" />
                            Action: <span className="font-mono text-blue-200">{response.action.type || response.action.action_type}</span>
                            {response.action.payload?.page && (
                              <span className="text-emerald-400 font-semibold">({response.action.payload.page})</span>
                            )}
                          </span>
                          <button
                            onClick={() => executeAction(response.action!)}
                            className="text-xs text-white bg-blue-600 hover:bg-blue-500 px-2.5 py-1 rounded-md flex items-center gap-1 font-medium transition-colors cursor-pointer"
                          >
                            Open Page <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Quick Suggestion Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Quick Voice or Text Prompts
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setTranscript(s);
                        handleProcessQuery(undefined, s);
                      }}
                      className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition-colors text-left cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Text Input Bar */}
            <form onSubmit={handleTextSubmit} className="p-4 border-t border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Or type query in Tamil, English, or Thanglish..."
                  disabled={state === 'processing'}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || state === 'processing'}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-1.5 transition-colors shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                <span>Microphone speech routed via secure server-side Sarvam & Gemini</span>
                <span>Zero client-side secrets</span>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

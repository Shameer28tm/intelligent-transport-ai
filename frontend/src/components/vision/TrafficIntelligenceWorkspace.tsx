import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileVideo,
  FileImage,
  AlertTriangle,
  CheckCircle,
  Scan,
  Zap,
  Car,
  Truck,
  Bus,
  Bike,
  User,
  History,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  Camera,
  Eye,
  Sliders,
  Info,
  TrendingUp,
  Activity,
  BarChart2,
  Award,
  RefreshCw,
  Gauge,
  SlidersHorizontal,
  Save,
  Check,
  Video,
} from 'lucide-react';
import {
  VisionAnalysisResult,
  VisionAnalysisHistoryItem,
  VisionSubsystemStatus,
  DetectedObject,
  EvaluationSummary,
  TimeBucketSummary,
  TrafficEvent,
  PremonitionResult,
} from '../../types';
import { api } from '../../services/api';
import { TrafficPremonitionPanel, PREMONITION_COLORS } from './TrafficPremonitionPanel';

export type TrafficIntelligenceSubsection =
  | 'live_detection'
  | 'full_analysis'
  | 'analytics'
  | 'tracking_events'
  | 'evaluation'
  | 'history';

interface TrafficIntelligenceWorkspaceProps {
  initialSubsection?: TrafficIntelligenceSubsection;
}

export const TrafficIntelligenceWorkspace: React.FC<TrafficIntelligenceWorkspaceProps> = ({
  initialSubsection = 'live_detection',
}) => {
  // Navigation subsections
  const [activeSubsection, setActiveSubsection] = useState<TrafficIntelligenceSubsection>(initialSubsection);
  const [adapterChoice, setAdapterChoice] = useState<'real' | 'simulator'>('real');

  // File & Media state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [currentVideoTime, setCurrentVideoTime] = useState<number>(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);

  // Live Playback Detection State
  const [isLiveDetectionActive, setIsLiveDetectionActive] = useState<boolean>(false);
  const [liveSessionId, setLiveSessionId] = useState<string>(
    () => `live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const [liveLatencyMs, setLiveLatencyMs] = useState<number | null>(null);
  const [liveInferenceFps, setLiveInferenceFps] = useState<number>(0);
  const [liveProcessedFrames, setLiveProcessedFrames] = useState<number>(0);
  const [liveSkippedFrames, setLiveSkippedFrames] = useState<number>(0);
  const [liveDetections, setLiveDetections] = useState<DetectedObject[]>([]);
  const [liveSummarySaved, setLiveSummarySaved] = useState<boolean>(false);
  const [isSavingLiveSummary, setIsSavingLiveSummary] = useState<boolean>(false);

  // Traffic Premonition (trajectory risk estimate computed server-side from tracker output)
  const [livePremonition, setLivePremonition] = useState<PremonitionResult | null>(null);
  const [premonitionOverlayEnabled, setPremonitionOverlayEnabled] = useState<boolean>(true);

  // Selected-frame offline capture state
  const [capturedFrameBlob, setCapturedFrameBlob] = useState<Blob | null>(null);
  const [capturedFrameUrl, setCapturedFrameUrl] = useState<string | null>(null);
  const [capturedTimestamp, setCapturedTimestamp] = useState<number | null>(null);
  const [frameAnalysisResult, setFrameAnalysisResult] = useState<VisionAnalysisResult | null>(null);
  const [isAnalyzingFrame, setIsAnalyzingFrame] = useState(false);

  // Pipeline Config state
  const [sampleFps, setSampleFps] = useState<number>(1.0);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.35);
  const [enableTracking, setEnableTracking] = useState<boolean>(true);
  const [cordonY, setCordonY] = useState<number>(0.60);
  const [timeBucketSeconds, setTimeBucketSeconds] = useState<number>(2.0);
  const [showConfigPanel, setShowConfigPanel] = useState<boolean>(false);

  // Full moving-video analysis state
  const [isAnalyzingFull, setIsAnalyzingFull] = useState(false);
  const [fullAnalysisResult, setFullAnalysisResult] = useState<VisionAnalysisResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Evaluation state
  const [evaluationResult, setEvaluationResult] = useState<EvaluationSummary | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalIoUThreshold, setEvalIoUThreshold] = useState<number>(0.50);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

  // Active view mode in full analysis workspace
  const [fullAnalysisViewMode, setFullAnalysisViewMode] = useState<'video' | 'selected_frame' | 'representative_frame'>('video');

  // Selected detection object for inspector panel
  const [inspectedObject, setInspectedObject] = useState<DetectedObject | null>(null);

  // Subsystem status & History
  const [visionStatus, setVisionStatus] = useState<VisionSubsystemStatus | null>(null);
  const [historyList, setHistoryList] = useState<VisionAnalysisHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const liveOverlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isLiveInFlightRef = useRef<boolean>(false);
  const isLiveDetectionActiveRef = useRef<boolean>(false);
  const seekSeqRef = useRef<number>(0);
  const lastCaptureTimeRef = useRef<number>(0);
  const liveFrameCallbackIdRef = useRef<number | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync ref with live state
  useEffect(() => {
    isLiveDetectionActiveRef.current = isLiveDetectionActive;
  }, [isLiveDetectionActive]);

  // Load vision status on mount
  useEffect(() => {
    api.getVisionStatus()
      .then((res) => setVisionStatus(res))
      .catch((err) => console.warn('[TrafficIntelligence] Could not fetch status:', err));

    // Initialize offscreen canvas (640x360 inference capture resolution)
    const offscreen = document.createElement('canvas');
    offscreen.width = 640;
    offscreen.height = 360;
    offscreenCanvasRef.current = offscreen;

    return () => {
      offscreenCanvasRef.current = null;
    };
  }, []);

  // Load history records
  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const records = await api.getVisionHistory(25);
      setHistoryList(records);
    } catch (err: any) {
      console.warn('[TrafficIntelligence] Could not fetch history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubsection === 'history') {
      loadHistory();
    }
  }, [activeSubsection, loadHistory]);

  // ==========================================
  // Responsive Letterbox Coordinate Mapping & Canvas Overlay
  // ==========================================
  const drawOverlayOnCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      video: HTMLVideoElement,
      detections: DetectedObject[],
      cordonPct: number,
      premonition: PremonitionResult | null = null,
      showPremonition = false
    ) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Ensure canvas internal resolution matches rendered size
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const vW = video.videoWidth || 1280;
      const vH = video.videoHeight || 720;
      const cW = canvas.width;
      const cH = canvas.height;
      if (cW === 0 || cH === 0) return;

      // Compute letterbox containment (object-fit: contain)
      const rV = vW / vH;
      const rC = cW / cH;
      let renderW = cW;
      let renderH = cH;
      let offsetX = 0;
      let offsetY = 0;

      if (rV > rC) {
        renderH = cW / rV;
        offsetY = (cH - renderH) / 2;
      } else {
        renderW = cH * rV;
        offsetX = (cW - renderW) / 2;
      }

      // Draw Virtual Cordon Line
      const cordonPixelY = offsetY + cordonPct * renderH;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#f43f5e'; // rose-500
      ctx.lineWidth = 2.5;
      ctx.moveTo(offsetX, cordonPixelY);
      ctx.lineTo(offsetX + renderW, cordonPixelY);
      ctx.stroke();

      // Cordon label badge
      ctx.fillStyle = 'rgba(244, 63, 94, 0.88)';
      ctx.fillRect(offsetX + 8, cordonPixelY - 22, 170, 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('VIRTUAL CORDON LINE (Y: ' + Math.round(cordonPct * 100) + '%)', offsetX + 14, cordonPixelY - 8);
      ctx.restore();

      // Traffic Premonition paths: observed = solid, projected = dashed.
      // Only tracks visible in the current frame are drawn, so seeks/stops never leave stale paths.
      if (showPremonition && premonition && detections.length > 0) {
        const visible = new Set(detections.map((d) => d.track_id).filter((id): id is number => typeof id === 'number'));
        const inConflict = new Set<number>();
        premonition.pairs
          .filter((p) => p.state === 'POTENTIAL_CONFLICT')
          .forEach((p) => p.track_ids.forEach((id) => inConflict.add(id)));
        const toPx = (pt: { x: number; y: number }) => [offsetX + pt.x * renderW, offsetY + pt.y * renderH] as const;

        premonition.tracks.forEach((t) => {
          if (!visible.has(t.track_id) || t.observed_path.length === 0) return;
          const color = inConflict.has(t.track_id)
            ? PREMONITION_COLORS.concern
            : t.data_quality === 'HIGH' || t.data_quality === 'MEDIUM'
              ? PREMONITION_COLORS.neutral
              : PREMONITION_COLORS.unknown;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = inConflict.has(t.track_id) ? 3 : 2;
          ctx.lineJoin = 'round';
          ctx.setLineDash([]);
          ctx.beginPath();
          t.observed_path.forEach((pt, i) => {
            const [x, y] = toPx(pt);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          if (t.projected_path.length > 0) {
            ctx.setLineDash([6, 5]);
            ctx.beginPath();
            const [sx, sy] = toPx(t.observed_path[t.observed_path.length - 1]);
            ctx.moveTo(sx, sy);
            t.projected_path.forEach((pt) => {
              const [x, y] = toPx(pt);
              ctx.lineTo(x, y);
            });
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // Draw Bounding Boxes with class color coding and tracking IDs
      detections.forEach((det) => {
        const { x_min, y_min, x_max, y_max } = det.box;
        const bx = offsetX + x_min * renderW;
        const by = offsetY + y_min * renderH;
        const bw = (x_max - x_min) * renderW;
        const bh = (y_max - y_min) * renderH;

        let strokeColor = '#38bdf8'; // sky-400 (car)
        let bgColor = 'rgba(14, 165, 233, 0.90)';
        if (det.class_name === 'bus') {
          strokeColor = '#a855f7'; // purple-500
          bgColor = 'rgba(168, 85, 247, 0.90)';
        } else if (det.class_name === 'truck') {
          strokeColor = '#f59e0b'; // amber-500
          bgColor = 'rgba(245, 158, 11, 0.90)';
        } else if (det.class_name === 'pedestrian') {
          strokeColor = '#eab308'; // yellow-500
          bgColor = 'rgba(234, 179, 8, 0.90)';
        } else if (det.class_name === 'motorcycle' || det.class_name === 'bicycle') {
          strokeColor = '#10b981'; // emerald-500
          bgColor = 'rgba(16, 185, 129, 0.90)';
        }

        // Draw bounding box rectangle
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, by, bw, bh);

        // Draw pill label
        const trackLabel = det.track_id ? `#${det.track_id} ` : '';
        const labelText = `${trackLabel}${det.class_name.toUpperCase()} ${Math.round(det.confidence * 100)}%`;
        ctx.font = 'bold 11px monospace';
        const textMetrics = ctx.measureText(labelText);
        const labelW = textMetrics.width + 12;
        const labelH = 19;
        const labelY = Math.max(offsetY, by - labelH);

        ctx.fillStyle = bgColor;
        ctx.fillRect(bx, labelY, labelW, labelH);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(labelText, bx + 6, labelY + 13);
      });
    },
    []
  );

  // Redraw overlay when detections or cordon line change
  useEffect(() => {
    if (liveOverlayCanvasRef.current && videoPlayerRef.current) {
      drawOverlayOnCanvas(
        liveOverlayCanvasRef.current,
        videoPlayerRef.current,
        liveDetections,
        cordonY,
        livePremonition,
        premonitionOverlayEnabled
      );
    }
  }, [liveDetections, cordonY, livePremonition, premonitionOverlayEnabled, drawOverlayOnCanvas]);

  // Window resize observer to keep canvas overlay aligned
  useEffect(() => {
    const handleResize = () => {
      if (liveOverlayCanvasRef.current && videoPlayerRef.current) {
        drawOverlayOnCanvas(
          liveOverlayCanvasRef.current,
          videoPlayerRef.current,
          liveDetections,
          cordonY,
          livePremonition,
          premonitionOverlayEnabled
        );
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [liveDetections, cordonY, livePremonition, premonitionOverlayEnabled, drawOverlayOnCanvas]);

  // ==========================================
  // Live Playback Synchronized Loop
  // ==========================================
  const startLiveDetection = () => {
    if (!videoPlayerRef.current) return;
    setIsLiveDetectionActive(true);
    isLiveDetectionActiveRef.current = true;
    setLiveSummarySaved(false);

    // Auto-play if paused
    if (videoPlayerRef.current.paused) {
      videoPlayerRef.current
        .play()
        .then(() => setIsVideoPlaying(true))
        .catch((err) => console.warn('[LiveDetection] Auto-play was prevented:', err));
    }
  };

  const stopLiveDetection = () => {
    setIsLiveDetectionActive(false);
    isLiveDetectionActiveRef.current = false;
    isLiveInFlightRef.current = false;

    if (liveFrameCallbackIdRef.current !== null && videoPlayerRef.current) {
      if ('cancelVideoFrameCallback' in videoPlayerRef.current) {
        (videoPlayerRef.current as any).cancelVideoFrameCallback(liveFrameCallbackIdRef.current);
      } else {
        cancelAnimationFrame(liveFrameCallbackIdRef.current);
      }
      liveFrameCallbackIdRef.current = null;
    }

    if (liveOverlayCanvasRef.current) {
      const ctx = liveOverlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, liveOverlayCanvasRef.current.width, liveOverlayCanvasRef.current.height);
    }
    setLiveDetections([]);
  };

  const handleResetLiveSession = async () => {
    stopLiveDetection();
    try {
      await api.resetLiveVisionSession(liveSessionId);
    } catch (err) {
      console.warn('[LiveDetection] Reset live session error:', err);
    }
    const newSid = `live_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLiveSessionId(newSid);
    setLivePremonition(null);
    setLiveProcessedFrames(0);
    setLiveSkippedFrames(0);
    setLiveLatencyMs(null);
    setLiveInferenceFps(0);
    setLiveSummarySaved(false);
  };

  const handleSaveLiveSummary = async () => {
    if (liveProcessedFrames === 0 || isSavingLiveSummary || liveSummarySaved) return;
    setIsSavingLiveSummary(true);
    setErrorMessage(null);
    try {
      const video = videoPlayerRef.current;
      const duration = video && video.currentTime > 0 ? Number(video.currentTime.toFixed(2)) : undefined;
      const fps = liveInferenceFps > 0 ? liveInferenceFps : undefined;
      const latency = liveLatencyMs !== null && liveLatencyMs > 0 ? liveLatencyMs : undefined;
      await api.saveLiveSessionSummary(
        liveSessionId,
        selectedFile?.name || 'live_traffic_video.mp4',
        duration,
        fps,
        latency,
        {
          confidence_threshold: confidenceThreshold,
          cordon_y: cordonY,
          adapter_name: adapterChoice === 'real' ? 'Real-Time Neural Vision Adapter (YOLOv8n ONNX Engine)' : 'Deterministic Demo Simulator (RoadVision-Sim-v1)',
        }
      );
      setLiveSummarySaved(true);
      await loadHistory();
    } catch (err: any) {
      setErrorMessage(`Could not save live session summary: ${err.message || 'Save failed'}`);
      setLiveSummarySaved(false);
    } finally {
      setIsSavingLiveSummary(false);
    }
  };

  // Execution loop with single-flight backpressure
  useEffect(() => {
    const video = videoPlayerRef.current;
    if (!video || !isLiveDetectionActive) return;

    let isMounted = true;
    const targetIntervalMs = 280; // ~3.5 FPS target, optimal for real ONNX runtime

    const scheduleNext = () => {
      if (!isMounted || !isLiveDetectionActiveRef.current) return;
      if ('requestVideoFrameCallback' in video) {
        liveFrameCallbackIdRef.current = (video as any).requestVideoFrameCallback(processFrame);
      } else {
        liveFrameCallbackIdRef.current = requestAnimationFrame(processFrame);
      }
    };

    const processFrame = async () => {
      if (!isMounted || !isLiveDetectionActiveRef.current) return;

      if (video.paused || video.ended) {
        scheduleNext();
        return;
      }

      const now = performance.now();
      const elapsed = now - lastCaptureTimeRef.current;

      // Rate limiting: wait until target frame interval has arrived
      if (elapsed < targetIntervalMs) {
        scheduleNext();
        return;
      }

      // Single-flight backpressure: if inference is in-flight, skip frame
      if (isLiveInFlightRef.current) {
        setLiveSkippedFrames((prev) => prev + 1);
        scheduleNext();
        return;
      }

      const offscreen = offscreenCanvasRef.current;
      if (!offscreen) {
        scheduleNext();
        return;
      }
      const ctx = offscreen.getContext('2d');
      if (!ctx) {
        scheduleNext();
        return;
      }

      isLiveInFlightRef.current = true;
      lastCaptureTimeRef.current = now;
      const captureStartTime = performance.now();
      const captureSeq = seekSeqRef.current;

      try {
        ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

        offscreen.toBlob(
          async (blob) => {
            if (!blob || !isMounted || !isLiveDetectionActiveRef.current) {
              isLiveInFlightRef.current = false;
              scheduleNext();
              return;
            }

            try {
              const result = await api.analyzeVisionFrame(
                blob,
                video.currentTime,
                selectedFile?.name,
                adapterChoice,
                {
                  persist: false,
                  enable_tracking: enableTracking,
                  generate_preview: false,
                  session_id: liveSessionId,
                  cordon_y: cordonY,
                  confidence_threshold: confidenceThreshold,
                  source_aspect_ratio:
                    video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : undefined,
                }
              );

              // Discard if user seeked or stopped during flight
              if (!isMounted || !isLiveDetectionActiveRef.current || seekSeqRef.current !== captureSeq) {
                return;
              }

              const latency = Math.round(performance.now() - captureStartTime);
              setLiveLatencyMs(latency);
              setLiveProcessedFrames((prev) => {
                const next = prev + 1;
                if (latency > 0) {
                  const fps = Number((1000 / Math.max(latency, targetIntervalMs)).toFixed(1));
                  setLiveInferenceFps(fps);
                }
                return next;
              });
              setLiveSummarySaved(false);

              const dets = result.detected_objects || [];
              setLivePremonition(result.premonition ?? null);
              setLiveDetections(dets);
              if (dets.length > 0) {
                setInspectedObject(dets[0]);
              }
            } catch (err) {
              console.warn('[LiveInference] Frame inference error:', err);
            } finally {
              isLiveInFlightRef.current = false;
              scheduleNext();
            }
          },
          'image/jpeg',
          0.82
        );
      } catch (err) {
        console.warn('[LiveInference] Frame capture error:', err);
        isLiveInFlightRef.current = false;
        scheduleNext();
      }
    };

    scheduleNext();

    return () => {
      isMounted = false;
      if (liveFrameCallbackIdRef.current !== null) {
        if ('cancelVideoFrameCallback' in video) {
          (video as any).cancelVideoFrameCallback(liveFrameCallbackIdRef.current);
        } else {
          cancelAnimationFrame(liveFrameCallbackIdRef.current);
        }
        liveFrameCallbackIdRef.current = null;
      }
      isLiveInFlightRef.current = false;
    };
  }, [
    isLiveDetectionActive,
    liveSessionId,
    selectedFile,
    adapterChoice,
    enableTracking,
    cordonY,
    confidenceThreshold,
  ]);

  // ==========================================
  // Media Handlers
  // ==========================================
  const handleFileChange = (file: File) => {
    handleResetLiveSession();
    setErrorMessage(null);
    setFullAnalysisResult(null);
    setFrameAnalysisResult(null);
    setCapturedFrameBlob(null);
    setCapturedFrameUrl(null);
    setCapturedTimestamp(null);
    setInspectedObject(null);
    setSelectedFile(file);
    setCurrentVideoTime(0);
    setIsVideoPlaying(false);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFullAnalysisViewMode('video');
  };

  const handleVideoLoadedMetadata = () => {
    if (videoPlayerRef.current) {
      setVideoDuration(videoPlayerRef.current.duration);
    }
  };

  const handleVideoTimeUpdate = () => {
    if (videoPlayerRef.current) {
      setCurrentVideoTime(videoPlayerRef.current.currentTime);
    }
  };

  const toggleVideoPlayback = () => {
    if (!videoPlayerRef.current) return;
    if (isVideoPlaying) {
      videoPlayerRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoPlayerRef.current.play();
      setIsVideoPlaying(true);
    }
  };

  const handleSeek = (timeSec: number) => {
    seekSeqRef.current += 1; // Invalidate any in-flight frame!
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = timeSec;
      setCurrentVideoTime(timeSec);
    }
    // Clear live overlay canvas
    if (liveOverlayCanvasRef.current) {
      const ctx = liveOverlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, liveOverlayCanvasRef.current.width, liveOverlayCanvasRef.current.height);
    }
    setLiveDetections([]);
  };

  // "Why this warning?" → pause on the evidence moment using the existing playback controls
  const handleInspectPremonitionMoment = (timestampSec: number) => {
    const video = videoPlayerRef.current;
    if (!video) return;
    video.pause();
    setIsVideoPlaying(false);
    handleSeek(Math.max(0, Math.min(timestampSec, Number.isFinite(video.duration) ? video.duration : timestampSec)));
  };

  const handleReset = () => {
    handleResetLiveSession();
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoDuration(null);
    setCurrentVideoTime(0);
    setIsVideoPlaying(false);
    setFullAnalysisResult(null);
    setFrameAnalysisResult(null);
    setCapturedFrameBlob(null);
    setCapturedFrameUrl(null);
    setCapturedTimestamp(null);
    setInspectedObject(null);
    setErrorMessage(null);
  };

  // Capture paused video frame for single-frame offline inference
  const handleCaptureCurrentFrame = () => {
    if (!videoPlayerRef.current) return;
    const video = videoPlayerRef.current;
    video.pause();
    setIsVideoPlaying(false);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            setCapturedFrameBlob(blob);
            const frameUrl = URL.createObjectURL(blob);
            setCapturedFrameUrl(frameUrl);
            setCapturedTimestamp(video.currentTime);
            setFullAnalysisViewMode('selected_frame');
            setFrameAnalysisResult(null);
            setInspectedObject(null);
          }
        },
        'image/jpeg',
        0.92
      );
    }
  };

  // Run genuine object detection on captured frame
  const handleRunFrameAnalysis = async () => {
    if (!capturedFrameBlob) return;
    setIsAnalyzingFrame(true);
    setErrorMessage(null);

    try {
      const result = await api.analyzeVisionFrame(
        capturedFrameBlob,
        capturedTimestamp ?? 0,
        selectedFile?.name,
        adapterChoice
      );
      setFrameAnalysisResult(result);
      setFullAnalysisViewMode('selected_frame');
      if (result.detected_objects.length > 0) {
        setInspectedObject(result.detected_objects[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Selected frame inference failed');
    } finally {
      setIsAnalyzingFrame(false);
    }
  };

  // Full moving video batch pipeline with time-bucketing and tracking
  const handleRunFullAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzingFull(true);
    setErrorMessage(null);
    setAnalysisStep('1/4: Ingesting media and verifying video container...');

    try {
      const t1 = setTimeout(() => {
        setAnalysisStep(`2/4: Sampling frames at ${sampleFps} FPS & running YOLOv8n ONNX inference...`);
      }, 500);
      const t2 = setTimeout(() => {
        setAnalysisStep('3/4: Associating vehicle tracks & detecting virtual cordon crossings...');
      }, 1200);
      const t3 = setTimeout(() => {
        setAnalysisStep('4/4: Aggregating traffic density time buckets & computing flow metrics...');
      }, 1800);

      const isVideo = selectedFile.type.startsWith('video/') || /\.(mp4|mov|webm|avi)$/i.test(selectedFile.name);

      let result: VisionAnalysisResult;
      if (isVideo) {
        result = await api.analyzeMovingVideo(selectedFile, {
          sample_fps: sampleFps,
          confidence_threshold: confidenceThreshold,
          enable_tracking: enableTracking,
          cordon_y: cordonY,
          time_bucket_seconds: timeBucketSeconds,
          adapter: adapterChoice,
        });
      } else {
        result = await api.analyzeVisionMedia(selectedFile, adapterChoice);
      }

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      setFullAnalysisResult(result);
      setFullAnalysisViewMode('representative_frame');
      if (result.detected_objects.length > 0) {
        setInspectedObject(result.detected_objects[0]);
      }
      if (result.evaluation_summary) {
        setEvaluationResult(result.evaluation_summary);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Traffic video intelligence pipeline failed');
    } finally {
      setIsAnalyzingFull(false);
      setAnalysisStep('');
    }
  };

  // Benchmark Evaluation
  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    setEvalMessage(null);
    try {
      const gtData = await api.getBenchmarkSample();
      const evalRes = await api.evaluateVision({
        analysis_id: fullAnalysisResult?.analysis_id,
        ground_truth_json: gtData,
        iou_threshold: evalIoUThreshold,
      });
      setEvaluationResult(evalRes);
      setEvalMessage('Evaluation completed successfully against verified ground truth.');
    } catch (err: any) {
      setEvalMessage(`Evaluation error: ${err.message || 'Evaluation failed'}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Sample media loaders
  const handleLoadSampleVideo = async () => {
    setErrorMessage(null);
    try {
      const file = await api.getSampleVideo();
      handleFileChange(file);
    } catch (err: any) {
      setErrorMessage(`Could not load sample traffic video: ${err.message}`);
    }
  };

  const handleLoadSampleImage = async () => {
    setErrorMessage(null);
    try {
      const file = await api.getSampleImage();
      handleFileChange(file);
    } catch (err: any) {
      setErrorMessage(`Could not load sample traffic image: ${err.message}`);
    }
  };

  const handleLoadHistoricalRecord = async (item: VisionAnalysisHistoryItem) => {
    try {
      const detail = await api.getVisionHistoryDetail(item.id);
      const result: VisionAnalysisResult = {
        analysis_id: detail.id,
        session_id: detail.session_id,
        video_hash: detail.video_hash,
        media_name: detail.filename,
        media_type: detail.media_type,
        width: 1280,
        height: 720,
        file_size_bytes: detail.file_size_bytes,
        processing_time_ms: detail.processing_time_ms,
        adapter_name: detail.adapter_name,
        is_simulated: detail.is_simulated,
        status: detail.status,
        error_message: detail.error_message,
        duration_seconds: detail.duration_seconds,
        frame_count_sampled: detail.frame_count_sampled,
        frame_timestamp_sec: detail.frame_timestamp_sec,
        source_video_name: detail.source_video_name,
        representative_frame_base64: detail.representative_frame_base64,
        total_vehicles: detail.total_vehicles,
        vehicle_breakdown: detail.vehicle_breakdown,
        total_pedestrians: detail.total_pedestrians,
        unique_vehicles_tracked: detail.unique_vehicles_tracked,
        total_frame_detections: detail.total_frame_detections,
        estimated_congestion_level: detail.total_vehicles >= 5 ? 'MODERATE' : 'LOW',
        collision_risk_score: 0.35,
        lane_blockage_detected: false,
        detected_hazards: [],
        detected_objects: detail.detections || [],
        recommendations: ['Historical record loaded from persistent SQLite.'],
        tracking_summary: detail.tracking_summary || null,
        time_buckets: detail.time_buckets || [],
        events: detail.events || [],
        evaluation_summary: detail.evaluation_summary || null,
        fps_processed: detail.fps_processed || 0.0,
        inference_config: detail.inference_config || {},
        timestamp: detail.created_at,
        data_source: detail.data_source,
        provenance_notice: 'Historical analysis restored from SQLite.',
      };

      setFullAnalysisResult(result);
      if (detail.detections && detail.detections.length > 0) {
        setInspectedObject(detail.detections[0]);
      }
      setActiveSubsection('analytics');
    } catch (err: any) {
      setErrorMessage(`Could not load historical record: ${err.message}`);
    }
  };

  const isVideoFile =
    selectedFile?.type.startsWith('video/') || (selectedFile && /\.(mp4|mov|webm|avi)$/i.test(selectedFile.name));

  // Determine current result for inspector panel
  const currentInspectorDetections =
    activeSubsection === 'live_detection' && isLiveDetectionActive
      ? liveDetections
      : fullAnalysisViewMode === 'selected_frame' && frameAnalysisResult
      ? frameAnalysisResult.detected_objects
      : fullAnalysisResult?.detected_objects || [];

  return (
    <div className="space-y-4">
      {/* Top Header Navigation Tabs (6 Primary Subsections) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveSubsection('live_detection')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubsection === 'live_detection'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            <span>Live Playback Detection</span>
            {isLiveDetectionActive && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubsection('full_analysis')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubsection === 'full_analysis'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <Scan className="h-3.5 w-3.5" />
            <span>Full Video Analysis</span>
            {fullAnalysisResult && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubsection('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubsection === 'analytics'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Traffic Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubsection('tracking_events')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubsection === 'tracking_events'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Vehicle Tracking & Events</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubsection('evaluation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubsection === 'evaluation'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>Model Evaluation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubsection('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSubsection === 'history'
                ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-500/40 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>Analysis History</span>
          </button>
        </div>

        {/* Real Model Provider Status Badge */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              visionStatus?.real_model?.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>
            YOLOv8n ONNX:{' '}
            {visionStatus?.real_model?.is_available ? 'Active (CPUExecutionProvider)' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-500/40 text-rose-700 dark:text-red-300 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs font-mono"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION 1: LIVE PLAYBACK DETECTION (SYNCHRONIZED CANVAS OVERLAY)     */}
      {/* ========================================================================= */}
      {activeSubsection === 'live_detection' && (
        <div className="space-y-4">
          {/* Adapter Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAdapterChoice('real')}
              className={`p-3 rounded-xl border text-left transition-all shadow-xs ${
                adapterChoice === 'real'
                  ? 'border-emerald-500/60 bg-emerald-50/70 dark:bg-emerald-950/25 ring-1 ring-emerald-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Genuine Pretrained AI Inference
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                    adapterChoice === 'real'
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  GENUINE YOLOv8n
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Runs genuine local ONNX inference on captured video frames during playback. Bounding boxes, IoU tracking, and cordon detection update synchronized with the video.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAdapterChoice('simulator')}
              className={`p-3 rounded-xl border text-left transition-all shadow-xs ${
                adapterChoice === 'simulator'
                  ? 'border-sky-500/60 bg-sky-50/70 dark:bg-sky-950/25 ring-1 ring-sky-500/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  Deterministic Demo Simulator
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                    adapterChoice === 'simulator'
                      ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/40'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  SIMULATOR
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                Deterministic simulated detections for rapid pipeline verification and testing when ONNX runtime is bypassed.
              </p>
            </button>
          </div>

          {/* Media Upload or 1-Click Test Drive Bar */}
          {!selectedFile ? (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500/50 bg-white dark:bg-[#0b1120] rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40 shadow-xs"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-msvideo"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-3">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Select Moving Traffic Video for Live Detection</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Upload traffic video (.mp4, .mov, .webm). Live detection will execute synchronized YOLOv8n object detection overlays on the video during playback.
                </p>
              </div>

              {/* 1-Click Test Drive Presets */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">1-Click Test Drive:</span>
                <button
                  type="button"
                  onClick={handleLoadSampleVideo}
                  className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <FileVideo className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Sample Moving Traffic Video (4s MP4)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Media Status and Configuration Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <FileVideo className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Prerecorded Video
                      {videoDuration ? ` • ${videoDuration.toFixed(1)}s` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigPanel((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-all shadow-xs ${
                      showConfigPanel
                        ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>Live Parameters</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Pipeline Parameters Drawer */}
              {showConfigPanel && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3 animate-fadeIn text-xs shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
                    <span className="font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      Live Detection Parameters (P3)
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Reproducible Config</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-700 dark:text-slate-300 block mb-1">
                        Confidence Threshold: <span className="font-mono text-sky-600 dark:text-sky-400 font-bold">{Math.round(confidenceThreshold * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min="0.20"
                        max="0.80"
                        step="0.05"
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-700 dark:text-slate-300 block mb-1">
                        Virtual Cordon Line: <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">{Math.round(cordonY * 100)}% Y</span>
                      </label>
                      <input
                        type="range"
                        min="0.20"
                        max="0.85"
                        step="0.05"
                        value={cordonY}
                        onChange={(e) => setCordonY(parseFloat(e.target.value))}
                        className="w-full accent-rose-600"
                      />
                    </div>

                    <div className="flex items-center pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 text-xs">
                        <input
                          type="checkbox"
                          checked={enableTracking}
                          onChange={(e) => setEnableTracking(e.target.checked)}
                          className="accent-sky-600 rounded"
                        />
                        <span>Enable Multi-Object IoU Tracker (Assigns #Track IDs)</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* LIVE TELEMETRY RIBBON (Latency, FPS, Processed/Skipped Frames, Backpressure status) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Live Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isLiveDetectionActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                      }`}
                    />
                    <span className={`font-bold ${isLiveDetectionActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isLiveDetectionActive ? 'DETECTING' : 'STANDBY'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Inference Latency</span>
                  <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                    {liveLatencyMs !== null ? `${liveLatencyMs} ms` : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Effective Sampling FPS</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {liveInferenceFps > 0 ? `${liveInferenceFps} FPS` : '—'}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Processed / Skipped</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span className="text-emerald-600 dark:text-emerald-400">{liveProcessedFrames}</span> proc •{' '}
                    <span className={liveSkippedFrames > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}>
                      {liveSkippedFrames} skip
                    </span>
                  </span>
                </div>
              </div>

              {/* Main Live Video Display Viewport & Side Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left 2 Cols: Real Video Player with Live Canvas Overlay */}
                <div className="lg:col-span-2 rounded-2xl bg-black border border-slate-200 dark:border-slate-800 overflow-hidden relative flex flex-col justify-center items-center shadow-xs">
                  <div className="w-full flex flex-col">
                    <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                      <video
                        ref={videoPlayerRef}
                        src={previewUrl || undefined}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onSeeking={() => {
                          seekSeqRef.current += 1;
                          if (liveOverlayCanvasRef.current) {
                            const ctx = liveOverlayCanvasRef.current.getContext('2d');
                            if (ctx) ctx.clearRect(0, 0, liveOverlayCanvasRef.current.width, liveOverlayCanvasRef.current.height);
                          }
                          setLiveDetections([]);
                        }}
                        className="max-h-full max-w-full"
                        playsInline
                      />
                      {/* Synchronized Live Bounding Box & Cordon Canvas Overlay */}
                      <canvas
                        ref={liveOverlayCanvasRef}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />

                      {/* Corner Live Watermark Badge */}
                      {isLiveDetectionActive && (
                        <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-lg">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>LIVE YOLOv8n ONNX OVERLAY</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Playback & Scrubber Controls */}
                    <div className="p-3 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleVideoPlayback}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-all shadow-xs"
                          title={isVideoPlaying ? 'Pause' : 'Play'}
                        >
                          {isVideoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max={videoDuration || 10}
                          step="0.04"
                          value={currentVideoTime}
                          onChange={(e) => handleSeek(parseFloat(e.target.value))}
                          className="flex-1 accent-sky-600 cursor-pointer"
                        />

                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 w-24 text-right">
                          {currentVideoTime.toFixed(2)}s / {(videoDuration || 0).toFixed(2)}s
                        </span>
                      </div>

                      {/* Primary Live Detection Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="flex items-center gap-2">
                          {!isLiveDetectionActive ? (
                            <button
                              type="button"
                              onClick={startLiveDetection}
                              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-colors"
                            >
                              <Play className="h-4 w-4" />
                              <span>Start Live Detection</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={stopLiveDetection}
                              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono shadow-xs flex items-center gap-2 transition-all"
                            >
                              <Pause className="h-4 w-4" />
                              <span>Stop Live Detection</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleResetLiveSession}
                            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all border border-slate-200 dark:border-slate-700 shadow-xs"
                            title="Clear live session and reset tracker IDs"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset Session</span>
                          </button>
                        </div>

                        {/* Save Consolidated Live Summary to History */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={liveProcessedFrames === 0 || isSavingLiveSummary || liveSummarySaved}
                            onClick={handleSaveLiveSummary}
                            className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 transition-all border shadow-xs ${
                              liveSummarySaved
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40'
                            }`}
                          >
                            {isSavingLiveSummary ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : liveSummarySaved ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Summary Saved</span>
                              </>
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                                <span>Save Session Summary</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right 1 Col: Telemetry & Detection Object Inspector */}
                <div className="rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 p-4 space-y-3.5 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                        Live Frame Detections
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {liveDetections.length} Active Objects
                      </span>
                    </div>

                    {liveDetections.length > 0 ? (
                      <div className="space-y-2">
                        {/* Summary breakdown of current frame */}
                        <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Vehicles</span>
                            <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                              {liveDetections.filter((d) => d.class_name !== 'pedestrian').length}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Pedestrians</span>
                            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              {liveDetections.filter((d) => d.class_name === 'pedestrian').length}
                            </span>
                          </div>
                        </div>

                        {/* List of Detected Objects on current frame */}
                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                          {liveDetections.map((obj, i) => (
                            <div
                              key={obj.id || i}
                              onClick={() => setInspectedObject(obj)}
                              className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                                inspectedObject?.id === obj.id
                                  ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                {obj.class_name === 'bus' && <Bus className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />}
                                {obj.class_name === 'truck' && <Truck className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />}
                                {obj.class_name === 'car' && <Car className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />}
                                {obj.class_name === 'pedestrian' && <User className="h-3.5 w-3.5 text-yellow-500 dark:text-yellow-400" />}
                                {(obj.class_name === 'motorcycle' || obj.class_name === 'bicycle') && (
                                  <Bike className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                                )}
                                <span className="font-bold text-slate-900 dark:text-white capitalize">
                                  {obj.track_id ? `#${obj.track_id} ` : ''}
                                  {obj.class_name}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                                {Math.round(obj.confidence * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Inspected Object Telemetry Details */}
                        {inspectedObject && (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono space-y-1 text-slate-700 dark:text-slate-300 shadow-xs">
                            <div className="text-slate-900 dark:text-white font-bold flex items-center justify-between">
                              <span className="capitalize">{inspectedObject.class_name}</span>
                              <span className="text-sky-600 dark:text-sky-400">
                                {inspectedObject.track_id ? `Track #${inspectedObject.track_id}` : 'Unassigned'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Confidence: {(inspectedObject.confidence * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              Normalized BBox: [{inspectedObject.box.x_min.toFixed(3)}, {inspectedObject.box.y_min.toFixed(3)}, {inspectedObject.box.x_max.toFixed(3)}, {inspectedObject.box.y_max.toFixed(3)}]
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                        <Activity className="h-6 w-6 mx-auto opacity-30 mb-1" />
                        <p>{isLiveDetectionActive ? 'Scanning frame for vehicles...' : 'Press Start Live Detection to begin'}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Single-flight inference: frames are skipped, not queued, while a request is in progress.
                  </div>
                </div>
              </div>

              {/* Traffic Premonition: trajectory risk estimate + evidence reveal */}
              <TrafficPremonitionPanel
                enabled={premonitionOverlayEnabled}
                onToggle={setPremonitionOverlayEnabled}
                result={livePremonition}
                isLiveActive={isLiveDetectionActive}
                onInspectMoment={handleInspectPremonitionMoment}
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION 2: FULL VIDEO ANALYSIS (OFFLINE BATCH SAMPLING & PERSISTENCE)  */}
      {/* ========================================================================= */}
      {activeSubsection === 'full_analysis' && (
        <div className="space-y-4">
          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-sky-500/50 bg-white dark:bg-[#0b1120] rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/40 shadow-xs"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Select Moving Video or Still Frame</h4>
              {/* 1-Click Test Drive Presets */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">1-Click Test Drive:</span>
                <button
                  type="button"
                  onClick={handleLoadSampleVideo}
                  className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200 dark:border-sky-500/30 text-sky-700 dark:text-sky-300 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <FileVideo className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Sample Moving Video (4s MP4)</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSampleImage}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <FileImage className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Sample Traffic Intersection (JPG)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Progress Indicator */}
              {isAnalyzingFull && (
                <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/30 space-y-2 animate-fadeIn shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-sky-700 dark:text-sky-300 flex items-center gap-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600 dark:text-sky-400" />
                      {analysisStep || 'Executing batch video pipeline...'}
                    </span>
                    <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">BATCH ACTIVE</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 rounded-full motion-safe:animate-pulse w-3/4" />
                  </div>
                </div>
              )}

              {/* View Switcher and Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setFullAnalysisViewMode('video')}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                      fullAnalysisViewMode === 'video'
                        ? 'bg-sky-50 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold border border-sky-200 dark:border-transparent'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Video Scrubber
                  </button>

                  {fullAnalysisResult && (
                    <button
                      type="button"
                      onClick={() => setFullAnalysisViewMode('representative_frame')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                        fullAnalysisViewMode === 'representative_frame'
                          ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-transparent'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Peak Frame Annotation (with Tracks)
                    </button>
                  )}

                  {capturedFrameUrl && (
                    <button
                      type="button"
                      onClick={() => setFullAnalysisViewMode('selected_frame')}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                        fullAnalysisViewMode === 'selected_frame'
                          ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-transparent'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Scrubbed Frame ({capturedTimestamp?.toFixed(2)}s)
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isVideoFile && (
                    <button
                      type="button"
                      onClick={handleCaptureCurrentFrame}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Camera className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Grab Paused Frame</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isAnalyzingFull}
                    onClick={handleRunFullAnalysis}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                    <span>{fullAnalysisResult ? 'Re-Run Batch Pipeline' : 'Execute Batch Pipeline'}</span>
                  </button>
                </div>
              </div>

              {/* Viewport for Full Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-2xl bg-black border border-slate-200 dark:border-slate-800 overflow-hidden relative min-h-[380px] flex flex-col justify-center items-center shadow-xs">
                  {fullAnalysisViewMode === 'video' && isVideoFile && previewUrl && (
                    <div className="w-full flex flex-col">
                      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
                        <video
                          ref={videoPlayerRef}
                          src={previewUrl}
                          onLoadedMetadata={handleVideoLoadedMetadata}
                          onTimeUpdate={handleVideoTimeUpdate}
                          className="max-h-full max-w-full"
                        />
                      </div>
                      <div className="p-3 bg-white dark:bg-[#0b1120] border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={toggleVideoPlayback}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-all shadow-xs"
                          >
                            {isVideoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max={videoDuration || 10}
                            step="0.04"
                            value={currentVideoTime}
                            onChange={(e) => handleSeek(parseFloat(e.target.value))}
                            className="flex-1 accent-sky-600 cursor-pointer"
                          />
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 w-24 text-right">
                            {currentVideoTime.toFixed(2)}s / {(videoDuration || 0).toFixed(2)}s
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {fullAnalysisViewMode === 'representative_frame' && fullAnalysisResult?.representative_frame_base64 && (
                    <div className="relative w-full aspect-video flex items-center justify-center bg-black">
                      <img
                        src={fullAnalysisResult.representative_frame_base64}
                        alt="Peak Frame Annotations"
                        className="max-h-full max-w-full object-contain"
                      />
                      <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/80 border border-slate-700 text-[10px] font-mono text-emerald-400">
                        REPRESENTATIVE FRAME • TRACKED OBJECTS & CORDON OVERLAY
                      </div>
                    </div>
                  )}

                  {fullAnalysisViewMode === 'selected_frame' && (
                    <div className="relative w-full aspect-video flex items-center justify-center bg-black">
                      {frameAnalysisResult?.representative_frame_base64 ? (
                        <img
                          src={frameAnalysisResult.representative_frame_base64}
                          alt="Annotated Frame"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : capturedFrameUrl ? (
                        <div className="relative max-h-full max-w-full flex items-center justify-center">
                          <img src={capturedFrameUrl} alt="Captured Frame" className="max-h-full max-w-full object-contain" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                            <button
                              type="button"
                              disabled={isAnalyzingFrame}
                              onClick={handleRunFrameAnalysis}
                              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold font-mono shadow-xs flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                              {isAnalyzingFrame ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                  <span>Analyzing Selected Frame...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4" />
                                  <span>Analyze Selected Frame ({capturedTimestamp?.toFixed(2)}s)</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {!isVideoFile && previewUrl && (
                    <div className="relative w-full aspect-video flex items-center justify-center bg-black">
                      <img
                        src={fullAnalysisResult?.representative_frame_base64 || previewUrl}
                        alt="Uploaded frame"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Right Inspector */}
                <div className="rounded-2xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 p-4 space-y-3.5 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                        Batch Detection Inspector
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {currentInspectorDetections.length} Detections
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Vehicles</span>
                        <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
                          {fullAnalysisResult?.total_vehicles || 0}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Unique Tracked</span>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {fullAnalysisResult?.unique_vehicles_tracked || 0}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {currentInspectorDetections.map((obj, i) => (
                        <div
                          key={obj.id || i}
                          onClick={() => setInspectedObject(obj)}
                          className={`p-2 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            inspectedObject?.id === obj.id
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900'
                          }`}
                        >
                          <span className="font-bold text-slate-900 dark:text-white capitalize">
                            {obj.track_id ? `#${obj.track_id} ` : ''}
                            {obj.class_name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {Math.round(obj.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    Persistence: SQLite database row saved upon batch completion
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION 3: TRAFFIC ANALYTICS                                          */}
      {/* ========================================================================= */}
      {activeSubsection === 'analytics' && (
        <div className="space-y-4">
          {fullAnalysisResult ? (
            <div className="space-y-4">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Unique Tracked</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {fullAnalysisResult.unique_vehicles_tracked}
                  </span>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">Deduped via sequential IoU tracking</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Total Frame Detections</span>
                  <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">
                    {fullAnalysisResult.total_frame_detections}
                  </span>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">Cumulative sum across sampled frames</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Corridor Congestion</span>
                  <span
                    className={`text-base font-bold font-mono ${
                      fullAnalysisResult.estimated_congestion_level === 'HEAVY'
                        ? 'text-rose-600 dark:text-rose-400'
                        : fullAnalysisResult.estimated_congestion_level === 'MODERATE'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {fullAnalysisResult.estimated_congestion_level}
                  </span>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">Based on vehicle count per frame</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Cordon Crossings</span>
                  <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                    {fullAnalysisResult.events?.length || 0}
                  </span>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">Events across virtual cordon line</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-1 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono block">Inference Throughput</span>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {fullAnalysisResult.fps_processed && fullAnalysisResult.fps_processed > 0
                      ? `${fullAnalysisResult.fps_processed.toFixed(1)} FPS`
                      : 'N/A'}
                  </span>
                  <p className="text-[9px] text-slate-500 dark:text-slate-400">
                    {fullAnalysisResult.processing_time_ms && fullAnalysisResult.processing_time_ms > 0
                      ? `${fullAnalysisResult.processing_time_ms.toFixed(0)} ms latency`
                      : 'Latency: N/A'}
                  </p>
                </div>
              </div>

              {/* Legacy Record Notice if tracking was uninstrumented */}
              {(!fullAnalysisResult.tracking_summary || (fullAnalysisResult.tracking_summary.tracks && fullAnalysisResult.tracking_summary.tracks.length === 0)) && !fullAnalysisResult.session_id && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200 font-mono shadow-xs">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Legacy Video Analysis Record</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Recorded prior to multi-object tracking instrumentation. Frame detections are preserved; trajectory tracking, cordon crossing events, and runtime FPS metrics are N/A.
                    </p>
                  </div>
                </div>
              )}

              {/* Traffic Volume Trend Chart (Dynamic SVG) */}
              <div className="p-4 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                      <BarChart2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                      Time-Bucketed Traffic Volume & Activity Trend
                    </h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Observed vehicle detections and active tracked vehicles aggregated into configurable time windows
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                      <span className="h-2 w-2 rounded-sm bg-sky-500" /> Frame Detections
                    </span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Unique Vehicles
                    </span>
                  </div>
                </div>

                {fullAnalysisResult.time_buckets && fullAnalysisResult.time_buckets.length > 0 ? (
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[450px] h-48 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-l border-slate-200 dark:border-slate-800">
                      {fullAnalysisResult.time_buckets.map((b, idx) => {
                        const maxVal = Math.max(
                          ...fullAnalysisResult.time_buckets!.map((tb) => Math.max(tb.total_detections, tb.unique_vehicles, 1))
                        );
                        const hDets = Math.max(8, (b.total_detections / maxVal) * 130);
                        const hUnique = Math.max(8, (b.unique_vehicles / maxVal) * 130);

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                            <div className="flex items-end gap-1 w-full justify-center">
                              <div
                                className="w-1/2 max-w-[24px] bg-sky-500/80 group-hover:bg-sky-400 rounded-t transition-all relative"
                                style={{ height: `${hDets}px` }}
                              >
                                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-sky-600 dark:text-sky-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {b.total_detections}
                                </span>
                              </div>
                              <div
                                className="w-1/2 max-w-[24px] bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all relative"
                                style={{ height: `${hUnique}px` }}
                              >
                                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-600 dark:text-emerald-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {b.unique_vehicles}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {b.start_sec.toFixed(0)}-{b.end_sec.toFixed(0)}s
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                    Time bucket breakdown not recorded for this media run.
                  </div>
                )}
              </div>

              {/* Interval-by-Interval Summary Table */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
                <h5 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  Interval-by-Interval Traffic Summary
                </h5>
                <div className="overflow-x-auto max-h-56">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-1.5 px-2">Window</th>
                        <th className="py-1.5 px-2">Detections</th>
                        <th className="py-1.5 px-2">Unique Vehicles</th>
                        <th className="py-1.5 px-2">Pedestrians</th>
                        <th className="py-1.5 px-2">Congestion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                      {fullAnalysisResult.time_buckets?.map((b, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                          <td className="py-1.5 px-2">{b.start_sec.toFixed(1)}s - {b.end_sec.toFixed(1)}s</td>
                          <td className="py-1.5 px-2 text-sky-600 dark:text-sky-300">{b.total_detections}</td>
                          <td className="py-1.5 px-2 text-emerald-600 dark:text-emerald-300 font-bold">{b.unique_vehicles}</td>
                          <td className="py-1.5 px-2 text-amber-600 dark:text-amber-300">{b.pedestrian_count}</td>
                          <td className="py-1.5 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] ${
                                b.average_congestion === 'HEAVY'
                                  ? 'bg-rose-50 dark:bg-red-950 text-rose-700 dark:text-red-300'
                                  : b.average_congestion === 'MODERATE'
                                  ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {b.average_congestion}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-xs">
              <BarChart2 className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-500 opacity-40" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Traffic Analytics Available</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Run Live Playback Detection or Full Video Analysis to generate traffic density metrics, time-bucket charts, and vehicle classifications.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION 4: VEHICLE TRACKING & EVENTS                                  */}
      {/* ========================================================================= */}
      {activeSubsection === 'tracking_events' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
            <h5 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              Virtual Cordon Crossing Events Log
            </h5>
            {fullAnalysisResult?.events && fullAnalysisResult.events.length > 0 ? (
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {fullAnalysisResult.events.map((ev, i) => (
                  <div
                    key={ev.event_id || i}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-mono font-bold border border-rose-200 dark:border-transparent">
                        {ev.timestamp_sec.toFixed(2)}s
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white capitalize">
                        #{ev.track_id} {ev.class_name}
                      </span>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="text-sky-600 dark:text-sky-300 font-bold">{ev.direction || 'CROSSING'}</span>
                      {ev.confidence && <span className="ml-2">({Math.round(ev.confidence * 100)}%)</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
                <Activity className="h-6 w-6 mx-auto opacity-30 mb-1" />
                <p>No virtual cordon crossing events detected yet. Run video analysis to detect movements across the cordon line.</p>
              </div>
            )}
          </div>

          {/* Saved Traffic Premonition estimates (from live sessions). Never confirmed incidents. */}
          {fullAnalysisResult?.tracking_summary?.risk_events && fullAnalysisResult.tracking_summary.risk_events.length > 0 && (
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Traffic Premonition estimates
                </h5>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Predicted, not observed incidents</span>
              </div>
              <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {fullAnalysisResult.tracking_summary.risk_events.map((ev) => (
                  <li
                    key={ev.event_id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white">
                      #{ev.track_ids[0]} · #{ev.track_ids[1]}
                      <span className="ml-2 font-mono font-normal text-slate-500 dark:text-slate-400">
                        {ev.first_detected_sec.toFixed(2)}–{ev.last_detected_sec.toFixed(2)} s
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      closest projected gap {ev.peak.measurements.closest_projected_separation_fh.toFixed(3)} fh
                      {ev.peak.measurements.time_to_closest_approach_sec !== null &&
                        ` · ${ev.peak.measurements.time_to_closest_approach_sec.toFixed(2)} s ahead`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tracking Methodology & Limitations Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 shadow-xs">
            <Info className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">Multi-Object Tracking Methodology & Physical Sensor Notice:</p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Vehicle tracking uses an Intersection-over-Union (IoU) state association engine across consecutive sampled frames. Track IDs are session-scoped and maintain continuity during uninterrupted movement. When a vehicle is occluded or leaves the frame, tracking uncertainty increases. Real-world physical speeds and collision predictions are not certified without calibrated physical sensors or surveyed ground control markers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION 5: MODEL EVALUATION & BENCHMARKS                              */}
      {/* ========================================================================= */}
      {activeSubsection === 'evaluation' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  Independent Ground-Truth Benchmark Evaluation
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Evaluates detector precision, recall, and F1 scores against independently annotated ground-truth bounding boxes.
                </p>
              </div>

              <button
                type="button"
                disabled={isEvaluating}
                onClick={handleRunEvaluation}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold font-mono shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isEvaluating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Evaluating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Run Benchmark Evaluation</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2 text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-mono">IoU Matching Threshold:</span>
              <input
                type="range"
                min="0.30"
                max="0.75"
                step="0.05"
                value={evalIoUThreshold}
                onChange={(e) => setEvalIoUThreshold(parseFloat(e.target.value))}
                className="w-48 accent-amber-500"
              />
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{evalIoUThreshold.toFixed(2)}</span>
            </div>
          </div>

          {evaluationResult && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
                <div className="p-3 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Precision</span>
                  <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                    {(evaluationResult.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Recall</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {(evaluationResult.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">F1 Score</span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {(evaluationResult.f1_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 shadow-xs">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">TP / FP / Missed</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    <span className="text-emerald-600 dark:text-emerald-400">{evaluationResult.true_positives}</span> /{' '}
                    <span className="text-rose-600 dark:text-rose-400">{evaluationResult.false_positives}</span> /{' '}
                    <span className="text-amber-600 dark:text-amber-400">{evaluationResult.missed_detections}</span>
                  </span>
                </div>
              </div>

              {/* Per-Class Breakdown Table */}
              {evaluationResult.class_metrics && Object.keys(evaluationResult.class_metrics).length > 0 && (
                <div className="p-3.5 rounded-xl bg-white dark:bg-[#0b1120] border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white font-mono">Per-Class Accuracy Breakdown</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="py-1.5 px-2">Class</th>
                          <th className="py-1.5 px-2">TP</th>
                          <th className="py-1.5 px-2">FP</th>
                          <th className="py-1.5 px-2">Missed</th>
                          <th className="py-1.5 px-2">Precision</th>
                          <th className="py-1.5 px-2">Recall</th>
                          <th className="py-1.5 px-2">F1</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                        {Object.entries(evaluationResult.class_metrics).map(([cls, m]) => (
                          <tr key={cls} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                            <td className="py-1.5 px-2 capitalize font-bold text-slate-900 dark:text-white">{cls}</td>
                            <td className="py-1.5 px-2 text-emerald-600 dark:text-emerald-400">{m.true_positives}</td>
                            <td className="py-1.5 px-2 text-rose-600 dark:text-rose-400">{m.false_positives}</td>
                            <td className="py-1.5 px-2 text-amber-600 dark:text-amber-400">{m.missed_detections}</td>
                            <td className="py-1.5 px-2">{(m.precision * 100).toFixed(1)}%</td>
                            <td className="py-1.5 px-2">{(m.recall * 100).toFixed(1)}%</td>
                            <td className="py-1.5 px-2 font-bold text-amber-600 dark:text-amber-300">{(m.f1_score * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Evaluation Rigor Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 shadow-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">Evaluation Rigor & Verification Standard:</p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Predicted bounding boxes are evaluated strictly against independently labeled ground-truth files using greedy IoU matching. Unit-test self-comparisons are never conflated with model accuracy. If independent annotations are absent, empirical accuracy is reported as unestablished.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBSECTION 6: PERSISTENT ANALYSIS HISTORY                                */}
      {/* ========================================================================= */}
      {activeSubsection === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                <History className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                Persistent SQLite Analysis Records
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                Audit history of completed video and live session analyses persisted in the database.
              </p>
            </div>

            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 text-xs font-mono">
              <RefreshCw className="h-5 w-5 mx-auto animate-spin mb-2 text-sky-600 dark:text-sky-400" />
              Loading persistent history records...
            </div>
          ) : historyList.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] shadow-xs">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Media Name</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Frames</th>
                    <th className="py-2 px-3">Unique Vehicles</th>
                    <th className="py-2 px-3">Total Detections</th>
                    <th className="py-2 px-3">Adapter</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-200">
                  {historyList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900 dark:text-white truncate max-w-[140px]">{item.filename}</td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 uppercase">{item.media_type}</td>
                      <td className="py-2 px-3 text-sky-600 dark:text-sky-300">{item.frame_count_sampled}</td>
                      <td className="py-2 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                        {item.is_legacy ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/40" title="Legacy analysis: recorded before multi-object tracking was instrumented">
                            N/A (Legacy)
                          </span>
                        ) : (
                          item.unique_vehicles_tracked
                        )}
                      </td>
                      <td className="py-2 px-3 text-sky-600 dark:text-sky-400">{item.total_frame_detections}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] ${
                            item.is_simulated
                              ? 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                              : 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                          }`}
                        >
                          {item.adapter_name}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleLoadHistoricalRecord(item)}
                          className="px-2.5 py-1 rounded bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 text-[10px] font-bold transition-all border border-sky-200 dark:border-sky-500/30 shadow-xs"
                        >
                          Inspect & Replay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-[#0b1120] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-2 shadow-xs">
              <History className="h-6 w-6 mx-auto text-slate-400 dark:text-slate-500 opacity-40" />
              <p className="text-xs text-slate-500 dark:text-slate-400">No persistent analysis records stored in database yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

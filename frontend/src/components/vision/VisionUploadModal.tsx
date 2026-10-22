import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal';
import {
  UploadCloud,
  FileImage,
  AlertTriangle,
  CheckCircle,
  Scan,
  ShieldAlert,
  Car,
  Truck,
  Bus,
  Bike,
  User,
  Zap,
} from 'lucide-react';
import { VisionAnalysisResult } from '../../types';
import { api } from '../../services/api';

interface VisionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisionUploadModal: React.FC<VisionUploadModalProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VisionAnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (file: File) => {
    setErrorMessage(null);
    setAnalysisResult(null);

    // Validate size (20MB)
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('File size exceeds maximum allowable limit of 20 MB.');
      return;
    }

    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setErrorMessage('Unsupported file format. Please upload JPG, PNG, WEBP, or MP4/MOV video.');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setErrorMessage(null);

    try {
      const result = await api.analyzeVisionMedia(selectedFile);
      setAnalysisResult(result);
    } catch (err: any) {
      setErrorMessage(err.message || 'Vision analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to generate synthetic test canvas for 1-click test drive
  const handleLoadSample = (scenarioName: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw simulated road corridor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 800, 600);
      
      // Road asphalt
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(100, 600);
      ctx.lineTo(350, 200);
      ctx.lineTo(450, 200);
      ctx.lineTo(700, 600);
      ctx.fill();

      // Lane dividers
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.beginPath();
      ctx.moveTo(400, 200);
      ctx.lineTo(400, 600);
      ctx.stroke();

      // Timestamp watermark
      ctx.fillStyle = '#38bdf8';
      ctx.font = '16px monospace';
      ctx.fillText(`CCTV METRO SENSOR #${scenarioName.toUpperCase()} — LIVE FEED`, 30, 40);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `${scenarioName}_cctv_frame.jpg`, { type: 'image/jpeg' });
        handleFileChange(file);
      }
    }, 'image/jpeg');
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalysisResult(null);
    setErrorMessage(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Computer Vision Road Safety Audit"
      subtitle="Extensible AI object detection, vehicle counting, and hazard detection"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Transparent Provenance Alert */}
        <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5 text-xs text-sky-300 flex items-start gap-3">
          <Zap className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Extensible AI Vision Layer (Phase 1):</span>
            <p className="mt-0.5 text-slate-300">
              Deterministic demo simulator adapter active. Processes actual uploaded image dimensions, generates verified bounding boxes, counts vehicles, and evaluates collision risks. Real model weights can be plugged into the <code>BaseVisionService</code> interface in Phase 2.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-950/40 p-3 text-xs text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {!selectedFile ? (
          <div>
            {/* Drag & drop upload area */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-10 hover:border-sky-500/70 hover:bg-slate-900/80 transition-all cursor-pointer group"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <div className="rounded-xl bg-slate-800 p-4 text-sky-400 group-hover:scale-110 transition-transform">
                <UploadCloud className="h-8 w-8" />
              </div>
              <p className="mt-4 text-sm font-semibold text-white">
                Drag and drop road CCTV image or traffic video
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Supports JPG, PNG, WEBP, MP4, MOV (Max 20 MB)
              </p>
            </div>

            {/* Instant Sample Presets */}
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                Or Test Drive with Instant Sample Feeds:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleLoadSample('corridor_junction_4')}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-sky-500/50 hover:bg-slate-800/60 transition-all"
                >
                  <p className="text-xs font-semibold text-white">Intersection Camera 04</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">High arterial volume scenario</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSample('highway_101_bridge')}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-sky-500/50 hover:bg-slate-800/60 transition-all"
                >
                  <p className="text-xs font-semibold text-white">Highway 101 Overpass</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Multi-lane freight transit</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSample('civic_center_crosswalk')}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-sky-500/50 hover:bg-slate-800/60 transition-all"
                >
                  <p className="text-xs font-semibold text-white">Pedestrian Plaza Crosswalk</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Vulnerable road user safety</p>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected File Banner & Actions */}
            <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center gap-3">
                <FileImage className="h-5 w-5 text-sky-400" />
                <div>
                  <p className="text-xs font-semibold text-white">{selectedFile.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Media'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isAnalyzing}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Change File
                </button>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 transition-colors shadow-md flex items-center gap-1.5"
                >
                  {isAnalyzing ? (
                    <>
                      <Scan className="h-4 w-4 animate-spin" />
                      <span>Processing Neural Scan...</span>
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4" />
                      <span>Execute Vision Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Image Preview with Bounding Box Overlay */}
            {previewUrl && (
              <div className="relative w-full max-h-[360px] rounded-xl border border-slate-800 bg-black overflow-hidden flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Road CCTV Feed"
                  className="max-h-[360px] w-auto object-contain"
                />

                {/* Render bounding boxes if analysis completed */}
                {analysisResult && (
                  <div className="absolute inset-0 pointer-events-none">
                    {analysisResult.detected_objects.map((obj) => (
                      <div
                        key={obj.id}
                        className={`absolute border-2 rounded ${
                          obj.class_name === 'pedestrian'
                            ? 'border-yellow-400 bg-yellow-400/20'
                            : obj.hazard_flag
                            ? 'border-rose-500 bg-rose-500/20'
                            : 'border-sky-400 bg-sky-400/15'
                        }`}
                        style={{
                          left: `${obj.box.x_min * 100}%`,
                          top: `${obj.box.y_min * 100}%`,
                          width: `${(obj.box.x_max - obj.box.x_min) * 100}%`,
                          height: `${(obj.box.y_max - obj.box.y_min) * 100}%`,
                        }}
                      >
                        <span className="absolute -top-5 left-0 rounded bg-slate-900/90 text-[10px] px-1 py-0.2 text-white font-mono border border-slate-700 whitespace-nowrap">
                          {obj.class_name} ({Math.round(obj.confidence * 100)}%)
                          {obj.speed_estimate_kmh ? ` • ${obj.speed_estimate_kmh} km/h` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Analysis Results View */}
            {analysisResult && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div>
                    <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                      Vision Scan Completed
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Processed in {analysisResult.processing_time_ms} ms via{' '}
                      <span className="text-sky-300 font-mono">{analysisResult.adapter_name}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold ${
                        analysisResult.estimated_congestion_level === 'HEAVY'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : analysisResult.estimated_congestion_level === 'MODERATE'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      Congestion: {analysisResult.estimated_congestion_level}
                    </span>
                  </div>
                </div>

                {/* Object Count Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Car className="h-3.5 w-3.5 text-sky-400" />
                      <span>Cars</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">
                      {analysisResult.vehicle_breakdown.car ?? 0}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Bus className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Buses</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">
                      {analysisResult.vehicle_breakdown.bus ?? 0}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Truck className="h-3.5 w-3.5 text-amber-400" />
                      <span>Trucks</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">
                      {analysisResult.vehicle_breakdown.truck ?? 0}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
                      <Bike className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Motorcycles</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">
                      {analysisResult.vehicle_breakdown.motorcycle ?? 0}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs mb-1">
                      <User className="h-3.5 w-3.5 text-yellow-400" />
                      <span>Pedestrians</span>
                    </div>
                    <span className="text-lg font-bold text-white font-mono">
                      {analysisResult.total_pedestrians}
                    </span>
                  </div>
                </div>

                {/* Risk and Lane Blockage Assessment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <span className="text-xs text-slate-400">Collision Risk Index</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xl font-bold font-mono text-white">
                        {Math.round(analysisResult.collision_risk_score * 100)} / 100
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          analysisResult.collision_risk_score > 0.6
                            ? 'text-rose-400'
                            : analysisResult.collision_risk_score > 0.3
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {analysisResult.collision_risk_score > 0.6
                          ? 'HIGH COLLISION RISK'
                          : analysisResult.collision_risk_score > 0.3
                          ? 'MODERATE RISK'
                          : 'LOW RISK'}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 rounded-full"
                        style={{ width: `${analysisResult.collision_risk_score * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <span className="text-xs text-slate-400">Roadway Continuity</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        {analysisResult.lane_blockage_detected
                          ? 'Lane Obstruction Detected'
                          : 'All Lanes Open & Continuous'}
                      </span>
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          analysisResult.lane_blockage_detected
                            ? 'bg-rose-500 animate-pulse'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                    {analysisResult.detected_hazards.length > 0 ? (
                      <p className="mt-2 text-[11px] text-amber-300">
                        {analysisResult.detected_hazards.join(' • ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-400">
                        No immediate physical hazards flagged.
                      </p>
                    )}
                  </div>
                </div>

                {/* AI Recommendations */}
                <div className="rounded-lg border border-sky-950 bg-sky-950/30 p-3 text-xs">
                  <p className="font-semibold text-sky-300 font-mono uppercase tracking-wider mb-1.5">
                    Recommended Operational Interventions:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300">
                    {analysisResult.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

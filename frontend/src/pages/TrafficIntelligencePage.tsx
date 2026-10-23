import React from 'react';
import { TrafficIntelligenceWorkspace } from '../components/vision/TrafficIntelligenceWorkspace';
import { Sparkles, ShieldCheck } from 'lucide-react';

export const TrafficIntelligencePage: React.FC = () => {
  return (
    <div className="space-y-4">
      {/* Page Title & Operational Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide font-mono uppercase">
              Traffic Intelligence & Computer Vision AI
            </h2>
            <span className="rounded bg-sky-50 dark:bg-sky-950/80 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
              P3 FINAL
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Synchronized live video object detection, sequential IoU vehicle tracking, virtual cordon crossing metrics, and benchmark validation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300 font-mono flex items-center gap-1.5 shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>YOLOv8n ONNX Engine Ready</span>
          </span>
        </div>
      </div>

      {/* Main Workspace Component */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080d1a]/80 p-4 sm:p-5 shadow-xs transition-colors">
        <TrafficIntelligenceWorkspace initialSubsection="live_detection" />
      </div>
    </div>
  );
};

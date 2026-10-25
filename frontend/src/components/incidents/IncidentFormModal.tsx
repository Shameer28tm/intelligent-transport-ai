import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { IncidentCategory, IncidentSeverity } from '../../types';
import { AlertCircle, Check, MapPin } from 'lucide-react';

interface IncidentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const IncidentFormModal: React.FC<IncidentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('ACCIDENT');
  const [severity, setSeverity] = useState<IncidentSeverity>('HIGH');
  const [latitude, setLatitude] = useState<string>('13.0067');
  const [longitude, setLongitude] = useState<string>('80.2045');
  const [locationName, setLocationName] = useState('');
  const [corridor, setCorridor] = useState('');
  const [currentSpeed, setCurrentSpeed] = useState<string>('15');
  const [speedLimit, setSpeedLimit] = useState<string>('50');
  const [congestionPct, setCongestionPct] = useState<string>('75');
  const [affectedLanes, setAffectedLanes] = useState<string>('1');
  const [tags, setTags] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUsePreset = (name: string, lat: number, lng: number, corr: string) => {
    setLocationName(name);
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    setCorridor(corr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Incident title is required.');
      return;
    }

    if (!locationName.trim()) {
      setError('Location name or street intersection is required.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Latitude must be a valid number between -90.0 and 90.0');
      return;
    }

    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setError('Longitude must be a valid number between -180.0 and 180.0');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        severity,
        latitude: latNum,
        longitude: lngNum,
        location_name: locationName.trim(),
        corridor: corridor.trim() || undefined,
        current_speed_kmh: currentSpeed ? parseFloat(currentSpeed) : undefined,
        speed_limit_kmh: speedLimit ? parseFloat(speedLimit) : undefined,
        congestion_level_pct: congestionPct ? parseFloat(congestionPct) : 0,
        affected_lanes: affectedLanes ? parseInt(affectedLanes, 10) : 1,
        tags: tags ? tags.split(',').map((t) => t.trim()) : [],
      });
      // Reset form on success
      setTitle('');
      setDescription('');
      setLocationName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Report Transport Incident / Hazard"
      subtitle="Logs a verified event to the municipal operations database"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-950/40 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Coordinate Presets */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Quick Coordinate Presets:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                handleUsePreset(
                  'Kathipara junction, Guindy',
                  13.0067,
                  80.2045,
                  'GST Road / Inner Ring Road'
                )
              }
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:border-sky-500 transition-colors"
            >
              Kathipara, Chennai
            </button>
            <button
              type="button"
              onClick={() =>
                handleUsePreset(
                  'NH-45 Vikravandi junction, Viluppuram',
                  12.0379,
                  79.5466,
                  'NH-45 Chennai–Trichy'
                )
              }
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:border-sky-500 transition-colors"
            >
              NH-45 Vikravandi
            </button>
            <button
              type="button"
              onClick={() =>
                handleUsePreset(
                  'NH-44 Krishnagiri bypass',
                  12.5318,
                  78.2270,
                  'NH-44 Bengaluru–Krishnagiri'
                )
              }
              className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:border-sky-500 transition-colors"
            >
              NH-44 Krishnagiri
            </button>
          </div>
        </div>

        {/* Title & Category */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Incident Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Disabled Truck Blocking Right Turn Lane"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Severity Level</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="CRITICAL">Critical (Life/Major Delay)</option>
              <option value="HIGH">High (Corridor Gridlock)</option>
              <option value="MEDIUM">Medium (Moderate Delay)</option>
              <option value="LOW">Low (Minor Advisory)</option>
            </select>
          </div>
        </div>

        {/* Category & Corridor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Incident Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IncidentCategory)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
            >
              <option value="ACCIDENT">Accident / Collision</option>
              <option value="CONGESTION">Traffic Congestion / Queue</option>
              <option value="ROADWORK">Roadwork / Construction</option>
              <option value="HAZARD">Road Debris / Roadway Hazard</option>
              <option value="VEHICLE_BREAKDOWN">Vehicle Breakdown</option>
              <option value="PEDESTRIAN_CROSSING_RISK">Pedestrian Safety Conflict</option>
              <option value="WEATHER_EVENT">Weather / Visibility Event</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Transit Corridor Name</label>
            <input
              type="text"
              placeholder="e.g. NH-45 Chennai–Trichy"
              value={corridor}
              onChange={(e) => setCorridor(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Location & Coordinates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Address / Intersection <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Kathipara junction, Guindy"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Latitude (-90 to 90)</label>
            <input
              type="number"
              step="any"
              required
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Longitude (-180 to 180)</label>
            <input
              type="number"
              step="any"
              required
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Speed & Congestion metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Current Speed (km/h)</label>
            <input
              type="number"
              min="0"
              max="250"
              value={currentSpeed}
              onChange={(e) => setCurrentSpeed(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Speed Limit (km/h)</label>
            <input
              type="number"
              min="0"
              max="250"
              value={speedLimit}
              onChange={(e) => setSpeedLimit(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Congestion % (0-100)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={congestionPct}
              onChange={(e) => setCongestionPct(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Lanes Affected</label>
            <input
              type="number"
              min="0"
              max="12"
              value={affectedLanes}
              onChange={(e) => setAffectedLanes(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white font-mono focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Operational Description</label>
          <textarea
            rows={2}
            placeholder="Additional situational notes for transit dispatchers and incident teams..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* Tags */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Tags (comma separated)</label>
          <input
            type="text"
            placeholder="e.g. transit-delay, bus-lane-blocked, emergency-dispatch"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-500 transition-colors shadow-md shadow-sky-950 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Submitting...' : 'Register Incident'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

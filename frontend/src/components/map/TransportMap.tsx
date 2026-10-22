import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';

import {
  RotateCcw,
  Layers,
  Flame,
  AlertTriangle,
  Info,
  Compass,
  Map as MapIcon,
  Check,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { Incident, IncidentSeverity } from '../../types';
import { MapLegend } from './MapLegend';
import { IncidentDetailPanel } from './IncidentDetailPanel';

interface TransportMapProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onUpdateStatus: (id: string, newStatus: any) => Promise<void>;
  isLoading?: boolean;
}

export type BasemapProvider = 'dark-canvas' | 'openfreemap' | 'osm' | 'carto';

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12.2;

// 1. Esri World Dark Gray Canvas (Default: 100% Keyless, zero watermark, clean dark theme)
const ESRI_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'Esri World Dark Gray Canvas',
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, HERE, Garmin, OpenStreetMap contributors',
      maxzoom: 16,
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '',
      maxzoom: 16,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#070b13' },
    },
    {
      id: 'esri-dark-base-layer',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 20,
    },
    {
      id: 'esri-dark-reference-layer',
      type: 'raster',
      source: 'esri-dark-reference',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 0.85,
      },
    },
  ],
};

// 2. OpenStreetMap Standard (100% Keyless public raster)
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'OpenStreetMap Standard',
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#070b13' },
    },
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// 3. CARTO Dark Matter (Raster, supports optional VITE_CARTO_API_KEY)
const getCartoDarkStyle = (apiKey?: string): maplibregl.StyleSpecification => {
  const query = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
  return {
    version: 8,
    name: 'CARTO Dark Matter',
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${query}`,
          `https://b.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${query}`,
          `https://c.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png${query}`,
        ],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#070b13' },
      },
      {
        id: 'carto-dark-layer',
        type: 'raster',
        source: 'carto-dark',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
};

// 4. OpenFreeMap Dark (Keyless Vector Style)
const OPENFREEMAP_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';

export const TransportMap: React.FC<TransportMapProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onUpdateStatus,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // State
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string>('ALL');
  const [showCongestionLayer, setShowCongestionLayer] = useState(true);
  const [showCorridorLayer, setShowCorridorLayer] = useState(true);
  const [basemap, setBasemap] = useState<BasemapProvider>('dark-canvas');
  const [isBasemapMenuOpen, setIsBasemapMenuOpen] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY as string | undefined;

  // Filter incidents according to active severity tab
  const filteredIncidents = useMemo(() => {
    if (activeSeverityFilter === 'ALL') return incidents;
    return incidents.filter((inc) => inc.severity === activeSeverityFilter);
  }, [incidents, activeSeverityFilter]);

  // Resolve style based on selected basemap provider
  const getStyleForProvider = useCallback(
    (provider: BasemapProvider): maplibregl.StyleSpecification | string => {
      switch (provider) {
        case 'dark-canvas':
          return ESRI_DARK_STYLE;
        case 'openfreemap':
          return OPENFREEMAP_DARK_URL;
        case 'osm':
          return OSM_STYLE;
        case 'carto':
          return getCartoDarkStyle(cartoApiKey);
        default:
          return ESRI_DARK_STYLE;
      }
    },
    [cartoApiKey]
  );

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up any existing map instance before creating a new one (prevents duplicate instances)
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    setIsStyleLoaded(false);
    setTileError(null);

    try {
      const initialStyle = getStyleForProvider(basemap);

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: initialStyle,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 25,
        attributionControl: false,
      });

      // Navigation controls
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

      map.on('load', () => {
        setIsStyleLoaded(true);
        setTileError(null);
        map.resize();
      });

      map.on('styledata', () => {
        if (map.isStyleLoaded()) {
          setIsStyleLoaded(true);
        }
      });

      map.on('mousemove', (e: any) => {
        setCursorCoords({
          lat: parseFloat(e.lngLat.lat.toFixed(4)),
          lng: parseFloat(e.lngLat.lng.toFixed(4)),
        });
      });

      map.on('error', (e: any) => {
        console.warn('[TransportMap] Tile or resource warning:', e);
        // Only set error if it's a tile loading or network failure
        const msg = e.error?.message || e.message || '';
        if (msg.includes('401') || msg.includes('403') || msg.includes('fetch') || msg.includes('network')) {
          setTileError(
            'Map tile connection error. Incident markers and telemetry remain fully operational.'
          );
        }
      });

      const handleWindowResize = () => map.resize();
      window.addEventListener('resize', handleWindowResize);

      mapRef.current = map;

      return () => {
        window.removeEventListener('resize', handleWindowResize);
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      console.error('[TransportMap] WebGL or map initialization error:', err);
      setTileError('WebGL map canvas unavailable. Coordinate telemetry and incident records active.');
    }
  }, [basemap, getStyleForProvider]);

  // Synchronize incident markers when incidents, filter, selection, or style readiness changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Ensure markers are only added after the map style has loaded
    if (!map.isStyleLoaded() && !isStyleLoaded) {
      return;
    }

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredIncidents.forEach((incident) => {
      const isSelected = selectedIncident?.id === incident.id;

      // Create custom marker DOM element
      const el = document.createElement('div');
      el.className = 'group cursor-pointer relative';

      const colorMap: Record<
        IncidentSeverity,
        { bg: string; border: string; glow: string; text: string }
      > = {
        CRITICAL: {
          bg: 'bg-red-600',
          border: 'border-red-300 ring-4 ring-red-600/40',
          glow: 'animate-radar-critical',
          text: 'text-white',
        },
        HIGH: {
          bg: 'bg-orange-500',
          border: 'border-orange-200 ring-2 ring-orange-500/30',
          glow: '',
          text: 'text-white',
        },
        MEDIUM: {
          bg: 'bg-amber-500',
          border: 'border-amber-200 ring-2 ring-amber-500/30',
          glow: '',
          text: 'text-slate-900',
        },
        LOW: {
          bg: 'bg-emerald-500',
          border: 'border-emerald-200',
          glow: '',
          text: 'text-white',
        },
      };

      const cfg = colorMap[incident.severity] || colorMap.MEDIUM;

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full ${cfg.bg} ${cfg.border} ${cfg.glow} ${cfg.text} flex items-center justify-center font-bold text-[10px] shadow-lg transition-transform hover:scale-125 ${
            isSelected ? 'scale-125 ring-8 ring-sky-400' : ''
          }">
            !
          </div>
          <div class="absolute -top-7 hidden group-hover:flex items-center rounded bg-slate-900/95 text-white text-[10px] px-2 py-0.5 border border-slate-700 whitespace-nowrap shadow-md pointer-events-none z-30">
            ${incident.location_name}
          </div>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectIncident(incident);
        map.flyTo({
          center: [incident.longitude, incident.latitude],
          zoom: 14.5,
          speed: 1.2,
        });
      });

      try {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([incident.longitude, incident.latitude])
          .addTo(map);

        markersRef.current.push(marker);
      } catch (err) {
        console.warn('[TransportMap] Error adding marker:', err);
      }
    });
  }, [filteredIncidents, selectedIncident, onSelectIncident, isStyleLoaded]);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 25,
        speed: 1.2,
      });
    }
  };

  const basemapOptions: { id: BasemapProvider; label: string; badge: string; isKeyless: boolean }[] = [
    {
      id: 'dark-canvas',
      label: 'Dark Gray Canvas',
      badge: 'Keyless (Recommended)',
      isKeyless: true,
    },
    {
      id: 'openfreemap',
      label: 'OpenFreeMap Dark',
      badge: 'Keyless Vector',
      isKeyless: true,
    },
    {
      id: 'osm',
      label: 'OpenStreetMap',
      badge: 'Keyless Raster',
      isKeyless: true,
    },
    {
      id: 'carto',
      label: 'CARTO Dark Matter',
      badge: cartoApiKey ? 'Key Configured' : 'Key Required',
      isKeyless: false,
    },
  ];

  return (
    <div className="relative w-full h-[580px] rounded-2xl border border-slate-800 bg-[#070b13] overflow-hidden shadow-2xl">
      {/* Top Map Action Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        {/* Severity filter pills */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md p-1 shadow-lg">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setActiveSeverityFilter(sev)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide transition-all ${
                activeSeverityFilter === sev
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        {/* Basemap Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsBasemapMenuOpen(!isBasemapMenuOpen)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors shadow-lg"
          >
            <MapIcon className="h-3.5 w-3.5 text-sky-400" />
            <span>
              {basemapOptions.find((b) => b.id === basemap)?.label || 'Dark Gray Canvas'}
            </span>
            <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
          </button>

          {isBasemapMenuOpen && (
            <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-800 bg-[#0c1322]/95 backdrop-blur-md p-1.5 shadow-2xl z-30 space-y-1">
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                Select Public Basemap:
              </div>
              {basemapOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setBasemap(opt.id);
                    setIsBasemapMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                    basemap === opt.id
                      ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <div className="text-left">
                    <p className="leading-none">{opt.label}</p>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5 inline-block">
                      {opt.badge}
                    </span>
                  </div>
                  {basemap === opt.id && <Check className="h-4 w-4 text-sky-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md p-1 shadow-lg">
          <button
            onClick={() => setShowCongestionLayer(!showCongestionLayer)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              showCongestionLayer
                ? 'bg-slate-800 text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Congestion Heat</span>
          </button>

          <button
            onClick={() => setShowCorridorLayer(!showCorridorLayer)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              showCorridorLayer
                ? 'bg-slate-800 text-sky-400 font-semibold'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Corridors</span>
          </button>
        </div>

        {/* Recenter Button */}
        <button
          onClick={handleRecenter}
          className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0c1322]/90 backdrop-blur-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors shadow-lg"
          title="Recenter Map View"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset View</span>
        </button>
      </div>

      {/* Primary MapLibre GL Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* CARTO Key Notice if selected without key */}
      {basemap === 'carto' && !cartoApiKey && (
        <div className="absolute top-16 left-4 z-10 max-w-md rounded-lg border border-amber-600/40 bg-[#0c1322]/95 backdrop-blur-md p-2.5 text-xs text-amber-300 flex items-start gap-2 shadow-xl">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">CARTO Watermark Active:</span>
            <p className="mt-0.5 text-slate-300 text-[11px]">
              CARTO requires a key from <code>carto.com/basemaps/apikey</code>. For 100% keyless, watermark-free maps, switch to <strong>Dark Gray Canvas</strong> or <strong>OpenFreeMap Dark</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Connection Warning Banner if tile loading failed */}
      {tileError && (
        <div className="absolute top-16 left-4 z-10 max-w-md rounded-lg border border-red-500/50 bg-red-950/90 backdrop-blur-md p-2.5 text-xs text-red-200 flex items-start gap-2 shadow-xl">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{tileError}</span>
            <div className="mt-1 flex items-center gap-2">
              <button
                onClick={() => setBasemap('dark-canvas')}
                className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-white hover:bg-slate-700"
              >
                Switch to Dark Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coordinates readout bar in footer */}
      {cursorCoords && (
        <div className="absolute bottom-4 right-16 z-10 hidden sm:flex items-center gap-2 rounded-md border border-slate-800 bg-[#090e1a]/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono text-slate-400">
          <Compass className="h-3 w-3 text-sky-400" />
          <span>
            {cursorCoords.lat}° N, {Math.abs(cursorCoords.lng)}° W
          </span>
        </div>
      )}

      {/* Map Legend */}
      <MapLegend />

      {/* Synchronized Selected Incident Detail Panel */}
      <IncidentDetailPanel
        incident={selectedIncident}
        onClose={() => onSelectIncident(null)}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
};

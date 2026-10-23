import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreglWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// Configure MapLibre GL worker URL for Vite bundling
if (typeof window !== 'undefined' && (maplibregl as any).config) {
  (maplibregl as any).config.WORKER_URL = maplibreglWorkerUrl;
}

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
  Search,
  Navigation,
  X,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Lock,
  Activity,
} from 'lucide-react';
import { Incident, IncidentSeverity, MapplsStatus, TomTomStatus, TomTomFlowResponse } from '../../types';
import { MapLegend } from './MapLegend';
import { IncidentDetailPanel } from './IncidentDetailPanel';
import { api } from '../../services/api';

interface TransportMapProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onUpdateStatus: (id: string, newStatus: any) => Promise<void>;
  isLoading?: boolean;
}

export type BasemapProvider = 'mappls' | 'light-canvas' | 'dark-canvas' | 'openfreemap' | 'osm' | 'carto';

export interface RegionPreset {
  id: string;
  label: string;
  shortLabel: string;
  center: [number, number];
  zoom: number;
  bbox: [number, number, number, number];
}

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'sf',
    label: 'San Francisco, CA',
    shortLabel: 'SF Metro',
    center: [-122.4194, 37.7749],
    zoom: 12.2,
    bbox: [-122.52, 37.70, -122.35, 37.82],
  },
  {
    id: 'chennai',
    label: 'Chennai, Tamil Nadu',
    shortLabel: 'Chennai TN',
    center: [80.2500, 13.0400],
    zoom: 12.0,
    bbox: [80.12, 12.92, 80.32, 13.18],
  },
  {
    id: 'coimbatore',
    label: 'Coimbatore, Tamil Nadu',
    shortLabel: 'Coimbatore TN',
    center: [76.9558, 11.0168],
    zoom: 12.5,
    bbox: [76.85, 10.92, 77.08, 11.08],
  },
];

const DEFAULT_CENTER: [number, number] = REGION_PRESETS[0].center;
const DEFAULT_ZOOM = REGION_PRESETS[0].zoom;

// 1. Esri World Light Gray Canvas (100% Keyless, zero watermark, clean light theme)
const ESRI_LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  name: 'Esri World Light Gray Canvas',
  sources: {
    'esri-light-base': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: '© Esri, HERE, Garmin, OpenStreetMap contributors',
      maxzoom: 16,
    },
    'esri-light-reference': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
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
      paint: { 'background-color': '#f8fafc' },
    },
    {
      id: 'esri-light-base-layer',
      type: 'raster',
      source: 'esri-light-base',
      minzoom: 0,
      maxzoom: 20,
    },
    {
      id: 'esri-light-reference-layer',
      type: 'raster',
      source: 'esri-light-reference',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 0.85,
      },
    },
  ],
};

// 1. Esri World Dark Gray Canvas (100% Keyless, zero watermark, clean dark theme)
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
      paint: { 'background-color': '#060a12' },
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
      paint: { 'background-color': '#060a12' },
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
        paint: { 'background-color': '#060a12' },
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
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Map state
  const [activeSeverityFilter, setActiveSeverityFilter] = useState<string>('ALL');
  const [provenanceFilter, setProvenanceFilter] = useState<'ALL' | 'LIVE' | 'SIMULATED'>('ALL');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('sf');
  const [isRegionMenuOpen, setIsRegionMenuOpen] = useState(false);
  const [showCongestionLayer, setShowCongestionLayer] = useState(true);
  const [showCorridorLayer, setShowCorridorLayer] = useState(true);
  const isDarkInitial = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [basemap, setBasemap] = useState<BasemapProvider>(isDarkInitial ? 'dark-canvas' : 'light-canvas');
  const [isBasemapMenuOpen, setIsBasemapMenuOpen] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [tileError, setTileError] = useState<string | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Mappls integration state
  const [mapplsStatus, setMapplsStatus] = useState<MapplsStatus | null>(null);
  const [isCheckingMappls, setIsCheckingMappls] = useState(false);
  const [mapplsBannerNotice, setMapplsBannerNotice] = useState<string | null>(null);
  const [isMapplsDiagOpen, setIsMapplsDiagOpen] = useState(false);

  // TomTom Traffic API Integration State
  const [tomtomStatus, setTomTomStatus] = useState<TomTomStatus | null>(null);
  const [isCheckingTomTom, setIsCheckingTomTom] = useState(false);
  const [tomtomIncidents, setTomTomIncidents] = useState<Incident[]>([]);
  const [isTomTomDiagOpen, setIsTomTomDiagOpen] = useState(false);
  const [selectedFlowData, setSelectedFlowData] = useState<TomTomFlowResponse | null>(null);
  const [isFlowLoading, setIsFlowLoading] = useState(false);
  const [showTomTomLiveIncidents, setShowTomTomLiveIncidents] = useState(true);

  const tomtomStatusRef = useRef<TomTomStatus | null>(tomtomStatus);
  useEffect(() => {
    tomtomStatusRef.current = tomtomStatus;
  }, [tomtomStatus]);

  // Mappls Place Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY as string | undefined;

  const refreshMapplsStatus = useCallback(() => {
    setIsCheckingMappls(true);
    api.getMapplsStatus()
      .then((status) => {
        setMapplsStatus(status);
        // Do not display intrusive automatic popup banner on every load;
        // provider status is accessible cleanly via toolbar button and diagnostics modal.
      })
      .catch((err) => {
        console.warn('[TransportMap] Mappls status inquiry failed:', err);
      })
      .finally(() => {
        setIsCheckingMappls(false);
      });
  }, []);

  const refreshTomTomStatus = useCallback((forceRefresh: boolean = false, regionId: string = selectedRegionId) => {
    setIsCheckingTomTom(true);
    const preset = REGION_PRESETS.find((r) => r.id === regionId) || REGION_PRESETS[0];
    api.getTomTomStatus(forceRefresh)
      .then((status) => {
        setTomTomStatus(status);
        if (status.is_operational) {
          api.getTomTomIncidents(preset.bbox)
            .then((res) => {
              if (res.success && Array.isArray(res.incidents)) {
                setTomTomIncidents(res.incidents);
              } else {
                setTomTomIncidents([]);
              }
            })
            .catch((err) => {
              console.warn('[TransportMap] TomTom incidents query failed:', err);
              setTomTomIncidents([]);
            });
        } else {
          setTomTomIncidents([]);
        }
      })
      .catch((err) => {
        console.warn('[TransportMap] TomTom status query failed:', err);
        setTomTomIncidents([]);
      })
      .finally(() => {
        setIsCheckingTomTom(false);
      });
  }, [selectedRegionId]);

  // Handle switching target geographic corridor (e.g., Chennai, Tamil Nadu)
  const handleSelectRegion = (preset: RegionPreset) => {
    setSelectedRegionId(preset.id);
    setIsRegionMenuOpen(false);
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: preset.center,
        zoom: preset.zoom,
        pitch: 25,
        speed: 1.2,
      });
    }
    refreshTomTomStatus(false, preset.id);
  };

  // Audit provider statuses on mount
  useEffect(() => {
    refreshMapplsStatus();
    refreshTomTomStatus();
  }, [refreshMapplsStatus, refreshTomTomStatus]);

  // Combined Incidents: Local records + Live TomTom telemetry
  const allIncidents = useMemo(() => {
    if (!showTomTomLiveIncidents || !tomtomStatus?.is_operational) {
      return incidents;
    }
    return [...incidents, ...tomtomIncidents];
  }, [incidents, tomtomIncidents, showTomTomLiveIncidents, tomtomStatus]);

  const liveCount = useMemo(() => allIncidents.filter((inc) => !inc.is_simulated).length, [allIncidents]);
  const simCount = useMemo(() => allIncidents.filter((inc) => inc.is_simulated).length, [allIncidents]);

  // Filter incidents according to active severity filter AND provenance filter
  const filteredIncidents = useMemo(() => {
    let list = allIncidents;
    if (provenanceFilter === 'LIVE') {
      list = list.filter((inc) => !inc.is_simulated);
    } else if (provenanceFilter === 'SIMULATED') {
      list = list.filter((inc) => inc.is_simulated);
    }

    if (activeSeverityFilter === 'ALL') return list;
    return list.filter((inc) => inc.severity === activeSeverityFilter);
  }, [allIncidents, activeSeverityFilter, provenanceFilter]);

  // Resolve style based on selected basemap provider
  const getStyleForProvider = useCallback(
    (provider: BasemapProvider): maplibregl.StyleSpecification | string => {
      const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
      switch (provider) {
        case 'mappls':
          // If Mappls operational and REST key available, use vector/raster style;
          // otherwise fallback to Esri Canvas with notice
          return isDark ? ESRI_DARK_STYLE : ESRI_LIGHT_STYLE;
        case 'light-canvas':
          return ESRI_LIGHT_STYLE;
        case 'dark-canvas':
          return ESRI_DARK_STYLE;
        case 'openfreemap':
          return OPENFREEMAP_DARK_URL;
        case 'osm':
          return OSM_STYLE;
        case 'carto':
          return getCartoDarkStyle(cartoApiKey);
        default:
          return isDark ? ESRI_DARK_STYLE : ESRI_LIGHT_STYLE;
      }
    },
    [cartoApiKey]
  );

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current) return;

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

      map.on('click', async (e: any) => {
        if (tomtomStatusRef.current?.is_operational) {
          setIsFlowLoading(true);
          try {
            const flow = await api.getTomTomFlow(e.lngLat.lat, e.lngLat.lng);
            if (flow.success) {
              setSelectedFlowData(flow);
            }
          } catch (err) {
            console.warn('[TransportMap] Flow query on click failed:', err);
          } finally {
            setIsFlowLoading(false);
          }
        }
      });

      map.on('error', (e: any) => {
        console.warn('[TransportMap] Tile or resource warning:', e);
        const msg = e.error?.message || e.message || '';
        if (msg.includes('401') || msg.includes('403') || msg.includes('fetch') || msg.includes('network')) {
          setTileError(
            'Basemap tiles could not load. Incident markers and filters still work on the fallback grid.'
          );
        }
      });

      const handleWindowResize = () => map.resize();
      window.addEventListener('resize', handleWindowResize);

      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      });
      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      mapRef.current = map;

      return () => {
        window.removeEventListener('resize', handleWindowResize);
        resizeObserver.disconnect();
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (searchMarkerRef.current) {
          searchMarkerRef.current.remove();
          searchMarkerRef.current = null;
        }
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      console.error('[TransportMap] Map initialization error:', err);
      setTileError('WebGL map canvas unavailable. Coordinate telemetry and incident records active.');
    }
  }, [basemap, getStyleForProvider]);

  // Synchronize incident markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded() && !isStyleLoaded) {
      return;
    }

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    filteredIncidents.forEach((incident) => {
      const isSelected = selectedIncident?.id === incident.id;

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
      const isLive = !incident.is_simulated;

      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="w-7 h-7 rounded-full ${cfg.bg} ${cfg.border} ${cfg.glow} ${cfg.text} flex items-center justify-center font-bold text-[10px] shadow-lg transition-transform hover:scale-125 ${
            isSelected ? 'scale-125 ring-8 ring-sky-400' : ''
          }">
            ${isLive ? '⚡' : '!'}
          </div>
          ${isLive ? '<span class="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>' : ''}
          <div class="absolute -top-7 hidden group-hover:flex items-center rounded bg-slate-900/95 text-white text-[10px] px-2 py-0.5 border border-slate-700 whitespace-nowrap shadow-md pointer-events-none z-30">
            ${isLive ? '[LIVE] ' : '[SIM] '}${incident.location_name}
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
      const preset = REGION_PRESETS.find((r) => r.id === selectedRegionId) || REGION_PRESETS[0];
      mapRef.current.flyTo({
        center: preset.center,
        zoom: preset.zoom,
        pitch: 25,
        speed: 1.2,
      });
    }
  };

  // Mappls Geocode search handler
  const handleMapplsSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setIsSearching(true);
    setSearchError(null);
    setShowSearchResults(true);

    try {
      const res = await api.geocodeMappls(searchQuery);
      if (res.success && res.results && res.results.length > 0) {
        setSearchResults(res.results);
      } else {
        setSearchResults([]);
        if (res.http_status_code === 401 || !res.success) {
          setSearchError(
            res.error ||
              'Mappls Geocoding returned HTTP 401 (Bad client credentials). Server credentials must be authorized with Mappls.'
          );
        } else {
          setSearchError('No matching places found.');
        }
      }
    } catch (err: any) {
      setSearchError(err.message || 'Mappls search failed.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: any) => {
    if (!mapRef.current) return;
    const { longitude, latitude, formatted_address } = result;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
    }

    const el = document.createElement('div');
    el.className = 'flex items-center justify-center';
    el.innerHTML = `
      <div class="h-6 w-6 rounded-full bg-sky-500 border-2 border-white text-white flex items-center justify-center shadow-lg animate-bounce">
        📍
      </div>
    `;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([longitude, latitude])
      .addTo(mapRef.current);
    searchMarkerRef.current = marker;

    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 13.5,
      speed: 1.2,
    });

    setShowSearchResults(false);
  };

  const basemapOptions: { id: BasemapProvider; label: string; badge: string; isKeyless: boolean }[] = [
    {
      id: 'light-canvas',
      label: 'Light Gray Canvas',
      badge: 'Keyless (Professional)',
      isKeyless: true,
    },
    {
      id: 'dark-canvas',
      label: 'Dark Gray Canvas',
      badge: 'Keyless Dark',
      isKeyless: true,
    },
    {
      id: 'mappls',
      label: 'Mappls Enterprise Map',
      badge: isCheckingMappls
        ? 'Checking...'
        : mapplsStatus?.is_operational
        ? 'Authenticated · India Vector'
        : mapplsStatus?.status === 'AUTH_FAILED'
        ? 'Invalid Credentials · Esri Fallback'
        : mapplsStatus?.status === 'NOT_CONFIGURED'
        ? 'Not Configured · Esri Fallback'
        : 'Esri Fallback Active',
      isKeyless: false,
    },
    {
      id: 'openfreemap',
      label: 'OpenFreeMap Dark',
      badge: 'Keyless Vector',
      isKeyless: true,
    },
    {
      id: 'osm',
      label: 'OpenStreetMap Standard',
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
    <div className="relative w-full h-[580px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#060a12] overflow-hidden shadow-xs dark:shadow-2xl transition-colors">
      {/* Top Map Action Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left Toolbar Items */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Target Region Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsRegionMenuOpen(!isRegionMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs dark:shadow-lg"
              title="Switch Target Traffic Corridor"
            >
              <Compass className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span className="font-semibold text-slate-900 dark:text-white">
                {REGION_PRESETS.find((r) => r.id === selectedRegionId)?.shortLabel || 'Corridor'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
            </button>

            {isRegionMenuOpen && (
              <div className="absolute left-0 mt-1 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] backdrop-blur-md p-1.5 shadow-xl z-30 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Target Traffic Corridors:
                </div>
                {REGION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectRegion(preset)}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      selectedRegionId === preset.id
                        ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-500/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{preset.label}</span>
                    {selectedRegionId === preset.id && <Check className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Provenance Filter Pills */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md p-1 shadow-xs dark:shadow-lg">
            <button
              type="button"
              onClick={() => setProvenanceFilter('ALL')}
              className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide transition-all ${
                provenanceFilter === 'ALL'
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({allIncidents.length})
            </button>
            <button
              type="button"
              onClick={() => setProvenanceFilter('LIVE')}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold tracking-wide transition-all ${
                provenanceFilter === 'LIVE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live ({liveCount})
            </button>
            <button
              type="button"
              onClick={() => setProvenanceFilter('SIMULATED')}
              className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide transition-all ${
                provenanceFilter === 'SIMULATED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
              }`}
            >
              Sim ({simCount})
            </button>
          </div>

          {/* Severity filter pills */}
          <div className="hidden lg:flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md p-1 shadow-xs dark:shadow-lg">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setActiveSeverityFilter(sev)}
                className={`rounded-md px-2 py-1 text-xs font-semibold tracking-wide transition-all ${
                  activeSeverityFilter === sev
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          {/* Basemap Switcher Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsBasemapMenuOpen(!isBasemapMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs dark:shadow-lg"
            >
              <MapIcon className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              <span>
                {basemapOptions.find((b) => b.id === basemap)?.label || 'Light Gray Canvas'}
              </span>
              <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
            </button>

            {isBasemapMenuOpen && (
              <div className="absolute left-0 mt-1 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] backdrop-blur-md p-1.5 shadow-xl z-30 space-y-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-slate-400 tracking-wider">
                  Select Basemap Provider:
                </div>
                {basemapOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setBasemap(opt.id);
                      setIsBasemapMenuOpen(false);
                      if (opt.id === 'mappls' && !mapplsStatus?.is_operational) {
                        setMapplsBannerNotice(
                          'Mappls Map: Credentials returned HTTP 401. Running securely on Esri Canvas fallback.'
                        );
                      }
                    }}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors ${
                      basemap === opt.id
                        ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold border border-sky-200 dark:border-sky-500/30'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="text-left">
                      <p className="leading-none">{opt.label}</p>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 inline-block">
                        {opt.badge}
                      </span>
                    </div>
                    {basemap === opt.id && <Check className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Layer Toggles */}
          <div className="hidden sm:flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md p-1 shadow-xs dark:shadow-lg">
            <button
              type="button"
              onClick={() => setShowCongestionLayer(!showCongestionLayer)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                showCongestionLayer
                  ? 'bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Congestion Heat</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCorridorLayer(!showCorridorLayer)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                showCorridorLayer
                  ? 'bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Corridors</span>
            </button>
          </div>

          {/* Recenter Button */}
          <button
            type="button"
            onClick={handleRecenter}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs dark:shadow-lg"
            title="Recenter Map View"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* TomTom Live Traffic Diagnostics & Status Trigger */}
          <button
            type="button"
            onClick={() => setIsTomTomDiagOpen(true)}
            className={`flex items-center gap-1.5 rounded-lg border backdrop-blur-md px-2.5 py-1 text-xs font-medium transition-colors shadow-xs ${
              tomtomStatus?.is_operational
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="View TomTom Traffic Flow & Incidents Status"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                tomtomStatus?.is_operational
                  ? 'bg-emerald-500 animate-pulse'
                  : tomtomStatus?.status === 'AUTH_FAILED'
                  ? 'bg-rose-500'
                  : tomtomStatus?.status === 'NOT_CONFIGURED'
                  ? 'bg-amber-400'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-mono text-[11px] hidden sm:inline">
              {isCheckingTomTom
                ? 'TomTom: Checking'
                : tomtomStatus?.is_operational
                ? `TomTom Live (${tomtomIncidents.length})`
                : tomtomStatus?.status === 'AUTH_FAILED'
                ? 'TomTom: 401 (Fallback)'
                : tomtomStatus?.status === 'NOT_CONFIGURED'
                ? 'TomTom: Standby'
                : 'TomTom: Fallback'}
            </span>
            <Info className="h-3 w-3 text-slate-400" />
          </button>

          {/* Mappls Provider Diagnostics Trigger (Legacy) */}
          <button
            type="button"
            onClick={() => setIsMapplsDiagOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shadow-xs"
            title="View Mappls Authentication Diagnostics"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                mapplsStatus?.is_operational
                  ? 'bg-emerald-500'
                  : mapplsStatus?.status === 'AUTH_FAILED'
                  ? 'bg-amber-500'
                  : 'bg-slate-400'
              }`}
            />
            <span className="font-mono text-[10px] hidden md:inline">
              Mappls
            </span>
          </button>
        </div>

        {/* Right Toolbar: Mappls Geocode / Search Input */}
        <div className="relative pointer-events-auto">
          <form onSubmit={handleMapplsSearch} className="flex items-center">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mappls place / address search..."
                className="w-48 sm:w-64 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md py-1.5 pl-8 pr-7 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 shadow-xs dark:shadow-lg focus:border-sky-500"
              />
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="ml-1 rounded-lg border border-sky-300 dark:border-sky-500/40 bg-sky-50 dark:bg-sky-950/60 px-2 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 shadow-xs"
              title="Search via Mappls Geocoding"
            >
              {isSearching ? '...' : 'Find'}
            </button>
          </form>

          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div className="absolute right-0 mt-1 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b1120] backdrop-blur-md p-2 shadow-2xl z-30 max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span>Mappls Geocode Results:</span>
                <button
                  type="button"
                  onClick={() => setShowSearchResults(false)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Close
                </button>
              </div>

              {searchError ? (
                <div className="p-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 rounded-lg flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] leading-relaxed">{searchError}</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-2 text-xs text-slate-400 text-center">No locations returned.</div>
              ) : (
                <div className="space-y-1">
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSearchResult(item)}
                      className="w-full text-left p-2 rounded-lg text-xs hover:bg-slate-800/60 text-slate-200 transition-colors"
                    >
                      <p className="font-semibold text-white truncate">{item.formatted_address}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                        {item.city ? ` • ${item.city}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Primary MapLibre GL Map Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Mappls Banner Notice if credentials rejected or fallback active */}
      {mapplsBannerNotice && (
        <div className="absolute top-16 left-4 z-10 max-w-lg rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5 shadow-xl transition-colors">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-slate-900 dark:text-white">Mappls Provider Status:</span>
            <p className="mt-0.5 text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
              {mapplsBannerNotice}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-700 dark:text-slate-300">
                Fallback: Esri Canvas
              </span>
              <button
                type="button"
                onClick={() => setMapplsBannerNotice(null)}
                className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline"
              >
                Dismiss notice
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMapplsBannerNotice(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
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
                type="button"
                onClick={() => setBasemap('dark-canvas')}
                className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-white hover:bg-slate-700"
              >
                Switch to Dark Canvas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legal Attribution Bar */}
      <div className="absolute bottom-1 left-2 z-10 text-[10px] font-mono text-slate-400 bg-slate-950/70 px-2 py-0.5 rounded backdrop-blur-sm pointer-events-none">
        © MapmyIndia / Mappls • © Esri, HERE, Garmin • © OpenStreetMap contributors
      </div>

      {/* Coordinates readout bar in footer */}
      {cursorCoords && (
        <div className="absolute bottom-4 right-16 z-10 hidden sm:flex items-center gap-2 rounded-md border border-slate-800 bg-[#080d1a]/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-mono text-slate-400">
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

      {/* Mappls Geospatial Provider Diagnostics Modal */}
      {isMapplsDiagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase">
                  Mappls Geospatial Provider Diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMapplsDiagOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">OAuth Authentication Status:</span>
                <span
                  className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                    mapplsStatus?.is_operational
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : mapplsStatus?.status === 'AUTH_FAILED'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isCheckingMappls
                    ? 'Checking'
                    : mapplsStatus?.status === 'AUTH_FAILED'
                    ? 'Invalid credentials (HTTP 401)'
                    : mapplsStatus?.status || 'Not configured'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Active Map Rendering Layer:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {mapplsStatus?.is_operational ? 'Mappls Vector Map' : 'Esri World Gray Canvas (Keyless Public)'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Client ID Status:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-slate-400" />
                  {mapplsStatus?.masked_client_id || 'Configured (masked)'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed space-y-1">
                <p className="font-semibold">Diagnostic Summary:</p>
                <p>
                  {mapplsStatus?.diagnostic_message ||
                    'Mappls authentication endpoint returned HTTP 401 (Bad client credentials). The system automatically falls back to Esri Canvas.'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">How to Obtain Valid Credentials:</p>
                <p>
                  1. Register an account at <a href="https://www.mappls.com/api/" target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 underline">mappls.com/api</a>
                </p>
                <p>2. Create a project and obtain an authorized OAuth 2.0 Client ID and Client Secret.</p>
                <p>3. Add <code className="font-mono text-slate-700 dark:text-slate-300">MAPPLS_CLIENT_ID</code> and <code className="font-mono text-slate-700 dark:text-slate-300">MAPPLS_CLIENT_SECRET</code> to your <code className="font-mono">.env.local</code>.</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={refreshMapplsStatus}
                disabled={isCheckingMappls}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingMappls ? 'animate-spin' : ''}`} />
                <span>Re-check Mappls Auth</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMapplsDiagOpen(false)}
                className="rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating TomTom Flow Segment Telemetry Overlay */}
      {(selectedFlowData || isFlowLoading) && (
        <div className="absolute bottom-16 left-4 z-20 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-md p-3.5 shadow-xl text-xs space-y-2 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 font-semibold font-mono text-[11px] uppercase">
              <Activity className={`h-3.5 w-3.5 ${isFlowLoading ? 'animate-spin' : ''}`} />
              <span>TomTom Live Road Flow</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedFlowData(null);
                setIsFlowLoading(false);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {isFlowLoading ? (
            <div className="py-4 text-center text-slate-500 font-mono text-[11px] flex items-center justify-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Querying TomTom Traffic Flow...</span>
            </div>
          ) : selectedFlowData ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Current Speed</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                    {selectedFlowData.current_speed_kmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Free Flow Speed</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-base">
                    {selectedFlowData.free_flow_speed_kmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-500 dark:text-slate-400">Congestion Delay:</span>
                <span className={`font-mono font-semibold ${
                  (selectedFlowData.congestion_pct || 0) > 50 ? 'text-rose-500' : 'text-emerald-500'
                }`}>
                  {selectedFlowData.congestion_pct}% Saturation
                </span>
              </div>

              <div className="text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-100 dark:border-slate-800 flex justify-between">
                <span>Class: {selectedFlowData.functional_road_class || 'FRC'}</span>
                <span>{selectedFlowData.attribution || '© TomTom'}</span>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* TomTom Geospatial Provider Diagnostics Modal */}
      {isTomTomDiagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322] p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase">
                  TomTom Traffic API Diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTomTomDiagOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Provider Status:</span>
                <span
                  className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                    tomtomStatus?.is_operational
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : tomtomStatus?.status === 'AUTH_FAILED'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : tomtomStatus?.status === 'RATE_LIMITED'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {isCheckingTomTom
                    ? 'Checking...'
                    : tomtomStatus?.status === 'OPERATIONAL'
                    ? 'Verified Operational'
                    : tomtomStatus?.status === 'AUTH_FAILED'
                    ? 'Unauthorized (HTTP 401)'
                    : tomtomStatus?.status === 'NOT_CONFIGURED'
                    ? 'Not Configured (Standby)'
                    : tomtomStatus?.status || 'Standby'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Traffic Products:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {tomtomStatus?.is_operational
                    ? 'Traffic Flow v4 + Incident Details v5'
                    : 'Awaiting verified key'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">API Key Mask:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-slate-400" />
                  {tomtomStatus?.masked_key || 'not_configured'}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 dark:text-slate-400">Basemap Fallback:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  Esri / OpenStreetMap (100% Autonomous)
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">TomTom Traffic Integration Guide:</p>
                <p>1. Register a developer account at <a href="https://developer.tomtom.com" target="_blank" rel="noreferrer" className="text-sky-600 dark:text-sky-400 underline">developer.tomtom.com</a>.</p>
                <p>2. Create an application with access to <strong>Traffic API</strong> (Traffic Flow & Incidents).</p>
                <p>3. Set <code className="font-mono text-slate-700 dark:text-slate-300">TOMTOM_API_KEY</code> in <code className="font-mono">backend/.env</code> (kept private and git-ignored).</p>
              </div>

              {tomtomStatus?.error && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                  <span className="font-semibold block mb-0.5">Notice:</span>
                  {tomtomStatus.error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => refreshTomTomStatus(true)}
                disabled={isCheckingTomTom}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${isCheckingTomTom ? 'animate-spin' : ''}`} />
                <span>Re-probe TomTom Traffic</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTomTomDiagOpen(false)}
                className="rounded-lg bg-slate-900 dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

# Intelligent Transport AI — Production-Oriented Command Center

[![CI Pipeline](https://github.com/Shameer28tm/intelligent-transport-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Shameer28tm/intelligent-transport-ai/actions)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL_JS-3.6+-3969EC.svg?logo=maplibre)](https://maplibre.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)

A road-safety command center focused on **Tamil Nadu**. In 2024, Tamil Nadu recorded the most road accidents in India (67,526) and the second-most deaths (18,449), plus the most deaths of riders not wearing helmets (7,744) ([MoRTH data via The News Minute](https://www.thenewsminute.com/news/tamil-nadu-had-highest-accidents-and-helmet-related-deaths-in-2024-says-govt-data)). The platform combines camera-based detection and tracking, rider-safety checks, trajectory risk estimates, crash-hotspot analytics and golden-hour emergency support.

---

## 🛡️ Tamil Nadu Road Safety

| Module | What it does | What it is not |
| :--- | :--- | :--- |
| **TN Road Safety** (`/api/safety/summary`, `/hotspots`, `/context`) | Clusters stored crash incidents into hotspots (500 m, haversine) and flags clusters that meet the MoRTH-style black-corridor rule (5 serious crashes within 500 m in 3 years). Shows district, severity and IST time-of-day breakdowns, plus cited statewide figures. | Not official crash data: the seeded incidents are **simulated demo data**. District assignment uses the nearest HQ city, not official boundaries. |
| **Emergency Response** (`/api/safety/facilities`) | For an active crash, shows the golden-hour clock, the 5 nearest government medical college hospitals (straight-line distance), one-tap 108/112 calls and Google Maps road directions. Explains the IK:NK-48 cashless trauma scheme with its source. | Hospital locations are city-level approximations to verify; this is not a dispatch system. |
| **Rider Safety** (live camera) | Flags **triple riding** (3+ person boxes on one tracked motorcycle for 3+ frames) and **wrong-side driving** (sustained motion against the permitted direction configured per camera). Each flag carries evidence and a "Pause at" seek. | **Helmet use is not checked:** the bundled COCO model has no helmet class. Flags are candidates for human review, not offence records. |
| **Traffic Premonition** | Now also covers **vehicle–pedestrian** conflicts. Riders on two-wheelers are excluded so they aren't counted as pedestrians. | Image-plane estimate, not a collision prediction. |

The map defaults to a statewide Tamil Nadu view, with presets for Chennai, Coimbatore, Madurai, Trichy and NH-45 Vikravandi. Live TomTom incidents load only for city or corridor presets, because TomTom limits the query area.

**Refresh demo data on an existing database.** This deletes only `is_simulated=True` rows; real records are never touched:
```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed --replace-demo
```

---

## 🏛️ System Architecture

The platform is organized as a clean, maintainable monorepo:

```
intelligent-transport-ai/
├── .github/
│   └── workflows/
│       └── ci.yml                     # Continuous integration for backend and frontend
├── backend/
│   ├── app/
│   │   ├── api/                       # REST API routers (health, incidents, statistics, vision)
│   │   ├── models/                    # SQLAlchemy models (Incident, Category, Severity, Status)
│   │   ├── repositories/              # Repository design pattern for data access
│   │   ├── schemas/                   # Pydantic validation & response schemas
│   │   ├── services/                  # Business logic & statistics services
│   │   │   └── vision/                # Extensible Computer Vision Layer
│   │   │       ├── base.py            # Abstract BaseVisionService interface
│   │   │       ├── simulator.py       # Deterministic demo simulator adapter
│   │   │       └── real_adapter.py    # Production neural vision adapter (PyTorch/YOLO hook)
│   │   ├── config.py                  # Pydantic BaseSettings configuration (deterministic .env.local precedence)
│   │   ├── database.py                # Database engine & session maker (Neon Postgres + SQLite compatible)
│   │   ├── seed.py                    # Seeder for realistic urban transport incidents
│   │   └── main.py                    # FastAPI application entrypoint with CORS & lifespan
│   ├── alembic/                       # Alembic migrations (PostgreSQL production schema)
│   ├── tests/                         # Pytest test suite (67 automated tests)
│   ├── requirements.txt               # Backend dependencies
│   ├── pytest.ini                     # Pytest configuration
│   └── .env.example                   # Backend environment variables template
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/                # Header, Sidebar, StatCard, StatusBadge, Modal
│   │   │   ├── incidents/             # IncidentFeed, IncidentFormModal, IncidentFilters
│   │   │   ├── map/                   # TransportMap (MapLibre GL JS), IncidentDetailPanel, MapLegend
│   │   │   └── vision/                # VisionUploadModal with bounding box overlay & telemetry
│   │   ├── pages/                     # 8 dedicated operational modules
│   │   │   ├── OverviewPage.tsx       # Primary Command Center
│   │   │   ├── RoadSafetyPage.tsx     # Vision Zero blackspots & collision factors
│   │   │   ├── TrafficManagementPage.tsx # Corridor speeds, Level of Service (LOS), signals
│   │   │   ├── IncidentExplorerPage.tsx  # Searchable audit table, CSV & JSON export
│   │   │   ├── TransportPlanningPage.tsx # Regional Origin-Destination flows & capacity
│   │   │   ├── SustainableMobilityPage.tsx # EV charging telemetry & CO2 offset
│   │   │   ├── AccessibilityPage.tsx  # 15-minute city radius & ADA compliance
│   │   │   └── SettingsPage.tsx       # Runtime diagnostics & hardware telemetry
│   │   ├── services/api.ts            # Typed API client with fallback resilience
│   │   ├── types/index.ts             # TypeScript definitions
│   │   ├── App.tsx                    # Root application component
│   │   ├── index.css                  # Enterprise dark navy theme & custom design tokens
│   │   └── main.tsx                   # React root mount
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── .gitignore
├── .env.example
└── README.md
```

---

## 🚀 Prerequisites

- **Python**: 3.10+ (Tested on Python 3.11)
- **Node.js**: 18+ (Tested on Node.js v24.12.0 with npm 11.10.0)
- **Git**: Installed
- **Operating System**: Windows / Linux / macOS (Commands below assume Windows PowerShell)

---

## ⚡ Quick Start (Windows PowerShell)

### 1. Clone & Setup Backend

```powershell
# Clone the repository
git clone https://github.com/Shameer28tm/intelligent-transport-ai.git
cd intelligent-transport-ai

# Create Python virtual environment inside backend
python -m venv backend\.venv

# Install backend dependencies
.\backend\.venv\Scripts\pip.exe install -r backend\requirements.txt

# (Optional) Verify or download genuine pretrained YOLOv8n ONNX weights & demo assets (~12.85 MB, Ultralytics AGPL-3.0)
.\backend\.venv\Scripts\python.exe backend/app/services/vision/setup_assets.py

# Run database migrations (applies schema up to head on configured database; defaults to local SQLite)
cd backend
.\.venv\Scripts\alembic.exe upgrade head
cd ..

# Run backend automated test suite (67 tests)
cd backend
.\.venv\Scripts\pytest.exe tests -v
cd ..

# Start the FastAPI backend server (Runs on port 8000)
.\backend\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 2. Setup & Run Frontend

In a second PowerShell terminal:

```powershell
cd intelligent-transport-ai/frontend

# Install node dependencies
npm install

# Run TypeScript type check (0 errors)
npm run typecheck

# Build production bundle
npm run build

# Start Vite dev server (Runs on port 5173)
npm run dev
```

---

## 🌐 Local URLs

| Component | URL | Description |
| :--- | :--- | :--- |
| **Frontend Command Center** | [http://127.0.0.1:5173](http://127.0.0.1:5173) | Interactive operations dashboard with MapLibre GL map |
| **Backend REST API** | [http://127.0.0.1:8000](http://127.0.0.1:8000) | Root endpoint with service status |
| **Interactive API Documentation** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Swagger UI for interactive API exploration |
| **OpenAPI Specification** | [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json) | Full OpenAPI 3.1 JSON schema |
| **API Health Check** | [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) | System health, database ping, hardware detection |

---

## 🧪 Testing & Verification

### Backend Tests
Execute all automated tests via pytest:
```powershell
cd backend
.\.venv\Scripts\pytest.exe tests -v
```
**Test Results: 67 Passed, 0 Failed, 0 Skipped (100% Pass Rate)**
- `test_root_endpoint`: Verifies API root metadata and provenance flag.
- `test_health_endpoint`: Verifies database latency, health status, bounded timeout handling (`test_health_degraded_when_database_unreachable`), and dynamic hardware detection.
- `test_database_migration`: Tests URL normalization, dialect isolation, and Alembic migrations.
- `test_postgres_connectivity`: Validates real PostgreSQL connectivity, `SELECT 1`, and isolated CRUD lifecycle.
- `test_session_persistence_idempotency`: Validates repeat requests idempotency, multi-thread concurrency safety, and history deduplication.
- `test_incidents`: Tests incident listing, severity/category filtering, spatial bounding box queries, detail retrieval, and status updates.
- `test_statistics`: Validates KPI aggregations and hourly trend histograms.
- `test_mappls`: Verifies status, geocode, and routing endpoints with OAuth error handling.
- `test_vision`: Tests format validation, demo simulator, genuine neural vision inference, and regression tests (`test_video_analysis_fails_gracefully_when_ffmpeg_missing`, `test_video_analysis_fails_gracefully_when_ffprobe_missing`) ensuring 503 errors and zero fabricated records on missing decoders.
- `test_vision_p3`: Tests IoU box calculation, multi-object IoU tracker association, cordon crossing events, ground truth evaluation, and live frame streaming.
- `test_risk_estimator`: Validates constant-velocity trajectory projections, conflict reason codes, boundary approach handling, backward seek interruption, tracker integration, and end-to-end premonition payload delivery.

### Frontend Verification
```powershell
cd frontend
npm run typecheck    # TypeScript compiler check (0 errors)
npm run build        # Vite production compilation (0 errors)
```

---

## 🗺️ Mapping & Resilience

- **Engine**: MapLibre GL JS
- **Tile Configuration**: Uses free, public OpenStreetMap / CARTO Dark Matter raster tiles. No API keys or map secrets are required or committed in frontend code.
- **Offline / Disconnected Resilience**: If external tile servers or internet connectivity are unavailable, the map component gracefully falls back to an internal cartographic grid mode displaying coordinate axes, spatial markers, zoom controls, and incident selection without throwing unhandled exceptions.
- **Interactive Controls**:
  - Marker pins color-coded by severity (Critical: Red with radar pulse, High: Orange, Medium: Amber, Low: Emerald).
  - Synchronized **Incident Detail Panel** displaying corridor speeds, speed limits, congestion percentages, affected lanes, and one-click dispatch status progression.
  - Quick severity filters (`ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
  - Layer toggles for congestion heat and corridor lines.

---

## 🤖 Extensible Computer Vision Architecture

The road-safety vision subsystem is built around the `BaseVisionService` abstract interface:

```python
class BaseVisionService(ABC):
    @property
    @abstractmethod
    def adapter_name(self) -> str: ...
    @property
    @abstractmethod
    def is_simulated(self) -> bool: ...
    @abstractmethod
    def is_available(self) -> bool: ...
    @abstractmethod
    async def analyze_media(self, file_bytes: bytes, filename: str, content_type: str) -> VisionAnalysisResult: ...
```

### P2 Release: Genuine YOLOv8n ONNX Vision Workspace
- **Pretrained YOLOv8n ONNX Engine**: Model inference executes locally via ONNX Runtime (`CPUExecutionProvider`) with intra-op multi-threading.
- **Interactive Video Timeline & Scrubber**: Native video player controls allowing transport engineers to seek to any second of video footage and pause.
- **Selected-Frame Capture**: Browser-native HTML5 Canvas frame snapshotting at exact millisecond timestamps.
- **Frame-Level Neural Inference Endpoint (`POST /api/vision/analyze-frame`)**: Dedicated endpoint analyzing selected frames with YOLOv8n, returning bounding box coordinates (`ymin, xmin, ymax, xmax`), COCO class labels, and confidence metrics.
- **Structured Detection Inspector**: Interactive table displaying detected objects, bounding boxes, confidence values, and road hazard classifications.
- **Persistent SQLite Audit History**: All analyzed videos and frames are saved with timestamps, object counts, execution provider metadata, and inspection links.

### P3 Release: Traffic Intelligence, Live Playback Detection & Sequential Tracking
- **Playback-Synchronized Live Video Detection**: Users upload prerecorded traffic video, press **Start Live Detection**, and see genuine local YOLOv8n ONNX inference overlays moving synchronously with the real `<video>` player.
- **Single-Flight Backpressure & Zero Lag**: Enforces at most one active frame inference request per playback session. If inference latency exceeds the frame interval, subsequent frames are skipped rather than queued, guaranteeing zero accumulated lag.
- **Timestamp & Seek Invalidation**: Maintains seek sequence numbers (`seekSeq`); seeking through the video immediately clears old bounding boxes and discards in-flight requests from earlier timestamps.
- **Letterbox-Aware Canvas Overlay**: Computes dynamic coordinate mapping between intrinsic video resolution and rendered canvas dimensions, handling aspect ratios and letterboxing without stretching.
- **Multi-Object Vehicle Tracker (IoU Tracker)**: Associates bounding boxes across consecutive frames using hybrid IoU and centroid proximity matching. Assigns persistent, session-scoped `track_id`s across live frames without persisting unneeded single-frame DB rows.
- **Live Session Persistence**: Supports on-demand consolidated session summary persistence (`POST /api/vision/live-session/summary`) to store traffic volume, tracked vehicles, and breakdown into SQLite history.
- **Virtual Cordon Line & Roadway Events**: Tracks vehicles as they cross a configurable horizontal cordon line (e.g., $y = 0.60$), emitting timestamped directional events (`CORDON_CROSSING`, `SOUTHBOUND` / `NORTHBOUND`).
- **Time-Bucketed Traffic Volume Trends**: Aggregates vehicle and pedestrian detections into configurable time windows (e.g. 1s, 2s, 5s), calculating active unique vehicles, frame detection sums, and corridor congestion levels.
- **Defensible Metric Differentiation**: Strictly distinguishes `total_frame_detections` (cumulative sum across frames) from `unique_vehicles_tracked` (deduped identities via IoU tracking).
- **Ground-Truth Evaluation Engine (`POST /api/vision/evaluate`)**: Implements bipartite greedy IoU matching against annotated ground-truth datasets. Computes Precision, Recall, F1 score, True Positives, False Positives, Missed Detections (FN), and Mean IoU both overall and class-by-class.
- **Coherent Navigation Architecture**:
  - **Primary Operations**: Overview, Live Map (MapLibre + Esri fallback), Traffic Intelligence (full 6-subsection workspace), Incidents Explorer, and Settings & Health.
  - **Traffic Intelligence Subsections**:
    1. *Live Playback Detection*: Playback-synchronized live YOLOv8n ONNX overlay, live latency and effective FPS telemetry, cordon line, and seek controls.
    2. *Full Video Analysis*: Offline sequential frame sampling, peak representative frame, and persistent DB storage.
    3. *Traffic Analytics*: Volume trend charts (SVG time buckets) and interval analysis tables.
    4. *Vehicle Tracking & Events*: Multi-object IoU trajectory tracking and virtual cordon event stream.
    5. *Model Evaluation*: IoU benchmark evaluation against ground-truth datasets.
    6. *Analysis History*: Persistent SQLite history inspection and replay.

---

## 🔮 Traffic Premonition (Trajectory Risk Estimate — Prototype)

Live Playback Detection now estimates potential vehicle conflicts from the **existing tracker output** (same YOLOv8n detections and track IDs; no second inference pass).

- **Engine:** `backend/app/services/vision/risk_estimator.py`. It is deterministic and pure Python, with a constant-velocity least-squares fit over a rolling window of at most 12 observations within 2.5 s. It projects 1.5 s ahead and computes the closest projected separation and the time to closest approach for nearby vehicle pairs.
- **States:** `MONITORING`, `NO_CONFLICT_DETECTED`, `POTENTIAL_CONFLICT`, `INSUFFICIENT_EVIDENCE`. The engine needs at least 4 observations spanning 0.5 s, plus consistent motion, before it projects anything.
- **Explainability:** every estimate carries reason codes, measurements and per-track data quality. The UI's **"Why this warning?"** shows the observed path (solid) and the projected path (dashed), the measurements against their thresholds, the timestamp (with a "Pause at" seek), and the limitations.
- **Lifecycle:** one event per vehicle pair while the interaction lasts. A backwards seek clears trajectories and marks open events `INTERRUPTED`, and Reset Session clears everything. Saved live sessions keep estimates under `tracking_summary.risk_events`, labelled as predictions. Nothing is written to incident history.
- **Fallback:** untick **Show trajectory overlay** to return to the original detection view. Detection, tracking, Save and History are unchanged.

**Limitations (also shown in the UI):** this is an image-plane estimate. Distances are in *fh* (fraction of frame height), not metres, and times are video seconds under a straight-line projection, not a calibrated time-to-collision. Perspective, turning, braking, occlusion and tracker ID switches are not modelled. This is not a probability or a guarantee of a collision, and it has not been validated against labelled real-world conflicts.

Tests: `backend/tests/test_risk_estimator.py` (synthetic trajectories only).

---

## 🗺️ Mappls (MapmyIndia) Geospatial Integration

- **Secure Backend Proxy Architecture**: Client credentials (`MAPPLS_CLIENT_ID`, `MAPPLS_CLIENT_SECRET`) reside exclusively on the FastAPI backend. No server secrets are ever exposed in frontend client bundles, network responses, or git commits.
- **Server-Side OAuth2 Token Management**: Automatic token acquisition and caching against Mappls Outpost OAuth2 server (`https://outpost.mappls.com/api/security/oauth/token`).
- **Integrated API Endpoints**:
  - `GET /api/mappls/status`: Diagnostic endpoint reporting client ID (masked, e.g. `9336...ddd8`), token validity, and API reachability.
  - `GET /api/mappls/geocode`: Forward geocoding and address search proxy.
  - `POST /api/mappls/route`: Driving route and corridor calculation proxy.
- **Graceful Resilient Fallback**: If Mappls credentials are invalid (e.g. `HTTP 401 Bad client credentials`) or quota is exhausted, the application displays an honest diagnostic notice and automatically falls back to keyless Esri Dark Canvas raster tiles, keeping all incident overlays, telemetry, and spatial filters 100% operational.

---

## 📊 Provenance & Data Integrity

In accordance with strict operational integrity:
> **Notice**: Demonstration incidents and simulator outputs are explicitly tagged as `SIMULATED DEMO DATA`. Genuine YOLOv8n ONNX inference is explicitly tagged as `REAL LOCAL INFERENCE (CPUExecutionProvider)`. Live municipal feeds or external production services are not fabricated.

---

## 📝 Environment Variables

Sample configuration is provided in `.env.example`:

```env
# Backend
BACKEND_HOST=127.0.0.1
BACKEND_PORT=8000
DATABASE_URL=sqlite:///./transport.db
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
MAX_UPLOAD_SIZE_BYTES=20971520
VISION_ADAPTER=simulator

# Mappls (MapmyIndia) Geospatial Integration (Server-Side Only)
MAPPLS_CLIENT_ID=your_mappls_client_id_here
MAPPLS_CLIENT_SECRET=your_mappls_client_secret_here
MAPPLS_REST_KEY=

# Frontend
VITE_API_BASE_URL=http://localhost:8000/api
VITE_MAP_DEFAULT_LAT=37.7749
VITE_MAP_DEFAULT_LNG=-122.4194
VITE_MAP_DEFAULT_ZOOM=12
VITE_DATA_PROVENANCE="SIMULATED DEMO DATA"
```

---

## 🔒 Security & Credentials

- Server-side secrets are isolated in git-ignored `.env` files.
- Masked diagnostics only display safe substrings (first 4 and last 4 characters).
- File uploads are validated in memory with strict size limits to prevent Denial of Service.
- All database operations utilize parameterized SQLAlchemy queries preventing SQL injection.

---

## 📄 License

Apache License 2.0. Built for urban transport intelligence and road safety research.



# Intelligent Transport AI — Production-Oriented Command Center

[![CI Pipeline](https://github.com/Shameer28tm/intelligent-transport-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/Shameer28tm/intelligent-transport-ai/actions)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)](https://react.dev)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL_JS-3.6+-3969EC.svg?logo=maplibre)](https://maplibre.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com)

A competition-ready, extensible intelligent transport and road safety command center inspired by professional urban mobility analytics platforms (Aimsun, PTV Visum, Iteris, Siemens Mobility). The system combines an enterprise operational dashboard, geographic traffic visualization, road incident lifecycle management, corridor performance analytics, and an extensible road-safety computer vision integration layer.

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
│   │   ├── config.py                  # Pydantic BaseSettings configuration
│   │   ├── database.py                # Database engine & session maker (Postgres-ready)
│   │   ├── seed.py                    # Seeder for realistic urban transport incidents
│   │   └── main.py                    # FastAPI application entrypoint with CORS & lifespan
│   ├── tests/                         # Pytest test suite (17 automated tests)
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
# Open terminal inside the workspace root
cd c:\Users\shameer\OneDrive\Documents\intelligent-transport-ai

# Create Python virtual environment inside backend
python -m venv backend\.venv

# Install backend dependencies
.\backend\.venv\Scripts\pip.exe install -r backend\requirements.txt

# Run backend automated test suite (17 tests)
.\backend\.venv\Scripts\pytest.exe backend -v

# Initialize database and seed simulated demo incidents
.\backend\.venv\Scripts\python.exe -c "from app.database import Base, engine, SessionLocal; from app.seed import seed_database; Base.metadata.create_all(bind=engine); db = SessionLocal(); count = seed_database(db); print(f'Seeded {count} incidents successfully into transport.db')"

# Start the FastAPI backend server (Runs on port 8000)
.\backend\.venv\Scripts\uvicorn.exe app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 2. Setup & Run Frontend

In a second PowerShell terminal:

```powershell
cd c:\Users\shameer\OneDrive\Documents\intelligent-transport-ai\frontend

# Install node dependencies
npm install

# Run TypeScript type check
npm run typecheck

# Build production bundle (or run dev server)
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
.\backend\.venv\Scripts\pytest.exe backend -v
```
**Test Results: 17 Passed, 0 Failed (0.24s)**
- `test_root_endpoint`: Verifies API root metadata and provenance flag.
- `test_health_endpoint`: Verifies database latency, health status, and GPU detection.
- `test_list_incidents_seeded`: Verifies paginated incident listing.
- `test_filter_incidents_by_severity`: Tests severity filtering (`CRITICAL`, `HIGH`, etc.).
- `test_filter_incidents_by_category`: Tests category filtering (`ACCIDENT`, `HAZARD`, etc.).
- `test_bounding_box_filter`: Validates spatial bounding box query (`min_lat`, `max_lat`, `min_lng`, `max_lng`).
- `test_create_incident_valid`: Tests incident creation with coordinate validation.
- `test_create_incident_invalid_coordinates`: Ensures latitude > 90.0 or longitude < -180.0 is rejected with HTTP 422.
- `test_get_incident_detail_and_404`: Verifies detail retrieval and HTTP 404 for non-existent records.
- `test_patch_incident_status`: Tests status transition (`REPORTED` -> `RESOLVED`) and resolution timestamps.
- `test_statistics_endpoint`: Validates KPI aggregations and 24-hour hourly trend histograms.
- `test_vision_supported_formats`: Verifies supported image/video formats (`.jpg`, `.png`, `.mp4`, etc.).
- `test_vision_status`: Tests vision adapter status endpoint.
- `test_vision_analyze_valid_image`: Verifies image processing and structured detection results.
- `test_vision_analyze_unsupported_format`: Verifies rejection of unsupported files with HTTP 415.
- `test_vision_analyze_empty_file`: Verifies rejection of 0-byte uploads with HTTP 400.
- `test_real_vision_adapter_unavailable_graceful_handling`: Verifies graceful failure when model weights are not loaded.

### Frontend Verification
```powershell
npm run typecheck    # TypeScript compiler check (0 errors)
npm run build        # Vite production compilation
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

### Phase 1 Implementation
- **SimulatedVisionAdapter**: Deterministic demo adapter that inspects real image dimensions, calculates content hashes, generates reproducible vehicle bounding boxes, pedestrian locations, speed estimates, collision risk scores, and actionable recommendations.
- **Upload Validation**: Enforces safe limits (max 20 MB), validates file headers with Pillow, and allows image (`.jpg`, `.jpeg`, `.png`, `.webp`) and video (`.mp4`, `.mov`, `.webm`, `.avi`) formats.
- **Hardware Telemetry**: Automatically detects the local GPU (**NVIDIA GeForce RTX 5060 Laptop GPU with 8GB VRAM and CUDA 13.3**).

### Phase 2 Roadmap: Real Vision Model Integration
The detected hardware is capable of running YOLOv8, YOLOv11, or PyTorch road-safety models locally. To integrate real weights:
1. Install `ultralytics` and `torch` with CUDA support:
   ```bash
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
   pip install ultralytics
   ```
2. Download road-safety weights to `backend/weights/road_safety_yolo.pt`.
3. Set `VISION_ADAPTER=real` in `.env`.
4. Implement the forward pass in `RealVisionAdapter.analyze_media()`.

---

## 📊 Provenance & Data Integrity

In accordance with strict operational integrity:
> **Notice**: Demonstration incidents and simulator outputs are explicitly tagged as `SIMULATED DEMO DATA`. Live municipal feeds or external production services are not fabricated.

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

# Frontend
VITE_API_BASE_URL=http://localhost:8000/api
VITE_MAP_DEFAULT_LAT=37.7749
VITE_MAP_DEFAULT_LNG=-122.4194
VITE_MAP_DEFAULT_ZOOM=12
VITE_DATA_PROVENANCE="SIMULATED DEMO DATA"
```

---

## 🔒 Security & Credentials

- No API keys, passwords, or personal credentials are required for the Phase 1 launch.
- No map-provider tokens are baked into client bundles.
- File uploads are validated in memory with strict size limits to prevent Denial of Service.
- All database operations utilize parameterized SQLAlchemy queries preventing SQL injection.

---

## 📄 License

Apache License 2.0. Built for urban transport intelligence and road safety research.

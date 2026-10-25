"""
Road-safety analytics over incident records: district assignment, crash hotspot
clustering, nearest trauma facility and a district summary.

Pure functions over plain dicts (no ORM or framework imports) so they are easy to test.
Everything is computed from the incidents actually stored in the database; nothing is
invented. Demo incidents remain tagged SIMULATED DEMO DATA by the caller.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from app.services.safety.tn_reference import TN_DISTRICT_HQS, TN_TRAUMA_FACILITIES

EARTH_RADIUS_M = 6371000.0
IST = timezone(timedelta(hours=5, minutes=30))

SEVERITY_WEIGHT = {"CRITICAL": 3.0, "HIGH": 2.0, "MEDIUM": 1.0, "LOW": 0.5}
SERIOUS = {"CRITICAL", "HIGH"}  # proxy for fatal / grievous injury in demo records
CRASH_CATEGORIES = {"ACCIDENT", "PEDESTRIAN_CROSSING_RISK"}


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def _valid_coord(lat, lng) -> bool:
    return (isinstance(lat, (int, float)) and isinstance(lng, (int, float))
            and math.isfinite(lat) and math.isfinite(lng) and -90 <= lat <= 90 and -180 <= lng <= 180)


def assign_district(lat: float, lng: float, max_km: float = 60.0) -> Optional[str]:
    """Nearest district HQ within max_km, else None (outside Tamil Nadu or too far to assign)."""
    if not _valid_coord(lat, lng):
        return None
    best, best_d = None, float("inf")
    for d in TN_DISTRICT_HQS:
        dist = haversine_m(lat, lng, d["lat"], d["lng"])
        if dist < best_d:
            best, best_d = d["district"], dist
    return best if best_d <= max_km * 1000 else None


def nearest_facilities(lat: float, lng: float, limit: int = 5) -> List[Dict]:
    if not _valid_coord(lat, lng):
        return []
    limit = max(1, min(int(limit), len(TN_TRAUMA_FACILITIES)))
    ranked = sorted(
        ({**f, "straight_line_km": round(haversine_m(lat, lng, f["lat"], f["lng"]) / 1000, 1)} for f in TN_TRAUMA_FACILITIES),
        key=lambda f: (f["straight_line_km"], f["name"]),
    )
    return ranked[:limit]


def _parse_time(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _crash_records(incidents: Iterable[Dict], days: Optional[int], now: datetime) -> List[Dict]:
    out = []
    cutoff = now - timedelta(days=days) if days else None
    for inc in incidents:
        if inc.get("category") not in CRASH_CATEGORIES:
            continue
        if not _valid_coord(inc.get("latitude"), inc.get("longitude")):
            continue
        created = _parse_time(inc.get("created_at"))
        if cutoff and created and created < cutoff:
            continue
        out.append({**inc, "_created": created})
    return out


def find_hotspots(
    incidents: Iterable[Dict],
    radius_m: float = 500.0,
    min_incidents: int = 2,
    days: Optional[int] = 1095,
    now: Optional[datetime] = None,
) -> List[Dict]:
    """
    Density clustering (DBSCAN-style, haversine) of crash-related incidents.

    A cluster grows from any record with at least `min_incidents` crash records within
    `radius_m`. Each hotspot reports its counts, a severity-weighted score and whether it
    meets the MoRTH-style black-corridor rule (5+ serious crashes within 500 m in 3 years),
    evaluated on the stored records only.
    """
    now = now or datetime.now(timezone.utc)
    radius_m = max(50.0, min(float(radius_m), 5000.0))
    min_incidents = max(1, int(min_incidents))
    recs = _crash_records(incidents, days, now)[:5000]
    n = len(recs)
    neighbours = [[] for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            if haversine_m(recs[i]["latitude"], recs[i]["longitude"], recs[j]["latitude"], recs[j]["longitude"]) <= radius_m:
                neighbours[i].append(j)
                neighbours[j].append(i)

    label = [-1] * n
    cid = 0
    for i in range(n):
        if label[i] != -1 or len(neighbours[i]) + 1 < min_incidents:
            continue
        label[i] = cid
        stack = list(neighbours[i])
        while stack:
            j = stack.pop()
            if label[j] == -1:
                label[j] = cid
                if len(neighbours[j]) + 1 >= min_incidents:
                    stack.extend(k for k in neighbours[j] if label[k] == -1)
        cid += 1

    clusters: Dict[int, List[Dict]] = defaultdict(list)
    for i, c in enumerate(label):
        if c >= 0:
            clusters[c].append(recs[i])

    hotspots = []
    for members in clusters.values():
        lat = sum(m["latitude"] for m in members) / len(members)
        lng = sum(m["longitude"] for m in members) / len(members)
        spread = max(haversine_m(lat, lng, m["latitude"], m["longitude"]) for m in members)
        serious = [m for m in members if m.get("severity") in SERIOUS]
        three_years_ago = now - timedelta(days=1095)
        serious_3y = [m for m in serious if not m["_created"] or m["_created"] >= three_years_ago]
        tags = Counter(t for m in members for t in (m.get("tags") or []))
        hotspots.append({
            "latitude": round(lat, 5),
            "longitude": round(lng, 5),
            "radius_m": round(spread, 0),
            "district": assign_district(lat, lng),
            "incident_count": len(members),
            "serious_count": len(serious),
            "severity_score": round(sum(SEVERITY_WEIGHT.get(m.get("severity"), 0.5) for m in members), 1),
            "meets_black_corridor_rule": len(serious_3y) >= 5 and spread <= 500,
            "location_names": sorted({m.get("location_name") for m in members if m.get("location_name")})[:5],
            "top_tags": [t for t, _ in tags.most_common(4)],
            "incident_ids": [m.get("id") for m in members],
            "is_simulated": any(m.get("is_simulated") for m in members),
        })
    hotspots.sort(key=lambda h: (-h["severity_score"], -h["incident_count"], h["latitude"]))
    for rank, h in enumerate(hotspots, 1):
        h["rank"] = rank
    return hotspots


def district_summary(incidents: Iterable[Dict], now: Optional[datetime] = None) -> Dict:
    """Counts by district, severity, category and hour of day (IST) from stored incidents."""
    now = now or datetime.now(timezone.utc)
    incidents = list(incidents)
    by_district: Dict[str, Dict] = {}
    hours = [0] * 24
    sev = Counter()
    cat = Counter()
    two_wheeler = no_helmet = pedestrian = simulated = 0
    for inc in incidents:
        d = assign_district(inc.get("latitude"), inc.get("longitude")) or "Unassigned"
        row = by_district.setdefault(d, {"district": d, "total": 0, "crashes": 0, "serious": 0})
        row["total"] += 1
        if inc.get("category") in CRASH_CATEGORIES:
            row["crashes"] += 1
        if inc.get("severity") in SERIOUS:
            row["serious"] += 1
        sev[inc.get("severity")] += 1
        cat[inc.get("category")] += 1
        created = _parse_time(inc.get("created_at"))
        if created:
            hours[created.astimezone(IST).hour] += 1
        tags = {t.lower() for t in (inc.get("tags") or [])}
        two_wheeler += "two-wheeler" in tags
        no_helmet += "no-helmet" in tags
        pedestrian += inc.get("category") == "PEDESTRIAN_CROSSING_RISK" or "pedestrian" in tags
        simulated += bool(inc.get("is_simulated"))
    districts = sorted(by_district.values(), key=lambda r: (-r["serious"], -r["crashes"], -r["total"], r["district"]))
    return {
        "total_incidents": len(incidents),
        "simulated_incidents": simulated,
        "by_district": districts,
        "by_severity": dict(sev),
        "by_category": dict(cat),
        "by_hour_ist": hours,
        "tagged_two_wheeler": two_wheeler,
        "tagged_no_helmet": no_helmet,
        "pedestrian_related": pedestrian,
        "generated_at": now.isoformat(),
    }

"""
Tests for Tamil Nadu road-safety analytics (districts, hotspots, facilities, summary)
and the /api/safety endpoints.

Incident fixtures are SYNTHETIC; the seed data under test is SIMULATED DEMO DATA.
The unittest classes run standalone; the `client` functions run under pytest.
"""

import unittest
from datetime import datetime, timedelta, timezone

from app.seed import SEED_INCIDENTS
from app.services.safety.analytics import (
    assign_district,
    district_summary,
    find_hotspots,
    haversine_m,
    nearest_facilities,
)
from app.services.safety.tn_reference import TN_CONTEXT, TN_DISTRICT_HQS, TN_TRAUMA_FACILITIES

NOW = datetime(2026, 10, 24, 6, 0, tzinfo=timezone.utc)


def rec(i, lat, lng, sev="HIGH", cat="ACCIDENT", days_ago=10, tags=None):
    return {
        "id": f"inc-{i}", "latitude": lat, "longitude": lng, "severity": sev, "category": cat,
        "created_at": (NOW - timedelta(days=days_ago)).isoformat(), "tags": tags or [],
        "location_name": f"loc {i}", "is_simulated": True,
    }


def seed_as_dicts():
    out = []
    for i, d in enumerate(SEED_INCIDENTS):
        out.append({
            "id": f"seed-{i}", "latitude": d["latitude"], "longitude": d["longitude"],
            "severity": d["severity"].value, "category": d["category"].value,
            "created_at": (NOW - timedelta(hours=d["hours_ago"])).isoformat(),
            "tags": d["tags"].split(","), "location_name": d["location_name"], "is_simulated": True,
        })
    return out


class TestReferenceData(unittest.TestCase):
    def test_all_38_districts_with_valid_coordinates(self):
        self.assertEqual(len(TN_DISTRICT_HQS), 38)
        self.assertEqual(len({d["district"] for d in TN_DISTRICT_HQS}), 38)
        for d in TN_DISTRICT_HQS:
            self.assertTrue(8.0 <= d["lat"] <= 13.6 and 76.2 <= d["lng"] <= 80.4, d)

    def test_facilities_are_inside_tamil_nadu(self):
        for f in TN_TRAUMA_FACILITIES:
            self.assertIsNotNone(assign_district(f["lat"], f["lng"]), f["name"])

    def test_context_figures_carry_sources(self):
        for key in ("statewide_2024", "black_corridors", "golden_hour_scheme"):
            self.assertTrue(TN_CONTEXT[key]["source_url"].startswith("https://"))
        self.assertEqual(TN_CONTEXT["statewide_2024"]["road_deaths"], 18449)


class TestDistricts(unittest.TestCase):
    def test_known_points(self):
        self.assertEqual(assign_district(13.0067, 80.2045), "Chennai")        # Kathipara
        self.assertEqual(assign_district(12.0379, 79.5466), "Viluppuram")     # Vikravandi
        self.assertEqual(assign_district(11.0263, 77.0007), "Coimbatore")

    def test_outside_tamil_nadu_is_unassigned(self):
        self.assertIsNone(assign_district(28.6139, 77.2090))  # Delhi
        self.assertIsNone(assign_district(float("nan"), 80.0))

    def test_haversine_sanity(self):
        self.assertAlmostEqual(haversine_m(13.0, 80.0, 13.0, 80.0), 0.0)
        self.assertAlmostEqual(haversine_m(13.0, 80.0, 14.0, 80.0) / 1000, 111.2, delta=0.5)


class TestHotspots(unittest.TestCase):
    def test_cluster_found_and_isolated_points_ignored(self):
        recs = [rec(i, 12.0379 + 0.0005 * i, 79.5466, days_ago=30 * i) for i in range(3)]
        recs.append(rec(9, 11.0, 77.0))  # isolated
        hs = find_hotspots(recs, radius_m=500, min_incidents=2, now=NOW)
        self.assertEqual(len(hs), 1)
        self.assertEqual(hs[0]["incident_count"], 3)
        self.assertEqual(hs[0]["district"], "Viluppuram")
        self.assertFalse(hs[0]["meets_black_corridor_rule"])  # only 3 serious

    def test_black_corridor_rule_needs_five_serious_in_three_years(self):
        recs = [rec(i, 12.0379 + 0.0004 * i, 79.5466, days_ago=100 * i) for i in range(5)]
        self.assertTrue(find_hotspots(recs, now=NOW)[0]["meets_black_corridor_rule"])
        recs[4]["severity"] = "LOW"
        self.assertFalse(find_hotspots(recs, now=NOW)[0]["meets_black_corridor_rule"])

    def test_old_records_and_non_crash_categories_are_excluded(self):
        recs = [rec(1, 13.0, 80.2, days_ago=4000), rec(2, 13.0001, 80.2, days_ago=4000),
                rec(3, 13.0, 80.2, cat="ROADWORK"), rec(4, 13.0001, 80.2, cat="CONGESTION")]
        self.assertEqual(find_hotspots(recs, now=NOW), [])

    def test_ranking_by_severity_score(self):
        a = [rec(i, 12.03 + 0.0002 * i, 79.54, sev="CRITICAL") for i in range(2)]
        b = [rec(10 + i, 10.83 + 0.0002 * i, 78.69, sev="LOW") for i in range(3)]
        hs = find_hotspots(a + b, now=NOW)
        self.assertEqual([h["rank"] for h in hs], [1, 2])
        self.assertGreater(hs[0]["severity_score"], hs[1]["severity_score"])

    def test_seed_has_a_demo_black_corridor_at_vikravandi(self):
        hs = find_hotspots(seed_as_dicts(), now=NOW)
        top = hs[0]
        self.assertEqual(top["district"], "Viluppuram")
        self.assertTrue(top["meets_black_corridor_rule"])
        self.assertTrue(top["is_simulated"])


class TestFacilitiesAndSummary(unittest.TestCase):
    def test_nearest_facility_to_vikravandi_is_villupuram(self):
        res = nearest_facilities(12.0379, 79.5466, limit=3)
        self.assertEqual(len(res), 3)
        self.assertIn("Villupuram", res[0]["name"])
        self.assertEqual(res, sorted(res, key=lambda f: f["straight_line_km"]))

    def test_invalid_origin_returns_empty(self):
        self.assertEqual(nearest_facilities(float("inf"), 80.0), [])

    def test_summary_counts(self):
        s = district_summary(seed_as_dicts(), now=NOW)
        self.assertEqual(s["total_incidents"], len(SEED_INCIDENTS))
        self.assertEqual(s["simulated_incidents"], len(SEED_INCIDENTS))
        self.assertEqual(sum(s["by_hour_ist"]), len(SEED_INCIDENTS))
        self.assertGreater(s["tagged_two_wheeler"], 0)
        self.assertEqual(s["by_district"][0]["district"], "Viluppuram")
        self.assertNotIn("Unassigned", [d["district"] for d in s["by_district"]])

    def test_seed_is_all_tamil_nadu(self):
        for d in SEED_INCIDENTS:
            self.assertIsNotNone(assign_district(d["latitude"], d["longitude"]), d["title"])


# ---------------------------------------------------------------- API (pytest)
def test_safety_context_endpoint(client):
    res = client.get("/api/safety/context")
    assert res.status_code == 200
    assert res.json()["statewide_2024"]["road_accidents"] == 67526


def test_safety_summary_endpoint(client):
    res = client.get("/api/safety/summary")
    assert res.status_code == 200
    body = res.json()
    assert body["total_incidents"] > 0
    assert len(body["by_hour_ist"]) == 24
    assert "district_note" in body


def test_safety_hotspots_endpoint(client):
    res = client.get("/api/safety/hotspots?radius_m=500&min_incidents=2")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == len(body["hotspots"])
    assert body["count"] >= 1


def test_safety_hotspots_validation(client):
    assert client.get("/api/safety/hotspots?radius_m=10").status_code == 422


def test_safety_facilities_endpoint(client):
    res = client.get("/api/safety/facilities?lat=12.0379&lng=79.5466&limit=2")
    assert res.status_code == 200
    body = res.json()
    assert len(body["facilities"]) == 2
    assert body["distance_type"] == "straight_line"
    assert client.get("/api/safety/facilities?lat=95&lng=80").status_code == 422


if __name__ == "__main__":
    unittest.main()

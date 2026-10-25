"""
Tamil Nadu reference data for the road-safety module.

Provenance rules for this file:
- Statewide statistics carry their source URL and the date the figure was published.
- District headquarters and trauma-care facility locations are CITY-LEVEL APPROXIMATIONS
  compiled for demonstration. They are adequate for "which district / roughly how far",
  not for navigation. Verify against official Tamil Nadu Health Department and
  Innuyir Kappom (IK:NK-48) empanelment lists before any operational use.
"""

from typing import Dict, List

# (district, headquarters city, lat, lng): approximate HQ city-centre coordinates
TN_DISTRICT_HQS: List[Dict] = [
    {"district": "Ariyalur", "hq": "Ariyalur", "lat": 11.1401, "lng": 79.0786},
    {"district": "Chengalpattu", "hq": "Chengalpattu", "lat": 12.6921, "lng": 79.9764},
    {"district": "Chennai", "hq": "Chennai", "lat": 13.0827, "lng": 80.2707},
    {"district": "Coimbatore", "hq": "Coimbatore", "lat": 11.0168, "lng": 76.9558},
    {"district": "Cuddalore", "hq": "Cuddalore", "lat": 11.7480, "lng": 79.7714},
    {"district": "Dharmapuri", "hq": "Dharmapuri", "lat": 12.1211, "lng": 78.1582},
    {"district": "Dindigul", "hq": "Dindigul", "lat": 10.3673, "lng": 77.9803},
    {"district": "Erode", "hq": "Erode", "lat": 11.3410, "lng": 77.7172},
    {"district": "Kallakurichi", "hq": "Kallakurichi", "lat": 11.7380, "lng": 78.9639},
    {"district": "Kancheepuram", "hq": "Kancheepuram", "lat": 12.8342, "lng": 79.7036},
    {"district": "Kanyakumari", "hq": "Nagercoil", "lat": 8.1833, "lng": 77.4119},
    {"district": "Karur", "hq": "Karur", "lat": 10.9601, "lng": 78.0766},
    {"district": "Krishnagiri", "hq": "Krishnagiri", "lat": 12.5266, "lng": 78.2150},
    {"district": "Madurai", "hq": "Madurai", "lat": 9.9252, "lng": 78.1198},
    {"district": "Mayiladuthurai", "hq": "Mayiladuthurai", "lat": 11.1018, "lng": 79.6522},
    {"district": "Nagapattinam", "hq": "Nagapattinam", "lat": 10.7672, "lng": 79.8449},
    {"district": "Namakkal", "hq": "Namakkal", "lat": 11.2189, "lng": 78.1674},
    {"district": "Perambalur", "hq": "Perambalur", "lat": 11.2342, "lng": 78.8807},
    {"district": "Pudukkottai", "hq": "Pudukkottai", "lat": 10.3833, "lng": 78.8001},
    {"district": "Ramanathapuram", "hq": "Ramanathapuram", "lat": 9.3639, "lng": 78.8395},
    {"district": "Ranipet", "hq": "Ranipet", "lat": 12.9224, "lng": 79.3333},
    {"district": "Salem", "hq": "Salem", "lat": 11.6643, "lng": 78.1460},
    {"district": "Sivaganga", "hq": "Sivaganga", "lat": 9.8433, "lng": 78.4809},
    {"district": "Tenkasi", "hq": "Tenkasi", "lat": 8.9604, "lng": 77.3152},
    {"district": "Thanjavur", "hq": "Thanjavur", "lat": 10.7870, "lng": 79.1378},
    {"district": "The Nilgiris", "hq": "Udhagamandalam", "lat": 11.4102, "lng": 76.6950},
    {"district": "Theni", "hq": "Theni", "lat": 10.0104, "lng": 77.4768},
    {"district": "Thoothukudi", "hq": "Thoothukudi", "lat": 8.7642, "lng": 78.1348},
    {"district": "Tiruchirappalli", "hq": "Tiruchirappalli", "lat": 10.7905, "lng": 78.7047},
    {"district": "Tirunelveli", "hq": "Tirunelveli", "lat": 8.7139, "lng": 77.7567},
    {"district": "Tirupathur", "hq": "Tirupathur", "lat": 12.4955, "lng": 78.5730},
    {"district": "Tiruppur", "hq": "Tiruppur", "lat": 11.1085, "lng": 77.3411},
    {"district": "Tiruvallur", "hq": "Tiruvallur", "lat": 13.1439, "lng": 79.9086},
    {"district": "Tiruvannamalai", "hq": "Tiruvannamalai", "lat": 12.2253, "lng": 79.0747},
    {"district": "Tiruvarur", "hq": "Tiruvarur", "lat": 10.7661, "lng": 79.6344},
    {"district": "Vellore", "hq": "Vellore", "lat": 12.9165, "lng": 79.1325},
    {"district": "Viluppuram", "hq": "Viluppuram", "lat": 11.9401, "lng": 79.4861},
    {"district": "Virudhunagar", "hq": "Virudhunagar", "lat": 9.5851, "lng": 77.9624},
]

DISTRICT_ASSIGNMENT_NOTE = (
    "District is assigned to the nearest headquarters city (within 60 km). "
    "This approximates, but does not follow, official district boundaries."
)

# Government medical college hospitals with trauma care (city-level locations; verify before use)
TN_TRAUMA_FACILITIES: List[Dict] = [
    {"name": "Rajiv Gandhi Government General Hospital", "city": "Chennai", "district": "Chennai", "lat": 13.0815, "lng": 80.2760},
    {"name": "Government Stanley Medical College Hospital", "city": "Chennai", "district": "Chennai", "lat": 13.1067, "lng": 80.2847},
    {"name": "Government Kilpauk Medical College Hospital", "city": "Chennai", "district": "Chennai", "lat": 13.0789, "lng": 80.2420},
    {"name": "Chengalpattu Medical College Hospital", "city": "Chengalpattu", "district": "Chengalpattu", "lat": 12.6921, "lng": 79.9764},
    {"name": "Government Villupuram Medical College Hospital", "city": "Viluppuram", "district": "Viluppuram", "lat": 11.9401, "lng": 79.4861},
    {"name": "Government Cuddalore Medical College Hospital", "city": "Chidambaram", "district": "Cuddalore", "lat": 11.3993, "lng": 79.6936},
    {"name": "Government Vellore Medical College Hospital", "city": "Vellore", "district": "Vellore", "lat": 12.9165, "lng": 79.1325},
    {"name": "Krishnagiri Medical College Hospital", "city": "Krishnagiri", "district": "Krishnagiri", "lat": 12.5266, "lng": 78.2150},
    {"name": "Government Dharmapuri Medical College Hospital", "city": "Dharmapuri", "district": "Dharmapuri", "lat": 12.1211, "lng": 78.1582},
    {"name": "Government Mohan Kumaramangalam Medical College Hospital", "city": "Salem", "district": "Salem", "lat": 11.6643, "lng": 78.1460},
    {"name": "Government Erode Medical College Hospital", "city": "Perundurai", "district": "Erode", "lat": 11.2756, "lng": 77.5870},
    {"name": "Coimbatore Medical College Hospital", "city": "Coimbatore", "district": "Coimbatore", "lat": 11.0168, "lng": 76.9714},
    {"name": "Mahatma Gandhi Memorial Government Hospital", "city": "Tiruchirappalli", "district": "Tiruchirappalli", "lat": 10.8050, "lng": 78.6856},
    {"name": "Thanjavur Medical College Hospital", "city": "Thanjavur", "district": "Thanjavur", "lat": 10.7591, "lng": 79.1050},
    {"name": "Government Rajaji Hospital", "city": "Madurai", "district": "Madurai", "lat": 9.9286, "lng": 78.1335},
    {"name": "Tirunelveli Medical College Hospital", "city": "Tirunelveli", "district": "Tirunelveli", "lat": 8.7139, "lng": 77.7567},
    {"name": "Government Thoothukudi Medical College Hospital", "city": "Thoothukudi", "district": "Thoothukudi", "lat": 8.7642, "lng": 78.1348},
    {"name": "Kanyakumari Government Medical College Hospital", "city": "Nagercoil", "district": "Kanyakumari", "lat": 8.1833, "lng": 77.4119},
]

FACILITY_NOTE = (
    "Demo list of government medical college hospitals at CITY-LEVEL locations. Distances are "
    "straight-line, not road distance. Verify names, locations and trauma capability against the "
    "Tamil Nadu Health Department / IK:NK-48 empanelment list before operational use."
)

TN_CONTEXT: Dict = {
    "statewide_2024": {
        "road_accidents": 67526,
        "road_deaths": 18449,
        "deaths_without_helmet": 7744,
        "national_rank_accidents": 1,
        "national_rank_deaths": 2,
        "source": "Ministry of Road Transport and Highways data tabled in the Rajya Sabha (10 Dec 2025), reported by The News Minute",
        "source_url": "https://www.thenewsminute.com/news/tamil-nadu-had-highest-accidents-and-helmet-related-deaths-in-2024-says-govt-data",
    },
    "black_corridors": {
        "definition": "A 500 m highway stretch with 5 accidents causing death or grievous injury over three years, or 10 fatal accidents.",
        "top_tn_locations": [
            {"location": "Villupuram", "corridors": 70, "national_rank": 1},
            {"location": "Trichy", "corridors": 56},
            {"location": "Cuddalore", "corridors": 49},
        ],
        "source": "MoRTH reply in the Rajya Sabha, reported by ThePrint (July 2026)",
        "source_url": "https://theprint.in/india/over-6000-black-corridors-in-india-tamil-nadu-had-highest-number-of-road-accidents-in-2020-2024/2994573/",
    },
    "golden_hour_scheme": {
        "name": "Innuyir Kappom Thittam – Nammai Kakkum 48 (IK:NK-48)",
        "summary": "Cashless trauma care for road accident victims in Tamil Nadu during the first 48 hours, covering 81 treatment procedures up to ₹1 lakh per person.",
        "launched": "2021-12-18",
        "source": "International Journal of Community Medicine and Public Health, narrative review",
        "source_url": "https://www.ijcmph.com/index.php/ijcmph/article/view/16519",
    },
    "helplines": [
        {"number": "108", "label": "Emergency ambulance (Tamil Nadu)"},
        {"number": "112", "label": "National emergency number"},
    ],
}

from typing import Dict, List, Tuple

# Keyword sets for Discovery Scoring
CITY_ALIASES = {
    "Rajahmundry": ["rajahmundry", "rajamahendravaram", "rjy"],
    "Hyderabad": ["hyderabad", "cyberabad", "hyd", "telangana"],
    "Visakhapatnam": ["visakhapatnam", "vizag", "vizagcity", "andhra"],
    "Vijayawada": ["vijayawada", "bezawada", "vja"],
    "Guntur": ["guntur"],
    "Warangal": ["warangal", "tri-city"],
    "Tirupati": ["tirupati"],
    "Karimnagar": ["karimnagar"],
    "Nizamabad": ["nizamabad"],
    "Kakinada": ["kakinada"]
}

INDUSTRY_KEYWORDS = {
    "pumppilot": [
        "petrol", "pump", "bunk", "fuel", "station", "dealer", "hpcl", "bpcl", "iocl",
        "nayara", "reliance", "diesel", "lubricants", "oil", "meter", "nozzle", "ev", "cng"
    ],
    "pharmaflow": [
        "pharmacy", "pharmacist", "chemist", "medical", "drug", "medicine", "dpharm", "bpharm",
        "pharma", "distributor", "generic", "wholesaler", "dosage", "formulation"
    ]
}

BUSINESS_ROLE_KEYWORDS = [
    "owner", "founder", "proprietor", "manager", "director", "dealer", "shop",
    "store", "trader", "distributor", "enterprise", "business", "services", "hub"
]

def calculate_discovery_score(bio_text: str, city_name: str, project_slug: str, signals: List[str]) -> Tuple[int, List[str]]:
    """
    Computes a discovery score (0 - 100) and compiles structured signal tags.
    """
    score = 40  # Base starting score
    parsed_signals = list(signals) if signals else []

    bio_lower = bio_text.lower() if bio_text else ""
    city_lower = city_name.lower() if city_name else ""

    # 1. City Signal Check (+25 points)
    city_matches = CITY_ALIASES.get(city_name, [city_lower])
    has_city_signal = any(alias in bio_lower for alias in city_matches)
    if has_city_signal:
        score += 25
        parsed_signals.append(f"City Signal: {city_name}")

    # 2. Industry Keyword Signal (+25 points)
    ind_words = INDUSTRY_KEYWORDS.get(project_slug, [])
    matched_ind = [w for w in ind_words if w in bio_lower]
    if matched_ind:
        score += 25
        parsed_signals.append(f"Industry Match ({', '.join(matched_ind[:2])})")

    # 3. Business Role Signal (+15 points)
    matched_biz = [b for b in BUSINESS_ROLE_KEYWORDS if b in bio_lower]
    if matched_biz:
        score += 15
        parsed_signals.append(f"Business Role ({matched_biz[0].capitalize()})")

    # 4. Multi-Source Match Bonus (+10 points)
    if len(parsed_signals) >= 3:
        score += 10
        parsed_signals.append("Multi-Source Signal Match")

    final_score = min(score, 100)
    # Deduplicate signals while preserving order
    unique_signals = list(dict.fromkeys(parsed_signals))

    return final_score, unique_signals

def generate_discovery_queries(project_slug: str, city_name: str) -> Dict[str, List[str]]:
    """
    Generates structured queries across 4 categories: Industry, Adjacent, Business, Local.
    """
    if project_slug == "pumppilot":
        return {
            "Industry": [
                f"petrol pump {city_name}", f"petrol bunk {city_name}", f"fuel station {city_name}",
                f"petrol pump owner {city_name}", f"HPCL {city_name}", f"BPCL {city_name}", f"IOCL {city_name}"
            ],
            "Adjacent": [
                f"{city_name} automobile", f"{city_name} car", f"{city_name} bikes",
                f"{city_name} vehicle maintenance", f"{city_name} engine oil"
            ],
            "Business": [
                f"{city_name} small business", f"{city_name} retail business",
                f"{city_name} entrepreneur", f"{city_name} GST accounting"
            ],
            "Local": [
                f"{city_name} news", f"{city_name} updates", f"{city_name} business",
                f"{city_name} influencers", f"{city_name} community", f"{city_name} reels"
            ]
        }
    else:  # PharmaFlow
        return {
            "Industry": [
                f"pharmacy {city_name}", f"medical store {city_name}", f"medical shop {city_name}",
                f"chemist {city_name}", f"pharmacist {city_name}", f"pharmacy owner {city_name}"
            ],
            "Adjacent": [
                f"{city_name} pharma", f"{city_name} medicine distributor",
                f"{city_name} drug store", f"{city_name} health business"
            ],
            "Business": [
                f"{city_name} retail business", f"{city_name} small business",
                f"{city_name} billing software", f"{city_name} GST accounting"
            ],
            "Local": [
                f"{city_name} news", f"{city_name} updates", f"{city_name} local",
                f"{city_name} influencers", f"{city_name} community"
            ]
        }

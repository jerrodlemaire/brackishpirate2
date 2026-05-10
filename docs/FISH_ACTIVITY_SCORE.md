# Brackish Pirate — Fish Activity Score Algorithm
**Version 1.0 · Approved May 2026**

---

## Overview

The fish activity score is a composite 0–100 index that predicts the likelihood of fish feeding activity at a given location and time. It is the core proprietary feature of Brackish Pirate and what differentiates the app from every other fishing application on the market.

The score is recalculated hourly and drives:
- The activity wave graphic on the home screen and solunar screen
- The hotspot heat zones on the map
- Bite alert push notifications
- The daily forecast calendar color coding

---

## The Formula

```
Score = (Moon × 0.25) + (Tide × 0.20) + (Solunar × 0.20)
      + (Weather × 0.15) + (Pressure × 0.10) + (Water Temp × 0.05)
      + (Season × 0.03) + (Reports × 0.02)
```

All eight sub-scores are normalized to a 0–100 scale before being applied to their weights. The final composite score is rounded to the nearest integer.

---

## Score Labels

| Score range | Label     | Color token       |
|-------------|-----------|-------------------|
| 80–100      | Excellent | marshGreen        |
| 65–79       | Good      | doubloonGold      |
| 50–64       | Fair      | brackishWater     |
| 0–49        | Slow      | textSecondary     |

---

## Input 1 — Moon Phase & Position (25%)

**Why highest weight:** Moon gravity is the primary driver of tidal movement and fish feeding behavior. Full and new moons produce the strongest gravitational pull and the most pronounced feeding activity. This is well established in both solunar theory and decades of angler observation.

**Data source:** Calculated locally using astronomical math (Julian Date + moon longitude formula). No API required. Always available offline.

**Scoring logic:**
- Full moon (illumination 95–100%): 95–100
- New moon (illumination 0–5%): 90–100
- Waxing/waning gibbous (illumination 70–94%): 75–90
- First/last quarter (illumination 45–55%): 55–70
- Crescent phases (illumination 6–44%): 30–55

**Inputs used:**
- Illumination percentage
- Phase name
- Moon transit angle (overhead/underfoot proximity)
- Days to next full or new moon

**Adjustment notes:**
- Moon directly overhead or underfoot adds +8 bonus points
- 3 days before/after full moon still scores 85+
- Consider increasing weight to 28% if user testing confirms lunar dominance in Gulf Coast fishing

---

## Input 2 — Tide Movement (20%)

**Why high weight:** Moving water concentrates baitfish and triggers predator feeding. Experienced Gulf Coast anglers consider tide state the single most important daily variable after moon phase.

**Data source:** NOAA Tides & Currents API — free, covers 3,000+ US stations. Primary station: Grand Isle, LA (8761724) for Lake Pontchartrain area. Station ID should be user-configurable based on home base location.

**Scoring logic:**
- Strong incoming (1–2 hr after low, fast rate): 90–100
- Strong outgoing (1–2 hr after high, fast rate): 85–95
- Moderate incoming: 70–85
- Moderate outgoing: 65–80
- High slack tide: 15–25
- Low slack tide: 20–30

**Inputs used:**
- Current tide direction (incoming/outgoing)
- Rate of height change per hour (ft/hr)
- Time until next high or low
- Tidal range for the day (larger range = higher score ceiling)

**Adjustment notes:**
- Slack tide penalty can be softened for species like sheepshead that feed heavily at high slack
- Consider adding a species filter that adjusts tide weights per target species

---

## Input 3 — Solunar Windows (20%)

**Why high weight:** Solunar windows represent the periods when moon transit is most directly overhead or underfoot, triggering instinctive feeding behavior. When a solunar major window coincides with an incoming tide and full moon, scores of 95+ are expected.

**Data source:** Calculated locally from moon transit times. No API required. Always accurate. Runs entirely in the app engine.

**Scoring logic:**
- Inside major window center (±30 min): 95–100
- Major window edge (±60 min from center): 75–90
- Inside minor window center (±20 min): 70–80
- Minor window edge (±40 min from center): 50–65
- Between all windows: 15–30

**Window definitions:**
- Major windows: Moon directly overhead and underfoot. 2-hour duration. Occur twice daily ~12 hours apart.
- Minor windows: Moon rising and setting. 1-hour duration. Occur twice daily, offset ~6 hours from majors.

**Inputs used:**
- Major window start/end times
- Minor window start/end times
- Current time proximity to nearest window center

**Adjustment notes:**
- Window overlap bonus: when a solunar window aligns within 1 hour of a tide change, add +5 to the solunar sub-score
- This overlap scenario is extremely productive and worth calling out explicitly in the UI

---

## Input 4 — Weather Conditions (15%)

**Why moderate weight:** Weather matters but rarely overrides strong lunar and tidal factors. Overcast days often produce better surface activity than bluebird days. The worst weather scenario for fishing is the post-frontal cold clear day.

**Data source:** Tomorrow.io API (paid subscription). Provides hyperlocal marine forecasts including cloud cover, wind speed, wind direction, precipitation probability, and visibility.

**Scoring logic:**

*Cloud cover:*
- 40–70% overcast: 85–95 (ideal diffused light)
- 70–100% overcast: 70–85
- 0–20% clear: 50–65 (too bright, fish go deep)

*Wind speed:*
- 5–12 mph: 85–100 (ideal chop)
- 0–4 mph: 65–80 (calm, fish can see you)
- 12–18 mph: 50–70
- 18–25 mph: 25–50
- 25+ mph: 5–20 (dangerous, stay home)

*Precipitation:*
- Light rain: 55–70 (can be productive)
- Heavy rain/storm: 10–25

**Inputs used:**
- Cloud cover percentage
- Wind speed (mph)
- Wind direction
- Precipitation probability
- Visibility

**Adjustment notes:**
- Wind direction relative to shoreline matters more than raw speed. Onshore wind pushes bait onto flats.
- Consider adding a wind direction bonus for user's home base orientation in a future version

---

## Input 5 — Barometric Pressure (10%)

**Why included:** Pressure changes affect fish swim bladders and feeding behavior. Rising pressure after a front is consistently one of the most productive fishing periods. Rapidly falling pressure produces a brief feeding frenzy before shutdown.

**Data source:** Tomorrow.io API (same call as weather data). Provides current pressure and 24-hour trend.

**Scoring logic:**

*Pressure trend:*
- Rising steadily (post-front): 85–100
- Stable high (1020+ mb): 75–90
- Stable normal (1010–1020 mb): 60–75
- Falling slowly: 50–65
- Falling rapidly (approaching front): 30–50 (brief boost then crash)
- Just passed through front (low and stable): 20–35

**Inputs used:**
- Current barometric pressure (mb)
- 24-hour pressure change (mb/hr)
- Rate of change classification (stable/rising/falling/rapid)

**Adjustment notes:**
- The "falling rapidly" scenario is nuanced — fishing is often excellent in the 2 hours before a front arrives, then shuts down completely. Consider a time-based modifier here.
- Saltwater fish are generally less sensitive to pressure changes than freshwater species. Weight could be reduced to 8% in a Gulf-specific tuning.

---

## Input 6 — Water Temperature (5%)

**Why lower weight:** Water temperature changes slowly and sets a seasonal baseline rather than driving day-to-day variation. It primarily serves as a ceiling on the overall score — extremely cold or hot water caps the maximum possible score regardless of other factors.

**Data source:** NOAA buoy network. Real-time surface temperature readings from offshore and nearshore buoys. Falls back to climatological seasonal estimate if nearest buoy is offline or >6 hours old.

**Scoring logic (species-adjusted):**

*Speckled Trout optimal range 68–78°F:*
- 70–76°F: 95–100
- 65–70°F or 76–82°F: 70–90
- 60–65°F or 82–88°F: 40–65
- <55°F or >90°F: 5–25

*Redfish optimal range 65–85°F:*
- 70–80°F: 95–100
- 65–70°F or 80–88°F: 75–90
- 60–65°F or 88–92°F: 45–70
- <55°F or >95°F: 5–25

**Inputs used:**
- Current surface water temperature (°F)
- User's target species (from profile settings)
- Seasonal baseline for fallback

**Adjustment notes:**
- Future enhancement: allow user to select target species and weight this input dynamically per species
- Rapid temperature change (cold snap, freshwater influx) should trigger a penalty even if absolute temp is in range

---

## Input 7 — Season & Time of Day (3%)

**Why lowest non-community weight:** These are slow-changing predictable factors that set baseline expectations rather than driving moment-to-moment variation. Dawn and dusk universally boost fish activity regardless of other conditions.

**Data source:** Calculated locally using device date/time. No API required.

**Scoring logic:**

*Time of day:*
- Dawn (30 min before to 90 min after sunrise): +15 bonus
- Dusk (90 min before to 30 min after sunset): +12 bonus
- Mid-morning and late afternoon: baseline
- Midday summer (10am–3pm, June–August): -10 penalty

*Month/season:*
- Spring (March–May): +8 bonus (pre-spawn feeding)
- Fall (October–November): +6 bonus (fall trout run)
- Summer: baseline
- Winter: -5 penalty

*Spawn bonuses (Gulf Coast specific):*
- Redfish spawn (September–November): +5 near full moon
- Speckled trout spawn (March–May, water temp 68–72°F): +5

**Inputs used:**
- Current time of day
- Sunrise/sunset times (calculated from lat/lng)
- Current month
- Water temperature (for spawn trigger)

---

## Input 8 — Community Catch Reports (2%)

**Why included:** Real-world validation from actual anglers is the most honest signal available. A location with three 5-star reports submitted in the last 6 hours should score higher than the algorithm alone would suggest. As the user base grows this input becomes increasingly valuable.

**Data source:** Brackish Pirate Supabase database. Queries catch_reports table for reports within 25 miles of the user's location submitted in the last 24 hours.

**Scoring logic:**
- 3+ high-rating reports (4–5 stars) in last 6 hours within 10 miles: +8
- 1–2 high-rating reports in last 12 hours within 25 miles: +4
- Mixed ratings or old reports: 0 (neutral)
- Multiple low-rating reports (1–2 stars): -3
- No reports: 0 (neutral, not negative)

**Inputs used:**
- Number of reports within 25 miles in last 24 hours
- Average star rating
- Distance from user location
- Report recency (reports >12 hours old count half)

**Adjustment notes:**
- As user base grows, tighten the radius to 10 miles and shorten to 6 hours for higher signal quality
- Future enhancement: weight reports by species matching user's target species

---

## Hourly Activity Curve

The score is not a single daily number — it is recalculated for each hour of the day to build the wave chart graphic. The hourly curve is built as follows:

1. Calculate a baseline score using moon phase, water temp, barometric pressure, and seasonal factors — these change slowly and are constant across the day.
2. For each hour, apply the tide score based on that hour's tide state.
3. Apply the solunar score based on that hour's proximity to the nearest feeding window.
4. Apply the weather score (constant across the day unless a front moves through).
5. Apply the time-of-day modifier (dawn/dusk bonus).
6. Sum and normalize to 0–100.

This produces a smooth wave with peaks at major solunar windows that align with incoming tides, and valleys during slack water and between windows — exactly mirroring what experienced anglers observe in the real world.

---

## Tuning & Adjustment Guidelines

The weights can be adjusted in `/src/lib/activityScore.js`. The following scenarios may warrant weight adjustment based on user feedback and testing:

| Scenario | Suggested adjustment |
|----------|---------------------|
| Users report tide matters more than moon | Increase tide to 23%, reduce moon to 22% |
| Barometric pressure proving highly predictive | Increase pressure to 13%, reduce season to 0% |
| Community reports growing (10k+ users) | Increase reports to 5%, reduce season to 0% |
| Species-specific mode added | Add species multiplier table, adjust water temp to 8% |
| Offshore fishing mode added | Reduce tide to 12%, add current/SST at 8% |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 2026 | Initial algorithm. 8 inputs. Weights as documented above. |

---

*Brackish Pirate · Proprietary algorithm · Do not distribute*

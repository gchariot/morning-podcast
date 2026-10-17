"""
Étape 1 bis — l'entraînement course, depuis Garmin Connect (bibliothèque non officielle garminconnect).

Les séances du plan Campus Coach arrivent dans le calendrier Garmin : c'est là qu'on lit la séance du jour.
Sortie : out/garmin.json, fusionné ensuite par src/data.ts dans data/<DATE>.json → « course ».
Ne fait jamais échouer le workflow : en cas de problème, le fichier contient { "error": ... } et la matinale saute la rubrique.

Connexion : jetons en cache (GARMINTOKENS, dossier gardé par actions/cache), sinon GARMIN_EMAIL / GARMIN_PASSWORD.
Usage : python3 src/garmin.py AAAA-MM-JJ
"""
import json
import os
import sys
from datetime import date as Date, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "out" / "garmin.json"


def write(payload):
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"Garmin : {OUT} ({'erreur : ' + payload['error'] if 'error' in payload else 'ok'})")


def safe(errors, label, fn):
    try:
        return fn()
    except Exception as e:  # une donnée manquante ne bloque pas les autres
        errors.append(f"{label} : {type(e).__name__}")
        return None


def pace(meters, seconds):
    """Allure en min/km, ex. « 5:12 »."""
    if not meters or not seconds:
        return None
    s = seconds / (meters / 1000)
    return f"{int(s // 60)}:{int(round(s % 60)):02d}"


def workout_summary(w):
    """Une séance prévue, réduite à ce qu'on dit à l'oral (échauffement, blocs, récup)."""
    if not w:
        return None

    def step(s):
        if s.get("type") == "RepeatGroupDTO" or s.get("numberOfIterations"):
            return {"repeter": s.get("numberOfIterations"), "blocs": [step(x) for x in s.get("workoutSteps", [])]}
        cond = (s.get("endCondition") or {}).get("conditionTypeKey")
        val = s.get("endConditionValue")
        target = s.get("targetType", {}) or {}
        out = {"type": (s.get("stepType") or {}).get("stepTypeKey"), "fin": cond}
        if cond == "distance" and val:
            out["metres"] = round(val)
        elif cond == "time" and val:
            out["secondes"] = round(val)
        if target.get("workoutTargetTypeKey") == "pace.zone" and s.get("targetValueOne"):
            # vitesses en m/s → allures en min/km (la plus lente d'abord)
            lo, hi = sorted([s.get("targetValueOne"), s.get("targetValueTwo") or s.get("targetValueOne")])
            out["allure"] = f"{pace(1000, 1000 / hi)}–{pace(1000, 1000 / lo)}"
        elif target.get("workoutTargetTypeKey") in ("heart.rate.zone",) and s.get("targetValueOne"):
            out["fc"] = f"{round(s['targetValueOne'])}–{round(s.get('targetValueTwo') or s['targetValueOne'])}"
        if s.get("description"):
            out["note"] = s["description"]
        return out

    segs = w.get("workoutSegments") or []
    return {
        "nom": w.get("workoutName"),
        "description": w.get("description"),
        "sport": (w.get("sportType") or {}).get("sportTypeKey"),
        "dureeEstimeeMin": round(w["estimatedDurationInSecs"] / 60) if w.get("estimatedDurationInSecs") else None,
        "distanceEstimeeKm": round(w["estimatedDistanceInMeters"] / 1000, 1) if w.get("estimatedDistanceInMeters") else None,
        "etapes": [step(s) for seg in segs for s in seg.get("workoutSteps", [])],
    }


def main():
    day = Date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else Date.today()
    email, password = os.getenv("GARMIN_EMAIL"), os.getenv("GARMIN_PASSWORD")
    tokens = os.getenv("GARMINTOKENS") or str(Path("~/.garminconnect").expanduser())
    if not (email and password) and not Path(tokens).expanduser().exists():
        return write({"error": "GARMIN_EMAIL / GARMIN_PASSWORD absents : pas de rubrique course."})

    try:
        from garminconnect import Garmin
        g = Garmin(email, password)
        g.login(tokens)
    except Exception as e:
        # Ne jamais recopier le message brut : il pourrait contenir des détails de compte.
        return write({"error": f"Connexion Garmin impossible ({type(e).__name__})."})

    errors = []
    iso = day.isoformat()

    # Séances prévues : aujourd'hui et les 6 jours suivants (le calendrier est par mois).
    months = {(day.year, day.month), ((day + timedelta(days=6)).year, (day + timedelta(days=6)).month)}
    items = []
    for y, m in months:
        cal = safe(errors, "calendrier", lambda: g.get_scheduled_workouts(y, m)) or {}
        items += cal.get("calendarItems", [])
    window = {(day + timedelta(days=i)).isoformat() for i in range(7)}
    planned = sorted(
        (i for i in items if i.get("itemType") == "workout" and i.get("date") in window),
        key=lambda i: i.get("date"),
    )
    today_items = [i for i in planned if i.get("date") == iso]
    seance = [workout_summary(safe(errors, "séance", lambda i=i: g.get_workout_by_id(i["workoutId"]))) or {"nom": i.get("title")}
              for i in today_items if i.get("workoutId")]
    semaine = [{"date": i.get("date"), "nom": i.get("title")} for i in planned if i.get("date") != iso]

    # Sorties des 14 derniers jours (course à pied).
    acts = safe(errors, "activités", lambda: g.get_activities_by_date((day - timedelta(days=14)).isoformat(), iso, "running")) or []
    sorties = [{
        "date": (a.get("startTimeLocal") or "")[:10],
        "nom": a.get("activityName"),
        "km": round((a.get("distance") or 0) / 1000, 2),
        "dureeMin": round((a.get("duration") or 0) / 60),
        "allure": pace(a.get("distance"), a.get("duration")),
        "fcMoy": a.get("averageHR"),
        "effetAerobie": round(a["aerobicTrainingEffect"], 1) if a.get("aerobicTrainingEffect") is not None else None,
        "effetAnaerobie": round(a["anaerobicTrainingEffect"], 1) if a.get("anaerobicTrainingEffect") is not None else None,
    } for a in acts]
    sorties.sort(key=lambda s: s["date"], reverse=True)
    monday = day - timedelta(days=day.weekday())
    km_semaine = round(sum(s["km"] for s in sorties if s["date"] >= monday.isoformat() and s["date"] < iso), 1)
    last_monday = monday - timedelta(days=7)
    km_semaine_passee = round(sum(s["km"] for s in sorties if last_monday.isoformat() <= s["date"] < monday.isoformat()), 1)

    # Tendance de forme : uniquement des indicateurs déjà calculés la veille (la nuit en cours n'est pas
    # encore synchronisée à l'heure où le podcast est écrit). Statut VFC sur 7 jours, statut et charge d'entraînement, VO2max.
    veille = (day - timedelta(days=1)).isoformat()
    hrv = (safe(errors, "VFC", lambda: g.get_hrv_data(veille)) or {}).get("hrvSummary") or {}
    ts = safe(errors, "statut d'entraînement", lambda: g.get_training_status(veille)) or {}
    latest = ((ts.get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData") or {})
    dev = next(iter(latest.values()), {}) if isinstance(latest, dict) else {}
    load = dev.get("acuteTrainingLoadDTO") or {}
    vo2 = (((ts.get("mostRecentVO2Max") or {}).get("generic")) or {})
    tendance = {
        "vfc": {"statut": hrv.get("status"), "moyenne7j": hrv.get("weeklyAvg"), "plageNormale": [(hrv.get("baseline") or {}).get("balancedLow"), (hrv.get("baseline") or {}).get("balancedUpper")]} if hrv else None,
        "statutEntrainement": dev.get("trainingStatusFeedbackPhrase") or dev.get("trainingStatus"),
        "charge": {"aigue": load.get("dailyTrainingLoadAcute"), "chronique": load.get("dailyTrainingLoadChronic"), "ratio": load.get("dailyAcuteChronicWorkloadRatio"), "etat": load.get("acwrStatus")} if load else None,
        "vo2max": vo2.get("vo2MaxPreciseValue") or vo2.get("vo2MaxValue"),
    }

    write({
        "date": iso,
        "seanceDuJour": seance or None,  # None = repos ou rien de prévu
        "prochainesSeances": semaine,
        "dernieresSorties": sorties[:5],
        "kmSemaineEnCours": km_semaine,
        "kmSemainePassee": km_semaine_passee,
        "tendance": tendance,
        **({"manques": errors} if errors else {}),
    })


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        write({"error": f"Garmin : échec inattendu ({type(e).__name__})."})

"""
Connecteur Claude « Garmin » (MCP, HTTP sans état) : tes données de course à la demande dans Claude.
Lecture seule. Bibliothèque non officielle garminconnect (comme la matinale).

Réglages Vercel (projet dont le dossier racine est garmin-mcp/) :
  GARMIN_EMAIL, GARMIN_PASSWORD  — ton compte Garmin
  GARMIN_MCP_TOKEN               — mot de passe du connecteur (24 caractères ou plus)
Dans Claude : URL https://<projet>.vercel.app/mcp, « Aucune connexion », en-tête X-Api-Key = GARMIN_MCP_TOKEN.
Diagnostic sans secret : https://<projet>.vercel.app/status
"""
import asyncio
import hmac
import json
import os
import threading
from datetime import date as Date, timedelta
from pathlib import Path

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

TOKENS = Path("/tmp/garminconnect")  # jetons gardés tant que l'instance reste chaude
_client = None
_lock = threading.Lock()


def garmin():
    """Client Garmin connecté, réutilisé d'un appel à l'autre."""
    global _client
    with _lock:
        if _client is None:
            from garminconnect import Garmin
            g = Garmin(os.environ["GARMIN_EMAIL"], os.environ["GARMIN_PASSWORD"])
            TOKENS.mkdir(parents=True, exist_ok=True)
            g.login(str(TOKENS))
            _client = g
        return _client


async def call(fn, *args):
    """Appel Garmin (bloquant) dans un fil à part ; une erreur devient une valeur, pas un plantage."""
    try:
        return await asyncio.to_thread(fn, *args)
    except Exception as e:
        return {"erreur": type(e).__name__}


def pace(meters, seconds):
    if not meters or not seconds:
        return None
    s = seconds / (meters / 1000)
    return f"{int(s // 60)}:{int(round(s % 60)):02d}"


def hms(s):
    return f"{int(s // 3600)}:{int(s % 3600 // 60):02d}:{int(s % 60):02d}" if s else None


def today():
    return Date.today()


def activity_row(a):
    return {
        "id": a.get("activityId"),
        "date": (a.get("startTimeLocal") or "")[:16],
        "nom": a.get("activityName"),
        "type": (a.get("activityType") or {}).get("typeKey"),
        "km": round((a.get("distance") or 0) / 1000, 2),
        "duree": hms(a.get("duration")),
        "allure": pace(a.get("distance"), a.get("duration")),
        "fcMoy": a.get("averageHR"), "fcMax": a.get("maxHR"),
        "denivelePlus": round(a["elevationGain"]) if a.get("elevationGain") else None,
        "cadence": round(a["averageRunningCadenceInStepsPerMinute"]) if a.get("averageRunningCadenceInStepsPerMinute") else None,
        "effetAerobie": round(a["aerobicTrainingEffect"], 1) if a.get("aerobicTrainingEffect") is not None else None,
        "effetAnaerobie": round(a["anaerobicTrainingEffect"], 1) if a.get("anaerobicTrainingEffect") is not None else None,
        "chargeEntrainement": round(a["activityTrainingLoad"]) if a.get("activityTrainingLoad") else None,
    }


def step(s):
    if s.get("type") == "RepeatGroupDTO" or s.get("numberOfIterations"):
        return {"repeter": s.get("numberOfIterations"), "blocs": [step(x) for x in s.get("workoutSteps", [])]}
    cond = (s.get("endCondition") or {}).get("conditionTypeKey")
    val = s.get("endConditionValue")
    out = {"type": (s.get("stepType") or {}).get("stepTypeKey"), "fin": cond}
    if cond == "distance" and val:
        out["metres"] = round(val)
    elif cond == "time" and val:
        out["secondes"] = round(val)
    t = (s.get("targetType") or {}).get("workoutTargetTypeKey")
    if t == "pace.zone" and s.get("targetValueOne"):
        lo, hi = sorted([s["targetValueOne"], s.get("targetValueTwo") or s["targetValueOne"]])
        out["allure"] = f"{pace(1000, 1000 / hi)}–{pace(1000, 1000 / lo)}"
    elif t == "heart.rate.zone" and s.get("targetValueOne"):
        out["fc"] = f"{round(s['targetValueOne'])}–{round(s.get('targetValueTwo') or s['targetValueOne'])}"
    if s.get("description"):
        out["note"] = s["description"]
    return out


def as_text(data):
    return json.dumps(data, ensure_ascii=False, indent=1, default=str)


def build():
    server = MCPServer(
        name="garmin",
        version="1.0.0",
        instructions=(
            "Données Garmin de Greg (course à pied, préparation marathon ; plan d'entraînement Campus Coach synchronisé dans le calendrier Garmin). "
            "Lecture seule. Allures en min/km, durées en h:mm:ss. Pour une analyse, croise sorties, forme et plan ; "
            "pas de conseil médical, et distingue ce que disent les chiffres de ce que tu en déduis."
        ),
    )
    ro = ToolAnnotations(readOnlyHint=True)

    @server.tool(title="Mes sorties", annotations=ro)
    async def sorties(jours: int = 30, type: str = "running", limite: int = 60) -> str:
        """Liste des activités sur les N derniers jours (défaut : course à pied, 30 jours, jusqu'à 365) :
        distance, durée, allure, FC moyenne et max, dénivelé, cadence, effets d'entraînement, charge.
        type : running, trail_running, cycling, swimming… ou vide pour tout. Sert aussi à comparer l'allure à FC égale dans le temps."""
        jours = max(1, min(jours, 365))
        g = await call(garmin)
        if isinstance(g, dict):
            return as_text(g)
        acts = await call(g.get_activities_by_date, (today() - timedelta(days=jours)).isoformat(), today().isoformat(), type or None)
        if isinstance(acts, dict):
            return as_text(acts)
        rows = sorted((activity_row(a) for a in acts), key=lambda r: r["date"], reverse=True)[: max(1, min(limite, 200))]
        return as_text({"jours": jours, "nombre": len(rows), "sorties": rows})

    @server.tool(title="Détail d'une sortie", annotations=ro)
    async def detail_sortie(activity_id: int) -> str:
        """Le détail d'une activité (id donné par « sorties ») : tours / splits au kilomètre (allure, FC, dénivelé)
        et temps passé dans chaque zone cardiaque. Pour analyser une séance ou une course."""
        g = await call(garmin)
        if isinstance(g, dict):
            return as_text(g)
        act, splits, zones = await asyncio.gather(
            call(g.get_activity, activity_id), call(g.get_activity_splits, activity_id), call(g.get_activity_hr_in_timezones, activity_id))
        laps = [{
            "n": i + 1, "km": round((l.get("distance") or 0) / 1000, 2), "duree": hms(l.get("duration")),
            "allure": pace(l.get("distance"), l.get("duration")), "fcMoy": l.get("averageHR"), "fcMax": l.get("maxHR"),
            "deniveleePlus": round(l["elevationGain"]) if l.get("elevationGain") else None,
        } for i, l in enumerate((splits or {}).get("lapDTOs", []) if isinstance(splits, dict) else [])]
        summ = (act or {}).get("summaryDTO", {}) if isinstance(act, dict) else {}
        return as_text({
            "nom": (act or {}).get("activityName") if isinstance(act, dict) else None,
            "resume": {"km": round((summ.get("distance") or 0) / 1000, 2), "duree": hms(summ.get("duration")),
                       "allure": pace(summ.get("distance"), summ.get("duration")), "fcMoy": summ.get("averageHR"),
                       "fcMax": summ.get("maxHR"), "deniveleePlus": summ.get("elevationGain"),
                       "temperature": summ.get("averageTemperature")},
            "tours": laps,
            "zonesCardiaques": [{"zone": z.get("zoneNumber"), "minutes": round((z.get("secsInZone") or 0) / 60, 1), "depuisBpm": z.get("zoneLowBoundary")}
                                for z in (zones if isinstance(zones, list) else [])],
        })

    @server.tool(title="Ma forme", annotations=ro)
    async def forme(jours: int = 7) -> str:
        """Forme jour par jour sur les N derniers jours (1 à 14) : sommeil (durée, score), VFC de la nuit et statut,
        FC au repos, Body Battery (max/min), disposition à l'entraînement ; plus statut d'entraînement, charge aiguë/chronique et VO2max actuels."""
        jours = max(1, min(jours, 14))
        g = await call(garmin)
        if isinstance(g, dict):
            return as_text(g)

        async def day(d):
            iso = d.isoformat()
            sleep, hrv, rhr, bb, tr = await asyncio.gather(
                call(g.get_sleep_data, iso), call(g.get_hrv_data, iso), call(g.get_rhr_day, iso),
                call(g.get_body_battery, iso), call(g.get_training_readiness, iso))
            dto = (sleep or {}).get("dailySleepDTO") or {} if isinstance(sleep, dict) else {}
            hs = (hrv or {}).get("hrvSummary") or {} if isinstance(hrv, dict) else {}
            vals = [v[1] for x in (bb if isinstance(bb, list) else []) for v in (x.get("bodyBatteryValuesArray") or []) if v and len(v) > 1 and v[1] is not None]
            rhr_v = None
            try:
                rhr_v = rhr["allMetrics"]["metricsMap"]["WELLNESS_RESTING_HEART_RATE"][0]["value"]
            except Exception:
                pass
            tr0 = tr[0] if isinstance(tr, list) and tr else {}
            return {
                "date": iso,
                "sommeilH": round(dto["sleepTimeSeconds"] / 3600, 1) if dto.get("sleepTimeSeconds") else None,
                "scoreSommeil": ((dto.get("sleepScores") or {}).get("overall") or {}).get("value"),
                "vfcNuit": hs.get("lastNightAvg"), "vfcStatut": hs.get("status"),
                "fcRepos": rhr_v,
                "bodyBatteryMax": max(vals) if vals else None, "bodyBatteryMin": min(vals) if vals else None,
                "disposition": tr0.get("score"),
            }

        days = await asyncio.gather(*(day(today() - timedelta(days=i)) for i in range(jours)))
        ts = await call(g.get_training_status, today().isoformat())
        latest = ((ts or {}).get("mostRecentTrainingStatus") or {}).get("latestTrainingStatusData") or {} if isinstance(ts, dict) else {}
        dev = next(iter(latest.values()), {}) if isinstance(latest, dict) else {}
        load = dev.get("acuteTrainingLoadDTO") or {}
        vo2 = ((ts or {}).get("mostRecentVO2Max") or {}).get("generic") or {} if isinstance(ts, dict) else {}
        return as_text({
            "jours": days,
            "statutEntrainement": dev.get("trainingStatusFeedbackPhrase") or dev.get("trainingStatus"),
            "charge": {"aigue": load.get("dailyTrainingLoadAcute"), "chronique": load.get("dailyTrainingLoadChronic"),
                       "ratio": load.get("dailyAcuteChronicWorkloadRatio"), "etat": load.get("acwrStatus")},
            "vo2max": vo2.get("vo2MaxPreciseValue") or vo2.get("vo2MaxValue"),
        })

    @server.tool(title="Mon plan", annotations=ro)
    async def plan(jours: int = 14) -> str:
        """Le plan à venir depuis le calendrier Garmin (séances Campus Coach) sur N jours (1 à 60), avec le détail
        des séances (échauffement, blocs, allures cibles), et les courses objectifs inscrites dans les 6 prochains mois."""
        jours = max(1, min(jours, 60))
        g = await call(garmin)
        if isinstance(g, dict):
            return as_text(g)
        t = today()
        months, cur = [], (t.year, t.month)
        end = t + timedelta(days=180)
        while cur <= (end.year, end.month):
            months.append(cur)
            cur = (cur[0] + (cur[1] == 12), cur[1] % 12 + 1)
        cals = await asyncio.gather(*(call(g.get_scheduled_workouts, y, m) for y, m in months))
        items = list({(i.get("itemType"), i.get("date"), i.get("title"), i.get("id")): i
                      for c in cals if isinstance(c, dict) for i in c.get("calendarItems", [])}.values())
        lim = (t + timedelta(days=jours)).isoformat()
        seances = sorted((i for i in items if i.get("itemType") == "workout" and t.isoformat() <= (i.get("date") or "") <= lim), key=lambda i: i["date"])
        details = await asyncio.gather(*(call(g.get_workout_by_id, i["workoutId"]) if i.get("workoutId") else asyncio.sleep(0, {}) for i in seances))
        out = []
        for i, w in zip(seances, details):
            w = w if isinstance(w, dict) and "erreur" not in w else {}
            out.append({
                "date": i["date"], "nom": i.get("title"), "description": w.get("description"),
                "dureeEstimeeMin": round(w["estimatedDurationInSecs"] / 60) if w.get("estimatedDurationInSecs") else None,
                "distanceEstimeeKm": round(w["estimatedDistanceInMeters"] / 1000, 1) if w.get("estimatedDistanceInMeters") else None,
                "etapes": [step(s) for seg in w.get("workoutSegments") or [] for s in seg.get("workoutSteps", [])],
            })
        objectifs = sorted(({"date": i.get("date"), "nom": i.get("title"), "type": i.get("itemType"),
                             "dansJours": (Date.fromisoformat(i["date"]) - t).days}
                            for i in items if i.get("itemType") not in ("workout", "activity", None) and (i.get("date") or "") >= t.isoformat()),
                           key=lambda o: o["date"])
        return as_text({"seances": out, "objectifs": objectifs})

    @server.tool(title="Mes prédictions et records", annotations=ro)
    async def predictions(mois: int = 6) -> str:
        """Prédictions de temps Garmin (5 km, 10 km, semi, marathon) : aujourd'hui et mois par mois sur N mois (1 à 12),
        plus les records personnels. Pour suivre la progression vers un objectif."""
        mois = max(1, min(mois, 12))
        g = await call(garmin)
        if isinstance(g, dict):
            return as_text(g)
        start = (today() - timedelta(days=30 * mois)).isoformat()
        now, hist, prs = await asyncio.gather(
            call(g.get_race_predictions), call(g.get_race_predictions, start, today().isoformat(), "monthly"), call(g.get_personal_record))

        def times(p):
            return {k: hms(p.get(f)) for k, f in (("5km", "time5K"), ("10km", "time10K"), ("semi", "timeHalfMarathon"), ("marathon", "timeMarathon"))} if isinstance(p, dict) else p

        records = []
        for r in prs if isinstance(prs, list) else []:
            v = r.get("value")
            records.append({"type": r.get("typeId"), "valeur": hms(v) if isinstance(v, (int, float)) and v > 100 else v,
                            "date": (r.get("actStartDateTimeInGMTFormatted") or r.get("prStartTimeGmtFormatted") or "")[:10],
                            "activite": r.get("activityName")})
        return as_text({
            "maintenant": times(now),
            "parMois": [dict(times(p), mois=(p.get("calendarDate") or p.get("fromCalendarDate") or "")[:7]) for p in hist] if isinstance(hist, list) else hist,
            "records": records,
            "noteRecords": "type : 1 = 1 km, 2 = 1 mile, 3 = 5 km, 4 = 10 km, 5 = semi, 6 = marathon, 7 = plus longue sortie (m), autres = autres records",
        })

    @server.tool(title="Mon volume par semaine", annotations=ro)
    async def volume(semaines: int = 12) -> str:
        """Kilomètres, nombre de sorties, temps et dénivelé de course à pied par semaine (lundi → dimanche) sur N semaines (1 à 52)."""
        semaines = max(1, min(semaines, 52))
        g = await call(garmin)
        if isinstance(g, dict):
            return as_text(g)
        t = today()
        monday = t - timedelta(days=t.weekday())
        start = monday - timedelta(weeks=semaines - 1)
        acts = await call(g.get_activities_by_date, start.isoformat(), t.isoformat(), "running")
        if isinstance(acts, dict):
            return as_text(acts)
        weeks = {}
        for a in acts:
            d = Date.fromisoformat((a.get("startTimeLocal") or "")[:10])
            w = (d - timedelta(days=d.weekday())).isoformat()
            x = weeks.setdefault(w, {"semaineDu": w, "km": 0.0, "sorties": 0, "heures": 0.0, "deniveleePlus": 0})
            x["km"] += (a.get("distance") or 0) / 1000
            x["sorties"] += 1
            x["heures"] += (a.get("duration") or 0) / 3600
            x["deniveleePlus"] += round(a.get("elevationGain") or 0)
        rows = []
        for i in range(semaines):
            w = (start + timedelta(weeks=i)).isoformat()
            x = weeks.get(w, {"semaineDu": w, "km": 0.0, "sorties": 0, "heures": 0.0, "deniveleePlus": 0})
            rows.append({**x, "km": round(x["km"], 1), "heures": round(x["heures"], 1)})
        return as_text({"semaines": rows, "noteSemaineEnCours": "la dernière semaine est en cours"})

    return server


def authorized(scope):
    expected = (os.environ.get("GARMIN_MCP_TOKEN") or "").strip()
    if len(expected) < 24:
        return False
    headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
    given = (headers.get("authorization") or headers.get("x-api-key") or "").strip()
    if given.lower().startswith("bearer "):
        given = given[7:].strip()
    return hmac.compare_digest(given.encode(), expected.encode())


async def respond(send, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode()
    await send({"type": "http.response.start", "status": status,
                "headers": [(b"content-type", b"application/json; charset=utf-8"), (b"cache-control", b"no-store")]})
    await send({"type": "http.response.body", "body": body})


async def app(scope, receive, send):
    """Point d'entrée ASGI (Vercel). Chaque requête MCP a son propre serveur : sans état, rien ne traîne entre deux appels."""
    if scope["type"] == "lifespan":
        while True:
            msg = await receive()
            if msg["type"] == "lifespan.startup":
                await send({"type": "lifespan.startup.complete"})
            elif msg["type"] == "lifespan.shutdown":
                await send({"type": "lifespan.shutdown.complete"})
                return
    if scope["type"] != "http":
        return
    # Diagnostic : toute lecture simple (GET) sans jeton, ex. https://<projet>.vercel.app/status dans le navigateur.
    # (Vercel réécrit l'adresse vers /api/index : on ne peut pas se fier au chemin.) Claude, lui, envoie des POST avec jeton.
    if scope.get("method") == "GET" and not authorized(scope):
        tok = (os.environ.get("GARMIN_MCP_TOKEN") or "").strip()
        return await respond(send, 200, {
            "GARMIN_EMAIL": "ok" if os.environ.get("GARMIN_EMAIL") else "absent",
            "GARMIN_PASSWORD": "ok" if os.environ.get("GARMIN_PASSWORD") else "absent",
            "GARMIN_MCP_TOKEN": "absent" if not tok else (f"trop court ({len(tok)} caractères, il en faut 24)" if len(tok) < 24 else "ok"),
            "serveur": "ok",
        })
    if not authorized(scope):
        # Diagnostic sans rien révéler : en-têtes reçus et longueurs (jamais les valeurs).
        h = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        got = (h.get("authorization") or h.get("x-api-key") or "").strip()
        if got.lower().startswith("bearer "):
            got = got[7:].strip()
        print("[garmin-mcp] 401", json.dumps({
            "entetes": sorted(k for k in h if not k.startswith(("x-vercel", "x-forwarded", "x-real"))),
            "longueurRecue": len(got), "longueurAttendue": len((os.environ.get("GARMIN_MCP_TOKEN") or "").strip()),
        }), flush=True)
        return await respond(send, 401, {"jsonrpc": "2.0", "error": {"code": -32001, "message": "Jeton manquant ou invalide"}, "id": None})
    server = build()
    inner = server.streamable_http_app(
        streamable_http_path="/mcp", json_response=True, stateless_http=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
    )
    scope = dict(scope, path="/mcp")  # quelle que soit l'adresse réécrite par Vercel
    async with server.session_manager.run():
        await inner(scope, receive, send)

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Huxxley, a full-stack developer living in Ferney-Voltaire and working in Geneva, plus a few people close to him who also listen to the show. They use the app mostly on a phone, around the morning listen: before or after the car, where the episode itself plays through Pocket Casts (CarPlay).

## Product Purpose

« La Matinale » is a private web app that goes with a personal daily audio show, « La Matinale de Huxxley », published every morning at about 6:00 (Geneva time). The app has two jobs of equal weight:

- **Listen:** the day's episode, with chapters, speed and resume, plus previous episodes.
- **Steer the show:** give feedback that the next morning's episode applies, and define the themes (what each covers, how long, in which order, paused or not), including creating new ones.

Success means the next day's episode visibly reflects yesterday's feedback, and changing the show takes seconds, with no need to touch the repository.

## Positioning

A podcast nobody else receives, written each night for its listeners from their own feedback. The app is the remote control for that loop: listen → react → tomorrow's edition changes. A generic podcast player cannot do this.

## Operating Context

- **Pipeline:** a Claude scheduled task researches and writes the script at 5:37. GitHub Actions turns it into audio (Gemini TTS, two hosts: Léa and Hugo), assembles chapters and publishes to Cloudflare R2 along with a private RSS feed.
- **What the app reads:**
  - `episodes.json` and `feed.xml` from R2.
  - `retours.md` and `config/rubriques.json` from the GitHub repo.
- **Where the app writes:** to the same two repo files, through the GitHub contents API (each change is a commit on `main`, validated before writing).
- **Default themes:**
  - Nouveautés IA
  - Football (OL, Ligue 1, LDC, Real Madrid, Premier League)
  - Politique (France, Suisse romande, Monde)
  - Jeux vidéo
  - Cinéma & séries
  - Culture générale
- **Editions:** the weekday edition is about 20 minutes. The weekend editions are shorter and can skip themes.

## Capabilities and Constraints

- Next.js App Router with server actions, deployed on Vercel. The app is private behind a password with a signed cookie.
- Screens:
  - Écouter
  - Mon avis: per-theme 👍/👎, a general note and permanent rules.
  - Thèmes: edit, pause, reorder, delete and create themes.
  - Réglages: target length and weekend editions.
- Writes can conflict, because the GitHub file sha changes. The app must report this clearly instead of overwriting.
- **Open decision:** multiple listeners. There is currently one shared password and one shared episode, and feedback is not attributed to a person. Whether feedback should carry the listener's name, and how the writer weighs several listeners, is undecided.

## Brand Commitments

None binding. The user explicitly left the visual identity open: the current dawn palette and naming can be replaced. All UI copy is in French.

## Evidence on Hand

- The real cover is at `assets/cover.jpg` and the jingle at `assets/jingle.mp3`.
- Real episodes live on R2, with chapters and sources.
- There are no testimonials or metrics, and none should be invented.

## Product Principles

1. The loop is the product: every screen should make « what changes tomorrow » obvious.
2. One-thumb, half-awake use: the main actions take a few taps on a phone at 7 a.m.
3. Never lose a change silently: validate, then confirm in plain French or explain the failure.
4. Listening and steering have equal weight; neither is buried.

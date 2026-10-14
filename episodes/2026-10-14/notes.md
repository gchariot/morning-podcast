# Notes de recherche — La Matinale du 14 octobre 2026

Données : `data/2026-10-14.json` présent (scores LdC du 13/10, affiches du 14/10, classement Ligue 1, éphéméride). `articleDuJour` = null.

## Nouveautés IA

- Google lance **Gemini 4 Argon** (13/10), son nouveau modèle de pointe : API payante via AI Studio, appli Gemini (abonnés Pro/Ultra), Antigravity (Ultra). Limite unifiée d'un million de tokens entrée+sortie, protocole de continuation pour les longues sorties. Prix de lancement 2 $/10 $ par million de tokens (entrée/sortie), cache −95 %, puis 4 $/20 $ après le 30 novembre. Benchmarks annoncés par Google (Vals Index n°1, ERQA 87 %). — [Introducing Gemini 4 Argon (blog.google)](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/)
- Simon Willison ajoute Argon à son outil `llm-gemini` 0.35 ; il rappelle que le prix double au 1er décembre et qu'Artificial Analysis chiffre son passage de benchmark à 2 407 $, moins cher que la plupart des modèles comparables. — [simonwillison.net](https://simonwillison.net/)
- Meta sort **Muse Wonder** et **Muse Wonder Full** (12/10), modèles propriétaires, ~1 M de tokens de contexte, entrées texte/image/audio/vidéo. Wonder dispo en API (`muse-wonder-1.0`, 4 $/20 $). Wonder Full seulement via les abonnements Muse Code (50 $ et 200 $/mois), en mode « Contributor » par défaut (données utilisables pour l'entraînement). Artificial Analysis : Wonder Full 56, Wonder 52, Claude Opus 5.5 en tête à 58. — [VentureBeat](https://venturebeat.com/technology/metas-new-muse-wonder-and-muse-wonder-full-models-achieve-frontier-performance-but-only-the-weaker-one-is-available-via-api)
- Anthropic raconte avoir construit son propre système de gestion de versions, **Scion** : les merges sont passés d'environ 2 500 par jour en mai à plus de 30 000 en septembre ; migration en cinq mois par une équipe de sept personnes (résumé de Simon Willison, 13/10). — [simonwillison.net](https://simonwillison.net/)
- Python 3.15 est sorti ; Simon Willison abandonne le support de 3.10 dans ses projets. — [simonwillison.net](https://simonwillison.net/)

## Football

- Scores du 13/10 (LdC, J2, fichier de données) : Lens 0-2 Sporting ; Arsenal 3-0 Lille ; Inter 3-4 Bruges ; Viking 3-3 Bayern ; Atlético 2-0 Manchester United ; Galatasaray 1-4 Barcelone ; Villarreal 3-1 Naples ; Leipzig 1-0 PSV ; Sabah 2-0 Slavia Prague.
- Ce soir (fichier de données, heures de Genève) : 18 h 45 Feyenoord–Côme, LASK–Liverpool ; 21 h Roma–Real Madrid, Manchester City–PSG, Aston Villa–Fenerbahçe, Betis–Porto, Shakhtar–AEK, Slovan Bratislava–Stuttgart, Bodø/Glimt–Dortmund.
- Classement Ligue 1 (fichier) : Monaco 14 pts, Lille 13, Rennes 13, OL 4e avec 11, Paris FC 11, PSG 11 (6 matchs).
- OL : Loïs Openda, fissure du péroné droit après le match contre Lens vendredi ; absent au moins un mois. Le club déplore le manque de protection du joueur. — [Lyonfoot](https://www.lyonfoot.com/article/14464/ol-fissure-du-perone-pour-lois-openda-le-joueur-indisponible-au-moins-un-mois)
- Real Madrid : premier déplacement de la phase de ligue au Stadio Olimpico, José Mourinho face à Gasperini ; la Roma est invaincue en match officiel cette saison, Donyell Malen meilleur buteur de Serie A ; deuxième match du Real en trois jours, Clásico en octobre. — [realmadrid.com](https://www.realmadrid.com/fr-FR/actualites/football/equipe-premiere/preliminaires/roma-real-madrid-regresa-la-champions-en-roma-14-10-2026)

- City–PSG (21 h) : PSG tenant du titre (deux fois), sans Senny Mayulu (cuisse, jusqu'à fin octobre) ; City effectif complet, six victoires en six matchs de Premier League ; Haaland 8 buts, Cherki 5, Ferran Torres 7 dont un triplé à la J1 ; Opta : City 44,1 %, nul 23,9 %, PSG 32 %. — [Al Jazeera](https://www.aljazeera.com/sports/2026/10/13/manchester-city-psg-champions-league-haaland-torres-predictions-teams)

## Politique

- France : l'Assemblée a rejeté mardi soir la motion de rejet préalable du PS sur le budget 2027, 236 voix contre 149. Le RN et le bloc central ont voté contre. Estelle Mercier (PS) : « sommation », accuse le gouvernement de refuser de taxer les plus riches. Roland Lescure : « esprit de compromis ». David Amiel : « budget de sauvegarde », ouvert sur « le comment » mais pas « le combien ». Sophie-Laurence Roy (RN) : budget mauvais pour les comptes et les travailleurs, le RN défendra ses priorités. Environ 43 Md€ d'économies supplémentaires, objectif déficit 5 % du PIB. Volet recettes débattu jusqu'à lundi. — [LCP](https://lcp.fr/actualites/la-motion-de-rejet-des-socialistes-n-ayant-pas-ete-adoptee-l-examen-du-budget-2027-aura) ; [France 24](https://www.france24.com/fr/france/20261013-budget-2027-debat-ouvert-assemblee-nationale-deficit-dette-retraites)
- Roland Lescure : « Il nous faut un budget d'ici la fin de l'année ». Kristalina Georgieva (FMI) : il faudra du temps à la France pour regagner « l'entière confiance » des marchés. — [Presse Évasion, revue du 14/10](https://www.presse-evasion.fr/article/revue-presse-14-10-2026)
- Suisse romande : aucune information des dernières 24-48 h vérifiable dans les sources de référence (pages RTS/TdG/Le Temps inaccessibles ou sans date). Les sujets trouvés (enquête sur le département de Pierre Maudet, budget genevois 2027, motion vaudoise de destitution) datent de plusieurs semaines voire mois → non retenus.
- Monde, Ukraine : vaste frappe russe dans la nuit, au moins neuf morts (dont trois à Kiev), plus d'un demi-million de personnes sans courant. Moscou dit avoir visé des sites d'énergie et de communication ; Zelensky accuse la Russie de violer la « trêve énergétique » annoncée par Donald Trump. Moscou dit avoir abattu 902 drones ukrainiens dans la nuit. — [Al Jazeera](https://www.aljazeera.com/news/2026/10/14/massive-russian-attack-on-ukraine-kills-at-least-six-cuts-power-in-kyiv)
- Monde, mer Noire : deux cargos attaqués par des drones au large de la Bulgarie, l'un a coulé ; le Premier ministre Roumen Radev parle d'une attaque « absolument inacceptable », sans preuve « solide » pour accuser, mais « la logique » suggère que cela profite à la Russie ; Sofia convoque l'ambassadrice russe. Pas de réaction russe citée. — [Meduza](https://meduza.io/en/news/2026/10/13/drones-attack-two-cargo-ships-off-bulgaria-s-coast-one-ukrainian-owned-sofia-plans-to-summon-russian-ambassador)

## Jeux vidéo

- Sorties de la semaine : Planet Zoo 2 et Valor Mortis (13/10), Warhammer 40,000 : Boltgun 2 (14/10), Castlevania : Belmont's Curse (15/10), Tenebris Somnia (16/10) ; PC, PS5, Xbox Series. — [jeuxvideo.com](https://www.jeuxvideo.com/jeux/sorties/annee-2026/mois-10/)
- Castlevania : Belmont's Curse — Evil Empire et Motion Twin (Dead Cells), édité par Konami, héroïne Rose Belmont, aussi sur Switch, 29,99 $. Famitsu : 8/8/8/8, soit 32/40. — [Nintendo Life](https://www.nintendolife.com/news/2026/10/the-first-review-for-castlevania-belmonts-curse-is-in)

- Planet Zoo 2 (Frontier Developments) : espèces aquatiques et volantes, zoo commercial ou réserve naturelle. — [Wikipedia](https://en.wikipedia.org/wiki/Planet_Zoo_2)
- ID@Xbox Showcase avec IGN le mardi 20 octobre à 19 h (heure d'Europe centrale) : 18 jeux, nombreuses premières ; seul titre confirmé : The Wolf Among Us Remastered. — [Pure Xbox](https://purexbox.com/news/2026/10/xbox-indie-showcase-to-highlight-18-games-this-month-including-tons-of-world-premieres)

## Cinéma (mercredi = sorties en salle)

- Les Misérables (Fred Cavayé ; Vincent Lindon, Tahar Rahim, Camille Cottin) ; Street Fighter (Kitao Sakurai ; Noah Centineo, Andrew Koji, Callina Liang) ; Malfaisante (Rob Savage ; Jessica Chastain) ; Englouti (Brian Duffield ; Josh Brolin, Elisabeth Shue) ; Minotaure (Andreï Zviaguintsev) ; Le Corset (Louis Clichy) ; Mochy (animation familiale) ; Petite Casbah (Antoine Colomb) ; Où vont les âmes (Brigitte Poupart, Monia Chokri). — [AlloCiné](https://www.allocine.fr/article/fichearticle_gen_carticle=1000226063.html)

## Culture générale

- Éphéméride (fichier) : 14 octobre 1670, première du Bourgeois gentilhomme de Molière à Chambord devant Louis XIV. Musique de Lully, ballets de Pierre Beauchamp, costumes turcs du chevalier d'Arvieux. Origine : l'envoyé du sultan Mehmed IV, Soliman Aga, aurait jugé le cheval du sultan plus richement paré que l'habit du roi ; Louis XIV voulait se moquer des « Turcs ». Molière jouait M. Jourdain ; réplique sur la prose « sans que j'en susse rien ». — [Wikipédia](https://fr.wikipedia.org/wiki/Le_Bourgeois_gentilhomme)
- Quiz : qui a composé la musique ? → Jean-Baptiste Lully.

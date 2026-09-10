Arnaud vient de courir. Tu écris un email en français qui **analyse sérieusement** la sortie
dans le contexte de son bloc marathon, et qui l'encourage.

1. Lis le fichier JSON indiqué par DOSSIER. Il contient : la sortie, les **splits au km**
   (allure, allure corrigée de la pente, FC, %LTHR, D+ par km), le **découplage cardiaque**,
   le dénivelé, la météo, les stats du jour, les 5 sorties précédentes, l'état du bloc, le
   journal et le contexte. N'appelle aucune API, tout est déjà là.

## RÈGLE ABSOLUE : aucune suggestion

Demande explicite d'Arnaud. Tu analyses et tu encourages, **tu ne conseilles rien**. Interdits :
- aucun plan, aucune séance, aucun "la prochaine fois essaie de..."
- aucune consigne d'allure, de FC, de volume, de fréquence
- aucun conseil de récup, d'étirement, de nutrition, de sommeil, de matériel
- aucun commentaire sur son calendrier : ses jours de course sont au feeling, ce n'est pas un sujet
- aucune mise en garde sur la blessure. Une donnée notable s'énonce comme un fait, sans "attention à".

Si tu as envie d'écrire un conseil, remplace-le par un constat.

## Profil (à utiliser, ne pas recalculer autrement)

- **LTHR 187** (allure seuil ≈ **3:57/km**), FC max 208. Raisonner en **% de LTHR**, jamais en
  % de FC max. Au-dessus de ~100 % LTHR = effort seuil ou plus.
- Dès qu'il y a du dénivelé, **l'allure corrigée de la pente (GAP) est la vraie référence** :
  une allure brute qui ralentit dans une bosse peut être un effort constant, voire en hausse.

## Ce que l'analyse DOIT couvrir

Sois précis et chiffré. Une analyse générique sur la moyenne de la sortie ne suffit pas :
la moyenne cache tout ce qui est intéressant.

1. **La sortie** : distance, allure, allure GAP si le D+ est notable, FC moyenne en %LTHR,
   chaleur si pertinente (il court à Nice) : utilise **`weather.apparent_c`** (le ressenti),
   c'est ce qui compte pour l'effort. Ignore `wrist_sensor_c_unreliable` : c'est le capteur du
   poignet, chauffé par la peau, il lit 28-33 °C quelle que soit la météo réelle.
2. **Les moments qui ressortent, en lisant `km_splits`** : le dernier km, le km le plus rapide,
   les kms en côte, une accélération ou une dérive de fin. **Un km nettement hors norme doit
   toujours être relevé et commenté** — c'est souvent le plus intéressant de la sortie
   (ex. finir sous l'allure seuil en montée après 20 km n'a rien d'anodin).
3. **Le découplage cardiaque, NOTÉ** (`decoupling`, `decoupling_rating`, `scales.decoupling`) :
   - dis en une phrase ce que la métrique mesure (durabilité aérobie), il ne la connaît pas ;
   - donne **la note** (`decoupling_rating.rating`) et **l'échelle** qui la justifie : < 3 %
     excellent, < 5 % bon, 5-10 % moyen, > 10 % élevé. Un chiffre sans barème ne lui apprend rien ;
   - sur terrain vallonné, la version GAP prime (`gap_pct`) ;
   - compare les deux moitiés (allure + FC) et dis s'il a fait un négatif split.
4. **« Est-ce que l'entraînement paie ? »** — section obligatoire, c'est sa question centrale.
   Appuie-toi sur `fitness` et sur la tendance du bloc, avec des chiffres :
   - **VO2max** maintenant vs au début du bloc (`vo2max_now`, `vo2max_block_start`, `vo2max_delta`) ;
   - **score d'endurance** Garmin et son palier, en citant les seuils (`endurance_score`,
     `endurance_thresholds` : intermediate / trained / well_trained / expert / superior) —
     dis dans quel palier il est ;
   - **temps de course prédits** par Garmin (`race_predictions`), en particulier le marathon ;
   - **facteur d'efficacité** (`efficiency_factor`, aussi présent sur `previous_runs`) : mètres
     par battement, à comparer à ses propres sorties récentes. En hausse à FC égale = la forme
     aérobie progresse. Explique-le en une demi-phrase, il ne connaît pas la métrique.
   - conclus franchement : est-ce que ça progresse, oui ou non, et sur quoi tu te bases.
   Ce n'est pas un conseil, c'est un constat chiffré — donc autorisé.
5. **Le bloc** : volume hebdo, allure à FC équivalente semaine après semaine, semaines restantes
   avant le marathon du 8/11.

N'invente jamais un barème : utilise `scales` et les seuils fournis dans le dossier.

## Forme

Écris `coach/state/out-run-<RUN_ID>.email.json` : `{ "subject", "html", "text" }`.

- Sujet : `Run {jj/mm} — {distance} en {allure}` + 3-5 mots de verdict.
- **350-450 mots.** Dense en chiffres, zéro remplissage. Tutoiement, chaleureux, direct.
- L'encouragement doit s'appuyer sur un chiffre réel, jamais sur une formule creuse.
- HTML en fragments (`<p>`, `<b>`, `<ul>`, `<table>`), sobre, lisible sur mobile, aucune image
  ni CSS externe. Fournis aussi une version `text`. Un petit tableau des kms marquants est bienvenu
  (pas les 21 lignes : ceux qui racontent quelque chose).
- Si `km_splits` ou `decoupling` sont vides/null (sortie trop courte, données manquantes),
  ne les invente pas : dis-le en une demi-phrase ou n'en parle pas.

Puis envoie : `node coach/send-mail.mjs coach/state/out-run-<RUN_ID>.email.json`
(ajoute `--dry-run` si DRY_RUN=1).

## Journal

Sauf si DRY_RUN=1, ajoute en fin de `coach/journal-runs.md` :

    ## {date} — {distance} en {allure}
    - Constat : <une ligne>
    - Découplage / forme : <une ligne>
    - Bloc : <une ligne>

Termine ta réponse par `OK <runId>` ou `FAILED <raison>`.

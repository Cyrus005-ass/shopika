# Shopika
Marketplace multi-boutiques pour l'Afrique francophone : les marchands ouvrent leur boutique, les clients paient en Mobile Money, l'argent reste en **séquestre** jusqu'à la livraison.
## Architecture
shopika/
├─ apps/
│  ├─ api/        API Express + Prisma (PostgreSQL) — déployée sur Vercel
│  │  ├─ src/
│  │  │  ├─ app.js, server.js
│  │  │  ├─ config/       lecture centralisée de l'environnement (URLs, tarifs, délais)
│  │  │  ├─ modules/      un dossier par domaine : <nom>/<nom>.routes.js (+ <nom>.service.js)
│  │  │  │               auth · stores · products · categories · orders · payments · marketplace
│  │  │  │               favorites · notifications · support · admin · cron · system
│  │  │  ├─ middleware/   auth, rôles, limitation de débit, erreurs
│  │  │  └─ lib/          briques réutilisables (escrow, e-mails, FedaPay, validateurs, abonnement…)
│  │  ├─ prisma/          schéma + migrations
│  │  ├─ scripts/         migrations (garde-fou), smoke-test, seed, set-password
│  │  └─ api/index.js     point d'entrée Vercel
│  ├─ web/        site client (HTML/JS statique) : landing, marketplace, boutiques, panier, commandes
│  ├─ merchant/   espace marchand (HTML/JS statique)
│  └─ admin/      espace admin (React + Vite + Tailwind)
├─ packages/
│  └─ shared/     source unique des fichiers communs (animations, kit de mise à jour sans interruption)
├─ scripts/       dev-all.js (tout lancer), sync-shared.js (copier packages/shared dans les apps)
├─ docs/          documentation (déploiement, thèmes, audit…)
└─ .github/       CI/CD
Chaque app est **indépendante** (son propre `package.json`, son propre déploiement). Les fichiers communs vivent dans `packages/shared/` et sont **copiés** dans chaque app par `npm run sync:shared` (les fronts statiques ne peuvent pas importer un dossier voisin une fois déployés). Le CI et les tests vérifient que les copies sont à jour.
## Démarrage
npm run install:all                     # dépendances de l'API et de l'admin
cp apps/api/.env.example apps/api/.env  # puis remplir (jamais committer .env)
npm --prefix apps/api run db:deploy     # migrations
npm run dev:all                         # API :4000 · site :8080 · marchand :5500
npm run dev:admin                       # admin (Vite)
npm test                                # tests de l'API
npm run sync:shared                     # après avoir modifié packages/shared/
## Déploiement Vercel (un projet par app)
| Projet | Root Directory |
|---|---|
| API | `apps/api` |
| Site client | `apps/web` |
| Espace marchand | `apps/merchant` |
| Admin | `apps/admin` |
Les tâches planifiées (`apps/api/vercel.json`) : `expire-orders` (minuit), `auto-confirm` (6 h), `subscription-reminders` (8 h). Définir `CRON_SECRET` : sans lui, les routes cron restent fermées.
## Variables d'environnement ajoutées
`AUTO_CONFIRM_DAYS` (7) · `PASSWORD_RESET_MINUTES` (30) · `FRONT_URL` (ou `CLIENT_APP_URL`) — voir `apps/api/.env.example`.
## Flux d'argent
Le client paie → fonds en séquestre → livraison confirmée (client, code de livraison, ou **confirmation automatique** après `AUTO_CONFIRM_DAYS` jours sans litige) → fonds libérés → versement Mobile Money au marchand par l'admin. Un litige bloque les fonds.
Plus de détails : `docs/` (déploiement sans interruption, thèmes boutique, journal d'audit).

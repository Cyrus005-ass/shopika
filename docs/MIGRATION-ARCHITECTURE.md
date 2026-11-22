# Passage à la nouvelle architecture

## Ce qui a bougé

| Avant | Après |
|---|---|
| `shopika-front/` | `apps/web/` |
| `SHOPIKA_marchand/` | `apps/merchant/` |
| `shopika-admin/` | `apps/admin/` |
| `src/`, `prisma/`, `api/`, `package.json`… (racine) | `apps/api/…` |
| `src/routes/<x>.routes.js` | `apps/api/src/modules/<x>/<x>.routes.js` |
| `deploy-kit/` | `packages/shared/` (+ `scripts/sync-shared.js`) |
| `scripts/*` (API) et `src/scripts/*` | `apps/api/scripts/` |
| `seed.js` (racine, identifiants en dur) | supprimé |
| `README.md`, `LISEZMOI.md`, `CHANGELOG-audit.md` | `README.md` (nouveau), `docs/` |

## À faire après avoir appliqué le patch

1. **Vercel** : pour chaque projet, Settings → General → *Root Directory* = `apps/api`, `apps/web`, `apps/merchant`, `apps/admin`.
2. **Secrets** : le `.env` du zip reçu contenait de vraies clés → les régénérer (base, JWT, Supabase, FedaPay, SMTP) et les remettre dans Vercel.
3. **Base de données** : une migration ajoute `store_orders.shipped_at` (ajout seul, compatible avec l'ancien code). Elle passe par `npm run db:deploy`. Le test « migrations déjà déployées » (`migration-baseline.json`) échouera tant que les migrations en attente ne sont pas déployées : après déploiement, `node apps/api/scripts/check-migrations.js --update-baseline`.
4. **Variables** : ajouter `CRON_SECRET` (obligatoire pour les crons) ; optionnel : `AUTO_CONFIRM_DAYS`, `PASSWORD_RESET_MINUTES`.
5. **GitHub Actions** : secrets inchangés, chemins déjà adaptés dans `.github/workflows/ci-cd.yml`.

# SHOPIKA — Plateforme de commerce (Backend + Frontends)

Projet monorepo contenant l'API backend et les trois frontends (client, admin, marchand).

## Aperçu des dossiers

| Dossier | Rôle | Technologie |
|---------|------|-------------|
| `.` (racine) | API backend + config globale | Node.js, Express 5, Prisma v6, Supabase/PostgreSQL |
| `shopika-front/` | Front client (vitrine, commande, compte) | HTML/JS vanilla, Tailwind |
| `shopika-admin/` | Interface d'administration | React, Vite, Tailwind |
| `SHOPIKA_marchand/` | Espace marchand (boutique, commandes) | HTML/JS vanilla |

## Prérequis

- Node.js >= 18
- PostgreSQL (local ou Supabase)
- Compte FedaPay (sandbox pour les tests, live pour la production)
- Serveur SMTP (pour les e-mails de vérification client)

---

## 1. API Backend (dossier racine / `src/`)

### Installation sur un nouveau PC

```powershell
# 1. Cloner le dépôt
git clone https://github.com/Cyrus005-ass/shopika.git
cd shopika

# 2. Installer les dépendances
npm install

# 3. Générer le client Prisma
npx prisma generate

# 4. Appliquer les migrations de base de données
npx prisma migrate deploy

# 5. Configurer les variables d'environnement
# Copier .env.example vers .env et remplir les valeurs :
copy .env.example .env
# Puis éditer .env avec DATABASE_URL, JWT_SECRET, etc.

# 6. Lancer l'API en local
npm run dev
# ? http://localhost:4000
```

### Scripts disponibles

| Script | Rôle |
|--------|------|
| `npm run dev` | Lance l'API en local sur le port 4000 |
| `npm start` | Idem (production classique) |
| `npm run vercel-build` | Génère Prisma pour le déploiement Vercel |
| `npm run db:deploy` | Applique les migrations Prisma |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run typecheck` | Valide le schéma Prisma |

### Variables d'environnement (`.env`)

Voir `.env.example` pour la liste complète. Les principales :

- `DATABASE_URL` — Chaîne de connexion PostgreSQL (Supabase pooler ou direct)
- `JWT_SECRET` — Clé secrète pour signer les tokens JWT
- `CORS_ORIGINS` — Origènes autorisées (ex: `http://localhost:5173,https://shopika-admin.vercel.app`)
- `FEDAPAY_ENV`, `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_SECRET_KEY` — Clés FedaPay (sandbox ou live)
- `FEDAPAY_WEBHOOK_SECRET` — Secret du webhook FedaPay (configuré dans le dashboard FedaPay)
- `FRONT_URL` — URL du front client (ex: `http://localhost:3000`) pour les liens de vérification e-mail
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — Configuration e-mail
- `CRON_SECRET` — Secret pour protéger la route `/api/cron/expire-orders`
- `ORDER_PAYMENT_TTL_MINUTES` — Délai avant annulation des commandes non payées (défaut 60)

> **Ne jamais committer le fichier `.env`.** Utilisez `.env.example` comme modèle.

### Routes principales

| Groupe | Routes |
|--------|--------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `POST /auth/resend-code`, `POST /auth/create-first-admin`, `POST /auth/create-admin`, `GET /auth/admin-exists`, `PATCH /auth/me`, `POST /auth/change-password`, `POST /auth/become-merchant` |
| Boutiques | `GET /stores/search`, `GET /stores/me`, `GET /stores/me/subscription`, `POST /stores/me/subscription/pay`, `GET /stores/:subdomain` |
| Produits | `GET /products`, `GET /products/:id`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` |
| Commandes | `POST /orders`, `GET /orders/my`, `GET /orders`, `PATCH /orders/:id/ship`, `POST /orders/:id/confirm`, `POST /orders/:id/dispute` |
| Paiements | `POST /payments/orders/:orderId/pay`, `POST /payments/webhook` |
| Admin | `GET /admin/overview`, `GET /admin/payouts/pending`, `POST /admin/payouts/:id`, `GET /admin/disputes`, `PATCH /admin/disputes/:id/resolve`, `GET /admin/stores`, `PATCH /admin/stores/:id/suspend`, `PATCH /admin/stores/:id/reactivate`, `GET /admin/audit` |
| Cron | `GET /cron/expire-orders` (protégé par `CRON_SECRET`) |

### Santé de l'API

```powershell
curl http://localhost:4000/api/health
# ? { "ok": true, "time": "..." }
```

---

## 2. Front Client (`shopika-front/`)

Site vitrine public + espace client connecté. Aucune dépendance npm (site statique HTML/JS).

### Lancer en local

```powershell
cd shopika-front
python3 -m http.server 8080
# ou : npx serve .
# Puis ouvrir : http://localhost:8080/index.html
```

### Configuration

Le fichier `shopika-front/js/config.js` détecte automatiquement l'URL de l'API :
- `localhost` / `127.0.0.1` ? `http://localhost:4000/api`
- Autre ? `https://shopika-api-indol.vercel.app/api`

### Pages

| Page | Rôle |
|------|------|
| `index.html` | Accueil / Marketplace |
| `marketplace.html` | Liste des boutiques |
| `produit.html` | Détail produit |
| `boutique.html` | Page d'une boutique |
| `inscription.html` | Création de compte client |
| `verify.html` | Vérification du code e-mail (lien depuis l'email) |
| `connexion.html` | Connexion client |
| `app/` | Espace client connecté (dashboard, profil, panier, commandes, favoris) |

---

## 3. Interface Admin (`shopika-admin/`)

Application React (Vite) pour l'administration de la plateforme.

### Lancer en local

```powershell
cd shopika-admin
npm install
npm run dev
# ? http://localhost:5173
```

### Premier lancement

Si aucun administrateur n'existe dans la base de données, vous arrivez automatiquement sur `/setup` pour créer le **premier compte admin**. Une fois créé, cette page devient inaccessible et vous êtes redirigé vers `/login`.

Un admin existant peut créer d'autres admins via la page `/admin/create`.

### Scripts

| Script | Rôle |
|--------|------|
| `npm run dev` | Serveur de développement Vite (port 5173) |
| `npm run build` | Build de production |
| `npm run preview` | Aperçu du build de production |

---

## 4. Espace Marchand (`SHOPIKA_marchand/`)

Espace dédié aux marchands (connexion, création de boutique, gestion des commandes).

### Lancer en local

```powershell
cd SHOPIKA_marchand
npx serve .
# ? http://localhost:5000 (ou autre selon npx serve)
```

### Configuration

`SHOPIKA_marchand/config.js` détecte automatiquement l'URL de l'API :
- `localhost` / `127.0.0.1` ? `http://localhost:4000/api`
- Autre ? `https://shopika-api-indol.vercel.app/api`

---

## 5. Déploiement

### API sur Vercel

Le fichier `api/index.js` expose `src/app.js` en mode serverless (sans `.listen()`). Vercel gère l'écoute réseau.

```bash
vercel --prod
```

### Frontends sur Vercil

Chaque frontend est un site statique déployable indépendamment sur Vercel.

---

## 6. Test du parcours complet (local)

1. **API** : `npm run dev` sur `http://localhost:4000`
2. **Admin** : `npm run dev` dans `shopika-admin/` sur `http://localhost:5173`
3. **Client** : `python3 -m http.server 8080` dans `shopika-front/` sur `http://localhost:8080`
4. **Marchand** : `npx serve .` dans `SHOPIKA_marchand/`

### Parcours admin

1. Ouvrir `http://localhost:5173/` ? redirection vers `/setup` si aucun admin
2. Créer le premier admin (nom, téléphone, mot de passe)
3. Se connecter sur `/login`
4. Créer d'autres admins via `/admin/create`

### Parcours client

1. Ouvrir `http://localhost:8080/inscription.html`
2. S'inscrire (prénom, nom, e-mail, mot de passe)
3. Le code de vérification s'affiche dans la console du serveur API (mode dev sans SMTP) ou arrive par e-mail
4. Ouvrir le lien `verify.html?email=...&code=...` ou saisir le code sur `verify.html`
5. Se connecter sur `connexion.html`

### Parcours marchand

1. Ouvrir l'espace marchand en local
2. S'inscrire en tant que marchand (téléphone, nom de boutique, sous-domaine)
3. Le compte devient marchand et peut créer sa boutique

---

## 7. Fichiers supprimés (nettoyage)

Les fichiers suivants ont été supprimés car ils ne servent pas au projet :

- `admin.err.txt`, `admin.out.txt`, `api.err.txt`, `api.err2.txt`, `api.error.log`, `api.log`, `api.out.txt`, `api.out2.txt` — logs de débogage temporaires
- `debug.js` — script de débogage temporaire
- `test_api.js`, `test_merchant.js` — scripts de test temporaires
- `vercel.json.bak` — sauvegarde obsolète
- `SHOPIKA_marchand/test.txt` — fichier test inutile

---

## 8. Sécurité

- Ne jamais committer `.env`
- `CRON_SECRET` doit être une chaîne aléatoire longue : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Les webhooks FedaPay sont vérifiés par signature (`X-FEDAPAY-SIGNATURE`)
- Le JWT contient `{ id, role, tokenVersion }` et est vérifié à chaque requête authentifiée

---

## 9. Licence

ISC
# SHOPIKA � Plateforme de commerce (Backend + Frontends)

Projet monorepo contenant l'API backend et les trois frontends (client, admin, marchand).

## Aper�u des dossiers

| Dossier | R�le | Technologie |
|---------|------|-------------|
| `.` (racine) | API backend + config globale | Node.js, Express 5, Prisma v6, Supabase/PostgreSQL |
| `shopika-front/` | Front client (vitrine, commande, compte) | HTML/JS vanilla, Tailwind |
| `shopika-admin/` | Interface d'administration | React, Vite, Tailwind |
| `SHOPIKA_marchand/` | Espace marchand (boutique, commandes) | HTML/JS vanilla |

## Pr�requis

- Node.js >= 18
- PostgreSQL (local ou Supabase)
- Compte FedaPay (sandbox pour les tests, live pour la production)
- Serveur SMTP (pour les e-mails de v�rification client)

---

## 1. API Backend (dossier racine / `src/`)

### Installation sur un nouveau PC

```powershell
# 1. Cloner le d�p�t
git clone https://github.com/Cyrus005-ass/shopika.git
cd shopika

# 2. Installer les d�pendances
npm install

# 3. G�n�rer le client Prisma
npx prisma generate

# 4. Appliquer les migrations de base de donn�es
npx prisma migrate deploy

# 5. Configurer les variables d'environnement
# Copier .env.example vers .env et remplir les valeurs :
copy .env.example .env
# Puis �diter .env avec DATABASE_URL, JWT_SECRET, etc.

# 6. Lancer l'API en local
npm run dev
# ? http://localhost:4000
```

### Scripts disponibles

| Script | R�le |
|--------|------|
| `npm run dev` | Lance l'API en local sur le port 4000 |
| `npm run dev:all` | Lance l'API, l'admin, le front client et l'espace marchand |
| `npm start` | Idem (production classique) |
| `npm run vercel-build` | G�n�re Prisma pour le d�ploiement Vercel |
| `npm run db:deploy` | Applique les migrations Prisma |
| `npm run lint` | V�rifie le code avec ESLint |
| `npm run typecheck` | Valide le sch�ma Prisma |

### Variables d'environnement (`.env`)

Voir `.env.example` pour la liste compl�te. Les principales :

- `DATABASE_URL` � Cha�ne de connexion PostgreSQL (Supabase pooler ou direct)
- `JWT_SECRET` � Cl� secr�te pour signer les tokens JWT
- `CORS_ORIGINS` � Orig�nes autoris�es (ex: `http://localhost:5173,https://shopika-admin.vercel.app`)
- `FEDAPAY_ENV`, `FEDAPAY_PUBLIC_KEY`, `FEDAPAY_SECRET_KEY` � Cl�s FedaPay (sandbox ou live)
- `FEDAPAY_WEBHOOK_SECRET` � Secret du webhook FedaPay (configur� dans le dashboard FedaPay)
- `FRONT_URL` � URL du front client (ex: `http://localhost:3000`) pour les liens de v�rification e-mail
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` � Configuration e-mail
- `CRON_SECRET` � Secret pour prot�ger la route `/api/cron/expire-orders`
- `ORDER_PAYMENT_TTL_MINUTES` � D�lai avant annulation des commandes non pay�es (d�faut 60)

> **Ne jamais committer le fichier `.env`.** Utilisez `.env.example` comme mod�le.

### Routes principales

| Groupe | Routes |
|--------|--------|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `POST /auth/resend-code`, `POST /auth/create-first-admin`, `POST /auth/create-admin`, `GET /auth/admin-exists`, `PATCH /auth/me`, `POST /auth/change-password`, `POST /auth/become-merchant` |
| Boutiques | `GET /stores/search`, `GET /stores/me`, `GET /stores/me/subscription`, `POST /stores/me/subscription/pay`, `GET /stores/:subdomain` |
| Produits | `GET /products`, `GET /products/:id`, `POST /products`, `PATCH /products/:id`, `DELETE /products/:id` |
| Commandes | `POST /orders`, `GET /orders/my`, `GET /orders`, `PATCH /orders/:id/ship`, `POST /orders/:id/confirm`, `POST /orders/:id/dispute` |
| Paiements | `POST /payments/orders/:orderId/pay`, `POST /payments/webhook` |
| Admin | `GET /admin/overview`, `GET /admin/payouts/pending`, `POST /admin/payouts/:id`, `GET /admin/disputes`, `PATCH /admin/disputes/:id/resolve`, `GET /admin/stores`, `PATCH /admin/stores/:id/suspend`, `PATCH /admin/stores/:id/reactivate`, `GET /admin/audit` |
| Cron | `GET /cron/expire-orders` (prot�g� par `CRON_SECRET`) |

### Sant� de l'API

```powershell
curl http://localhost:4000/api/health
# ? { "ok": true, "time": "..." }
```

---

## 2. Front Client (`shopika-front/`)

Site vitrine public + espace client connect�. Aucune d�pendance npm (site statique HTML/JS).

### Lancer en local

```powershell
npm run dev:all
# Puis ouvrir : http://localhost:3000
```

### Configuration

Le fichier `shopika-front/js/config.js` d�tecte automatiquement l'URL de l'API :
- `localhost` / `127.0.0.1` ? `http://localhost:4000/api`
- Autre ? `https://shopika-api-indol.vercel.app/api`

### Pages

| Page | R�le |
|------|------|
| `index.html` | Accueil / Marketplace |
| `marketplace.html` | Liste des boutiques |
| `produit.html` | D�tail produit |
| `boutique.html` | Page d'une boutique |
| `inscription.html` | Cr�ation de compte client |
| `verify.html` | V�rification du code e-mail (lien depuis l'email) |
| `connexion.html` | Connexion client |
| `app/` | Espace client connect� (dashboard, profil, panier, commandes, favoris) |

---

## 3. Interface Admin (`shopika-admin/`)

Application React (Vite) pour l'administration de la plateforme.

### Lancer en local

```powershell
npm run dev:all
# Puis ouvrir : http://localhost:5173
```

Pour lancer uniquement l'admin : `npm run dev` dans `shopika-admin/`.

### Premier lancement

Si aucun administrateur n'existe dans la base de donn�es, vous arrivez automatiquement sur `/setup` pour cr�er le **premier compte admin**. Une fois cr��, cette page devient inaccessible et vous �tes redirig� vers `/login`.

Un admin existant peut cr�er d'autres admins via la page `/admin/create`.

### Scripts

| Script | R�le |
|--------|------|
| `npm run dev` | Serveur de d�veloppement Vite (port 5173) |
| `npm run build` | Build de production |
| `npm run preview` | Aper�u du build de production |

---

## 4. Espace Marchand (`SHOPIKA_marchand/`)

Espace d�di� aux marchands (connexion, cr�ation de boutique, gestion des commandes).

### Lancer en local

```powershell
npm run dev:all
# Puis ouvrir : http://localhost:5500
```

### Configuration

`SHOPIKA_marchand/config.js` d�tecte automatiquement l'URL de l'API :
- `localhost` / `127.0.0.1` ? `http://localhost:4000/api`
- Autre ? `https://shopika-api-indol.vercel.app/api`

---

## 5. D�ploiement

### API sur Vercel

Le fichier `api/index.js` expose `src/app.js` en mode serverless (sans `.listen()`). Vercel g�re l'�coute r�seau.

```bash
vercel --prod
```

### Frontends sur Vercil

Chaque frontend est un site statique d�ployable ind�pendamment sur Vercel.

---

## 6. Test du parcours complet (local)

Pour lancer l'API, l'admin, le front client et l'espace marchand depuis la
racine, exécutez :

```powershell
npm run dev:all
```

Le script génère automatiquement le client Prisma avant de démarrer les services.
Ils sont disponibles sur `http://localhost:4000` (API),
`http://localhost:5173` (admin), `http://localhost:3000` (client) et
`http://localhost:5500` (marchand). Les frontends sont servis sans cache.
Si le port client ou marchand est occupé ou bloqué, le lanceur essaie les ports
suivants et affiche l'adresse retenue. Arrêtez les services avec `Ctrl+C`.

1. **API** : `npm run dev` sur `http://localhost:4000`
2. **Admin** : `npm run dev` dans `shopika-admin/` sur `http://localhost:5173`
3. **Client** : `http://localhost:3000`
4. **Marchand** : `http://localhost:5500`

### Parcours admin

1. Ouvrir `http://localhost:5173/` ? redirection vers `/setup` si aucun admin
2. Cr�er le premier admin (nom, t�l�phone, mot de passe)
3. Se connecter sur `/login`
4. Cr�er d'autres admins via `/admin/create`

### Parcours client

1. Ouvrir `http://localhost:3000/inscription.html`
2. S'inscrire (pr�nom, nom, e-mail, mot de passe)
3. Le code de v�rification s'affiche dans la console du serveur API (mode dev sans SMTP) ou arrive par e-mail
4. Ouvrir le lien `verify.html?email=...&code=...` ou saisir le code sur `verify.html`
5. Se connecter sur `connexion.html`

### Parcours marchand

1. Ouvrir l'espace marchand en local
2. S'inscrire en tant que marchand (t�l�phone, nom de boutique, sous-domaine)
3. Le compte devient marchand et peut cr�er sa boutique

---

## 7. Fichiers supprim�s (nettoyage)

Les fichiers suivants ont �t� supprim�s car ils ne servent pas au projet :

- `admin.err.txt`, `admin.out.txt`, `api.err.txt`, `api.err2.txt`, `api.error.log`, `api.log`, `api.out.txt`, `api.out2.txt` � logs de d�bogage temporaires
- `debug.js` � script de d�bogage temporaire
- `test_api.js`, `test_merchant.js` � scripts de test temporaires
- `vercel.json.bak` � sauvegarde obsol�te
- `SHOPIKA_marchand/test.txt` � fichier test inutile

---

## 8. S�curit�

- Ne jamais committer `.env`
- `CRON_SECRET` doit �tre une cha�ne al�atoire longue : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Les webhooks FedaPay sont v�rifi�s par signature (`X-FEDAPAY-SIGNATURE`)
- Le JWT contient `{ id, role, tokenVersion }` et est v�rifi� � chaque requ�te authentifi�e

---

## 9. Licence

ISC
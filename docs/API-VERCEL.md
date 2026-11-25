# SHOPIKA — API Backend

Backend unique de la plateforme Shopika. C'est le seul point d'accès à la base de données. Aucune autre application ne touche directement à PostgreSQL ; tout passe par cette API en JSON par-dessus HTTP.

## Stack technique

| Rôle | Choix |
|------|-------|
| Serveur HTTP | Node.js + Express 5 |
| Base de données | PostgreSQL (Supabase) |
| ORM | Prisma v6 |
| Authentification | JWT + bcrypt (double schéma : téléphone pour marchand/admin, e-mail pour client) |
| Paiements | FedaPay (encaissement Mobile Money + carte, payouts marchand) |
| Stockage fichiers | Supabase Storage (bucket `product-images`) |
| E-mail | SMTP générique via nodemailer |

## Installation sur un nouveau PC

```powershell
# 1. Cloner le dépôt (à la racine du projet)
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
# → http://localhost:4000
```

## Scripts disponibles

| Script | Rôle |
|--------|------|
| `npm run dev` | Lance l'API en local sur le port 4000 (`src/server.js`) |
| `npm start` | Idem (serveur classique) |
| `npm run vercel-build` | Génère Prisma pour le déploiement Vercel |
| `npm run db:deploy` | Applique les migrations Prisma |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run typecheck` | Valide le schéma Prisma |

## Point d'entrée

- **Local** : `src/server.js` — appelle `.listen()` sur le port défini par `PORT` (défaut 4000)
- **Vercel (serverless)** : `api/index.js` — expose `src/app.js` sans appeler `.listen()` (Vercel gère l'écoute réseau)

## Variables d'environnement (`.env`)

Voir `.env.example` pour la liste complète avec exemples commentés.

### Principales variables

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL | `postgresql://user:pass@host:port/db?pgbouncer=true` |
| `JWT_SECRET` | Clé secrète pour signer les tokens JWT | `votre_cle_secrete_tres_longue` |
| `PORT` | Port d'écoute en local | `4000` |
| `CORS_ORIGINS` | Origènes autorisées (séparées par des virgules) | `http://localhost:5173,https://shopika-admin.vercel.app` |
| `FEDAPAY_ENV` | Environnement FedaPay | `sandbox` ou `live` |
| `FEDAPAY_PUBLIC_KEY` | Clé publique FedaPay | `pk_sandbox_...` ou `pk_live_...` |
| `FEDAPAY_SECRET_KEY` | Clé secrète FedaPay | `sk_sandbox_...` ou `sk_live_...` |
| `FEDAPAY_WEBHOOK_SECRET` | Secret du webhook FedaPay | `wh_sandbox_...` ou `wh_live_...` |
| `FRONT_URL` | URL du front client (liens de vérification e-mail) | `http://localhost:3000` |
| `SMTP_HOST` | Serveur SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP | `587` ou `465` |
| `SMTP_USER` | Identifiant SMTP | `votre@email.com` |
| `SMTP_PASS` | Mot de passe SMTP / mot de passe d'application | `...` |
| `SMTP_FROM` | Adresse expéditrice | `"Shopika <no-reply@shopika.app>"` |
| `CRON_SECRET` | Secret pour protéger `/api/cron/expire-orders` | Générer avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ORDER_PAYMENT_TTL_MINUTES` | Délai avant annulation des commandes non payées | `60` |
| `SUPABASE_URL` | URL du projet Supabase | `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Clé de service Supabase | `sb_secret_...` |

> **Ne jamais committer le fichier `.env`.** Utilisez `.env.example` comme modèle.

## Routes principales

### Authentification (`/api/auth`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/register` | POST | Inscription (téléphone = marchand, e-mail = client avec vérification) | Public |
| `/login` | POST | Connexion (téléphone ou e-mail + mot de passe) | Public |
| `/verify-email` | POST | Vérification du code à 6 chiffres | Public |
| `/resend-code` | POST | Renvoyer le code de vérification | Public |
| `/admin-exists` | GET | Vérifie si un admin existe déjà | Public |
| `/create-first-admin` | POST | Crée le premier administrateur | Public (bloqué si admin existe) |
| `/create-admin` | POST | Crée un autre administrateur | Admin uniquement |
| `/me` | PATCH | Modifier le profil connecté | Authentifié |
| `/change-password` | POST | Changer le mot de passe | Authentifié |
| `/become-merchant` | POST | Passer client → marchand + créer boutique | Authentifié client |

### Boutiques (`/api/stores`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/search?q=` | GET | Recherche boutiques publiées | Public |
| `/me` | GET | Ma boutique (marchand connecté) | Authentifié |
| `/me/subscription` | GET | Abonnement de ma boutique | Authentifié |
| `/me/subscription/pay` | POST | Payer l'abonnement boutique | Authentifié |
| `/:subdomain` | GET | Page publique d'une boutique | Public |

### Produits (`/api/products`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/` | GET | Liste des produits | Public |
| `/search?category=&q=` | GET | Recherche produits | Public |
| `/store/:subdomain` | GET | Produits d'une boutique | Public |
| `/public/:id` | GET | Produit public | Public |
| `/` | POST | Créer un produit | Marchand (sa boutique) |
| `/:id` | PATCH | Modifier un produit | Marchand (sa boutique) |
| `/:id` | DELETE | Supprimer un produit | Marchand (sa boutique) |
| `/upload-image` | POST | Upload image produit | Marchand |

### Commandes (`/api/orders`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/` | POST | Créer une commande | Client authentifié |
| `/my` | GET | Mes commandes | Client authentifié |
| `/` | GET | Toutes les commandes | Admin |
| `/:id/ship` | PATCH | Marquer comme expédié | Marchand |
| `/:id/confirm` | POST | Confirmer réception (client) | Client |
| `/:id/confirm-with-code` | POST | Confirmer avec code de livraison | Livre |
| `/:id/dispute` | POST | Ouvrir un litige | Client |

### Paiements (`/api/payments`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/orders/:orderId/pay` | POST | Créer le lien de paiement FedaPay | Client authentifié |
| `/webhook` | POST | Webhook FedaPay (commandes + abonnements) | FedaPay uniquement |

### Admin (`/api/admin`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/overview` | GET | Tableau de bord admin | Admin |
| `/payouts/pending` | GET | Versements en attente | Admin |
| `/payouts/:id` | POST | Effectuer un versement marchand | Admin |
| `/refunds/pending` | GET | Remboursements en attente | Admin |
| `/refunds/:id` | POST | Effectuer un remboursement client | Admin |
| `/disputes` | GET | Liste des litiges | Admin |
| `/disputes/:id/resolve` | PATCH | Arbitrer un litige | Admin |
| `/stores` | GET | Toutes les boutiques | Admin |
| `/stores/:id/suspend` | PATCH | Suspendre une boutique | Admin |
| `/stores/:id/reactivate` | PATCH | Réactiver une boutique | Admin |
| `/users` | GET | Tous les utilisateurs | Admin |
| `/users/:id/active` | PATCH | Activer/désactiver un compte | Admin |
| `/audit` | GET | Journal d'audit | Admin |

### Cron (`/api/cron`)
| Route | Méthode | Description | Accès |
|-------|---------|-------------|-------|
| `/expire-orders` | GET | Annuler les commandes non payées | Protégé par `CRON_SECRET` |

## Santé de l'API

```powershell
curl http://localhost:4000/api/health
# → { "ok": true, "time": "..." }
```

## Déploiement sur Vercel

```bash
vercel --prod
```

Les variables d'environnement doivent être configurées dans le dashboard Vercel (Settings → Environment Variables).

## Sécurité

- Les webhooks FedaPay sont vérifiés par signature (`X-FEDAPAY-SIGNATURE`) sur le corps brut de la requête.
- Le JWT contient `{ id, role, tokenVersion }` et est vérifié à chaque requête authentifiée.
- Un compte désactivé (`isActive = false`) est refusé immédiatement.
- Anti force-brute : 8 échecs de mot de passe → compte verrouillé 15 min.
- CORS piloté par `CORS_ORIGINS` (liste blanche en production).
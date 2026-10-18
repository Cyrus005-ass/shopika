# SHOPIKA_api

Backend unique de la plateforme **Shopika**. Ce service est le **seul point d'accès à la base de données** du projet — aucune autre application (`SHOPIKA_marchand`, `SHOPIKA_clients`, futur espace admin) ne touche directement à Postgres, tout passe par cette API en JSON par-dessus HTTP.

```
SHOPIKA_marchand  ──┐
                     ├──►  SHOPIKA_api (ce dépôt)  ──►  Supabase (PostgreSQL)
SHOPIKA_clients   ──┤                                ──►  FedaPay (paiements, payouts)
espace admin      ──┘                                ──►  SMTP (e-mails de vérification)
(site séparé)
```

---

## Stack technique

| Rôle | Choix |
|---|---|
| Serveur HTTP | Node.js + Express, exécutable soit en serveur classique (`src/server.js`), soit en fonction serverless (`api/index.js`, pour Vercel) — voir section Déploiement |
| Base de données | PostgreSQL (Supabase) |
| ORM | Prisma v6 (figé volontairement, voir note en fin de doc) |
| Authentification | JWT + bcrypt, **double schéma** : téléphone (marchand/admin) ou e-mail (client) — voir section Authentification |
| Paiements | FedaPay — encaissement (Mobile Money + carte) et payouts marchand |
| Stockage fichiers | Supabase Storage (bucket `product-images`) |
| E-mail | SMTP générique via nodemailer (code de vérification client) |

---

## Structure du projet

```
SHOPIKA_api/
├── api/
│   └── index.js            # Point d'entrée serverless (Vercel)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app.js               # L'application Express (routes + middlewares), sans .listen()
│   ├── server.js             # Point d'entrée LOCAL uniquement (npm run dev) — appelle .listen()
│   ├── lib/
│   │   ├── prisma.js         # Instance Prisma partagée
│   │   ├── supabase.js       # Client Supabase Storage
│   │   ├── whatsapp.js       # Génération de liens "cliquer pour discuter"
│   │   ├── fedapay.js        # Transactions, lien de paiement, payouts
│   │   ├── email.js          # Envoi du code de vérification par e-mail
│   │   ├── notify.js         # Création de notifications in-app (notify, notifyAdmins)
│   │   ├── subscription.js   # Logique d'abonnement boutique (voir plus bas)
│   │   └── http.js           # sendError() — réponses d'erreur uniformisées
│   ├── middleware/
│   │   ├── auth.js           # requireAuth — vérifie le token JWT
│   │   └── requireRole.js    # requireRole('admin' | 'marchand' | 'client')
│   ├── routes/
│   │   ├── auth.routes.js         # Inscription/connexion (double schéma), profil, mot de passe
│   │   ├── stores.routes.js       # CRUD boutique, recherche marketplace, abonnement
│   │   ├── products.routes.js     # CRUD produits, upload image, recherche marketplace
│   │   ├── categories.routes.js
│   │   ├── orders.routes.js       # Commandes multi-boutiques + Escrow
│   │   ├── payments.routes.js     # Encaissement FedaPay + webhook (commandes ET abonnements)
│   │   ├── admin.routes.js        # Payouts, litiges, support, vue d'ensemble boutiques
│   │   ├── support.routes.js      # Marchand → support Shopika
│   │   ├── notifications.routes.js
│   │   └── favorites.routes.js
│   └── scripts/
│       └── set-password.js  # Utilitaire CLI pour définir un mot de passe (comptes de test)
├── .env / .env.example
├── vercel.json               # Config de déploiement serverless
└── package.json
```

---

## Modèle de données

### Utilisateurs

**`User`** — un compte unique pour tout le monde (`role` : `client` | `marchand` | `admin`).
- Les comptes **marchand/admin** se connectent par **téléphone**.
- Les comptes **client** se connectent par **e-mail**, avec vérification par code à 6 chiffres.
- `firstName`/`lastName` (client) coexistent avec `fullName` (les deux rôles).
- `address`, `city`, `country`, `twoFactorOn` : profil éditable par le compte lui-même.

### Boutiques

**`Store`** — 1-à-1 avec un `User` marchand. Contient l'identité visuelle (thème, couleurs, logo), `city`/`country`/`description`/`rating`/`shippingFee` (affichage marketplace), les coordonnées de versement (`payoutPhone`, `payoutCountry`), et l'état d'abonnement (voir ci-dessous).

**`Category`** — globale à la plateforme (pas propre à une boutique), auto-référencée pour les sous-catégories.

**`Product`** — `price`/`promoPrice` en `Decimal`, sérialisés en chaîne dans le JSON (`parseFloat()` côté frontend). `images` est un tableau d'URLs.

### Abonnement boutique

Créer une boutique n'est pas gratuit indéfiniment : la boutique doit être payée (frais de création la première fois, réabonnement mensuel ensuite) pour rester visible et fonctionnelle.

- `Store.subscriptionStatus` : `en_attente_paiement` → `active` → `suspendu` (indicatif, voir plus bas)
- `Store.subscriptionExpiresAt` : **la seule vraie source de vérité**. Une boutique est active si et seulement si `subscriptionExpiresAt > maintenant`.
- Il n'y a **aucune tâche planifiée (cron)** qui "suspend" une boutique : chaque lecture qui compte (marketplace, catalogue produits, création de commande) compare directement `subscriptionExpiresAt` à l'instant présent. Résultat : la suspension et la réactivation sont automatiques, précises à la seconde ("jour pour jour, heure pour heure"), et fonctionnent pareil sur n'importe quel hébergeur, avec ou sans cron.
- Le paiement (`POST /api/stores/me/subscription/pay`) prolonge toujours `subscriptionExpiresAt` d'exactement un mois calendaire à partir de la date d'expiration actuelle si l'abonnement est encore actif (renouvellement anticipé = pas de jours perdus), ou à partir de maintenant sinon.
- **Exception ponctuelle** : la toute première boutique créée sur l'ensemble de la plateforme (détecté via `prisma.store.count() === 0` au moment de `become-merchant`) est activée automatiquement pour 100 ans, sans paiement — pratique pour tester le parcours complet. Toute boutique suivante suit le circuit normal. Supprimable depuis l'API admin via `DELETE /api/admin/stores/:id` **uniquement tant que la boutique n'a aucun historique** (commande ou paiement d'abonnement) ; sinon l'API répond 409 et il faut la **suspendre**. Le compte marchand n'est jamais supprimé et peut recréer une boutique normalement.
- **Suspension admin** (`Store.isSuspended`) : une boutique suspendue disparaît de la marketplace et ne peut plus recevoir de commandes, même avec un abonnement valide. Ses commandes en cours, escrows et historique restent intacts. Réversible (`PATCH /api/admin/stores/:id/reactivate`).
- Toute la logique est centralisée dans `src/lib/subscription.js` (`isStoreActive()` et `activeStoreWhere()` pour les filtres Prisma : abonnement non expiré **et** non suspendue).

### Commandes et Escrow

Une commande peut contenir des produits de plusieurs boutiques (panier mixte). 3 tables :
- **`Order`** — le panier global, + statut de **paiement** (`paymentStatus`, `fedapayTransactionId`, `paidAt`)
- **`StoreOrder`** — une sous-commande par boutique, avec son propre statut de livraison, d'escrow, ET de **payout** (`payoutStatus`, `fedapayPayoutId`, `paidOutAt`)
- **`OrderItem`** — détail produit/quantité

**Statuts commande (`OrderStatus`)** : `en_attente` → `confirmee` → `expediee` → `livree`/`terminee`, ou `litige`/`annulee`.
**Statuts escrow (`EscrowStatus`)** : `bloque` → `libere`/`rembourse`.
**Statuts paiement (`PaymentStatus`)** : `en_attente` → `payee`/`echouee`/`remboursee`.
**Statuts payout (`PayoutStatus`)** : `en_attente` → `effectue`/`echoue`.

### Autres tables

- **`Notification`** — notifications in-app (nouvelle commande, expédition, litige, versement, réponse support...)
- **`SupportMessage`** — suggestions/demandes du marchand vers le support Shopika, avec réponse admin
- **`Favorite`** — produits favoris d'un client

---

## Authentification — double schéma

| | Marchand / Admin | Client |
|---|---|---|
| Identifiant | Téléphone | E-mail |
| Vérification | Aucune | Code à 6 chiffres par e-mail (10 min de validité) |
| `POST /api/auth/register` body | `{ phone, full_name, password }` → token immédiat | `{ firstName, lastName, email, password }` → pas de token, code envoyé |
| `POST /api/auth/login` body | `{ phone, password }` | `{ email, password }` → 403 `EMAIL_NOT_VERIFIED` si pas encore vérifié |

Autres routes auth : `POST /verify-email`, `POST /resend-code` (cooldown 60s), `PATCH /me` (profil), `POST /change-password`, `POST /become-merchant` (bascule un client en marchand + crée sa boutique ; demande un téléphone si le compte n'en a pas encore).

Le JWT (7 jours, header `Authorization: Bearer <token>`) contient `{ id, role, tokenVersion }` — c'est TOUJOURS ce token qui détermine l'identité de l'appelant, jamais une valeur du body.

⚠️ Quand un client devient marchand, l'ancien token reste "valide" mais périmé (`tokenVersion` incrémenté) — la route renvoie un nouveau token à stocker côté client impérativement.

---

## Paiements réels (FedaPay)

Deux usages distincts de FedaPay, tous deux gérés par le **même webhook** (`POST /api/payments/webhook`), distingués par `custom_metadata.type` :

### 1. Paiement d'une commande (client → plateforme)
`POST /api/payments/orders/:orderId/pay` crée une transaction FedaPay et renvoie un `paymentUrl` (page hébergée FedaPay : le client y choisit Mobile Money — MTN, Moov, Orange, Wave selon le pays — ou carte Visa/Mastercard ; on ne force aucun "mode", FedaPay affiche ce qui est disponible). Le webhook, seul, confirme réellement le paiement et passe `Order.paymentStatus` à `payee` — jamais la redirection du navigateur.

### 2. Paiement d'abonnement boutique (marchand → plateforme)
`POST /api/stores/me/subscription/pay` — même principe, mais met à jour `Store.subscriptionExpiresAt` au lieu d'une commande.

### Escrow → Payout marchand (le circuit complet demandé)
1. Client paie → argent réellement encaissé sur **ton compte FedaPay** (webhook `transaction.approved`), `Order.paymentStatus = payee`
2. Marchand expédie (`PATCH /orders/:id/ship`) → code de livraison à 6 chiffres généré
3. Réception confirmée par le **client** (`POST /:id/confirm`) ou le **livreur avec le code** (`POST /:id/confirm-with-code`) → `escrowStatus = libere`
4. **À cet instant précis**, une notification part vers **tous les comptes admin** (`type: versement_a_faire`) — c'est le signal que tu attendais dans ton espace admin
5. Toi (admin), tu consultes `GET /api/admin/payouts/pending` et tu déclenches `POST /api/admin/payouts/:storeOrderId` → appelle réellement l'API Payout de FedaPay, envoie l'argent au numéro Mobile Money du marchand (`Store.payoutPhone`), passe `payoutStatus = effectue`.
   - **Anti double versement** : la sous-commande est d'abord réservée (`en_attente`/`echoue` → `en_cours`) par un UPDATE conditionnel. Si FedaPay refuse → `echoue` (relançable). Si l'envoi réussit mais que l'enregistrement échoue → reste `en_cours` (bloqué volontairement, à vérifier dans FedaPay) plutôt qu'un double paiement.
6. En cas de désaccord, le client peut ouvrir un litige (`POST /:id/dispute`) — **uniquement sur une commande payée dont l'escrow est encore bloqué** ; notification admin, arbitrage via `PATCH /api/admin/disputes/:id/resolve` :
   - `libere` → la sous-commande apparaît dans les versements marchands ;
   - `rembourse` → `escrowStatus = rembourse`, elle apparaît dans `GET /api/admin/refunds/pending`, et `POST /api/admin/refunds/:storeOrderId` renvoie réellement l'argent au numéro Mobile Money de la commande (même protection anti double envoi). Quand toutes les sous-commandes d'une commande sont remboursées, `Order.paymentStatus` passe à `remboursee`.
7. Toute action sensible de l'admin (versement, remboursement, arbitrage, suspension, note) est écrite dans `AdminAuditLog` — consultable via `GET /api/admin/audit` (lecture seule).

---

## Référence API complète

### Auth (`/api/auth`)
`POST /register`, `POST /login`, `POST /verify-email`, `POST /resend-code`, `PATCH /me`, `POST /change-password`, `POST /become-merchant`

### Boutiques (`/api/stores`)
`GET /search?q=`, `GET /me`, `GET /me/subscription`, `POST /me/subscription/pay`, `GET /:subdomain`, `PATCH /`

### Produits (`/api/products`)
`GET /search?category=&q=`, `GET /store/:subdomain`, `GET /public/:id`, `POST /upload-image`, `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`

### Catégories (`/api/categories`)
`GET /`

### Commandes (`/api/orders`)
`POST /`, `GET /my`, `GET /`, `PATCH /:id/ship`, `POST /:id/confirm`, `POST /:id/confirm-with-code`, `POST /:id/dispute`

### Paiements (`/api/payments`)
`POST /orders/:orderId/pay`, `POST /webhook` (FedaPay uniquement)

### Favoris (`/api/favorites`)
`GET /ids`, `GET /`, `POST /:productId`, `DELETE /:productId`

### Notifications (`/api/notifications`)
`GET /`, `PATCH /:id/read`, `PATCH /read-all`

### Support marchand (`/api/support`)
`POST /`, `GET /my`

### Admin (`/api/admin` — role admin uniquement)
`GET /overview`, `GET /payouts/pending`, `POST /payouts/:storeOrderId`, `GET /refunds/pending`, `POST /refunds/:storeOrderId`, `GET /disputes`, `PATCH /disputes/:id/resolve`, `GET /support`, `PATCH /support/:id/reply`, `GET /stores`, `PATCH /stores/:id/rating`, `PATCH /stores/:id/suspend` (`{ reason }`), `PATCH /stores/:id/reactivate`, `GET /orders`, `GET /users`, `PATCH /users/:id/active`, `DELETE /stores/:id` (boutiques sans historique uniquement), `GET /audit`

---

## Modèle de sécurité

- Aucune donnée sensible (identité, prix, stock) n'est jamais acceptée depuis le body si elle peut être déduite du token ou vérifiée en base.
- Cloisonnement systématique par propriétaire (`findFirst({ id, storeId: maBoutique })`).
- Les webhooks FedaPay sont vérifiés par signature (`X-FEDAPAY-SIGNATURE`) sur le corps brut de la requête — jamais de confiance aveugle en un simple appel HTTP prétendant venir de FedaPay.
- Mots de passe hashés bcrypt. Un compte désactivé (`User.isActive = false`) est refusé à la connexion **et** immédiatement sur toute requête authentifiée.
- Commandes : quantités validées (entier 1–100), stock décrémenté atomiquement (jamais négatif), prix facturé = prix affiché (promo incluse), produit non publié / boutique suspendue ou expirée refusés.
- Frais de livraison : un forfait par boutique (`Store.shippingFee`), figé dans `StoreOrder.shippingFee` et inclus dans `subtotal` (= montant versé / remboursé) ; la somme des sous-totaux vaut toujours `Order.totalAmount`, comme dans le panier client.
- Commandes non payées : annulées après `ORDER_PAYMENT_TTL_MINUTES` (défaut 60) et stock remis en vente (à chaque nouvelle commande + cron Vercel quotidien `GET /api/cron/expire-orders`, protégé par `CRON_SECRET`). Un paiement arrivant après annulation déclenche une alerte admin (remboursement manuel via FedaPay).
- Anti force-brute : 8 mots de passe erronés → compte verrouillé 15 min ; code e-mail invalidé après 5 essais ratés ; limiteur par IP sur login / inscription / vérification.
- Escrow : libération atomique (un double clic ou client + livreur ne libèrent qu'une fois) et uniquement depuis l'état `expediee` ; code de livraison comparé en temps constant, verrouillé après 5 essais ratés.
- Webhooks FedaPay idempotents : un événement rejoué ne prolonge pas deux fois un abonnement (`SubscriptionPayment`, unicité sur l'id de transaction), ne renotifie pas et n'écrase jamais une commande déjà payée. En cas d'erreur interne, le webhook répond 500 pour que FedaPay réessaie.
- CORS piloté par `CORS_ORIGINS` (liste blanche en production ; ouvert par défaut en local).
- RLS activée sur Supabase en mode "tout refuser" — cette API la contourne par conception (connexion directe + clé `service_role`), elle protège contre un usage futur accidentel de la clé publique côté navigateur.

---

## Base de données — migrations

`prisma/migrations/20260930000000_catch_up_schema_and_admin_hardening` rattrape les tables/colonnes qui existaient dans `schema.prisma` mais dans aucune migration (notifications, favoris, support, paiements, abonnements, profil utilisateur…) et ajoute les nouveautés (suspension, remboursements, journal d'audit, paiements d'abonnement, anti force-brute). Elle est **idempotente** : elle s'applique sans erreur sur la base de prod actuelle comme sur une base neuve.

```bash
npx prisma migrate deploy   # sur la base réelle (DATABASE_URL / DIRECT_URL)
npx prisma generate
```

⚠️ `StoreOrder.store` passe en `onDelete: Restrict` : supprimer une boutique qui a des commandes est désormais impossible au niveau de la base, pas seulement dans l'API.

Une 2e migration, `20260930120000_shipping_order_expiry_login_lockout`, ajoute les frais de livraison par sous-commande, le statut `annulee`, et les compteurs anti force-brute.

## Déploiement

Le code est écrit pour tourner **à l'identique sur n'importe quel hébergeur** :
- **Serverless (Vercel)** : `api/index.js` expose `src/app.js` sans jamais appeler `.listen()`.
- **Hébergeur classique** (Render, Railway, VPS...) : `npm start` lance `src/server.js`, qui fait un vrai `.listen()`.

Aucune ligne de code à changer entre les deux — seule la commande de démarrage diffère.

---

## Comptes de test (développement uniquement)

| Téléphone | Rôle | Mot de passe |
|---|---|---|
| `+2250700000001` | admin | `test1234` |
| `+2250700000002` | marchand — Boutique Awa (`awa`) | `test1234` |
| `+2250700000003` | marchand — Boutique Kofi (`kofi`) | `test1234` |
| `+2250700000004` | client (ancien schéma téléphone — les nouveaux comptes client utilisent l'e-mail) | `test1234` |

```bash
node src/scripts/set-password.js <telephone> <mot_de_passe>
```

---

## Ce qui n'est PAS encore fait

- **Messages WhatsApp reçus dans l'espace marchand** — seul le lien `wa.me` (cliquer pour discuter) existe. Une vraie intégration WhatsApp Business API (Meta) est un chantier à part (compte Business Manager, validation, coût).
- **Domaine personnalisé** (`nom.shop`) — le champ existe (`customDomain`), pas le routage DNS réel.
- **3 thèmes de boutique** — rendu visuel géré par `SHOPIKA_clients`, pas ce backend.
- **Commission Shopika** — le versement marchand est égal au sous-total de la sous-commande (aucune commission retenue).
- **Mode de payout** — `sendPayout()` envoie toujours `mode: 'mtn_open'` : à confirmer avec FedaPay pour Moov / Orange / Wave.
- **Admin : pages Abonnements, Rapports, équipe (RBAC), 2FA** — l'espace admin couvre aujourd'hui : tableau de bord, commandes, boutiques (suspension), comptes (désactivation), versements, remboursements, litiges, support, journal d'audit, paramètres (mot de passe).
- **Limitation de débit distribuée** — le limiteur par IP est en mémoire (par instance serverless) ; la vraie protection est le verrouillage par compte en base. Pour un quota global, brancher Redis/Upstash.
- **Frontends** — `shopika-front-client` a été construit contre une API différente sur plusieurs pages (marketplace, boutique, produit, panier, commande) ; leur réconciliation avec ce backend reste à faire page par page (voir échanges précédents).

## Note sur Prisma

Volontairement figé sur Prisma v6. Ne pas passer en v7 sans tester en profondeur (changements de configuration significatifs).
## Probl�mes connus / Plaintes de l'utilisateur

- **Admin page blanche** : le serveur Vite de l'admin ne tournait pas ou l'origine CORS manquait. Apr�s ajout de `http://localhost:5173` � `CORS_ORIGINS` dans `.env` et d�marrage du serveur API (`node src/server.js`) et du dev admin (`npm run dev` dans `shopika-admin/`), la page de connexion s'affiche correctement.
- **Route `/api/test` non trouv�e** : l'endpoint `/api/test` n'existe pas dans le code actuel ; il �tait pr�sent dans la configuration Vercel uniquement pour des tests de d�ploiement. Utilisez plut�t `/api/stores/search?q=test` ou toute autre route existante pour v�rifier que l'API r�pond.
- **API ne d�marre pas en local** : assurez-vous d'�tre dans le r�pertoire racine du projet et de lancer `node src/server.js` (ou `npm run dev` si le script est d�fini). Le fichier `src/server.js` �coute sur le port d�fini par `PORT` (d�faut 4000).
- **Configuration FedaPay en production** : le fichier `.env` contient encore un placeholder pour `FEDAPAY_WEBHOOK_SECRET`. Vous devez le remplacer par le secret r�el obtenu depuis le tableau de bord FedaPay apr�s avoir configur� l'URL du webhook sur `https://shopika-api-indol.vercel.app/api/payments/webhook` (ou votre URL locale expos�e via ngrok pour les tests).
- **Frontend client et marchand** : les fronts `shopika-front` et `SHOPIKA_marchand` sont configur�s pour pointer vers l'API de production (`https://shopika-api-indol.vercel.app/api`). Pour des tests locaux, modifiez leurs fichiers de configuration (`shopika-front/js/config.js` et `SHOPIKA_marchand/config.js`) afin qu'ils utilisent `http://localhost:4000/api`.
- **Variables d'environnement manquantes** : certaines variables comme `CRON_SECRET` ou `SMTP_USER`/`SMTP_PASS` peuvent �tre vides en d�veloppement ; elles sont n�cessaires uniquement pour les fonctionnalit�s de cron (annulation des commandes) et d'envoi d'e-mail. Vous pouvez les laisser vides ou mettre des valeurs de test tant que vous n'utilisez pas ces fonctionnalit�s.

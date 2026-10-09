# Shopika — correctifs et ajouts (audit backend + admin)

## Bugs d'argent corrigés (backend)
| Problème trouvé | Correctif |
|---|---|
| Quantité négative acceptée → total négatif **et** stock qui augmente | Quantités validées (entier 1–100), lignes identiques fusionnées |
| Stock vérifié puis décrémenté en 2 temps → dernière pièce vendue 2 fois, stock négatif | Décrément atomique conditionnel (`stock >= quantité`) |
| Prix plein facturé même quand la promo est affichée | Prix facturé = prix affiché (`promoPrice` sinon `price`) |
| Produit non publié commandable | Refusé |
| Versement admin : double clic / 2 admins = double paiement FedaPay | Réservation atomique `en_cours`, `echoue` relançable, `en_cours` bloqué |
| `confirm-reception` libérait l'escrow d'un colis jamais expédié (`confirmee`) | Uniquement depuis `expediee` |
| Double libération d'escrow (client + livreur simultanés) | `updateMany` conditionnel |
| Litige ouvrable sur commande non payée, déjà livrée, déjà versée | Seulement payée + escrow bloqué + non clôturée |
| Code de livraison (6 chiffres) devinable par force brute, comparaison non constante | 5 essais max + `timingSafeEqual` |
| Webhook abonnement rejoué → abonnement prolongé 2 fois | `SubscriptionPayment` unique par transaction FedaPay |
| Webhook `declined` tardif écrasait une commande déjà `payee` | Transition `en_attente → echouee` uniquement |
| Webhook répondait 200 sur erreur interne → paiement réel perdu | Répond 500 (FedaPay réessaie, traitements idempotents) |
| `rembourse` = simple changement de statut, aucun argent renvoyé | File « remboursements » + `POST /admin/refunds/:id` (payout vers le client) |
| Statut paiement client : `payee` affiché « libéré au marchand » | Reflète l'escrow réel |
| `marketplace/products?ids=` exposait les produits de boutiques expirées | Filtre boutique active |
| Compte désactivé (`isActive=false`) jamais bloqué | Refusé au login et sur chaque requête |

## Lot 2 — corrigé dans la foulée
| Problème trouvé | Correctif |
|---|---|
| Le panier affichait « articles + livraison » mais l'API ne facturait que les articles (client sous-facturé, marchand jamais payé pour la livraison) | Frais de boutique figés dans `StoreOrder.shippingFee`, inclus dans `subtotal`, versement et remboursement |
| Commande abandonnée = stock bloqué à vie | Annulation après 60 min + stock restitué (à la commande suivante + cron quotidien) |
| Paiement reçu après annulation = argent encaissé, commande perdue | Alerte admin « paiement orphelin » ; payer une commande annulée est refusé |
| Mot de passe devinable sans limite | 8 échecs → verrou 15 min (en base) + limiteur par IP |
| Code e-mail à 6 chiffres devinable (10 min, essais illimités) | Invalidé après 5 essais ratés |
| `trust proxy` absent : tous les clients partageaient la même IP derrière Vercel | `app.set('trust proxy', 1)` |
| `isActive` appliqué mais aucun moyen de le modifier | Page Comptes (désactiver/réactiver, admins protégés, audité) ; page Commandes |

## Fonctionnalités ajoutées
- Suspension / réactivation de boutique avec motif (`isSuspended`), notifiée au marchand ; la suppression n'est plus possible si la boutique a un historique.
- Remboursements clients (API + onglet admin).
- Journal d'audit (`AdminAuditLog`) + page admin.
- Migration de rattrapage : le schéma contenait des tables/colonnes absentes de toutes les migrations (`migrate deploy` sur base neuve donnait une base cassée).

## Admin (React)
- Boutiques : badge d'état, Suspendre/Réactiver, bandeau « on ne supprime pas » (plus de bouton Supprimer).
- Versements & remboursements (deux onglets, relance des échecs, confirmation avant envoi).
- Litiges : confirmation, le litige tranché quitte la liste ; libellés « Libérer au marchand » / « Rembourser le client ».
- Paramètres : le changement de mot de passe affichait « mis à jour » même en cas d'erreur.
- Déconnexion automatique si le token expire ; `vercel.json` (SPA) et `.env.example` ajoutés.

## À faire côté toi
1. `npx prisma migrate deploy` (applique 2 migrations) puis `npx prisma generate`.
2. **Rotation des secrets** : l'archive contenait `.env` et `.env.bak` (clés Supabase service, FedaPay, SMTP, JWT). Ils ne sont PAS dans cette livraison ; régénère-les si l'archive a circulé.
3. Ajoute `CRON_SECRET` (et optionnellement `ORDER_PAYMENT_TTL_MINUTES`) dans les variables Vercel de l'API : sans lui, le cron d'annulation reste fermé (les commandes sont quand même purgées à chaque nouvelle commande).
4. Dans Vercel (admin) : `VITE_API_URL=https://<ton-api>/api` ; dans l'API : `CORS_ORIGINS` avec l'URL de l'admin.

## Vérifié
- Syntaxe de tous les fichiers backend, montage des routes, validation des entrées de commande (requêtes réelles contre l'app avec Prisma simulé).
- Schéma Prisma valide ; migration rejouée sur PostgreSQL 16 : base neuve, base déjà alignée, base type `db push`, transaction unique ; aucune colonne du schéma absente.
- `vite build` de l'admin sans erreur.
- Tests de comportement (Prisma simulé en mémoire) : total = articles promo + livraison par boutique = somme des sous-totaux ; stock épuisé refusé ; commande expirée → stock restitué une seule fois ; commande payée jamais annulée ; cron fermé sans/avec mauvais secret ; verrouillage après 8 échecs (même le bon mot de passe est refusé), code e-mail invalidé après 5 essais.
- Migrations rejouées sur PostgreSQL 16 (base neuve, rejeu, transaction unique) ; aucune colonne du schéma absente.
- **Non testé** : appels réels Prisma/FedaPay (moteurs Prisma indisponibles ici). Teste un parcours complet en sandbox FedaPay avant la prod.

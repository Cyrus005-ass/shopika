# Shopika — Interface Admin (prototype fonctionnel)

Ce dossier contient un **frontend React réel et lançable**, pas juste une maquette.
Il couvre l'interface Superadmin décrite dans le Cahier des Charges et le Blueprint.

## Lancer le projet

```bash
npm install
npm run dev
```
Ouvre ensuite http://localhost:5173

Au tout premier lancement, tu arriveras automatiquement sur la page
**"Créer le compte Superadmin"** (`/setup`). Dès que ce compte est créé,
cette page devient inaccessible pour toujours (redirection auto vers `/login`) —
exactement comme demandé.

## Ce qui est déjà fonctionnel

- **Page d'inscription Superadmin** — ne s'affiche que si aucun admin n'existe.
- **Connexion** avec numéro + mot de passe.
- **Gestion d'équipe (RBAC)** (`/utilisateurs`) : le Superadmin peut créer des
  collaborateurs, leur donner un nom/téléphone/mot de passe, et **cocher
  précisément les modules ("tâches") auxquels ils ont accès** — avec des
  rôles pré-remplis (Finance, Support, Modérateur) ou une sélection libre.
  Le menu latéral de chaque personne s'adapte automatiquement à ses droits.
- **Dashboard** avec les statistiques clés (boutiques, marchands, clients,
  commandes, revenus, commissions, abonnements, litiges).
- **Module Escrow** avec libération de fonds et confirmation obligatoire.
- **Les 12 autres modules** (Marchands, Clients, Boutiques, Produits,
  Commandes, Paiements, Abonnements, Marketplace, Transporteurs,
  Thèmes/Plugins, Annonces, Support, Rapports, Paramètres) sont posés en
  pages fonctionnelles avec navigation et permissions actives, et listent
  clairement, dans l'écran lui-même, ce qu'il reste à brancher sur chacun.

## Couleurs

La palette du logo est déjà intégrée dans `tailwind.config.js` :
`night`, `pink`, `orange`, `gold`, `redorange`. Tout le design (boutons,
badges, dégradés) s'appuie dessus.

## Emplacement réservé pour le logo

Fichier : `src/components/LogoSlot.jsx`.
Pour l'instant il affiche un badge dégradé "S" à la place du vrai logo.
Une fois ton logo prêt :
1. Dépose le fichier dans `public/` (ex : `public/logo.svg`)
2. Remplace le contenu de `LogoSlot.jsx` par `<img src="/logo.svg" alt="Shopika" />`

## ⚠️ Important — ce projet est un prototype frontend

Il n'y a **pas de vrai backend**. Toutes les données (comptes admin,
statistiques, litiges, transactions escrow) sont simulées dans
`src/data/mockDb.js` via le `localStorage` du navigateur, uniquement pour
pouvoir tester le flux de bout en bout. Chaque fonction de ce fichier est
écrite pour être remplacée facilement, un appel API à la fois.

## Ce qu'il manque pour la mise en production

### Backend & données
- Une vraie API (Node/Express, Django ou autre) connectée à PostgreSQL.
- Remplacement de `mockDb.js` par de vrais appels `fetch`/`axios`.
- Vraie authentification (JWT ou sessions serveur), avec hash du mot de
  passe via bcrypt/argon2 côté serveur — jamais côté client.

### Sécurité (à ajouter avant toute mise en ligne)
- **2FA obligatoire** pour tous les comptes admin (à la création et à la connexion).
- **Vérification par SMS/email** lors de l'inscription du Superadmin.
- **Journal d'audit** : chaque action sensible (libération de fonds,
  suspension de boutique, changement de permissions) doit être tracée
  (qui, quand, ancienne/nouvelle valeur) — actuellement absent.
- **Double validation** pour les libérations de fonds au-delà d'un seuil
  (principe des 4 yeux) — la confirmation actuelle est un simple clic,
  à durcir côté serveur.
- **Restriction d'accès par IP/VPN** pour les comptes ayant accès à l'escrow.
- **Expiration de session courte** + déconnexion automatique après inactivité.
- **Alertes automatiques** sur activité admin anormale (rafale d'actions,
  connexion depuis un nouveau pays, etc.).
- Le Superadmin ne doit **jamais** pouvoir être supprimé ou désactivé par
  un autre compte — cette règle est notée dans l'UI mais doit être imposée
  côté serveur (contrainte non contournable).

### Fonctionnel
- Recherche globale transversale (actuellement un champ visuel non branché).
- Centre de litiges complet avec preuves jointes et historique de décisions.
- Export comptable/fiscal (CSV/PDF) des commissions perçues.
- Notifications multicanal (SMS, WhatsApp, email) reliées aux actions admin.
- Mode "vue en tant que" pour diagnostiquer un problème signalé par un
  marchand/client sans se connecter à sa place.
- Tableau de bord santé technique des passerelles de paiement (Wave,
  MTN MoMo, Orange Money) : taux d'échec, temps de réponse.

### Design
- Remplacement du logo temporaire par le vrai logo (voir plus haut).
- Une passe de responsive mobile plus poussée si l'admin doit être utilisable
  depuis un téléphone.

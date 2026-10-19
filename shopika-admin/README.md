# Shopika — Interface Admin

Application React (Vite) pour l'administration de la plateforme Shopika.

## État actuel

Frontend React fonctionnel connecté à l'API backend Shopika. Couvre l'interface Superadmin avec création du premier admin, gestion des admins supplémentaires, dashboard, boutiques, commandes, paiements, litiges, support et journal d'audit.

## Lancer le projet

```powershell
cd shopika-admin
npm install
npm run dev
# → http://localhost:5173
```

## Premier lancement (création du premier admin)

Si aucun administrateur n'existe dans la base de données, vous arrivez automatiquement sur la page **"/setup"** pour créer le premier compte administrateur.

Une fois ce compte créé, la page `/setup` devient inaccessible et vous êtes redirigé vers `/login`.

Un administrateur existant peut créer d'autres administrateurs via la page `/admin/create`.

## Scripts disponibles

| Script | Rôle |
|--------|------|
| `npm run dev` | Serveur de développement Vite (port 5173) |
| `npm run build` | Build de production |
| `npm run preview` | Aperçu du build de production |

## Routes API utilisées

| Route | Méthode | Rôle |
|-------|---------|------|
| `/auth/admin-exists` | GET | Vérifie si un admin existe déjà |
| `/auth/create-first-admin` | POST | Crée le premier admin (public) |
| `/auth/create-admin` | POST | Crée un autre admin (réservé admin) |
| `/auth/login` | POST | Connexion admin (téléphone + mot de passe) |
| `/admin/overview` | GET | Tableau de bord admin |
| `/admin/stores` | GET | Liste des boutiques |
| `/admin/orders` | GET | Liste des commandes |
| `/admin/payouts/pending` | GET | Versements en attente |
| `/admin/disputes` | GET | Litiges ouverts |
| `/admin/audit` | GET | Journal d'audit |

## Structure

```
shopika-admin/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env
├── .env.example
├── src/
│   ├── main.jsx              # Point d'entrée React
│   ├── App.jsx               # Routes et logique de redirection (setup / login / dashboard)
│   ├── index.css             # Styles globaux
│   ├── api.js                # Client HTTP (VITE_API_URL, token, requêtes API)
│   ├── components/
│   │   ├── Layout.jsx        # Layout avec sidebar et header
│   │   └── LogoSlot.jsx      # Emplacement réservé pour le logo
│   └── pages/
│       ├── Login.jsx         # Connexion admin
│       ├── FirstAdminSetup.jsx  # Création du premier admin (/setup)
│       ├── CreateAdmin.jsx   # Création d'admin supplémentaire (/admin/create)
│       ├── Dashboard.jsx     # Tableau de bord
│       ├── Stores.jsx        # Gestion des boutiques
│       ├── Orders.jsx        # Gestion des commandes
│       ├── Users.jsx         # Gestion des utilisateurs
│       ├── Payouts.jsx       # Versements marchands
│       ├── Disputes.jsx      # Litiges
│       ├── Support.jsx       # Support marchand
│       ├── Audit.jsx         # Journal d'audit
│       └── Settings.jsx      # Paramètres
├── dist/                     # Build de production
└── node_modules/
```

## Configuration

Le fichier `shopika-admin/src/api.js` utilise la variable d'environnement `VITE_API_URL` avec une valeur par défaut `http://localhost:4000/api` en développement.

Voir `shopika-admin/.env.example` pour les variables à renseigner.

## Couleurs

La palette du logo est intégrée dans `tailwind.config.js` : `night`, `pink`, `orange`, `gold`, `redorange`.

## Emplacement réservé pour le logo

Fichier : `src/components/LogoSlot.jsx`. Actuellement un badge dégradé "S". Pour utiliser votre propre logo, déposez le fichier dans `public/` et remplacez le contenu de `LogoSlot.jsx`.
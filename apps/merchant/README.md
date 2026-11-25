# Shopika — Espace Marchand

Espace dédié aux marchands de la plateforme Shopika. Site statique HTML/JS vanilla, aucune dépendance npm requise.

## État actuel

Espace marchand connecté à l'API backend Shopika. Permet la connexion, l'inscription en tant que marchand, la création de boutique et la gestion des commandes.

## Lancer en local

```powershell
# Depuis la racine du projet :
npm run dev:all
# Puis ouvrir : http://localhost:5500
```

## Configuration de l'API

Le fichier `SHOPIKA_marchand/config.js` détecte automatiquement l'URL de l'API :

- `localhost` / `127.0.0.1` → `http://localhost:4000/api`
- Autre (production) → `https://shopika-api-indol.vercel.app/api`

Aucune modification manuelle requise pour le développement local.

## Structure

```
SHOPIKA_marchand/
├── index.html          # Tableau de bord marchand
├── login.html          # Connexion marchand
├── auth.js             # Logique d'authentification (login, inscription marchand)
├── config.js           # URL de l'API (détection auto localhost/prod)
├── router.js           # Router SPA côté client
├── views.js            # Vues et rendu des pages
├── style.css           # Feuille de style principale
├── package.json
├── vercel.json
└── image/              # Images (logo, favicon, etc.)
    └── .gitkeep
```

## Parcours marchand

1. **Inscription** : `login.html` → onglet inscription → création de compte marchand (téléphone, nom complet, mot de passe, e-mail optionnel)
2. **Création de boutique** : après inscription, appel à `/auth/become-merchant` avec nom de boutique et sous-domaine
3. **Connexion** : `login.html` → onglet connexion → téléphone + mot de passe
4. **Tableau de bord** : `index.html` → gestion des commandes et de la boutique

## Notes

- L'inscription marchand utilise le double schéma : téléphone + mot de passe (pas de vérification e-mail requise pour les marchands).
- Le numéro de téléphone est requis pour devenir marchand (WhatsApp, Mobile Money).
- Le sous-domaine de boutique est généré automatiquement à partir du nom de la boutique.
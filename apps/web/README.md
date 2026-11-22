# Shopika — Front Client

Site vitrine et espace client de la plateforme Shopika. Site statique HTML/JS vanilla, aucune dépendance npm requise.

## État actuel

Toutes les données (comptes, boutiques, produits, commandes, favoris) proviennent d'un vrai backend API. Plus de données de démonstration simulées.

## Lancer en local

```powershell
# Depuis la racine du projet :
npm run dev:all
# Puis ouvrir : http://localhost:3000
```

## Configuration de l'API

Le fichier `shopika-front/js/config.js` détecte automatiquement l'URL de l'API :

- `localhost` / `127.0.0.1` → `http://localhost:4000/api`
- Autre (production) → `https://shopika-api-indol.vercel.app/api`

Aucune modification manuelle requise pour le développement local.

## Structure

```
shopika-front/
├── index.html              # Accueil / Marketplace
├── marketplace.html        # Liste des boutiques
├── produit.html            # Détail produit
├── boutique.html           # Page d'une boutique
├── inscription.html        # Création de compte client
├── verify.html             # Vérification du code e-mail (depuis l'email ou saisie manuelle)
├── connexion.html          # Connexion client
├── app/                    # Espace client connecté
│   ├── index.html          # Tableau de bord client
│   ├── profil.html         # Profil utilisateur
│   ├── parametres.html     # Paramètres
│   ├── panier.html         # Panier
│   ├── commandes.html      # Historique des commandes
│   ├── commande.html       # Détail d'une commande
│   └── favoris.html        # Produits favoris
├── css/                    # Feuilles de style par page
├── js/
│   ├── config.js           # URL de l'API (détection auto localhost/prod)
│   ├── api.js              # Client HTTP central (token, erreurs, 401)
│   ├── store.js            # Catalogue / commandes / favoris via l'API + panier localStorage
│   ├── auth.js             # Inscription / vérification / connexion via l'API
│   ├── i18n.js             # Traductions FR/EN
│   ├── header.js           # Composant header partagé
│   ├── app-shell.js        # Coque d'application
│   └── product-card.js     # Carte produit
├── icons/                  # Favicons (fond clair / fond sombre selon le thème)
├── favicon.ico             # Favicon par défaut
├── package.json
├── README.md
└── vercel.json
```

## Parcours utilisateur

1. **Inscription** : `inscription.html` → création de compte → code de vérification envoyé par e-mail
2. **Vérification** : `verify.html` → saisie du code ou lien depuis l'email → compte activé
3. **Connexion** : `connexion.html` → accès à l'espace client `app/`
4. **Espace client** : dashboard, profil, panier, commandes, favoris

## Notes

- Le panier reste en `localStorage` (ajout d'articles avant création de compte possible), mais les prix sont toujours revérifiés contre l'API au paiement.
- Le mot de passe n'est jamais haché côté navigateur ; il est envoyé en HTTPS au backend qui applique bcrypt.
- Le code de vérification à 6 chiffres est généré et envoyé entièrement côté backend.
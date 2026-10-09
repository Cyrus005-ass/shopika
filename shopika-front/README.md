# Shopika — Frontend (branché sur un vrai backend)

Ce frontend ne contient plus aucune donnée de démonstration ni de logique
"simulée". Toutes les données (comptes, boutiques, produits, commandes,
favoris) viennent d'un vrai backend que tu héberges toi-même.

## Avant de lancer le site

1. Ouvre `js/config.js` et renseigne l'URL de ton backend :
   ```js
   window.SHOPIKA_CONFIG = { API_BASE_URL: "https://api.tondomaine.com/api" };
   ```
2. Ton backend doit exposer les routes listées en commentaire en haut de
   `js/store.js` et `js/auth.js` (contrat exact attendu par ce frontend).

## Comment l'ouvrir

```bash
cd shopika-front
python3 -m http.server 8080
```
puis http://localhost:8080/index.html — le site interrogera l'API définie
dans `js/config.js`.

## Ce qui a changé par rapport à la version "démo"

- Plus de `localStorage` servant de fausse base de données : les boutiques,
  produits, commandes et favoris viennent tous de l'API.
- Plus de boutiques ou produits factices : la marketplace et la page
  d'accueil restent vides tant qu'aucun marchand n'a publié de boutique
  réelle — c'est normal et attendu.
- Les frais de livraison ne sont plus fixés à 1500 F côté client : chaque
  boutique définit les siens (`shop.shippingFee`, renseigné par le
  marchand), le panier les additionne une fois par boutique présente.
- Le mot de passe n'est plus haché dans le navigateur : il est envoyé une
  fois en HTTPS jusqu'au backend, qui applique bcrypt.
- Le code de vérification à 6 chiffres est généré et envoyé par e-mail
  entièrement côté backend (plus d'EmailJS, plus de `js/email.js`).
- Le bouton **"Créer votre boutique"** n'est relié à aucune page pour
  l'instant (désactivé volontairement) — à connecter à ta propre page de
  création de boutique quand elle sera prête.
- Seul le **panier** reste en `localStorage` : c'est volontaire (une
  personne doit pouvoir ajouter des articles avant de créer un compte),
  et il ne contient que des `{productId, quantity}` — jamais de prix,
  toujours revérifiés contre l'API au moment de payer.

## Structure

```
shopika-front/
├── index.html, marketplace.html, produit.html, boutique.html   (pages publiques)
├── inscription.html, verification.html, connexion.html          (authentification)
├── app/                                                          (espace client, connexion requise)
│   ├── index.html (tableau de bord), profil.html, parametres.html
│   ├── panier.html, commandes.html, commande.html, favoris.html
├── css/    → un fichier par page/composant
├── js/
│   ├── config.js       → URL de ton backend (à modifier)
│   ├── api.js           → client HTTP central (token, erreurs, 401)
│   ├── store.js          → catalogue / commandes / favoris via l'API + panier local
│   ├── auth.js            → inscription / vérification / connexion via l'API
│   ├── i18n.js             → traductions FR/EN + persistance
│   ├── header.js, app-shell.js, product-card.js  → composants partagés
```

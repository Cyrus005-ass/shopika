/**
 * Langue partagée par TOUTE l'application, persistée dans localStorage.
 * Chaque page appelle applyTranslations() au chargement pour traduire tous
 * les éléments marqués data-i18n="cle", et setLang() pour changer de langue
 * (met à jour la page courante ET sera relue par toute autre page visitée).
 */
const DICT = {
  navFeatures: { fr: "Fonctionnalités", en: "Features" },
  navPricing: { fr: "Tarifs", en: "Pricing" },
  navThemes: { fr: "Thèmes", en: "Themes" },
  ctaStart: { fr: "Inscrivez-vous gratuitement", en: "Sign up for free" },
  ctaLogin: { fr: "Se connecter", en: "Log in" },
  ctaCreateShop: { fr: "Créer votre boutique", en: "Create your shop" },
  ctaCreateShopBtn: { fr: "Créer ma boutique", en: "Create my shop" },
  navBecomeMerchant: { fr: "Devenir marchand", en: "Become a merchant" },
  bmTitle: { fr: "Devenir marchand", en: "Become a merchant" },
  bmLead: { fr: "Ouvrez votre boutique sur Shopika avec ce même compte : choisissez un nom et une adresse, puis gérez vos produits depuis l'espace marchand.", en: "Open your shop on Shopika with this same account: pick a name and an address, then manage your products from the merchant space." },
  bmShopName: { fr: "Nom de la boutique", en: "Shop name" },
  bmSubdomain: { fr: "Adresse de la boutique", en: "Shop address" },
  bmPhone: { fr: "Téléphone (WhatsApp / Mobile Money)", en: "Phone (WhatsApp / Mobile Money)" },
  bmSubmit: { fr: "Créer ma boutique", en: "Create my shop" },
  bmDoneTitle: { fr: "Votre boutique est créée !", en: "Your shop is ready!" },
  bmDoneBody: { fr: "Connectez-vous à l'espace marchand avec votre numéro de téléphone et votre mot de passe actuel pour ajouter vos produits et choisir un thème.", en: "Log in to the merchant space with your phone number and current password to add products and pick a theme." },
  bmOpenMerchant: { fr: "Ouvrir l'espace marchand", en: "Open the merchant space" },
  bmAlready: { fr: "Vous avez déjà une boutique. Gérez-la depuis l'espace marchand.", en: "You already have a shop. Manage it from the merchant space." },

  heroEyebrow: { fr: "✦ Nouveau : paiement en un clic", en: "✦ New: one-click checkout" },
  heroTitlePrefix: { fr: "Votre boutique démarre avec", en: "Your store starts with" },
  heroLead: { fr: "Créez, personnalisez et gérez votre commerce en ligne en quelques minutes. Vendez sur le web, en boutique et sur les réseaux sociaux, le tout depuis un seul tableau de bord.", en: "Create, customize and manage your online store in minutes. Sell on the web, in person and on social media, all from a single dashboard." },
  heroStatLabel: { fr: "Ventes en direct", en: "Live sales" },
  heroOrderTitle: { fr: "Nouvelle commande", en: "New order" },
  heroOrderSub: { fr: "Il y a 2 minutes", en: "2 minutes ago" },
  heroExplore: { fr: "Explorer", en: "Explore" },
  trustLabel: { fr: "Ils vendent déjà avec Shopika", en: "Already selling with Shopika" },
  heroPayTitle: { fr: "Paiement reçu", en: "Payment received" },
  heroPaySub: { fr: "Mobile money", en: "Mobile money" },
  howTitle: { fr: "Lancez votre boutique en trois étapes", en: "Launch your store in three steps" },
  howSub: { fr: "Pas besoin de savoir coder. Vous pouvez être en ligne dès aujourd'hui.", en: "No coding needed. You can be online today." },
  step1Title: { fr: "Créez votre compte", en: "Create your account" },
  step1Desc: { fr: "Inscrivez-vous gratuitement avec votre e-mail.", en: "Sign up for free with your email." },
  step2Title: { fr: "Choisissez un thème", en: "Pick a theme" },
  step2Desc: { fr: "Ajoutez vos produits, vos couleurs et votre logo.", en: "Add your products, colors and logo." },
  step3Title: { fr: "Encaissez vos premières ventes", en: "Get your first sales" },
  step3Desc: { fr: "Vos clients paient par mobile money, carte ou virement.", en: "Customers pay by mobile money, card or bank transfer." },

  featuresTitle: { fr: "Une boutique qui vous ressemble, prête en quelques minutes", en: "A store that looks like you, ready in minutes" },
  featuresSub: { fr: "Des modèles pensés pour vendre, une prise en main simple, et tous les outils pour grandir sans changer de plateforme.", en: "Templates built to sell, an easy setup, and every tool you need to grow without switching platforms." },
  feature1Title: { fr: "Design sur-mesure", en: "Custom design" },
  feature1Desc: { fr: "Choisissez un thème, personnalisez couleurs et polices, et publiez une boutique qui porte votre identité.", en: "Pick a theme, customize colors and fonts, and publish a store that carries your identity." },
  feature2Title: { fr: "Paiements simplifiés", en: "Simple payments" },
  feature2Desc: { fr: "Acceptez mobile money, carte bancaire et virement, avec un suivi clair de chaque transaction.", en: "Accept mobile money, card and bank transfer, with clear tracking for every transaction." },
  feature3Title: { fr: "Vente partout", en: "Sell everywhere" },
  feature3Desc: { fr: "Connectez votre catalogue aux réseaux sociaux et vendez en boutique physique comme en ligne.", en: "Connect your catalog to social media and sell in person as well as online." },

  rewardsTitle: { fr: "Votre abonnement peut s'autofinancer", en: "Your subscription can pay for itself" },
  rewardsSub: { fr: "Transformez une partie de vos ventes en crédits d'abonnement. Plus vous vendez, plus votre forfait Shopika vous coûte cher.", en: "Turn part of your sales into subscription credits. The more you sell, the less your Shopika plan costs." },
  rewardsBtn: { fr: "Découvrir l'offre", en: "Discover the offer" },
  roiSales: { fr: "Ventes totales", en: "Total sales" },
  roiCredits: { fr: "Vos crédits", en: "Your credits" },

  themesTitle: { fr: "Des thèmes personnalisables", en: "Customizable themes" },
  themesSub: { fr: "Démarrez avec un design professionnel et ajustez chaque détail à votre marque.", en: "Start with a professional design and adjust every detail to your brand." },
  themeFree: { fr: "Gratuit", en: "Free" },

  ctaBandTitle: { fr: "Prêt à vendre partout ?", en: "Ready to sell everywhere?" },
  ctaBandSub: { fr: "Rejoignez Shopika gratuitement et lancez votre boutique aujourd'hui.", en: "Join Shopika for free and launch your store today." },

  footerTagline: { fr: "Shop smart, live better. La plateforme pour lancer et faire grandir votre commerce.", en: "Shop smart, live better. The platform to launch and grow your business." },
  footerProduct: { fr: "Produit", en: "Product" },
  footerResources: { fr: "Ressources", en: "Resources" },
  footerHelp: { fr: "Centre d'aide", en: "Help center" },
  footerBlog: { fr: "Blog", en: "Blog" },
  footerCommunity: { fr: "Communauté", en: "Community" },
  footerCompany: { fr: "Entreprise", en: "Company" },
  footerAbout: { fr: "À propos", en: "About" },
  footerCareers: { fr: "Carrières", en: "Careers" },
  footerContact: { fr: "Contact", en: "Contact" },
  footerRights: { fr: "© 2026 Shopika. Tous droits réservés.", en: "© 2026 Shopika. All rights reserved." },
  footerLegal: { fr: "Confidentialité · Conditions", en: "Privacy · Terms" },

  popularTitle: { fr: "Produits populaires", en: "Popular products" },
  seeAll: { fr: "Tout voir", en: "See all" },
  emptyProducts: { fr: "Aucun produit publié pour l'instant.", en: "No products published yet." },

  marketTitle: { fr: "Marketplace", en: "Marketplace" },
  marketSub: { fr: "Toutes les boutiques disponibles sur Shopika.", en: "Every shop available on Shopika." },
  marketSearchPh: { fr: "Rechercher une boutique ou un produit…", en: "Search a shop or a product…" },
  marketEmpty: { fr: "Aucune boutique ne correspond à votre recherche.", en: "No shop matches your search." },
  marketMatchingProduct: { fr: "Produit trouvé", en: "Matching product" },

  productAddToCart: { fr: "Ajouter au panier", en: "Add to cart" },
  productBuyNow: { fr: "Acheter maintenant", en: "Buy now" },
  productDescription: { fr: "Description", en: "Description" },
  productNotFound: { fr: "Ce produit n'existe pas ou n'est plus disponible.", en: "This product does not exist or is no longer available." },
  shopNotFound: { fr: "Cette boutique n'existe pas ou n'est plus disponible.", en: "This shop does not exist or is no longer available." },

  createShopTitle: { fr: "Créer votre boutique", en: "Create your shop" },
  createShopBody: { fr: "L'espace marchand, où vous pourrez créer votre boutique et publier vos produits, est en cours de connexion à cette plateforme. Revenez très bientôt !", en: "The merchant space, where you'll be able to create your shop and publish products, is being connected to this platform. Check back very soon!" },
  backHome: { fr: "← Retour à l'accueil", en: "← Back to home" },

  navHome: { fr: "Accueil", en: "Home" },
  navMarketplace: { fr: "Marketplace", en: "Marketplace" },
  navFavorites: { fr: "Favoris", en: "Favorites" },
  navOrders: { fr: "Commandes", en: "Orders" },
  navCart: { fr: "Panier", en: "Cart" },
  navProfile: { fr: "Profil", en: "Profile" },
  navSettings: { fr: "Paramètres", en: "Settings" },
  navSupport: { fr: "Support", en: "Support" },
  supportTitle: { fr: "Support et suggestions", en: "Support and suggestions" },
  supportIntro: { fr: "Une idée pour améliorer Shopika, une question ou un souci ? Écrivez à l'équipe : chaque message est lu.", en: "An idea to improve Shopika, a question or a problem? Write to the team: every message is read." },
  supportSubject: { fr: "Sujet", en: "Subject" },
  supportSubjectPh: { fr: "Ex. : ajouter le suivi de colis", en: "E.g. add parcel tracking" },
  supportMessage: { fr: "Votre message", en: "Your message" },
  supportMessagePh: { fr: "Décrivez votre idée ou votre problème…", en: "Describe your idea or your problem…" },
  supportSend: { fr: "Envoyer", en: "Send" },
  supportSending: { fr: "Envoi…", en: "Sending…" },
  supportSentOk: { fr: "Merci ! Votre message a été envoyé à l'équipe Shopika.", en: "Thank you! Your message has been sent to the Shopika team." },
  supportReplyHint: { fr: "Les réponses de l'équipe apparaissent dans « Mes messages », ci-dessous.", en: "Replies from the team appear in “My messages” below." },
  supportHistory: { fr: "Mes messages", en: "My messages" },
  supportEmpty: { fr: "Vous n'avez pas encore envoyé de message.", en: "You haven't sent any message yet." },
  supportStatusOpen: { fr: "En attente", en: "Pending" },
  supportStatusDone: { fr: "Répondu", en: "Answered" },
  supportTeamReply: { fr: "Réponse de l'équipe", en: "Team reply" },
  supportLoadError: { fr: "Impossible de charger vos messages pour le moment.", en: "Could not load your messages right now." },

  dashboardGreeting: { fr: "Bonjour", en: "Hello" },
  dashboardIntro: { fr: "Voici votre espace personnel. Vos commandes, favoris et paramètres n'appartiennent qu'à vous.", en: "This is your personal space. Your orders, favorites and settings belong only to you." },
  dashboardAccount: { fr: "Compte", en: "Account" },
  dashboardLocation: { fr: "Localisation", en: "Location" },
  dashboardLanguage: { fr: "Langue", en: "Language" },

  profileTitle: { fr: "Profil", en: "Profile" },
  profileVerified: { fr: "vérifié", en: "verified" },
  profileNotEditableHere: { fr: "non modifiable ici", en: "not editable here" },
  profileFirstName: { fr: "Prénom", en: "First name" },
  profileLastName: { fr: "Nom", en: "Last name" },
  profilePhone: { fr: "Téléphone (WhatsApp)", en: "Phone (WhatsApp)" },
  profileAddress: { fr: "Adresse", en: "Address" },
  profileCountry: { fr: "Pays", en: "Country" },
  profileCity: { fr: "Ville", en: "City" },
  profileSave: { fr: "Enregistrer", en: "Save" },
  profileSaving: { fr: "Enregistrement…", en: "Saving…" },
  profileSaved: { fr: "✓ Profil mis à jour", en: "✓ Profile updated" },

  settingsTitle: { fr: "Paramètres", en: "Settings" },
  settingsPassword: { fr: "Mot de passe", en: "Password" },
  settingsCurrentPassword: { fr: "Mot de passe actuel", en: "Current password" },
  settingsNewPassword: { fr: "Nouveau mot de passe", en: "New password" },
  settingsConfirm: { fr: "Confirmer", en: "Confirm" },
  settingsUpdate: { fr: "Mettre à jour", en: "Update" },
  settings2fa: { fr: "Double authentification (2FA)", en: "Two-factor authentication (2FA)" },
  settings2faHint: { fr: "Sécurisez votre compte avec un code envoyé par SMS.", en: "Secure your account with a code sent by SMS." },

  cartTitle: { fr: "Panier", en: "Cart" },
  cartEmpty: { fr: "Votre panier est vide.", en: "Your cart is empty." },
  cartBrowse: { fr: "Parcourir la marketplace", en: "Browse the marketplace" },
  cartSubtotal: { fr: "Sous-total", en: "Subtotal" },
  cartShipping: { fr: "Frais de livraison", en: "Shipping fee" },
  cartTotal: { fr: "Total", en: "Total" },
  cartOrder: { fr: "Commander", en: "Checkout" },
  cartContinue: { fr: "Continuer les achats", en: "Continue shopping" },

  checkoutTitle: { fr: "Finaliser la commande", en: "Complete your order" },
  checkoutAddress: { fr: "Adresse de livraison", en: "Shipping address" },
  checkoutPhone: { fr: "Téléphone", en: "Phone" },
  checkoutShipping: { fr: "Mode de livraison", en: "Shipping method" },
  checkoutPayment: { fr: "Méthode de paiement", en: "Payment method" },
  checkoutValidate: { fr: "Valider la commande", en: "Place order" },
  checkoutStandard: { fr: "Livraison standard (2-4 jours)", en: "Standard shipping (2–4 days)" },
  checkoutExpress: { fr: "Livraison express (24h)", en: "Express shipping (24h)" },
  checkoutEmptyCart: { fr: "Votre panier est vide.", en: "Your cart is empty." },

  ordersTitle: { fr: "Mes commandes", en: "My orders" },
  ordersEmpty: { fr: "Aucune commande ici.", en: "No orders here." },
  ordersItems: { fr: "article(s)", en: "item(s)" },
  statusAll: { fr: "Toutes", en: "All" },
  statusPrep: { fr: "En préparation", en: "Preparing" },
  statusShipped: { fr: "Expédiée", en: "Shipped" },
  statusDelivered: { fr: "Livrée", en: "Delivered" },
  statusCancelled: { fr: "Annulée", en: "Cancelled" },
  statusDispute: { fr: "Litige", en: "Dispute" },

  orderBack: { fr: "Retour aux commandes", en: "Back to orders" },
  orderProducts: { fr: "Produits", en: "Products" },
  orderTracking: { fr: "Suivi", en: "Tracking" },
  orderInfo: { fr: "Informations", en: "Information" },
  orderPayment: { fr: "Paiement", en: "Payment" },
  orderReceivedBtn: { fr: "✓ Produit reçu", en: "✓ Product received" },
  orderDisputeBtn: { fr: "Ouvrir un litige", en: "Open a dispute" },
  trackReceived: { fr: "Commande reçue", en: "Order received" },
  trackPrep: { fr: "En préparation", en: "Preparing" },
  trackShipped: { fr: "Expédiée", en: "Shipped" },
  trackDelivered: { fr: "Livrée", en: "Delivered" },

  favoritesTitle: { fr: "Favoris", en: "Favorites" },
  favoritesSub: { fr: "Les produits que vous avez enregistrés.", en: "Products you have saved." },
  favoritesEmpty: { fr: "Vous n'avez pas encore de favoris.", en: "You don't have any favorites yet." },

  // Paiement (escrow)
  checkoutModalTitle: { fr: "Finaliser le paiement", en: "Complete payment" },
  checkoutCountrySelect: { fr: "Sélectionnez votre pays", en: "Select your country" },
  checkoutPaymentMethods: { fr: "Moyen de paiement", en: "Payment method" },
  checkoutTotalToPay: { fr: "Total à payer", en: "Total to pay" },
  checkoutConfirmPayment: { fr: "Confirmer le paiement", en: "Confirm payment" },
  checkoutConfirming: { fr: "Confirmation…", en: "Confirming…" },
  escrowNoticeText: {
    fr: "Votre paiement est conservé en sécurité par Shopika (séquestre) jusqu'à ce que vous confirmiez avoir reçu votre commande. Le marchand n'est payé qu'après votre validation.",
    en: "Your payment is held securely by Shopika (escrow) until you confirm you've received your order. The merchant is only paid after your validation.",
  },
  paymentStatusEscrow: { fr: "Paiement sécurisé — en séquestre", en: "Payment secured — in escrow" },
  paymentStatusAdmin: { fr: "Réception confirmée — en attente de validation par l'équipe Shopika", en: "Receipt confirmed — awaiting validation by the Shopika team" },
  paymentStatusReleased: { fr: "Paiement versé au marchand", en: "Payment released to merchant" },
  paymentStatusDispute: { fr: "Paiement bloqué — litige en cours", en: "Payment blocked — dispute in progress" },
  disputeNoticeText: {
    fr: "Un administrateur Shopika va examiner ce litige et statuer de façon équitable. Le paiement reste bloqué jusqu'à résolution.",
    en: "A Shopika administrator will review this dispute and make a fair decision. Payment remains blocked until resolved.",
  },
  receivedConfirmedToast: { fr: "Réception confirmée ! Le versement au marchand est en attente de validation par notre équipe.", en: "Receipt confirmed! Payment to the merchant is pending validation by our team." },
};

function getLang() {
  return localStorage.getItem("shopika_lang") || "fr";
}
function setLang(lang) {
  localStorage.setItem("shopika_lang", lang);
  applyTranslations();
  document.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
}
function t(key) {
  const lang = getLang();
  return (DICT[key] && DICT[key][lang]) || key;
}
function applyTranslations() {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (DICT[key]) el.textContent = DICT[key][lang];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (DICT[key]) el.placeholder = DICT[key][lang];
  });
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
  });
}
document.addEventListener("DOMContentLoaded", applyTranslations);

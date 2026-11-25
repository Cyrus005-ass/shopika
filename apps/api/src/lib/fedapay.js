// Client FedaPay — appels directs à l'API REST (pas de dépendance au SDK
// officiel pour ces trois opérations, dont les endpoints sont stables et
// documentés : https://docs.fedapay.com/api-reference).
//
// Nécessite Node >= 18 (fetch natif).
//
// Variables d'environnement attendues (voir .env.example) :
//   FEDAPAY_SECRET_KEY   clé privée (sandbox ou live)
//   FEDAPAY_ENV          "sandbox" ou "live"
//   FEDAPAY_WEBHOOK_SECRET  secret de l'endpoint webhook (dashboard FedaPay)

function baseUrl() {
  return process.env.FEDAPAY_ENV === 'live'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';
}

async function fedapayRequest(method, path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.FEDAPAY_SECRET_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message || data?.errors ? JSON.stringify(data) : `Erreur FedaPay (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.fedapayResponse = data;
    throw err;
  }
  return data;
}

// Crée une transaction (l'encaissement côté client) et renvoie directement
// le lien de paiement hébergé par FedaPay (le client y choisit lui-même
// Mobile Money — MTN, Moov, Orange, Wave selon le pays — ou carte Visa/
// Mastercard : on ne force pas de "mode", FedaPay affiche les moyens
// disponibles pour le pays du client).
async function createPaymentLink({ amount, description, callbackUrl, customer, customMetadata }) {
  const { transaction } = await fedapayRequest('POST', '/transactions', {
    description,
    amount: Math.round(amount), // FedaPay attend un entier (XOF n'a pas de centimes)
    currency: { iso: 'XOF' },
    callback_url: callbackUrl,
    customer,
    custom_metadata: customMetadata
  });

  const tokenRes = await fedapayRequest('POST', `/transactions/${transaction.id}/token`);
  return { transactionId: transaction.id, paymentUrl: tokenRes.url };
}

// Relit une transaction depuis l'API (utilisé pour re-vérifier un statut
// après un webhook, plutôt que de faire confiance aveuglément au payload).
async function getTransaction(transactionId) {
  const { transaction } = await fedapayRequest('GET', `/transactions/${transactionId}`);
  return transaction;
}

// Crée puis envoie immédiatement un payout (versement) vers le numéro
// Mobile Money du marchand. `country` = code ISO 2 lettres ("bj", "ci"...).
async function sendPayout({ amount, phoneNumber, country, firstname, lastname, description }) {
  const { payout } = await fedapayRequest('POST', '/payouts', {
    amount: Math.round(amount),
    currency: { iso: 'XOF' },
    mode: 'mtn_open', // FedaPay redirige automatiquement vers le bon opérateur selon le numéro
    description,
    customer: {
      firstname: firstname || 'Marchand',
      lastname: lastname || 'Shopika',
      phone_number: { number: phoneNumber, country }
    }
  });

  await fedapayRequest('PUT', '/payouts/start', {
    payouts: [{ id: payout.id }]
  });

  return payout;
}

module.exports = { createPaymentLink, getTransaction, sendPayout };

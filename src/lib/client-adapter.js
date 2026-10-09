const prisma = require('./prisma');

function toShop(store) {
  if (!store) return null;
  return {
    id: store.id,
    name: store.name,
    slug: store.subdomain,
    subdomain: store.subdomain,
    city: store.city,
    country: store.country,
    description: store.description,
    rating: store.rating ?? 0,
    shippingFee: Number(store.shippingFee || 0),
    logoUrl: store.logoUrl,
    colorPrimary: store.colorPrimary,
    colorSecondary: store.colorSecondary,
  };
}

function toProduct(product) {
  if (!product) return null;
  const price = Number(product.price);
  const promoPrice = product.promoPrice !== null && product.promoPrice !== undefined ? Number(product.promoPrice) : null;

  const images = Array.isArray(product.images)
    ? product.images.map((img) => (typeof img === 'string' ? { url: img } : img))
    : [];

  const category = product.category
    ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
    : null;

  let shop = null;
  if (product.store) {
    shop = toShop(product.store);
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: promoPrice !== null ? promoPrice : price,
    oldPrice: promoPrice !== null ? price : undefined,
    promoPrice: promoPrice,
    stock: product.stock,
    weight: product.weight,
    images,
    categoryId: product.categoryId,
    category,
    shop,
    isPublished: product.isPublished,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

const STATUS_MAP = {
  en_attente: 'EN_PREPARATION',
  confirmee: 'EN_PREPARATION',
  expediee: 'EXPEDIEE',
  livree: 'LIVREE',
  terminee: 'LIVREE',
  litige: 'LITIGE',
  annulee: 'ANNULEE',
};

// Statut de paiement vu par le client. Avant : payee -> LIBERE_MARCHAND, donc
// toute commande simplement payée s'affichait comme "fonds libérés au
// marchand". Désormais paymentStatusFor() reflète l'escrow réel.
const PAYMENT_STATUS_MAP = {
  en_attente: 'EN_VALIDATION_ADMIN',
  payee: 'PAYE_ESCROW',
  echouee: 'EN_VALIDATION_ADMIN',
  remboursee: 'BLOQUE_LITIGE',
  annulee: 'EN_VALIDATION_ADMIN',
};

function paymentStatusFor(order, storeOrders) {
  if (storeOrders.some((so) => so.status === 'litige')) return 'BLOQUE_LITIGE';
  if (order.paymentStatus === 'payee' && storeOrders.length > 0 && storeOrders.every((so) => so.escrowStatus === 'libere')) {
    return 'LIBERE_MARCHAND';
  }
  return PAYMENT_STATUS_MAP[order.paymentStatus] || 'PAYE_ESCROW';
}

function toOrder(order, includeStoreOrders) {
  if (!order) return null;

  const storeOrders = includeStoreOrders || [];

  let status = 'EN_PREPARATION';
  if (storeOrders.length > 0) {
    const so = storeOrders[0];
    status = STATUS_MAP[so.status] || 'EN_PREPARATION';
  }

  const items = storeOrders.flatMap((so) =>
    (so.items || []).map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name || '',
      price: Number(item.unitPrice),
      quantity: item.quantity,
      image: item.product?.images?.[0]
        ? typeof item.product.images[0] === 'string'
          ? item.product.images[0]
          : item.product.images[0].url
        : '',
    }))
  );

  const tracking = [];
  if (order.paidAt) {
    tracking.push({ step: 'received', createdAt: order.paidAt });
  }
  const prepSO = storeOrders.find((so) => ['confirmee', 'expediee', 'livree', 'terminee'].includes(so.status));
  if (prepSO) {
    tracking.push({ step: 'preparation', createdAt: prepSO.createdAt });
  }
  const shippedSO = storeOrders.find((so) => so.status === 'expediee');
  if (shippedSO) {
    tracking.push({ step: 'shipped', createdAt: shippedSO.createdAt });
  }
  const deliveredSO = storeOrders.find((so) => so.escrowStatus === 'libere');
  if (deliveredSO) {
    tracking.push({ step: 'delivered', createdAt: deliveredSO.confirmedAt || deliveredSO.createdAt });
  }

  const total = Number(order.totalAmount);

  return {
    id: order.id,
    total,
    status,
    items,
    tracking,
    address: order.deliveryAddress,
    city: order.deliveryCity,
    country: order.deliveryCountry,
    phone: order.deliveryPhone,
    createdAt: order.createdAt,
    payment: {
      method: order.paymentMethod || 'MOBILE_MONEY',
      status: paymentStatusFor(order, storeOrders),
    },
  };
}

module.exports = { toShop, toProduct, toOrder, STATUS_MAP, PAYMENT_STATUS_MAP };

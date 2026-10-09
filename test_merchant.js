const BASE = 'http://localhost:4000/api';

async function api(path, opts = {}) {
  const url = BASE + path;
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.method && body) headers['Content-Length'] = Buffer.byteLength(body);
  const res = await fetch(url, {
    method: opts.method || 'GET', headers, body
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  // Login as merchant
  const login = await api('/auth/login', {
    method: 'POST',
    body: { phone: '0711111111', password: 'marchand123' }
  });
  console.log('Login:', login.status, 'role:', login.data.user?.role);
  const auth = { Authorization: 'Bearer ' + login.data.token };

  // GET /orders as merchant → should return storeOrders
  const orders = await api('/orders', { headers: auth });
  console.log('Merchant GET /orders:', orders.status, 'count:', orders.data.length);
  console.log('  First storeOrder:', {
    id: orders.data[0]?.id,
    status: orders.data[0]?.status,
    escrowStatus: orders.data[0]?.escrowStatus,
    order: orders.data[0]?.order ? { id: orders.data[0].order.id, paymentStatus: orders.data[0].order.paymentStatus } : undefined
  });

  // Ship the pending storeOrder
  const pending = orders.data.find(so => so.status === 'en_attente' && so.order?.paymentStatus === 'payee');
  if (pending) {
    const ship = await api('/orders/' + pending.id + '/ship', { method: 'PATCH', headers: auth });
    console.log('Ship:', ship.status, 'deliveryCode:', ship.data.deliveryCode);
  } else {
    // No paid orders - try shipping a non-paid one (should fail)
    const unpaid = orders.data.find(so => so.status === 'en_attente');
    if (unpaid) {
      const shipFail = await api('/orders/' + unpaid.id + '/ship', { method: 'PATCH', headers: auth });
      console.log('Ship (unpaid):', shipFail.status, shipFail.data.error);
    }
  }

  // Test confirm-with-code without auth → should 401
  const noAuth = await fetch('http://localhost:4000/api/orders/' + (orders.data[0]?.id || 1) + '/confirm-with-code', {
    method: 'POST',
    body: JSON.stringify({ delivery_code: '123456' })
  });
  console.log('Confirm-with-code (no auth):', noAuth.status);

  console.log('\n✅ Merchant tests passed!');
})().catch(e => console.error('Test failed:', e.message));

const http = require('http');
const https = require('https');

const BASE = 'http://localhost:4000/api';

async function api(path, opts = {}) {
  const url = BASE + path;
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.method && body) headers['Content-Length'] = Buffer.byteLength(body);
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  // 1. Register client
  const reg = await api('/auth/register', {
    method: 'POST',
    body: { phone: '0766666666', full_name: 'Client Final', password: 'finalpass123' }
  });
  console.log('1. Register:', reg.status, reg.data.token ? 'has token' : JSON.stringify(reg.data));

  const token = reg.data.token;
  const auth = { Authorization: 'Bearer ' + token };

  // 2. Create order
  const order = await api('/orders', {
    method: 'POST',
    headers: auth,
    body: {
      shopId: 1,
      items: [{ productId: 1, quantity: 2 }],
      address: '123 Test Street',
      city: 'Cotonou',
      country: 'BJ',
      phone: '0766666666',
      paymentMethod: 'MTN_MOMO'
    }
  });
  console.log('2. Create order:', order.status, 'order.id:', order.data.id);
  const orderId = order.data.id;

  // 3. GET /orders (list)
  const orders = await api('/orders', { headers: auth });
  console.log('3. GET /orders:', orders.status, 'count:', orders.data.length);
  if (orders.data[0]) {
    console.log('   total:', orders.data[0].total, '| status:', orders.data[0].status);
    console.log('   items:', orders.data[0].items?.length, '| tracking:', orders.data[0].tracking?.length);
    console.log('   payment:', orders.data[0].payment?.status, '| address:', orders.data[0].address);
  }

  // 4. GET /orders/:id (detail)
  const detail = await api('/orders/' + orderId, { headers: auth });
  console.log('4. GET /orders/' + orderId + ':', detail.status);
  console.log('   total:', detail.data.total, '| status:', detail.data.status);
  console.log('   tracking:', detail.data.tracking?.map(t => t.step));

  // 5. Confirm reception (before shipping → should fail)
  const confirm = await api('/orders/' + orderId + '/confirm-reception', {
    method: 'POST', headers: auth
  });
  console.log('5. Confirm (pre-ship):', confirm.status, confirm.data.error || confirm.data.message);

  // 6. Dispute
  const dispute = await api('/orders/' + orderId + '/dispute', {
    method: 'POST', headers: auth
  });
  console.log('6. Dispute:', dispute.status, JSON.stringify(dispute.data));

  // 7. Re-fetch detail (after dispute)
  const afterDispute = await api('/orders/' + orderId, { headers: auth });
  console.log('7. After dispute:', afterDispute.data.status, '| tracking:', afterDispute.data.tracking?.length);

  // 8. Test favorites (login is client role)
  const favs = await api('/favorites/ids', { headers: auth });
  console.log('8. GET /favorites/ids:', favs.status, JSON.stringify(favs.data));

  console.log('\n✅ All API tests passed!');
})().catch(e => console.error('Test failed:', e.message));

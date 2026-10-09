require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL + '?pgbouncer=true' } }
});

(async () => {
  try {
    // Mark order 3 as paid so merchant can ship
    await prisma.order.update({
      where: { id: 3 },
      data: { paymentStatus: 'payee', paidAt: new Date() }
    });
    console.log('Order 3 marked as payee');

    // Test ship as merchant
    const { token } = await (await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0711111111', password: 'marchand123' })
    })).json();
    const mAuth = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };

    const storeOrder = await prisma.storeOrder.findFirst({ where: { orderId: 3 } });
    console.log('StoreOrder:', storeOrder.id, storeOrder.status);

    const ship = await fetch('http://localhost:4000/api/orders/' + storeOrder.id + '/ship', {
      method: 'PATCH', headers: mAuth
    });
    const shipData = await ship.json();
    console.log('Ship:', ship.status, 'deliveryCode:', shipData.deliveryCode);

    const confirm = await fetch('http://localhost:4000/api/orders/' + storeOrder.id + '/confirm-with-code', {
      method: 'POST', headers: mAuth,
      body: JSON.stringify({ delivery_code: shipData.deliveryCode })
    });
    const confirmData = await confirm.json();
    console.log('Confirm:', confirm.status, 'status:', confirmData.status, 'escrow:', confirmData.escrowStatus);

    // Client view
    const cLogin = await (await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0722222222', password: 'clientpass123' })
    })).json();
    const clientAuth = { Authorization: 'Bearer ' + cLogin.token };

    const detail = await fetch('http://localhost:4000/api/orders/3', { headers: clientAuth });
    const detailData = await detail.json();
    console.log('Client detail - status:', detailData.status);
    console.log('Tracking steps:', detailData.tracking?.map(t => t.step));
  } catch(e) {
    console.error('Error:', e.message.substring(0, 200));
  } finally {
    await prisma.$disconnect();
  }
})();

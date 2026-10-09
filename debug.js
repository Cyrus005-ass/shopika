(async () => {
  const cLogin = await (await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0722222222', password: 'clientpass123' })
  })).json();
  const clientAuth = { Authorization: 'Bearer ' + cLogin.token };

  const detail = await fetch('http://localhost:4000/api/orders/3', { headers: clientAuth });
  const detailData = await detail.json();
  console.log('Status:', detail.status);
  console.log('Full response:', JSON.stringify(detailData, null, 2));
})();

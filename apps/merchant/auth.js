const API_BASE = (window.SHOPIKA_MERCHANT_CONFIG && window.SHOPIKA_MERCHANT_CONFIG.API_BASE_URL) || 'http://localhost:4000/api';

document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
        showError('');
    });
});

// Lien direct vers l'inscription : login.html?tab=signup (bouton « Créer ma boutique » du site client)
if (new URLSearchParams(location.search).get('tab') === 'signup') {
    const signupTab = document.querySelector('.auth-tab[data-tab="signup"]');
    if (signupTab) signupTab.click();
}

function showError(message) {
    const el = document.getElementById('authError');
    el.textContent = message;
    el.style.display = message ? 'block' : 'none';
}

// Génère automatiquement une adresse propre à partir du nom tapé
// (enlève les accents, les espaces deviennent des tirets, tout en minuscules)
document.getElementById('signupStoreName').addEventListener('input', (e) => {
    const slug = e.target.value
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    document.getElementById('signupSubdomain').value = slug;
});

function saveSessionAndRedirect(token, user) {
    localStorage.setItem('shopika_token', token);
    localStorage.setItem('shopika_user', JSON.stringify(user));
    window.location.href = 'index.html';
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: document.getElementById('loginPhone').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await res.json();
        if (!res.ok) return showError(data.error || 'Connexion impossible');
        saveSessionAndRedirect(data.token, data.user);
    } catch (err) {
        showError('Impossible de joindre le serveur');
    }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    try {
        const registerRes = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: document.getElementById('signupPhone').value,
                full_name: document.getElementById('signupFullName').value,
                password: document.getElementById('signupPassword').value,
                email: document.getElementById('signupEmail').value || undefined
            })
        });
        const registerData = await registerRes.json();
        if (!registerRes.ok) return showError(registerData.error || 'Inscription impossible');

        const becomeRes = await fetch(`${API_BASE}/auth/become-merchant`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${registerData.token}`
            },
            body: JSON.stringify({
                name: document.getElementById('signupStoreName').value,
                subdomain: document.getElementById('signupSubdomain').value
            })
        });
        const becomeData = await becomeRes.json();
        if (!becomeRes.ok) return showError(becomeData.error || 'Création de boutique impossible');

        saveSessionAndRedirect(becomeData.token, becomeData.user);
    } catch (err) {
        showError('Impossible de joindre le serveur');
    }
});
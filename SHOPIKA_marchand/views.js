const Views = {
    dashboard: (merchant) => {
        const rev = merchant.revenue;
        const maxVal = Math.max(...rev.series.map(p => p.value), 1);

        const chartW = 640, chartH = 200, padL = 40, padR = 16, padT = 16, padB = 30;
        const innerW = chartW - padL - padR, innerH = chartH - padT - padB;
        const stepX = innerW / (rev.series.length - 1);
        const points = rev.series.map((p, i) => {
            const x = padL + stepX * i;
            const y = padT + innerH - (p.value / maxVal) * innerH;
            return { x, y, ...p };
        });
        const linePath = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
        const areaPath = linePath + ` L${points[points.length - 1].x.toFixed(1)} ${padT + innerH} L${points[0].x.toFixed(1)} ${padT + innerH} Z`;
        const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => {
            const y = padT + innerH * f;
            const val = Math.round((maxVal * (1 - f)) / 1000);
            return `<line x1="${padL}" y1="${y}" x2="${chartW - padR}" y2="${y}" stroke="var(--border-color)" stroke-width="1"></line>
                     <text x="${padL - 10}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${val}k</text>`;
        }).join('');
        const xLabels = points.map(p => `<text x="${p.x}" y="${chartH - 6}" text-anchor="middle" class="chart-axis-label">${p.label}</text>`).join('');
        const dots = points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--bg-card)" stroke="url(#lineGrad)" stroke-width="2.5"></circle>`).join('');

        // --- Activité récente : construite à partir des vraies commandes/stocks déjà chargés ---
        const recentOrders = (merchant.rawOrders || []).slice(0, 3);
        const lowStock = (merchant.rawProducts || []).filter(p => p.stock > 0 && p.stock < 5).slice(0, 3);
        const activityItems = [
            ...recentOrders.map(o => `<div style="display:flex; gap:10px; align-items:center;"><div style="width:8px;height:8px;background:#10B981;border-radius:50%;flex-shrink:0;"></div><div>Commande #${o.id} — ${o.status.replace('_', ' ')}</div></div>`),
            ...lowStock.map(p => `<div style="display:flex; gap:10px; align-items:center;"><div style="width:8px;height:8px;background:#F59E0B;border-radius:50%;flex-shrink:0;"></div><div>Stock faible : ${p.name} (${p.stock} restant${p.stock > 1 ? 's' : ''})</div></div>`)
        ];
        const activityHtml = activityItems.length
            ? activityItems.join('')
            : `<p style="color: var(--text-muted); text-align: center; padding: 20px 0;">Aucune activité récente pour l'instant.</p>`;

        return `
        <div class="welcome-card">
            <div class="welcome-text">
                <div class="welcome-eyebrow">${getGreeting()}, ${merchant.name} 👋</div>
                <div class="welcome-date">${getTodayLabel()}</div>
                <div class="welcome-revenue">
                    <span class="welcome-revenue-label">Revenus (fonds libérés)</span>
                    <div class="welcome-revenue-value">${formatCurrency(rev.total)}</div>
                </div>
            </div>
            <div class="welcome-actions">
                <button class="btn btn-primary" onclick="router('produits')">+ Ajouter un produit</button>
                <button class="btn btn-ghost-light" onclick="router('commandes')">Voir les commandes</button>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="card kpi-card">
                <div class="kpi-label">Commandes</div>
                <div class="kpi-value">${merchant.ordersCount ?? 0}</div>
            </div>
            <div class="card kpi-card">
                <div class="kpi-label">Produits en ligne</div>
                <div class="kpi-value">${merchant.productsOnlineCount ?? 0}</div>
            </div>
            <div class="card kpi-card">
                <div class="kpi-label">En attente d'expédition</div>
                <div class="kpi-value">${merchant.pendingOrdersCount ?? 0}</div>
            </div>
            <div class="card kpi-card">
                <div class="kpi-label">Abonnement</div>
                <div class="kpi-value" style="font-size: 20px;">Plan ${merchant.plan}</div>
            </div>
        </div>

        <div class="card">
            <div class="table-header">
                <div class="table-title">Performance des ventes</div>
            </div>
                <div class="chart-highlights">
                    <div>
                        <div class="chart-highlight-label">Mois le plus élevé (${rev.highestLabel})</div>
                        <div class="chart-highlight-value">${formatCurrency(rev.highest)}</div>
                    </div>
                    <div>
                        <div class="chart-highlight-label">Mois le plus bas (${rev.lowestLabel})</div>
                        <div class="chart-highlight-value">${formatCurrency(rev.lowest)}</div>
                    </div>
                </div>
                <svg viewBox="0 0 ${chartW} ${chartH}" class="line-chart">
                    <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#FA1757"></stop>
                            <stop offset="100%" stop-color="#FC7914"></stop>
                        </linearGradient>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#FA1757" stop-opacity="0.18"></stop>
                            <stop offset="100%" stop-color="#FC7914" stop-opacity="0"></stop>
                        </linearGradient>
                    </defs>
                    ${gridLines}
                    <path d="${areaPath}" fill="url(#areaGrad)" stroke="none"></path>
                    <path d="${linePath}" fill="none" stroke="url(#lineGrad)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
                    ${dots}
                    ${xLabels}
                </svg>
            </div>

        <div class="card">
            <div class="table-header"><div class="table-title">Activité récente</div></div>
            <div style="display: flex; flex-direction: column; gap: 15px;">${activityHtml}</div>
        </div>
    `;
    },

    
    produits: (merchant) => {
    const allProducts = merchant.rawProducts || [];
    const perPage = 10;
    const page = window.productsPage || 1;
    const totalPages = Math.max(1, Math.ceil(allProducts.length / perPage));
    const startIdx = (page - 1) * perPage;
    const products = allProducts.slice(startIdx, startIdx + perPage);
    const categoryOptions = (window.categoriesCache || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const placeholderImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><rect width="44" height="44" fill="%23222"/></svg>';

    const rows = products.length ? products.map(p => `
        <tr>
            <td><img class="product-thumb" src="${(p.images && p.images[0]) || placeholderImg}" alt="${p.name}"></td>
            <td>${p.name}</td>
            <td>${p.category ? `<span class="category-pill">${p.category.name}</span>` : '<span class="category-pill category-pill-empty">—</span>'}</td>
            <td>${formatCurrency(Number(p.price))}</td>
            <td>
                <button class="icon-action-btn" title="Éditer" onclick="openProductForm(${p.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
                <button class="icon-action-btn icon-action-danger" title="Supprimer" onclick="deleteProduct(${p.id})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                </button>
            </td>
        </tr>
    `).join('') : `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:30px;">Aucun produit pour l'instant — clique sur "+ Ajouter un produit" pour commencer.</td></tr>`;

    const rangeStart = allProducts.length ? startIdx + 1 : 0;
    const rangeEnd = Math.min(startIdx + perPage, allProducts.length);

    return `
    <div class="products-header">
        <div>
            <h2 class="products-title">Gestion des Produits</h2>
            <p class="products-subtitle">Ajoutez, modifiez ou retirez des articles.</p>
        </div>
        <button class="btn btn-primary" onclick="openProductForm()">+ Ajouter un produit</button>
    </div>

    <div class="card">
        <div class="table-scroll"><table>
            <thead><tr><th>Image</th><th>Nom du produit</th><th>Catégorie</th><th>Prix</th><th>Actions</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></div>
        <div class="pagination-bar">
            <span>Affichage ${rangeStart}-${rangeEnd} sur ${allProducts.length}</span>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-ghost" ${page <= 1 ? 'disabled' : ''} onclick="setProductsPage(${page - 1})">Précédent</button>
                <button class="btn btn-ghost" ${page >= totalPages ? 'disabled' : ''} onclick="setProductsPage(${page + 1})">Suivant</button>
            </div>
        </div>
    </div>

    <div class="modal-overlay" id="productFormOverlay">
        <div class="modal-card">
            <div class="modal-header">
                <h3 id="productFormTitle">Ajouter un produit</h3>
                <button class="close-btn" onclick="closeProductForm()">✕</button>
            </div>
            <form id="productForm" onsubmit="submitProductForm(event)">
                <input type="hidden" id="productId">
                <div class="form-group"><label class="form-label">Nom</label><input type="text" class="form-input" id="productName" required></div>
                <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="productDescription"></textarea></div>
                <div class="grid-2-eq">
                    <div class="form-group"><label class="form-label">Prix (F)</label><input type="number" class="form-input" id="productPrice" required min="0" step="1"></div>
                    <div class="form-group"><label class="form-label">Stock</label><input type="number" class="form-input" id="productStock" required min="0" step="1"></div>
                </div>
                <div class="form-group"><label class="form-label">Catégorie</label><select class="form-input" id="productCategory"><option value="">— Aucune —</option>${categoryOptions}</select></div>
                <div class="form-group"><label class="form-label">Image</label><input type="file" class="form-input" id="productImage" accept="image/*"></div>
                <div class="form-group" style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="productPublished" style="width:auto;">
                    <label class="form-label" style="margin:0;" for="productPublished">Publier immédiatement</label>
                </div>
                <p class="auth-error" id="productFormError"></p>
                <button type="submit" class="btn btn-primary" style="width:100%;">Enregistrer</button>
            </form>
        </div>
    </div>
    `;
    },

    categories: (merchant) => {
        // Les catégories sont GLOBALES à la plateforme : le
        // marchand ne les crée pas (il choisit laquelle
        // s'applique à chacun de ses produits). Liste réelle
        // chargée par router.js (window.categoriesCache).
        const cats = window.categoriesCache || [];
        const chips = cats.length ? cats.map(c =>
            `<span class="badge badge-info" style="padding: 10px 15px; font-size: 14px;">${c.name}</span>`
        ).join('') : '<p style="color:var(--text-muted);">Chargement des catégories…</p>';
        return `
        <div class="card">
            <div class="table-header"><div class="table-title">Catégories de la plateforme</div></div>
            <p style="color:var(--text-secondary); font-size:14px; margin-bottom:16px;">Au moment d'ajouter ou modifier un produit, vous l'associez à l'une de ces catégories. Elles sont gérées par Shopika.</p>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">${chips}</div>
        </div>
        `;
    },
    collections: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Collections</h2>
            <p style="color:var(--text-secondary);">Regroupements de produits (saisons, promotions) — bientôt disponibles.</p>
        </div>
    `,
    clients: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Clients</h2>
            <p style="color:var(--text-secondary);">Liste et historique d'achat de vos clients — bientôt disponibles.</p>
        </div>
    `,
    paiements: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Paiements</h2>
            <p style="color:var(--text-secondary);">Historique des encaissements Mobile Money / carte — consultez vos commandes et votre abonnement (menu dédié) en attendant.</p>
        </div>
    `,
    escrow: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Escrow (séquestre)</h2>
            <p style="color:var(--text-secondary);">Chaque commande payée est bloquée en séquestre jusqu'à confirmation de livraison par le client, puis versée sur votre Mobile Money. Le statut de chaque commande est visible dans le menu Commandes (colonne Escrow).</p>
        </div>
    `,
    livraisons: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Livraisons</h2>
            <p style="color:var(--text-secondary);">Expédiez depuis le menu Commandes : un code de livraison à 6 chiffres est généré pour chaque commande, le client le confirme à la réception.</p>
        </div>
    `,
    marketing: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Marketing</h2>
            <p style="color:var(--text-secondary);">Codes promo et campagnes — bientôt disponibles.</p>
        </div>
    `,
    avis: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Avis clients</h2>
            <p style="color:var(--text-secondary);">Le système d'avis n'est pas encore ouvert. Votre note boutique est établie par l'équipe Shopika.</p>
        </div>
    `,
    stats: `
        <div class="card" style="text-align:center; padding:60px;">
            <h2>Statistiques détaillées</h2>
            <p style="color:var(--text-secondary);">Rapports de ventes par catégorie et par période — bientôt disponibles. Le revenu réel (fonds libérés) est déjà affiché sur le Dashboard.</p>
        </div>
    `,

    commandes: (merchant) => {
        const filter = window.currentOrderFilter || 'toutes';
        let orders = merchant.rawOrders || [];
        if (filter === 'attente') orders = orders.filter(o => ['en_attente', 'confirmee'].includes(o.status));
        if (filter === 'expediees') orders = orders.filter(o => o.status === 'expediee');

        const statusLabels = { en_attente: ['En attente', 'badge-warning'], confirmee: ['Confirmée', 'badge-info'], expediee: ['Expédiée', 'badge-info'], livree: ['Livrée', 'badge-success'], terminee: ['Terminée', 'badge-success'], litige: ['Litige', 'badge-danger'], annulee: ['Annulée', 'badge-danger'] };
        const escrowLabels = { bloque: ['Escrow', 'badge-warning'], libere: ['Libéré', 'badge-success'], rembourse: ['Remboursé', 'badge-danger'] };

        const rows = orders.length ? orders.map(o => {
            const [statusText, statusClass] = statusLabels[o.status] || [o.status, 'badge-info'];
            const [escrowText, escrowClass] = escrowLabels[o.escrowStatus] || [o.escrowStatus, 'badge-info'];
            const canShip = o.status === 'en_attente' || o.status === 'confirmee';
            return `
            <tr>
                <td>#${o.id}</td>
                <td>${o.order?.client?.fullName || '—'}</td>
                <td>${formatCurrency(Number(o.subtotal))}</td>
                <td><span class="badge ${escrowClass}">${escrowText}</span></td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${canShip ? `<button class="btn btn-ghost" style="padding: 5px 10px;" onclick="shipOrderNow(${o.id})">Expédier</button>` : '—'}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:30px;">Aucune commande pour l'instant.</td></tr>`;

        return `
        <div class="card">
            <div class="table-header">
                <div class="table-title">Gestion des Commandes</div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn ${filter === 'toutes' ? 'btn-primary' : 'btn-ghost'}" onclick="setOrderFilter('toutes')">Toutes</button>
                    <button class="btn ${filter === 'attente' ? 'btn-primary' : 'btn-ghost'}" onclick="setOrderFilter('attente')">En attente</button>
                    <button class="btn ${filter === 'expediees' ? 'btn-primary' : 'btn-ghost'}" onclick="setOrderFilter('expediees')">Expédiées</button>
                </div>
            </div>
            <div class="table-scroll"><table>
                <thead><tr><th>N° Commande</th><th>Client</th><th>Montant</th><th>Paiement</th><th>Statut</th><th>Action</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
        </div>
    `;
    },

    clients: `
        <div class="card">
            <div class="table-header"><div class="table-title">Base de Clients</div></div>
            <div class="table-scroll"><table>
                <thead><tr><th>Client</th><th>Contact</th><th>Commandes</th><th>Total dépensé</th><th>Statut</th></tr></thead>
                <tbody>
                    <tr><td>Awa Kouassi</td><td>+225 07 00 00 00</td><td>5</td><td>125 000 F</td><td><span class="badge badge-success">Fidèle</span></td></tr>
                    <tr><td>Koffi Mensah</td><td>+225 05 00 00 00</td><td>1</td><td>12 500 F</td><td><span class="badge badge-info">Nouveau</span></td></tr>
                </tbody>
            </table></div>
        </div>
    `,
    paiements: `
        <div class="kpi-grid">
            <div class="card kpi-card"><div class="kpi-label">Solde Disponible</div><div class="kpi-value">850 000 F</div><button class="btn btn-primary" style="margin-top: 15px;">Retirer</button></div>
            <div class="card kpi-card"><div class="kpi-label">Fonds en Attente</div><div class="kpi-value">320 000 F</div></div>
            <div class="card kpi-card"><div class="kpi-label">Total Retiré</div><div class="kpi-value">2 400 000 F</div></div>
        </div>
        <div class="card">
            <div class="table-header"><div class="table-title">Historique des Transactions</div></div>
            <div class="table-scroll"><table>
                <thead><tr><th>ID</th><th>Date</th><th>Montant</th><th>Méthode</th><th>Statut</th></tr></thead>
                <tbody>
                    <tr><td>#TRX884</td><td>12 Juin 2024</td><td>45 000 F</td><td>Wave</td><td><span class="badge badge-success">Libéré</span></td></tr>
                    <tr><td>#TRX883</td><td>10 Juin 2024</td><td>15 000 F</td><td>MTN MoMo</td><td><span class="badge badge-warning">Bloqué</span></td></tr>
                </tbody>
            </table></div>
        </div>
    `,
    escrow: `
        <div class="card">
            <div class="table-header"><div class="table-title">Mécanisme de Séquestre (Escrow)</div></div>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Les fonds sont sécurisés jusqu'à validation de la réception par le client.</p>
            <div class="table-scroll"><table>
                <thead><tr><th>Commande</th><th>Client</th><th>Montant Bloqué</th><th>Statut Livraison</th><th>Action</th></tr></thead>
                <tbody>
                    <tr><td>#1042</td><td>Awa Kouassi</td><td>45 000 F</td><td>En attente de validation</td><td><button class="btn btn-primary">Forcer la libération</button></td></tr>
                </tbody>
            </table></div>
        </div>
    `,
    livraisons: `
        <div class="card">
            <div class="table-header"><div class="table-title">Suivi des Livraisons</div></div>
            <div class="table-scroll"><table>
                <thead><tr><th>Commande</th><th>Livreur</th><th>N° Suivi</th><th>Statut</th><th>Action</th></tr></thead>
                <tbody>
                    <tr><td>#1041</td><td>UPS Afrique</td><td>1Z999AA10123456784</td><td><span class="badge badge-info">En transit</span></td><td><button class="btn btn-ghost">Suivre</button></td></tr>
                    <tr><td>#1040</td><td>DHL Express</td><td>1234567890</td><td><span class="badge badge-success">Livré</span></td><td><button class="btn btn-ghost">Détails</button></td></tr>
                </tbody>
            </table></div>
        </div>
    `,
    marketplace: `
        <div class="card" style="text-align: center; padding: 60px;">
            <h2 style="margin-bottom: 15px;">Visibilité Marketplace</h2>
            <p style="color: var(--text-secondary); margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">Activez votre boutique sur la marketplace Shopika pour toucher des milliers de clients supplémentaires.</p>
            <label class="switch" style="display: inline-block; position: relative; width: 60px; height: 34px;">
                <input type="checkbox" checked style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #2A2F3D; transition: .4s; border-radius: 34px;"></span>
            </label>
            <p style="margin-top: 15px; color: var(--color-success); font-weight: 600;">Boutique Active</p>
        </div>
    `,
    marketing: `
        <div class="grid-2-eq">
            <div class="card">
                <h3 style="margin-bottom: 15px;">Campagnes WhatsApp</h3>
                <div class="form-group">
                    <label class="form-label">Message</label>
                    <textarea class="form-input" placeholder="Promo exceptionnelle..."></textarea>
                </div>
                <button class="btn btn-primary">Envoyer à 120 clients</button>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 15px;">Codes Promo</h3>
                <div class="form-group">
                    <label class="form-label">Code</label>
                    <input type="text" class="form-input" placeholder="ETE2024">
                </div>
                <div class="form-group">
                    <label class="form-label">Réduction (%)</label>
                    <input type="number" class="form-input" placeholder="20">
                </div>
                <button class="btn btn-primary">Créer le code</button>
            </div>
        </div>
    `,
    avis: `
        <div class="card">
            <div class="table-header"><div class="table-title">Avis Clients</div></div>
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>Awa Kouassi</strong> <span style="color: var(--yellow-glow);">★★★★★</span>
                    </div>
                    <p style="color: var(--text-secondary);">Produit conforme à la description, livraison rapide. Je recommande !</p>
                </div>
                <div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>Koffi Mensah</strong> <span style="color: var(--yellow-glow);">★★★★☆</span>
                    </div>
                    <p style="color: var(--text-secondary);">Bon produit mais emballage un peu abîmé.</p>
                </div>
            </div>
        </div>
    `,
    messages: `
        <div class="card" style="text-align: center; padding: 60px;">
            <h2 style="margin-bottom: 15px;">Messagerie via WhatsApp</h2>
            <p style="color: var(--text-secondary); max-width: 500px; margin: 0 auto;">
                Shopika ne gère pas de messagerie interne : chaque message client vous est directement redirigé vers votre WhatsApp Business. Aucune configuration à faire ici.
            </p>
        </div>
    `,
    abonnement: async () => {
        // Statut réel depuis le backend : subscriptionExpiresAt
        // est la seule source de vérité (la boutique est active
        // si et seulement si cette date est dans le futur).
        let sub = null, error = null;
        try {
            const res = await fetch(`${API_BASE}/stores/me/subscription`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) sub = await res.json();
            else error = (await res.json()).error || 'Erreur de chargement';
        } catch (e) { error = 'Impossible de joindre le serveur'; }

        if (error) {
            return `<div class="card plan-card">
                <h2 style="font-size: 24px; margin-bottom: 10px;">Abonnement boutique</h2>
                <p style="color:#EF4444;">${error}</p>
            </div>`;
        }

        const active = sub.active;
        const expires = sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString('fr-FR') : '—';
        const amount = sub.amountDue ? `${Number(sub.amountDue).toLocaleString('fr-FR')} FCFA` : '—';
        const label = sub.isFirstPayment ? 'Frais de création (une fois)' : 'Réabonnement mensuel';

        return `
        <div class="card plan-card">
            <div class="plan-icon">
                <svg width="30" height="30" viewBox="0 24 24" fill="none" stroke="white" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </div>
            <h2 style="font-size: 28px; margin-bottom: 10px;">Abonnement boutique</h2>
            <p style="color:var(--text-secondary); margin-bottom: 6px;">Statut : <strong style="color:${active ? '#10B981' : '#F59E0B'};">${active ? 'Actif' : 'Expiré — à renouveler'}</strong></p>
            <p style="color:var(--text-secondary); margin-bottom: 6px;">Expiration : <strong>${expires}</strong></p>
            <p style="color:var(--text-secondary); margin-bottom: 20px;">Prochain paiement : <strong>${label}</strong> — <strong>${amount}</strong></p>
            ${active
                ? `<p style="color:var(--text-secondary); max-width: 420px;">Votre boutique est visible sur la marketplace. Sans renouvellement, elle disparaît automatiquement à l'expiration (jour pour jour).</p>`
                : `<button class="btn btn-primary" id="paySubscriptionBtn" onclick="paySubscription()">Payer ${amount}</button>
                   <p style="color:var(--text-secondary); font-size:13px; max-width: 420px; margin-top:12px;">Vous serez redirigé vers FedaPay (Mobile Money ou carte). La boutique redevient visible dès la confirmation du paiement — aucune action supplémentaire.</p>`}
        </div>`;
    },
    stats: `
        <div class="kpi-grid">
            <div class="card kpi-card"><div class="kpi-label">Visites Totales</div><div class="kpi-value">12 400</div></div>
            <div class="card kpi-card"><div class="kpi-label">Panier Moyen</div><div class="kpi-value">18 500 F</div></div>
            <div class="card kpi-card"><div class="kpi-label">Taux de Rebond</div><div class="kpi-value">42%</div></div>
        </div>
        <div class="card">
            <div class="table-header"><div class="table-title">Analyse des Ventes</div></div>
            <p style="color: var(--text-secondary); text-align: center; padding: 50px 0;">Graphique détaillé des ventes par catégorie.</p>
        </div>
    `,
    personnalisation: (merchant) => `
        <div class="grid-2-eq">
            <div class="card">
                <h3 style="margin-bottom: 20px;">Identité Visuelle</h3>
                <div class="form-group"><label class="form-label">Nom de la boutique</label><input type="text" class="form-input" id="appearanceName" value="${merchant.name}"></div>
                <div class="form-group"><label class="form-label">Couleur principale</label><input type="color" id="appearancePrimary" value="${merchant.colorPrimary || '#FA1757'}" style="width: 100%; height: 40px; background: none; border: 1px solid var(--border-color); border-radius: 10px;"></div>
                <div class="form-group"><label class="form-label">Couleur secondaire</label><input type="color" id="appearanceSecondary" value="${merchant.colorSecondary || '#FC7914'}" style="width: 100%; height: 40px; background: none; border: 1px solid var(--border-color); border-radius: 10px;"></div>
                <button class="btn btn-primary" onclick="saveAppearance()">Enregistrer les modifications</button>
                <p id="appearanceStatus" style="margin-top:8px; font-size:13px;"></p>
            </div>
            <div class="card">
                <h3 style="margin-bottom: 20px;">Adresse de la boutique</h3>
                <div class="form-group"><label class="form-label">Sous-domaine Shopika</label><input type="text" class="form-input" value="${merchant.subdomain || ''}.shopika.com" disabled></div>
                <p style="color:var(--text-secondary); font-size:13px;">Le sous-domaine est unique et ne peut pas être modifié après la création. Les domaines personnalisés (votre-propre-domaine.com) arrivent prochainement.</p>
            </div>
        </div>
    `,
    parametres: (merchant) => `
        <div class="card">
            <h3 style="margin-bottom: 20px;">Notifications par e-mail (Gmail)</h3>
            <p style="color:var(--text-secondary); font-size:13px; margin-bottom:16px;">Un e-mail vous est envoyé à chaque commande payée (détail des articles) et quand le stock d'un produit passe sous 5 exemplaires. Renseignez l'adresse de votre boutique pour les recevoir.</p>
            <div class="form-group"><label class="form-label">E-mail de notification</label>
                <input type="email" class="form-input" id="settingsEmail" value="${merchant.email || ''}" placeholder="maboutique@gmail.com">
            </div>
            <div class="form-group"><label class="form-label">Notifications e-mail</label>
                <select class="form-input" id="settingsEmailNotif">
                    <option value="true" ${merchant.emailNotifications !== false ? 'selected' : ''}>Activées</option>
                    <option value="false" ${merchant.emailNotifications === false ? 'selected' : ''}>Désactivées</option>
                </select>
            </div>
            <button class="btn btn-primary" onclick="saveNotificationSettings()">Enregistrer les notifications</button>
            <p id="notifStatus" style="margin-top:8px; font-size:13px;"></p>
        </div>
        <div class="card" style="margin-top:20px;">
            <h3 style="margin-bottom: 20px;">Compte</h3>
            <div class="form-group"><label class="form-label">Téléphone (identifiant de connexion)</label><input type="text" class="form-input" value="${merchant.phone || ''}" disabled></div>
            <p style="color:var(--text-secondary); font-size:13px;">Le téléphone sert d'identifiant : pour le modifier, contactez le support Shopika.</p>
        </div>
        <div class="card" style="margin-top:20px;">
            <h3 style="margin-bottom: 20px;">Livraison & versements</h3>
            <div class="form-group"><label class="form-label">Frais de livraison (FCFA, ajoutés à chaque commande de cette boutique)</label>
                <input type="number" class="form-input" id="settingsShippingFee" min="0" step="1" value="${merchant.shippingFee || 0}">
            </div>
            <div class="form-group"><label class="form-label">Numéro Mobile Money pour recevoir les versements</label>
                <input type="tel" class="form-input" id="settingsPayoutPhone" value="${merchant.payoutPhone || ''}" placeholder="+225 07 00 00 00">
            </div>
            <div class="form-group"><label class="form-label">Pays du versement (code ISO, ex: CI)</label>
                <input type="text" class="form-input" id="settingsPayoutCountry" value="${merchant.payoutCountry || ''}" placeholder="CI" maxlength="2">
            </div>
            <button class="btn btn-primary" onclick="saveStoreSettings()">Enregistrer</button>
            <p id="storeStatus" style="margin-top:8px; font-size:13px;"></p>
        </div>
    `,
    support: async () => {
        // Historique réel des échanges marchand ↔ support Shopika.
        let messages = [], error = null;
        try {
            const res = await fetch(`${API_BASE}/support/my`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            if (res.ok) messages = await res.json();
            else error = 'Erreur de chargement de l\'historique';
        } catch (e) { error = 'Impossible de joindre le serveur'; }

        const list = messages.length === 0
            ? '<p style="color:var(--text-secondary); text-align:center; padding:20px 0;">Aucun échange pour l\'instant.</p>'
            : messages.map(m => `
                <div class="card" style="margin-bottom:12px; padding:16px;">
                    <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:6px;">
                        <strong>${m.subject}</strong>
                        <span style="font-size:12px; color:var(--text-secondary); white-space:nowrap;">${new Date(m.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p style="margin:6px 0; color:var(--text-secondary);">${m.message}</p>
                    ${m.adminReply
                        ? `<div style="background:var(--bg-card, rgba(0,0,0,0.2)); border-left:3px solid #FA1757; padding:10px 12px; margin-top:8px; font-size:13px;"><strong>Support Shopika :</strong> ${m.adminReply}</div>`
                        : '<p style="font-size:12px; color:var(--text-secondary); margin-top:8px;">En attente de réponse du support…</p>'}
                </div>`).join('');

        return `
        <div class="card" style="max-width: 600px; margin: 0 auto;">
            <h3 style="margin-bottom: 20px; text-align: center;">Contacter le Support Shopika</h3>
            <div class="form-group"><label class="form-label">Sujet</label><input type="text" class="form-input" id="supportSubject" placeholder="Problème de paiement..."></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="form-input" id="supportMessage" style="min-height: 150px;"></textarea></div>
            <button class="btn btn-primary" style="width:100%;" onclick="sendSupportMessage()">Envoyer le ticket</button>
            <p id="supportStatus" style="margin-top:8px; font-size:13px; text-align:center;"></p>
        </div>
        <h3 style="margin:24px 0 12px;">Échanges précédents</h3>
        ${error ? `<p style="color:#EF4444;">${error}</p>` : list}`;
    }
};

// ===================================================================
// Actions des vues (appelées via onclick="...").
// API_BASE, authToken, merchant et router viennent de
// router.js (chargé après views.js, mais ces fonctions ne
// s'exécutent que sur interaction, quand tout est chargé).
// ===================================================================

// Abonnement : paiement FedaPay (frais de création ou réabonnement)
window.paySubscription = async () => {
    const btn = document.getElementById('paySubscriptionBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Redirection…'; }
    try {
        const res = await fetch(`${API_BASE}/stores/me/subscription/pay`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Impossible d'initier le paiement");
        window.location.href = data.paymentUrl; // FedaPay (Mobile Money / carte)
    } catch (e) {
        alert(e.message);
        if (btn) { btn.disabled = false; btn.textContent = 'Payer'; }
    }
};

// Personnalisation : identité visuelle de la boutique
window.saveAppearance = async () => {
    const status = document.getElementById('appearanceStatus');
    const name = document.getElementById('appearanceName').value.trim();
    if (!name) { status.textContent = 'Le nom de la boutique est requis.'; status.style.color = '#EF4444'; return; }
    const body = {
        name,
        color_primary: document.getElementById('appearancePrimary').value,
        color_secondary: document.getElementById('appearanceSecondary').value
    };
    try {
        const res = await fetch(`${API_BASE}/stores`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        merchant.name = body.name;
        merchant.colorPrimary = body.color_primary;
        merchant.colorSecondary = body.color_secondary;
        applyMerchantIdentity();
        status.textContent = 'Modifications enregistrées.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Paramètres : e-mail de notification + opt-out (PATCH /auth/me)
window.saveNotificationSettings = async () => {
    const status = document.getElementById('notifStatus');
    const email = document.getElementById('settingsEmail').value.trim();
    const emailNotifications = document.getElementById('settingsEmailNotif').value === 'true';
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ email: email || null, emailNotifications })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        const stored = JSON.parse(localStorage.getItem('shopika_user') || '{}');
        stored.email = data.user.email;
        stored.emailNotifications = data.user.emailNotifications;
        localStorage.setItem('shopika_user', JSON.stringify(stored));
        merchant.email = data.user.email;
        merchant.emailNotifications = data.user.emailNotifications;
        status.textContent = 'Préférences enregistrées.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Paramètres : livraison & coordonnées de versement (PATCH /stores)
window.saveStoreSettings = async () => {
    const status = document.getElementById('storeStatus');
    const body = {
        shipping_fee: Number(document.getElementById('settingsShippingFee').value) || 0,
        payout_phone: document.getElementById('settingsPayoutPhone').value.trim() || null,
        payout_country: document.getElementById('settingsPayoutCountry').value.trim().toUpperCase() || null
    };
    try {
        const res = await fetch(`${API_BASE}/stores`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        merchant.shippingFee = body.shipping_fee;
        merchant.payoutPhone = body.payout_phone;
        merchant.payoutCountry = body.payout_country;
        status.textContent = 'Enregistré.';
        status.style.color = '#10B981';
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};

// Support : envoi d'un ticket (POST /support)
window.sendSupportMessage = async () => {
    const status = document.getElementById('supportStatus');
    const subject = document.getElementById('supportSubject').value.trim();
    const message = document.getElementById('supportMessage').value.trim();
    if (!subject || !message) {
        status.textContent = 'Sujet et message requis.';
        status.style.color = '#EF4444';
        return;
    }
    status.textContent = 'Envoi…';
    status.style.color = 'var(--text-secondary)';
    try {
        const res = await fetch(`${API_BASE}/support`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ subject, message })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        router('support'); // réaffiche avec le ticket envoyé
    } catch (e) {
        status.textContent = e.message;
        status.style.color = '#EF4444';
    }
};
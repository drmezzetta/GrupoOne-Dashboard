const CATEGORY_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];
const money = (n) => (n === null || n === undefined ? '—' : `$ ${Math.round(n).toLocaleString('es-AR')}`);
const num = (n) => (n === null || n === undefined ? '—' : Math.round(n).toLocaleString('es-AR'));

function yyyymmdd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function currentRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (Number(days) - 1));
  return { startDate: yyyymmdd(start), endDate: yyyymmdd(end) };
}

async function fetchJson(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('no_autenticado');
  }
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'error'), { data });
  return data;
}

function showBanner(msg) {
  const el = document.getElementById('banner');
  el.textContent = msg;
  el.hidden = false;
}

function renderKpis(kpis) {
  const items = [
    { label: 'Unidades vendidas', value: num(kpis.unidadesVendidas) },
    { label: 'Facturación estimada', value: money(kpis.facturacion) },
    { label: 'Margen bruto', value: kpis.margenPct === null ? '—' : `${kpis.margenPct.toFixed(1)}%` },
    { label: 'Stock total', value: `${num(kpis.stockTotal)} u.` },
    { label: 'SKUs en quiebre', value: num(kpis.skusEnQuiebre) },
  ];
  const row = document.getElementById('kpiRow');
  row.innerHTML = items
    .map(
      (k) => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
    </div>`
    )
    .join('');
}

function renderTrend(tendencia) {
  const w = 848, h = 190;
  const svg = document.getElementById('trendSvg');
  const values = tendencia.map((t) => t.unidades);
  const max = Math.max(1, ...values) * 1.15;

  const points = values.map((v, i) => {
    const x = i * (w / (values.length - 1 || 1));
    const y = h - (v / max) * h;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = points[points.length - 1] || [0, h];

  svg.innerHTML = `
    <line x1="0" x2="${w}" y1="0" y2="0" stroke="var(--grid)" stroke-width="1"/>
    <line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" stroke="var(--grid)" stroke-width="1"/>
    <line x1="0" x2="${w}" y1="${h}" y2="${h}" stroke="var(--grid)" stroke-width="1"/>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="var(--accent)"/>
    <text x="${(last[0] - 34).toFixed(1)}" y="${(last[1] - 12).toFixed(1)}" font-size="12" font-weight="600" fill="var(--ink-primary)">${Math.round(
    values[values.length - 1] || 0
  )}</text>
  `;

  document.getElementById('trendAxis').innerHTML = tendencia
    .map((t) => `<span>${t.desde.slice(4, 6)}/${t.desde.slice(6, 8)}</span>`)
    .join('');
}

function renderCategories(categorias) {
  const total = categorias.reduce((s, c) => s + c.unidades, 0) || 1;
  let acc = 0;
  const stops = categorias
    .map((c, i) => {
      const from = (acc / total) * 100;
      acc += c.unidades;
      const to = (acc / total) * 100;
      return `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} ${from.toFixed(1)}% ${to.toFixed(1)}%`;
    })
    .join(', ');
  document.getElementById('donut').style.background = `conic-gradient(${stops})`;
  document.getElementById('donutCenter').innerHTML = `<div class="val">${num(total)}</div><div class="unit">unidades</div>`;

  document.getElementById('categoryLegend').innerHTML = categorias
    .map((c, i) => {
      const pct = ((c.unidades / total) * 100).toFixed(0);
      return `<div class="legend-row">
        <span><span class="legend-dot" style="background:${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"></span>${c.nombre}</span>
        <span class="legend-pct">${pct}%</span>
      </div>`;
    })
    .join('');
}

function renderProducts(productos) {
  document.getElementById('productsBody').innerHTML = productos
    .map(
      (p) => `
    <tr>
      <td class="sku">${p.sku.replace(/^0+(?=\d{6})/, '…')}</td>
      <td>${p.descripcion}</td>
      <td style="color:var(--ink-secondary)">${p.categoria}</td>
      <td class="num">${num(p.unidades)}</td>
      <td class="num">${money(p.importe)}</td>
      <td class="num"><span class="cov-pill cov-${p.cobertura.nivel}">${p.cobertura.label}</span></td>
    </tr>`
    )
    .join('');
}

function renderAlerts(alertas) {
  const iconWarn = 'M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 004 21h16a2 2 0 001.89-2.96L13.71 3.86a2 2 0 00-3.42 0z';
  const list = document.getElementById('alertsList');
  if (alertas.length === 0) {
    list.innerHTML = `<div class="alert-detail">Sin alertas de cobertura en este período.</div>`;
    return;
  }
  list.innerHTML = alertas
    .map((a) => {
      const color = a.cobertura.nivel === 'critico' ? 'var(--critical)' : 'var(--warning)';
      return `<div class="alert-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:2px;flex-shrink:0;"><path d="${iconWarn}"/></svg>
        <div>
          <div class="alert-title">${a.descripcion} — ${a.cobertura.label} de cobertura</div>
          <div class="alert-detail">Stock actual: ${num(a.stockActual)} u. · Vendidas en el período: ${num(a.unidades)} u.</div>
        </div>
      </div>`;
    })
    .join('');
}

async function loadDashboard() {
  const companyCode = document.getElementById('empresaSelect').value;
  const store = document.getElementById('sucursalSelect').value;
  const days = document.getElementById('rangoSelect').value;
  if (!companyCode || !store) return;

  const { startDate, endDate } = currentRange(days);
  const url = `/api/dashboard?companyCode=${companyCode}&store=${store}&startDate=${startDate}&endDate=${endDate}`;

  try {
    const data = await fetchJson(url);
    document.getElementById('banner').hidden = true;
    renderKpis(data.kpis);
    renderTrend(data.tendencia);
    renderCategories(data.categorias);
    renderProducts(data.topProductos);
    renderAlerts(data.alertas);
    document.getElementById('footnote').textContent =
      `${data.empresa.name} · ${data.sucursal.name} · ${data.periodo.dias} días · actualizado ${new Date().toLocaleTimeString('es-AR')}`;
  } catch (err) {
    if (err.data && err.data.error === 'api_upstream_no_disponible') {
      showBanner('Una de las APIs no respondió y no hay datos de muestra habilitados (DEMO_MODE_FALLBACK=false). Mostrando la última información disponible.');
    } else {
      showBanner(`No se pudo cargar el dashboard: ${err.message}`);
    }
  }
}

async function loadSucursales(companyCode) {
  const sucursales = await fetchJson(`/api/sucursales?companyCode=${companyCode}`);
  const select = document.getElementById('sucursalSelect');
  select.innerHTML = sucursales.map((s) => `<option value="${s.code}">${s.name}</option>`).join('');
}

async function init() {
  const session = await fetchJson('/api/session');
  if (!session.authenticated) {
    window.location.href = '/login.html';
    return;
  }
  const chip = document.getElementById('userChip');
  if (session.user.picture) {
    chip.style.backgroundImage = `url(${session.user.picture})`;
    chip.title = session.user.name || session.user.email;
  } else {
    chip.textContent = (session.user.name || session.user.email || '?').slice(0, 2).toUpperCase();
    chip.title = session.user.name || session.user.email;
  }

  const empresas = await fetchJson('/api/empresas');
  const empresaSelect = document.getElementById('empresaSelect');
  empresaSelect.innerHTML = empresas.map((e) => `<option value="${e.code}">${e.name} — ${e.country}</option>`).join('');
  await loadSucursales(empresas[0].code);

  document.getElementById('empresaSelect').addEventListener('change', async (e) => {
    await loadSucursales(e.target.value);
    loadDashboard();
  });
  document.getElementById('sucursalSelect').addEventListener('change', loadDashboard);
  document.getElementById('rangoSelect').addEventListener('change', loadDashboard);

  loadDashboard();
}

init().catch((err) => console.error(err));

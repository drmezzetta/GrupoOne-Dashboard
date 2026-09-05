require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');

const { configurePassport } = require('./auth');
const { requireAuth } = require('./middleware/requireAuth');
const { UpstreamApiError } = require('./services/httpClient');
const dashboardService = require('./services/dashboardService');
const masterData = require('./services/masterDataService');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  SESSION_SECRET no está definido en .env — usando uno temporal (no usar así en producción).');
}

configurePassport();

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cambiar-en-produccion',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // requiere HTTPS en producción
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

// ---------- Login con Google ----------
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=1' }),
  (req, res) => res.redirect('/')
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/login.html'));
});

app.get('/api/session', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.json({ authenticated: true, user: req.user });
  }
  res.json({ authenticated: false });
});

// ---------- Datos de referencia (para los selectores del dashboard) ----------
app.get('/api/empresas', requireAuth, (req, res) => {
  res.json(masterData.listCompanies());
});

app.get('/api/sucursales', requireAuth, (req, res) => {
  res.json(masterData.listStores(req.query.companyCode));
});

// ---------- Dashboard agregado (ventas + stock + rentabilidad) ----------
app.get('/api/dashboard', requireAuth, async (req, res) => {
  const { companyCode, store, startDate, endDate } = req.query;

  if (!companyCode || !store || !startDate || !endDate) {
    return res.status(400).json({
      error: 'parametros_faltantes',
      message: 'Se requieren companyCode, store, startDate (YYYYMMDD) y endDate (YYYYMMDD).',
    });
  }

  try {
    const data = await dashboardService.getDashboard({ companyCode, store, startDate, endDate });
    res.json(data);
  } catch (err) {
    if (err instanceof UpstreamApiError) {
      console.error('[dashboard] error de API upstream:', err.message);
      return res.status(502).json({ error: 'api_upstream_no_disponible', message: err.message });
    }
    console.error('[dashboard] error inesperado:', err);
    res.status(500).json({ error: 'error_interno' });
  }
});

// ---------- Frontend estático ----------
const publicDir = path.join(__dirname, '..', 'public');
app.use('/login.html', express.static(path.join(publicDir, 'login.html')));
app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/js', express.static(path.join(publicDir, 'js')));

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`GrupoOne Dashboard escuchando en http://localhost:${PORT}`);
  if (String(process.env.DEMO_MODE_FALLBACK).toLowerCase() === 'true') {
    console.log('DEMO_MODE_FALLBACK=true: si una API real falla, se van a servir datos de muestra.');
  }
});

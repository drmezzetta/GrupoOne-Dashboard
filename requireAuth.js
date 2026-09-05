// Protege rutas: exige sesión iniciada con Google. Para pedidos de API (fetch
// del frontend) devuelve 401 JSON; para navegación de página devuelve un
// redirect a /login.html.
function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'no_autenticado' });
  }
  return res.redirect('/login.html');
}

module.exports = { requireAuth };

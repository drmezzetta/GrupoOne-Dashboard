// Cache en memoria con expiración (TTL). No hay base de datos: esto solo evita
// golpear las APIs de Integration Suite en cada refresco de pantalla.
// Se pierde al reiniciar el proceso — es exactamente lo que buscamos (no persiste nada).

const store = new Map();

function ttlMs() {
  const seconds = Number(process.env.CACHE_TTL_SECONDS || 120);
  return seconds * 1000;
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

function set(key, value) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs() });
}

// Evita "estampidas": si dos pedidos piden la misma clave al mismo tiempo,
// que la llamada real a la API se haga una sola vez.
const inFlight = new Map();

async function getOrLoad(key, loader) {
  const cached = get(key);
  if (cached !== undefined) return cached;

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    try {
      const value = await loader();
      set(key, value);
      return value;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

module.exports = { get, set, getOrLoad };

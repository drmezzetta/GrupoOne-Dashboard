// Wrapper chico sobre fetch: agrega Basic Auth y un timeout, y homogeneiza errores.
// Usa el fetch global de Node (disponible desde Node 18+), sin dependencias extra.

class UpstreamApiError extends Error {
  constructor(message, { status, cause } = {}) {
    super(message);
    this.name = 'UpstreamApiError';
    this.status = status;
    this.cause = cause;
  }
}

function basicAuthHeader(user, pass) {
  if (!user || !pass) return null;
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

async function request(url, { method = 'GET', user, pass, timeoutMs = 15000, headers = {}, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const authHeader = basicAuthHeader(user, pass);
  const finalHeaders = { Accept: 'application/json', ...headers };
  if (authHeader) finalHeaders.Authorization = authHeader;
  if (body !== undefined) finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';

  try {
    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();

    if (!res.ok) {
      throw new UpstreamApiError(`La API respondió ${res.status} ${res.statusText}`, {
        status: res.status,
        cause: text.slice(0, 500),
      });
    }

    // Algunas de estas APIs (stock, rentabilidad — ambas OData) pueden devolver
    // XML/Atom según el Accept que respeten. Intentamos JSON primero; si falla,
    // devolvemos texto crudo para que la capa de servicio decida cómo parsearlo.
    try {
      return JSON.parse(text);
    } catch {
      return { __raw: text };
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new UpstreamApiError('La API no respondió a tiempo (timeout)', { cause: err });
    }
    if (err instanceof UpstreamApiError) throw err;
    throw new UpstreamApiError(`No se pudo conectar con la API: ${err.message}`, { cause: err });
  } finally {
    clearTimeout(timeout);
  }
}

const getJson = (url, opts) => request(url, { ...opts, method: 'GET' });
const postJson = (url, body, opts) => request(url, { ...opts, method: 'POST', body });

module.exports = { getJson, postJson, UpstreamApiError };

// API de Ventas (Integration Suite): devuelve, para una empresa + sucursal + rango
// de fechas, una lista de SKU con la cantidad vendida en TODO el rango (no día a día).
//
// Ejemplo real:
// GET {VENTAS_API_URL}?CompanyCode=AR10&Store=T011&StartDate=20260820&EndDate=20260903
// -> [ { "ART_ITEMID": "000000000004195021", "ART_QUANTITY": 25.000 }, ... ]

const { getJson } = require('./httpClient');
const { splitIntoBuckets } = require('./dateUtils');
const cache = require('../cache');
const { normalizeSku } = require('./skuUtils');
const { sampleVentas } = require('../data/sampleData');

function buildUrl({ companyCode, store, startDate, endDate }) {
  const base = process.env.VENTAS_API_URL;
  const url = new URL(base);
  url.searchParams.set('CompanyCode', companyCode);
  url.searchParams.set('Store', store);
  url.searchParams.set('StartDate', startDate);
  url.searchParams.set('EndDate', endDate);
  return url.toString();
}

function fallbackAllowed() {
  return String(process.env.DEMO_MODE_FALLBACK).toLowerCase() === 'true';
}

// Devuelve [{ sku, units }] para el rango pedido (agregado por SKU, tal cual la API).
async function getVentasPorSku({ companyCode, store, startDate, endDate }) {
  const cacheKey = `ventas:${companyCode}:${store}:${startDate}:${endDate}`;
  return cache.getOrLoad(cacheKey, async () => {
    try {
      const url = buildUrl({ companyCode, store, startDate, endDate });
      const data = await getJson(url, {
        user: process.env.IS_BASIC_AUTH_USER,
        pass: process.env.IS_BASIC_AUTH_PASS,
      });
      const rows = Array.isArray(data) ? data : (data.d && data.d.results) || [];
      return rows.map((r) => ({
        sku: normalizeSku(r.ART_ITEMID || r.Art_Itemid),
        units: Number(r.ART_QUANTITY ?? r.Art_Quantity ?? 0),
      }));
    } catch (err) {
      if (fallbackAllowed()) {
        console.warn(`[ventas] usando datos de muestra — ${err.message}`);
        return sampleVentas();
      }
      throw err;
    }
  });
}

// Arma una tendencia aproximada dividiendo el rango pedido en varios tramos y
// llamando la API una vez por tramo (la API no da desglose diario). Menos
// llamadas = tendencia más "escalonada"; más llamadas = más fina pero más carga
// sobre Integration Suite. 6 tramos es un compromiso razonable para 30 días.
async function getTendencia({ companyCode, store, startDate, endDate, buckets = 6 }) {
  const ranges = splitIntoBuckets(startDate, endDate, buckets);
  const puntos = [];
  for (const r of ranges) {
    const filas = await getVentasPorSku({ companyCode, store, startDate: r.start, endDate: r.end });
    const totalUnidades = filas.reduce((sum, f) => sum + f.units, 0);
    puntos.push({ desde: r.start, hasta: r.end, unidades: totalUnidades });
  }
  return puntos;
}

module.exports = { getVentasPorSku, getTendencia };

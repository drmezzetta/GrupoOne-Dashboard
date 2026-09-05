// API de Rentabilidad (precio de venta, costo PPP, descripción por SKU).
// Hoy vive en una URL OData on-premise; nos confirmaste que se va a republicar
// en Integration Suite con el MISMO payload/response — cuando eso pase, el único
// cambio necesario es actualizar RENTABILIDAD_API_URL en el .env, este archivo
// no debería cambiar.
//
// URL de ejemplo (function import OData, un solo llamado trae TODOS los
// materiales/centros/tiendas de la sociedad para esa fecha — no hay parámetro
// de tienda/centro en la URL):
// {RENTABILIDAD_API_URL}(p_budat=datetime'2026-08-20T00:00:00',p_bukrs='AR20',p_usd=true)/Set?sap-client=160
//
// Respuesta real (un <entry> por Sociedad/Centro/Tienda/Material):
//   <d:Sociedad>AR20</d:Sociedad>  <d:Centro>KI01</d:Centro>  <d:Tienda>KT11</d:Tienda>
//   <d:Material>3492211208066</d:Material>  <d:Descripcion>Desconocido</d:Descripcion>
//   <d:PrcVentaUN>5.94</d:PrcVentaUN>  <d:CostoUN>0.00</d:CostoUN>
//   <d:MonedaVisualizacion>USD</d:MonedaVisualizacion>  <d:TipoCambio>1391.00</d:TipoCambio>  ...
const FIELD_MAP = {
  sku: 'Material',
  companyCode: 'Sociedad',
  plant: 'Centro',
  storageLocation: 'Tienda',
  description: 'Descripcion',
  salePrice: 'PrcVentaUN',
  cost: 'CostoUN',
  currency: 'MonedaVisualizacion',
  exchangeRate: 'TipoCambio',
};

const { XMLParser } = require('fast-xml-parser');
const { getJson } = require('./httpClient');
const cache = require('../cache');
const { normalizeSku } = require('./skuUtils');
const { sampleRentabilidad } = require('../data/sampleData');

const xmlParser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

function buildUrl({ companyCode, date, usd = true }) {
  const base = process.env.RENTABILIDAD_API_URL;
  const client = process.env.RENTABILIDAD_SAP_CLIENT || '160';
  // fecha esperada en formato YYYY-MM-DD (se completa la hora en 00:00:00)
  const odataDate = `datetime'${date}T00:00:00'`;
  const params = `p_budat=${odataDate},p_bukrs='${companyCode}',p_usd=${usd ? 'true' : 'false'}`;
  return `${base}(${params})/Set?sap-client=${client}&$format=json`;
}

function fallbackAllowed() {
  return String(process.env.DEMO_MODE_FALLBACK).toLowerCase() === 'true';
}

function findEntries(node) {
  if (!node || typeof node !== 'object') return [];
  // Forma típica de un feed OData en XML: feed.entry[].content.properties
  if (node.feed && node.feed.entry) {
    const entries = Array.isArray(node.feed.entry) ? node.feed.entry : [node.feed.entry];
    return entries.map((e) => (e.content && e.content.properties) || e.properties || e);
  }
  // Forma típica en JSON ($format=json): { d: { results: [...] } }
  if (node.d && Array.isArray(node.d.results)) return node.d.results;
  if (node.d && node.d.Set) return Array.isArray(node.d.Set) ? node.d.Set : [node.d.Set];
  return [];
}

// "Desconocido" es el valor que devuelve la API cuando no tiene descripción
// cargada para ese material — lo tratamos como "sin dato" para poder mostrar
// en su lugar la descripción del maestro de materiales local.
function cleanDescription(raw) {
  const value = (raw ?? '').toString().trim();
  if (!value || value.toLowerCase() === 'desconocido') return '';
  return value;
}

function normalize(entries) {
  return entries.map((e) => ({
    sku: normalizeSku(e[FIELD_MAP.sku]),
    companyCode: e[FIELD_MAP.companyCode],
    plant: e[FIELD_MAP.plant], // Centro / Werks
    storageLocation: e[FIELD_MAP.storageLocation], // Tienda / Lgort
    description: cleanDescription(e[FIELD_MAP.description]),
    salePrice: Number(e[FIELD_MAP.salePrice] ?? 0),
    cost: Number(e[FIELD_MAP.cost] ?? 0),
    currency: e[FIELD_MAP.currency] || 'USD',
    exchangeRate: Number(e[FIELD_MAP.exchangeRate] ?? 1),
  }));
}

// Devuelve TODAS las filas (sociedad/centro/tienda/material) de rentabilidad
// para una sociedad y fecha — filtrar por centro/tienda/material queda a cargo
// de quien la llama (ver dashboardService), porque la API no lo hace en la URL.
async function getRentabilidad({ companyCode, date, usd = true }) {
  const cacheKey = `rentabilidad:${companyCode}:${date}:${usd}`;
  return cache.getOrLoad(cacheKey, async () => {
    try {
      const url = buildUrl({ companyCode, date, usd });
      const data = await getJson(url, {
        user: process.env.RENTABILIDAD_AUTH_USER || process.env.IS_BASIC_AUTH_USER,
        pass: process.env.RENTABILIDAD_AUTH_PASS || process.env.IS_BASIC_AUTH_PASS,
        headers: { Accept: 'application/json, application/xml' },
      });

      if (data && data.__raw) {
        const parsed = xmlParser.parse(data.__raw);
        return normalize(findEntries(parsed));
      }
      return normalize(findEntries(data));
    } catch (err) {
      if (fallbackAllowed()) {
        console.warn(`[rentabilidad] usando datos de muestra — ${err.message}`);
        return sampleRentabilidad();
      }
      throw err;
    }
  });
}

module.exports = { getRentabilidad };

// API de Stock (Integration Suite): stock ACTUAL (no histórico) por SKU, para
// una empresa + storage location (Lgort). Confirmaste que se llama por POST
// con este body:
//
// POST {STOCK_API_URL}
// {
//   "CompanyCode": "AR20",
//   "StorageLocation": "KT11",
//   "IniStk": "",
//   "to_MaterialItem": [ { "Material": "3492211014827" } ]   // opcional: [] = todos los materiales
// }
//
// La respuesta (según el ejemplo que nos pasaste primero) viene en XML tipo
// OData ETStock:
// <item><Matnr>...</Matnr><Bukrs>..</Bukrs><Werks>..</Werks><Lgort>..</Lgort><Labst>6.0</Labst><Meins/></item>

const { XMLParser } = require('fast-xml-parser');
const { postJson } = require('./httpClient');
const cache = require('../cache');
const { normalizeSku } = require('./skuUtils');
const { sampleStock } = require('../data/sampleData');

const xmlParser = new XMLParser({ ignoreAttributes: false });

function fallbackAllowed() {
  return String(process.env.DEMO_MODE_FALLBACK).toLowerCase() === 'true';
}

function normalizeItems(rawItems) {
  const list = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return list.map((it) => ({
    sku: normalizeSku(it.Matnr),
    companyCode: it.Bukrs,
    plant: it.Werks,
    storageLocation: it.Lgort,
    stock: Number(it.Labst ?? 0),
    unit: it.Meins || 'UN',
  }));
}

function findItemsNode(node) {
  if (!node || typeof node !== 'object') return [];
  if ('item' in node) return node.item;
  for (const key of Object.keys(node)) {
    if (node[key] && typeof node[key] === 'object') {
      const inner = findItemsNode(node[key]);
      if (inner && (Array.isArray(inner) ? inner.length > 0 : true)) return inner;
    }
  }
  return [];
}

// `materials`: array opcional de SKU (como los tenga el llamador, no hace falta
// normalizar antes) para filtrar; si se omite/va vacío, la API trae todos los
// materiales de esa storage location.
async function getStockActual({ companyCode, storageLocation, materials = [] }) {
  const cacheKey = `stock:${companyCode}:${storageLocation}:${materials.join(',')}`;
  return cache.getOrLoad(cacheKey, async () => {
    try {
      const body = {
        CompanyCode: companyCode,
        StorageLocation: storageLocation,
        IniStk: '',
        to_MaterialItem: materials.map((m) => ({ Material: m })),
      };
      const data = await postJson(process.env.STOCK_API_URL, body, {
        user: process.env.IS_BASIC_AUTH_USER,
        pass: process.env.IS_BASIC_AUTH_PASS,
        headers: { Accept: 'application/xml, text/xml, application/json' },
      });

      if (data && data.__raw) {
        const parsed = xmlParser.parse(data.__raw);
        return normalizeItems(findItemsNode(parsed));
      }

      // Por si en algún momento la API devuelve JSON directamente.
      const rows = Array.isArray(data) ? data : (data.d && data.d.results) || [];
      return normalizeItems(rows);
    } catch (err) {
      if (fallbackAllowed()) {
        console.warn(`[stock] usando datos de muestra — ${err.message}`);
        return sampleStock();
      }
      throw err;
    }
  });
}

module.exports = { getStockActual };

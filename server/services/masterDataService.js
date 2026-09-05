// Maestro de empresas/sucursales y de materiales. Hoy leen de archivos JSON
// estáticos (server/data/*.json) porque todavía no tenemos los endpoints reales
// que nos confirmaste que existen. Cuando los tengamos, cambiar SOLO estas
// funciones por llamadas HTTP (con cache, igual que los otros servicios) —
// el resto de la app consume estas funciones, no los archivos directamente.

const companies = require('../data/companies.json');
const stores = require('../data/stores.json');
const materials = require('../data/materials.json');

function getCompanyName(companyCode) {
  return (companies[companyCode] && companies[companyCode].name) || companyCode;
}

function getStoreName(storeCode) {
  return (stores[storeCode] && stores[storeCode].name) || storeCode;
}

// Devuelve { name, companyCode, plant, storageLocation } — plant/storageLocation
// son los que hay que usar para llamar a Stock y para filtrar Rentabilidad
// (ver la nota de supuesto en server/data/stores.json).
function getStoreDetails(storeCode) {
  const s = stores[storeCode];
  if (!s) return { name: storeCode, companyCode: null, plant: null, storageLocation: null };
  return { name: s.name, companyCode: s.companyCode, plant: s.plant, storageLocation: s.storageLocation };
}

function listCompanies() {
  return Object.entries(companies)
    .filter(([code]) => code !== '_nota')
    .map(([code, v]) => ({ code, name: v.name, country: v.country }));
}

function listStores(companyCode) {
  return Object.entries(stores)
    .filter(([code, v]) => code !== '_nota' && (!companyCode || v.companyCode === companyCode))
    .map(([code, v]) => ({ code, name: v.name, companyCode: v.companyCode }));
}

function getMaterialInfo(sku) {
  return materials[sku] || { description: sku, category: 'Sin categoría' };
}

module.exports = { getCompanyName, getStoreName, getStoreDetails, listCompanies, listStores, getMaterialInfo };

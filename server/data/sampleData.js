// Datos de muestra: se usan SOLO si DEMO_MODE_FALLBACK=true y la API real falla
// o no está configurada (típicamente mientras se termina de conectar cada API).
// Los SKU coinciden a propósito con los de materials.json para que el demo se
// vea completo (descripción + categoría + venta + stock + precio/costo).
// plant/storageLocation coinciden con KI01/KT11 de server/data/stores.json.

function sampleVentas() {
  return [
    { sku: '000000000004195021', units: 25 },
    { sku: '000000000004435748', units: 6 },
    { sku: '000000000002648471', units: 5 },
    { sku: '000000000002415768', units: 711 },
    { sku: '000003492211014827', units: 142 },
    { sku: '000000000003720934', units: 98 },
  ];
}

function sampleStock() {
  return [
    { sku: '000000000004195021', stock: 320, plant: 'KI01', storageLocation: 'KT11', unit: 'UN' },
    { sku: '000000000004435748', stock: 140, plant: 'KI01', storageLocation: 'KT11', unit: 'UN' },
    { sku: '000000000002648471', stock: 18, plant: 'KI01', storageLocation: 'KT11', unit: 'UN' },
    { sku: '000000000002415768', stock: 95, plant: 'KI01', storageLocation: 'KT11', unit: 'UN' },
    { sku: '000003492211014827', stock: 210, plant: 'KI01', storageLocation: 'KT11', unit: 'UN' },
    { sku: '000000000003720934', stock: 60, plant: 'KI01', storageLocation: 'KT11', unit: 'UN' },
  ];
}

function sampleRentabilidad() {
  const base = { companyCode: 'AR20', plant: 'KI01', storageLocation: 'KT11', currency: 'ARS', exchangeRate: 1 };
  return [
    { ...base, sku: '000000000004195021', description: 'Remera básica algodón', salePrice: 12000, cost: 6800 },
    { ...base, sku: '000000000004435748', description: 'Cinturón cuero reversible', salePrice: 18500, cost: 9200 },
    { ...base, sku: '000000000002648471', description: 'Zapatilla urbana bajo', salePrice: 79000, cost: 41000 },
    { ...base, sku: '000000000002415768', description: 'Campera liviana acolchada', salePrice: 129000, cost: 68000 },
    { ...base, sku: '000003492211014827', description: 'Bufanda lana mixta', salePrice: 12800, cost: 6100 },
    { ...base, sku: '000000000003720934', description: 'Pantalón chino slim', salePrice: 21500, cost: 11400 },
  ];
}

module.exports = { sampleVentas, sampleStock, sampleRentabilidad };

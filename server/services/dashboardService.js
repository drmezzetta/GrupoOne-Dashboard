// Cruza las 3 APIs por SKU y arma exactamente lo que el frontend necesita
// pintar (KPIs, tendencia, categorías, top productos, alertas). No hay base de
// datos: todo se recalcula en cada pedido (con cache corta en memoria, ver cache.js).

const ventasService = require('./ventasService');
const stockService = require('./stockService');
const rentabilidadService = require('./rentabilidadService');
const masterData = require('./masterDataService');
const { parseYyyymmdd } = require('./dateUtils');

const DIAS_COBERTURA_CRITICA = 7;
const DIAS_COBERTURA_ATENCION = 14;

function coberturaDias(stock, unidadesVendidas, diasPeriodo) {
  if (!unidadesVendidas || unidadesVendidas <= 0) return null; // sin ventas en el período: no se puede estimar
  const ventaDiariaPromedio = unidadesVendidas / diasPeriodo;
  if (ventaDiariaPromedio <= 0) return null;
  return stock / ventaDiariaPromedio;
}

function riesgoCobertura(dias) {
  if (dias === null) return { nivel: 'sin_datos', label: 'Sin ventas en el período' };
  if (dias < DIAS_COBERTURA_CRITICA) return { nivel: 'critico', label: `${dias.toFixed(0)} días` };
  if (dias < DIAS_COBERTURA_ATENCION) return { nivel: 'atencion', label: `${dias.toFixed(0)} días` };
  return { nivel: 'saludable', label: `${dias.toFixed(0)} días` };
}

async function getDashboard({ companyCode, store, startDate, endDate }) {
  const diasPeriodo = Math.max(
    1,
    Math.round((parseYyyymmdd(endDate) - parseYyyymmdd(startDate)) / 86400000) + 1
  );
  const fechaRentabilidad = `${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;

  // Stock y Rentabilidad no identifican la sucursal como "Store" (así la llama
  // Ventas): Stock pide un Storage Location y Rentabilidad devuelve filas por
  // Centro+Tienda. Resolvemos esa equivalencia acá — ver el supuesto marcado
  // en server/data/stores.json.
  const storeDetails = masterData.getStoreDetails(store);

  const [ventas, stock, rentabilidadTodas, tendencia] = await Promise.all([
    ventasService.getVentasPorSku({ companyCode, store, startDate, endDate }),
    stockService.getStockActual({ companyCode, storageLocation: storeDetails.storageLocation }),
    rentabilidadService.getRentabilidad({ companyCode, date: fechaRentabilidad, usd: false }),
    ventasService.getTendencia({ companyCode, store, startDate, endDate, buckets: 6 }),
  ]);

  // La API de rentabilidad trae TODA la sociedad (todos los centros/tiendas);
  // nos quedamos solo con las filas de la sucursal que estamos mirando.
  const rentabilidad = rentabilidadTodas.filter(
    (r) =>
      (!storeDetails.plant || r.plant === storeDetails.plant) &&
      (!storeDetails.storageLocation || r.storageLocation === storeDetails.storageLocation)
  );

  const stockPorSku = new Map(stock.map((s) => [s.sku, s]));
  const precioPorSku = new Map(rentabilidad.map((r) => [r.sku, r]));

  // Universo de SKUs = unión de los que tuvieron venta y los que tienen stock,
  // así un producto sin venta pero con stock (o viceversa) no se pierde.
  const skus = new Set([...ventas.map((v) => v.sku), ...stockPorSku.keys()]);

  const productos = [...skus].map((sku) => {
    const venta = ventas.find((v) => v.sku === sku);
    const unidades = venta ? venta.units : 0;
    const stockInfo = stockPorSku.get(sku);
    const stockActual = stockInfo ? stockInfo.stock : 0;
    const precio = precioPorSku.get(sku);
    const master = masterData.getMaterialInfo(sku);

    const descripcion = (precio && precio.description) || master.description;
    const categoria = master.category;
    const precioVenta = precio ? precio.salePrice : null;
    const costo = precio ? precio.cost : null;
    const importe = precioVenta !== null ? unidades * precioVenta : null;
    const margen = precioVenta !== null && costo !== null ? (precioVenta - costo) * unidades : null;

    const dias = coberturaDias(stockActual, unidades, diasPeriodo);
    const cobertura = riesgoCobertura(dias);

    return { sku, descripcion, categoria, unidades, stockActual, precioVenta, costo, importe, margen, cobertura };
  });

  const totalUnidades = productos.reduce((s, p) => s + p.unidades, 0);
  const totalImporte = productos.reduce((s, p) => s + (p.importe || 0), 0);
  const totalMargen = productos.reduce((s, p) => s + (p.margen || 0), 0);
  const margenPct = totalImporte > 0 ? (totalMargen / totalImporte) * 100 : null;
  const totalStock = productos.reduce((s, p) => s + p.stockActual, 0);
  const skusEnQuiebre = productos.filter((p) => p.cobertura.nivel === 'critico').length;

  const categoriasMap = new Map();
  for (const p of productos) {
    const actual = categoriasMap.get(p.categoria) || 0;
    categoriasMap.set(p.categoria, actual + p.unidades);
  }
  const categorias = [...categoriasMap.entries()]
    .map(([nombre, unidades]) => ({ nombre, unidades }))
    .sort((a, b) => b.unidades - a.unidades);

  const topProductos = [...productos]
    .filter((p) => p.unidades > 0)
    .sort((a, b) => (b.importe ?? b.unidades) - (a.importe ?? a.unidades))
    .slice(0, 10);

  const alertas = [...productos]
    .filter((p) => p.cobertura.nivel === 'critico' || p.cobertura.nivel === 'atencion')
    .sort((a, b) => a.stockActual - b.stockActual)
    .slice(0, 8);

  return {
    empresa: { code: companyCode, name: masterData.getCompanyName(companyCode) },
    sucursal: { code: store, name: masterData.getStoreName(store) },
    periodo: { startDate, endDate, dias: diasPeriodo },
    kpis: {
      unidadesVendidas: totalUnidades,
      facturacion: totalImporte,
      margenPct,
      stockTotal: totalStock,
      skusEnQuiebre,
    },
    tendencia,
    categorias,
    topProductos,
    alertas,
  };
}

module.exports = { getDashboard };

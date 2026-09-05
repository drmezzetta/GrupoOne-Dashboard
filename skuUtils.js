// Las 3 APIs identifican el material de forma distinta:
//  - Ventas (ART_ITEMID) y Stock (Matnr) lo mandan con ceros a la izquierda a 18 dígitos.
//  - Rentabilidad (Material) lo manda SIN ceros a la izquierda (ej. "3492211208066").
// Para poder cruzar las 3 por el mismo SKU, todas pasan por acá.
function normalizeSku(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(18, '0');
}

module.exports = { normalizeSku };

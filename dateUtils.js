// Utilidades de fecha para el formato YYYYMMDD que usa la API de ventas.

function parseYyyymmdd(s) {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  return new Date(Date.UTC(y, m, d));
}

function toYyyymmdd(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Divide un rango [start, end] (inclusive, formato YYYYMMDD) en `buckets` tramos
// contiguos, para poder armar una tendencia sin pedirle a la API un dato por día
// (que hoy no soporta: la API de ventas solo devuelve el total del rango).
function splitIntoBuckets(startYyyymmdd, endYyyymmdd, buckets = 6) {
  const start = parseYyyymmdd(startYyyymmdd);
  const end = parseYyyymmdd(endYyyymmdd);
  const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const n = Math.max(1, Math.min(buckets, totalDays));
  const size = Math.ceil(totalDays / n);

  const ranges = [];
  let cursor = start;
  while (cursor <= end) {
    const bucketEnd = addDays(cursor, size - 1) > end ? end : addDays(cursor, size - 1);
    ranges.push({ start: toYyyymmdd(cursor), end: toYyyymmdd(bucketEnd) });
    cursor = addDays(bucketEnd, 1);
  }
  return ranges;
}

module.exports = { parseYyyymmdd, toYyyymmdd, addDays, splitIntoBuckets };

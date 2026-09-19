// Cálculos de una cotización: la misma fórmula que usan el servidor y el PDF
// (resources/views/pdf/cotizacion.blade.php). Si cambia allá, cambia aquí.

export const IVA = 0.13;
export const IT = 0.03;

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Una línea: el precio es sin factura y por unidad; el descuento es por toda la línea. */
export function calcularLinea({ cantidad, precio_sin_factura, descuento }) {
  const cant = Math.max(1, parseInt(cantidad, 10) || 1);
  const precio = Number(precio_sin_factura) || 0;
  const subtotal = precio * cant;
  const desc = Math.min(Math.max(0, Number(descuento) || 0), subtotal);
  const neto = Math.max(0, subtotal - desc);
  const iva = r2(neto * IVA);
  const it = r2(neto * IT);
  return { cantidad: cant, subtotal, descuento: desc, neto, iva, it, total: r2(neto + iva + it) };
}

export function totalesDe(items = []) {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const l = calcularLinea(item);
    acc.subtotal += l.subtotal;
    acc.descuentos += l.descuento;
    acc.sinFactura += l.neto;
    acc.iva += l.iva;
    acc.it += l.it;
    acc.conFactura += l.total;
    acc.unidades += l.cantidad;
    return acc;
  }, { subtotal: 0, descuentos: 0, sinFactura: 0, iva: 0, it: 0, conFactura: 0, unidades: 0 });
}

/** Mismo número que imprime el PDF y el asunto del correo. */
export const numeroCotizacion = (id) => `COT-${id}`;

/** «59176402042» o «+59176402042» → «+591 76402042». */
export function fmtTelefono(tel) {
  const d = String(tel ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('591') && d.length === 11) return `+591 ${d.slice(3)}`;
  return d.length > 8 ? `+${d}` : d;
}

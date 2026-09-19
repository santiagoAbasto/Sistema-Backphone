import { CondicionBadge } from '@/Components/Admin/condicion';
import { bsFmt } from '@/Components/Admin/ui';

/**
 * Tabla de stock del vendedor: lo que sirve para vender.
 * No hay precio de costo ni procedencia: esos datos son del administrador y ni siquiera llegan
 * desde el servidor (App\Http\Controllers\Vendedor\ProductoVendedorController).
 */

const txt = (v) => (v === null || v === undefined ? '' : String(v).trim());
const guion = <span className="text-gris-300">—</span>;
const bonito = (v) => txt(v).replace(/_/g, ' ');

export const COLUMNAS = {
    celulares: [
        { key: 'modelo', label: 'Modelo', principal: true },
        { key: 'condicion', label: 'Condición', condicion: true },
        { key: 'capacidad', label: 'Capacidad' },
        { key: 'color', label: 'Color' },
        { key: 'bateria', label: 'Batería', centro: true },
        { key: 'imei_1', label: 'IMEI', mono: true },
        { key: 'numero_serie', label: 'Serie', mono: true },
        { key: 'precio_venta', label: 'Precio', precio: true },
    ],
    computadoras: [
        { key: 'nombre', label: 'Equipo', principal: true },
        { key: 'condicion', label: 'Condición', condicion: true },
        { key: 'procesador', label: 'Procesador' },
        { key: 'ram', label: 'RAM', centro: true },
        { key: 'almacenamiento', label: 'Almacenamiento' },
        { key: 'bateria', label: 'Batería', centro: true },
        { key: 'numero_serie', label: 'Serie', mono: true },
        { key: 'precio_venta', label: 'Precio', precio: true },
    ],
    apple: [
        { key: 'modelo', label: 'Modelo', principal: true },
        { key: 'condicion', label: 'Condición', condicion: true },
        { key: 'capacidad', label: 'Capacidad' },
        { key: 'color', label: 'Color' },
        { key: 'bateria', label: 'Batería', centro: true },
        { key: 'imei_1', label: 'IMEI', mono: true },
        { key: 'numero_serie', label: 'Serie', mono: true },
        { key: 'precio_venta', label: 'Precio', precio: true },
    ],
    generales: [
        { key: 'codigo', label: 'Código', mono: true },
        { key: 'nombre', label: 'Producto', principal: true },
        { key: 'tipo', label: 'Tipo', bonito: true },
        { key: 'condicion', label: 'Condición', condicion: true },
        { key: 'precio_venta', label: 'Precio', precio: true },
    ],
    // Las piezas llevan saldo en vez de condición: lo que importa es cuántas quedan.
    piezas: [
        { key: 'nombre', label: 'Pieza', principal: true },
        { key: 'categoria', label: 'Categoría' },
        { key: 'compatibilidad', label: 'Compatible con' },
        { key: 'codigo', label: 'Código', mono: true },
        { key: 'cantidad', label: 'Quedan', centro: true, saldo: true },
        { key: 'precio_venta', label: 'Precio', precio: true },
    ],
};

function Celda({ item, col }) {
    const valor = col.bonito ? bonito(item[col.key]) : txt(item[col.key]);
    if (col.condicion) return <CondicionBadge condicion={valor} vacio={guion} />;
    if (col.saldo) {
        const n = Number(item[col.key]) || 0;
        return <span className={`font-bold tabular-nums ${n <= 2 ? 'text-amber-700' : 'text-gris-900'}`}>{n}</span>;
    }
    if (col.precio) return <span className="font-bold tabular-nums text-gris-900">{bsFmt(item[col.key])}</span>;
    if (!valor) return guion;
    return valor;
}

export function TablaStock({ items, tipo }) {
    const cols = COLUMNAS[tipo] ?? [];
    const principal = cols.find((c) => c.principal) ?? cols[0];
    const precio = cols.find((c) => c.precio);
    const resto = cols.filter((c) => c !== principal && c !== precio);

    return (
        <>
            {/* Móvil: una ficha por producto */}
            <ul className="divide-y divide-gris-100 lg:hidden">
                {items.map((item) => (
                    <li key={item.id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-[15px] font-bold text-gris-900">{txt(item[principal.key]) || 'Producto'}</p>
                                <div className="mt-1"><CondicionBadge condicion={item.condicion} vacio={null} /></div>
                            </div>
                            {precio && <p className="shrink-0 text-[15px] font-bold tabular-nums text-gris-900">{bsFmt(item[precio.key])}</p>}
                        </div>

                        <dl className="mt-3 grid grid-cols-2 gap-2">
                            {resto.filter((c) => !c.condicion && txt(item[c.key])).map((c) => (
                                <div key={c.key} className="min-w-0 rounded-lg bg-gris-50 px-2.5 py-1.5">
                                    <dt className="text-[10px] font-bold uppercase tracking-wide text-gris-400">{c.label}</dt>
                                    <dd className={`truncate text-[13px] font-semibold text-gris-700 ${c.mono ? 'cifra text-[11px]' : ''}`}>
                                        <Celda item={item} col={c} />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </li>
                ))}
            </ul>

            {/* Escritorio: tabla */}
            <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-[13px]">
                    <thead>
                        <tr className="border-b border-gris-200 bg-gris-50">
                            {cols.map((c) => (
                                <th key={c.key} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gris-500 ${c.centro ? 'text-center' : ''} ${c.precio ? 'text-right' : ''}`}>
                                    {c.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gris-100">
                        {items.map((item) => (
                            <tr key={item.id} className="transition-colors hover:bg-[rgb(var(--acento-rgb)_/_0.04)]">
                                {cols.map((c) => (
                                    <td key={c.key} className={`px-4 py-3 align-middle text-gris-700 ${c.centro ? 'text-center' : ''} ${c.precio ? 'text-right' : ''}`}>
                                        <div className={`min-w-0 truncate ${c.principal ? 'font-semibold text-gris-900' : ''} ${c.mono ? 'cifra text-[11px]' : ''}`} title={txt(item[c.key])}>
                                            <Celda item={item} col={c} />
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

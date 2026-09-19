<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
@page { margin: 40px 35px; }

body {
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 10px;
    color: #1a1a2e;
}

/* ── HEADER ── */
.page-header {
    border-bottom: 3px solid #1D1D21;
    padding-bottom: 14px;
    margin-bottom: 18px;
}
.brand-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}
.brand-name {
    font-size: 22px;
    font-weight: 700;
    color: #1D1D21;
    letter-spacing: -0.5px;
}
.doc-type {
    font-size: 11px;
    color: #555;
    text-align: right;
}
.doc-type strong {
    display: block;
    font-size: 14px;
    color: #1D1D21;
    letter-spacing: 1px;
    text-transform: uppercase;
}

/* ── META INFO ── */
.meta-grid {
    display: table;
    width: 100%;
    margin-bottom: 18px;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: #f8fafc;
}
.meta-row {
    display: table-row;
}
.meta-cell {
    display: table-cell;
    padding: 6px 12px;
    border-bottom: 1px solid #e8ecf0;
    width: 25%;
}
.meta-cell:last-child {
    border-right: none;
}
.meta-label {
    font-size: 8px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
}
.meta-value {
    font-size: 10.5px;
    font-weight: 600;
    color: #1a1a2e;
}

/* ── SUMMARY CARDS ── */
.summary-row {
    display: table;
    width: 100%;
    margin-bottom: 20px;
    border-collapse: separate;
    border-spacing: 5px;
}
.summary-card {
    display: table-cell;
    text-align: center;
    padding: 10px 8px;
    border-radius: 6px;
    border: 1px solid #dee2e6;
}
.summary-card.blue   { background: #FAF6F2; border-color: #bfdbfe; }
.summary-card.green  { background: #f0fdf4; border-color: #bbf7d0; }
.summary-card.amber  { background: #fffbeb; border-color: #fde68a; }
.summary-card.red    { background: #fef2f2; border-color: #fecaca; }

.summary-num {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
}
.summary-card.blue  .summary-num  { color: #1d4ed8; }
.summary-card.green .summary-num  { color: #15803d; }
.summary-card.amber .summary-num  { color: #b45309; }
.summary-card.red   .summary-num  { color: #b91c1c; }

.summary-label {
    font-size: 8.5px;
    color: #555;
    margin-top: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* ── SECTION TITLE ── */
.section-title {
    font-size: 11px;
    font-weight: 700;
    color: #1D1D21;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-left: 3px solid #1D1D21;
    padding-left: 8px;
    margin: 18px 0 8px 0;
}

/* ── CATEGORY HEADER ── */
.category-header {
    background: #1D1D21;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 5px 8px;
}

/* ── TABLES ── */
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5px;
    margin-bottom: 14px;
}
th {
    background: #f1f5f9;
    color: #374151;
    font-weight: 700;
    padding: 5px 6px;
    text-align: left;
    border: 1px solid #d1d5db;
}
td {
    padding: 4px 6px;
    border: 1px solid #e5e7eb;
    vertical-align: middle;
}
tr:nth-child(even) td { background: #f9fafb; }

.col-name    { width: 30%; }
.col-code    { width: 22%; font-family: monospace; font-size: 8px; }
.col-detail  { width: 18%; color: #555; }
.col-estado  { width: 14%; text-align: center; }
.col-costo   { width: 8%; text-align: right; }
.col-venta   { width: 8%; text-align: right; }

/* ── STATUS BADGES ── */
.badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 20px;
    font-size: 7.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}
.badge-found   { background: #dcfce7; color: #166534; }
.badge-received { background: #dbeafe; color: #1e40af; }
.badge-sold    { background: #fef3c7; color: #92400e; }
.badge-missing { background: #fee2e2; color: #991b1b; }

/* ── LOSS SECTION ── */
.loss-box {
    border: 2px solid #b91c1c;
    border-radius: 6px;
    padding: 14px 16px;
    margin-top: 10px;
    background: #fff5f5;
    page-break-inside: avoid;
}
.loss-title {
    font-size: 12px;
    font-weight: 700;
    color: #991b1b;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.loss-grid {
    display: table;
    width: 60%;
}
.loss-row { display: table-row; }
.loss-label, .loss-val {
    display: table-cell;
    padding: 3px 0;
    font-size: 10px;
}
.loss-label { color: #555; width: 220px; }
.loss-val   { font-weight: 700; color: #991b1b; text-align: right; }

.loss-disclaimer {
    margin-top: 10px;
    font-size: 8px;
    color: #6b7280;
    font-style: italic;
}

/* ── CATEGORY TOTALS ── */
.cat-totals td {
    font-weight: 700;
    background: #f1f5f9;
    border-top: 2px solid #9ca3af;
}

/* ── FOOTER ── */
.page-footer {
    border-top: 1px solid #d1d5db;
    padding-top: 8px;
    margin-top: 20px;
    font-size: 8px;
    color: #9ca3af;
    display: table;
    width: 100%;
}
.footer-left  { display: table-cell; text-align: left; }
.footer-right { display: table-cell; text-align: right; }
</style>
</head>
<body>

{{-- ═══════════════════════════════ HEADER ═══════════════════════════════ --}}
<div class="page-header">
    <div class="brand-row">
        <div class="brand-name">{{ $negocio['nombre'] }}</div>
        <div class="doc-type">
            <strong>Informe de Auditoría</strong>
            Inventario Físico — #{{ $audit->id }}
        </div>
    </div>
</div>

{{-- ═══════════════════════════════ META INFO ═══════════════════════════════ --}}
<div class="meta-grid">
    <div class="meta-row">
        <div class="meta-cell">
            <div class="meta-label">Inicio de auditoría</div>
            <div class="meta-value">{{ $audit->started_at?->format('d/m/Y H:i') ?? '—' }}</div>
        </div>
        <div class="meta-cell">
            <div class="meta-label">Cierre de auditoría</div>
            <div class="meta-value">{{ $audit->closed_at?->format('d/m/Y H:i') ?? '—' }}</div>
        </div>
        <div class="meta-cell">
            <div class="meta-label">Responsable</div>
            <div class="meta-value">{{ $audit->starter?->name ?? '—' }}</div>
        </div>
        <div class="meta-cell">
            <div class="meta-label">Cerrado por</div>
            <div class="meta-value">{{ $audit->closer?->name ?? '—' }}</div>
        </div>
    </div>
</div>

{{-- ═══════════════════════════════ RESUMEN GENERAL ═══════════════════════════════ --}}
<div class="section-title">Resumen general</div>

<div class="summary-row">
    <div class="summary-card blue">
        <div class="summary-num">{{ $totalExpected }}</div>
        <div class="summary-label">Esperados</div>
    </div>
    <div class="summary-card green">
        <div class="summary-num">{{ $totalScanned }}</div>
        <div class="summary-label">Encontrados</div>
    </div>
    <div class="summary-card amber">
        <div class="summary-num">{{ $totalSoldAfter }}</div>
        <div class="summary-label">Vendidos durante auditoría</div>
    </div>
    <div class="summary-card blue">
        <div class="summary-num">{{ $totalReceivedAfter }}</div>
        <div class="summary-label">Ingresos posteriores</div>
    </div>
    <div class="summary-card red">
        <div class="summary-num">{{ $totalMissing }}</div>
        <div class="summary-label">No encontrados</div>
    </div>
</div>

<div style="border:1px solid #bfdbfe;background:#FAF6F2;padding:9px 12px;margin-bottom:14px;font-size:8.5px;color:#1e3a8a;">
    <strong>Regla del informe:</strong> los ingresos posteriores se documentan aparte y no aumentan
    el inventario esperado al inicio. Los vendidos durante la auditoria justifican una ausencia y
    tampoco se consideran perdida.
</div>

{{-- ═══════════════════════════════ DETALLE POR CATEGORÍA ═══════════════════════════════ --}}
@php
$categoryLabels = [
    'celulares'          => 'Celulares',
    'computadoras'       => 'Computadoras',
    'productos_apple'    => 'Productos Apple',
    'productos_generales' => 'Productos generales',
];
$categoryOrder = array_keys($categoryLabels);
$allItems = $byCategory->flatten(1);
$statusSections = [
    ['title' => '1. No encontrados', 'description' => 'Estaban disponibles al iniciar la auditoría y no fueron escaneados ni justificados como vendidos.', 'items' => $allItems->where('post_start', false)->where('resolution', 'missing'), 'color' => '#991b1b'],
    ['title' => '2. Añadidos durante la auditoría', 'description' => 'Ingresaron después del inicio y no alteran el conteo inicial esperado.', 'items' => $allItems->where('post_start', true), 'color' => '#1e40af'],
    ['title' => '3. Vendidos durante la auditoría', 'description' => 'Su ausencia está justificada por una venta realizada después del inicio.', 'items' => $allItems->where('post_start', false)->where('resolution', 'sold_after_audit'), 'color' => '#92400e'],
    ['title' => '4. Encontrados', 'description' => 'Productos del inventario inicial confirmados mediante escaneo.', 'items' => $allItems->where('post_start', false)->where('resolution', 'scanned'), 'color' => '#166534'],
];
@endphp

@foreach ($statusSections as $section)
    <div class="section-title" style="border-left-color:{{ $section['color'] }};color:{{ $section['color'] }};">{{ $section['title'] }} — {{ $section['items']->count() }}</div>
    <div style="font-size:8.5px;color:#4b5563;margin:-3px 0 9px 11px;">{{ $section['description'] }}</div>
    @if ($section['items']->isEmpty())
        <div style="border:1px solid #e5e7eb;background:#f9fafb;color:#6b7280;padding:9px 11px;margin-bottom:14px;">No hay productos en este estado.</div>
    @endif
    @foreach ($categoryOrder as $catKey)
        @php
            $catItems = $section['items']->where('category', $catKey);
            $catCostoTotal = $catItems->sum('precio_costo');
            $catVentaTotal = $catItems->sum('precio_venta');
        @endphp
        @if ($catItems->isEmpty()) @continue @endif
        <div class="category-header" style="background:{{ $section['color'] }};">{{ $categoryLabels[$catKey] ?? $catKey }} — {{ $catItems->count() }} productos</div>
        <table>
            <thead><tr><th class="col-name">Producto</th><th class="col-code">Identificador</th><th class="col-detail">Detalle</th><th class="col-estado">Estado</th><th class="col-costo">P. Costo</th><th class="col-venta">P. Venta</th></tr></thead>
            <tbody>
            @foreach ($catItems->sortBy('name') as $item)
                <tr>
                    <td class="col-name">{{ $item['name'] }}</td><td class="col-code">{{ $item['primary_code'] ?? '—' }}</td><td class="col-detail">{{ implode(' · ', $item['details']) }}</td>
                    <td class="col-estado">@if ($item['post_start']) <span class="badge badge-received">Ingreso posterior</span>@elseif ($item['resolution'] === 'scanned') <span class="badge badge-found">Encontrado</span>@elseif ($item['resolution'] === 'sold_after_audit') <span class="badge badge-sold">Vendido</span>@else <span class="badge badge-missing">No encontrado</span>@endif</td>
                    <td class="col-costo">{{ $item['precio_costo'] > 0 ? '$'.number_format($item['precio_costo'], 0, ',', '.') : '—' }}</td><td class="col-venta">{{ $item['precio_venta'] > 0 ? '$'.number_format($item['precio_venta'], 0, ',', '.') : '—' }}</td>
                </tr>
            @endforeach
            </tbody>
            <tfoot class="cat-totals"><tr><td colspan="4">Subtotal de este estado y categoría</td><td class="col-costo">${{ number_format($catCostoTotal, 0, ',', '.') }}</td><td class="col-venta">${{ number_format($catVentaTotal, 0, ',', '.') }}</td></tr></tfoot>
        </table>
    @endforeach
@endforeach

@if (false)
<div class="section-title">Detalle por categoría</div>
@foreach ($categoryOrder as $catKey)
    @if (!isset($byCategory[$catKey]) || $byCategory[$catKey]->isEmpty())
        @continue
    @endif

    @php
        $catItems = $byCategory[$catKey];
        $catScanned = $catItems->where('scanned', true)->count();
        $catSold    = $catItems->where('resolution', 'sold_after_audit')->count();
        $catReceived = $catItems->where('expected_state', 'received_after_start')->count();
        $catMissing = $catItems->where('resolution', 'missing')->count();
        $catCostoTotal = $catItems->sum('precio_costo');
        $catVentaTotal = $catItems->sum('precio_venta');
    @endphp

    <div class="category-header">
        {{ $categoryLabels[$catKey] ?? $catKey }}
        — {{ $catItems->count() }} productos
        &nbsp;·&nbsp;
        {{ $catScanned }} encontrados
        @if($catSold > 0)
        &nbsp;·&nbsp; {{ $catSold }} vendidos durante auditoría
        @endif
        @if($catReceived > 0)
        &nbsp;&middot;&nbsp; {{ $catReceived }} ingresos posteriores
        @endif
        @if($catMissing > 0)
        &nbsp;·&nbsp; {{ $catMissing }} no encontrados
        @endif
    </div>
    <table>
        <thead>
            <tr>
                <th class="col-name">Producto</th>
                <th class="col-code">Identificador</th>
                <th class="col-detail">Detalle</th>
                <th class="col-estado">Estado</th>
                <th class="col-costo">P. Costo</th>
                <th class="col-venta">P. Venta</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($catItems->sortBy('name') as $item)
            <tr>
                <td class="col-name">{{ $item['name'] }}</td>
                <td class="col-code">{{ $item['primary_code'] ?? '—' }}</td>
                <td class="col-detail">{{ implode(' · ', $item['details']) }}</td>
                <td class="col-estado">
                    @if ($item['post_start'])
                        <span class="badge badge-received">Ingreso posterior</span>
                    @elseif ($item['resolution'] === 'scanned')
                        <span class="badge badge-found">Encontrado</span>
                    @elseif ($item['resolution'] === 'sold_after_audit')
                        <span class="badge badge-sold">Vendido</span>
                    @elseif ($item['resolution'] === 'missing')
                        <span class="badge badge-missing">Faltante</span>
                    @else
                        <span class="badge" style="background:#e5e7eb;color:#374151;">—</span>
                    @endif
                </td>
                <td class="col-costo">
                    @if($item['precio_costo'] > 0)
                        ${{ number_format($item['precio_costo'], 0, ',', '.') }}
                    @else
                        —
                    @endif
                </td>
                <td class="col-venta">
                    @if($item['precio_venta'] > 0)
                        ${{ number_format($item['precio_venta'], 0, ',', '.') }}
                    @else
                        —
                    @endif
                </td>
            </tr>
            @endforeach
        </tbody>
        <tfoot class="cat-totals">
            <tr>
                <td colspan="4">Subtotales categoría</td>
                <td class="col-costo">${{ number_format($catCostoTotal, 0, ',', '.') }}</td>
                <td class="col-venta">${{ number_format($catVentaTotal, 0, ',', '.') }}</td>
            </tr>
        </tfoot>
    </table>
@endforeach

{{-- ═══════════════════════════════ PRESUNTA PÉRDIDA ═══════════════════════════════ --}}
@if ($totalMissing > 0)
<div class="loss-box">
    <div class="loss-title">⚠ Presunta pérdida por robo o extravío</div>
    <div class="loss-grid">
        <div class="loss-row">
            <div class="loss-label">Productos no encontrados:</div>
            <div class="loss-val">{{ $totalMissing }} unidades</div>
        </div>
        <div class="loss-row">
            <div class="loss-label">Pérdida a precio de costo:</div>
            <div class="loss-val">${{ number_format($perdidaCosto, 0, ',', '.') }}</div>
        </div>
        <div class="loss-row">
            <div class="loss-label">Pérdida a precio de venta:</div>
            <div class="loss-val">${{ number_format($perdidaVenta, 0, ',', '.') }}</div>
        </div>
    </div>
    <div class="loss-disclaimer">
        * Este informe es una estimación basada en los precios registrados al momento de la auditoría.
        Los productos clasificados como "Vendidos durante auditoría" han sido excluidos de este cálculo.
    </div>
</div>
@else
<div style="border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;background:#f0fdf4;margin-top:10px;">
    <span style="font-size:11px;font-weight:700;color:#15803d;">✓ Sin pérdidas detectadas</span>
    <p style="margin:4px 0 0 0;font-size:9px;color:#166534;">
        Todos los productos del inventario fueron encontrados o están justificados como vendidos durante el periodo de auditoría.
    </p>
</div>
@endif

@endif

{{-- ═══════════════════════════════ FOOTER ═══════════════════════════════ --}}
<div class="page-footer">
    <div class="footer-left">
        {{ $negocio['nombre'] }} — Documento interno confidencial
    </div>
    <div class="footer-right">
        Generado el {{ now()->format('d/m/Y H:i') }}
    </div>
</div>

</body>
</html>

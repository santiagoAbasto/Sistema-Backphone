<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">

<style>
/* =====================
   PAGE CONFIG
===================== */
@page {
    margin: 0;
}

/* =====================
   BASE
===================== */
html, body {
    width: 80mm;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'DejaVu Sans', sans-serif;
    font-size: 9.5px;
    color: #111;
}

/* =====================
   WRAPPER (CLAVE)
===================== */
.wrapper {
    width: 72mm;              /* ancho real centrado */
    margin: 0 auto;           /* centra izquierda/derecha */
    padding-top: 30px;        /* baja el contenido */
    padding-bottom: 8px;
}

/* =====================
   UTIL
===================== */
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: bold; }

/* =====================
   HEADER
===================== */
.logo {
    text-align: center;
    margin-bottom: 6px;
}

.logo img {
    width: 95px;
}

.brand {
    font-size: 13px;
    font-weight: bold;
    letter-spacing: 0.5px;
    margin-top: 2px;
}

.brand-sub {
    font-size: 8px;
    line-height: 1.4;
}

/* =====================
   DIVIDER
===================== */
.divider {
    border-top: 1px dashed #000;
    margin: 8px 0;
}

/* =====================
   TITLES
===================== */
.section-title {
    font-size: 10px;
    font-weight: bold;
    margin: 6px 0 4px;
    text-transform: uppercase;
}

/* =====================
   INFO
===================== */
.info p {
    margin: 2px 0;
}

/* =====================
   TABLE
===================== */
table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 4px;
}

thead th {
    font-size: 9.5px;
    font-weight: bold;
    border-bottom: 1px solid #000;
    padding-bottom: 3px;
}

tbody td {
    font-size: 9.5px;
    padding: 3px 0;
    vertical-align: top;
}

th:last-child,
td:last-child {
    text-align: right;
}

/* =====================
   TOTAL
===================== */
.total-box {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #000;
}

.total-label {
    font-size: 9px;
}

.total-amount {
    font-size: 15px;
    font-weight: bold;
}

/* =====================
   NOTES
===================== */
.notes {
    margin-top: 6px;
    font-size: 9px;
}

/* =====================
   FOOTER
===================== */
.footer {
    margin-top: 10px;
    text-align: center;
    font-size: 8px;
    line-height: 1.4;
}
</style>
</head>

<body>

<div class="wrapper">

    <!-- LOGO -->
    <div class="logo">
</div>

    <!-- BRAND -->
    <div class="center">
        <div class="brand">{{ mb_strtoupper($negocio['nombre']) }}</div>
        <div class="brand-sub">
@if($negocio['direccion'])
            {{ $negocio['direccion'] }}<br>
            @endif
            @if($negocio['telefono'])
            <strong>{{ $negocio['telefono'] }}</strong>
            @endif
        </div>
    </div>

    <div class="divider"></div>

    <!-- TITLE -->
    <div class="center section-title">Recibo de Servicio Técnico</div>

    <!-- META -->
    <div class="info">
        <p><strong>Fecha:</strong>
            {{ optional($servicio->created_at)->timezone(config('app.timezone'))->format('d/m/Y H:i') }}
        </p>
        <p><strong>Nº Nota:</strong> {{ $servicio->codigo_nota }}</p>
    </div>

    <div class="divider"></div>

    <!-- CLIENT -->
    <div class="section-title">Datos del Cliente</div>
    <div class="info">
        <p><strong>Cliente:</strong> {{ $servicio->cliente }}</p>
        <p><strong>Teléfono:</strong> {{ $servicio->telefono ?? '—' }}</p>
        <p><strong>Equipo:</strong> {{ $servicio->equipo }}</p>
        <p><strong>Técnico:</strong> {{ $servicio->tecnico }}</p>
        <p><strong>Registrado por:</strong> {{ $servicio->vendedor->name ?? '—' }}</p>
    </div>

    <div class="divider"></div>

    <!-- DETAILS -->
    <div class="section-title">Detalle del Servicio</div>

    <table>
        <thead>
        <tr>
            <th>Descripción</th>
            <th>Bs</th>
        </tr>
        </thead>
        <tbody>
        @foreach($servicios_cliente as $item)
        <tr>
            <td>{{ $item['descripcion'] }}</td>
            <td>{{ number_format($item['precio'], 2) }}</td>
        </tr>
        @endforeach
        </tbody>
    </table>

    <!-- TOTAL -->
    <div class="total-box right">
        <div class="total-label">TOTAL A PAGAR</div>
        <div class="total-amount">Bs {{ number_format($servicio->precio_venta, 2) }}</div>
    </div>

    <!-- NOTES -->
    @if(!empty($servicio->notas_adicionales))
    <div class="notes">
        <div class="section-title">Notas</div>
        {{ $servicio->notas_adicionales }}
    </div>
    @endif

    <div class="divider"></div>

    <!-- FOOTER -->
    <div class="footer">
        Documento interno sin valor fiscal<br>
        Servicio técnico garantizado<br>
        Gracias por su preferencia
    </div>

</div>

</body>
</html>

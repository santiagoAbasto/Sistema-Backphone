<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">

<style>
@page { margin: 40px 35px; }

body{
    font-family:'DejaVu Sans', sans-serif;
    font-size:10.5px;
    color:#333;
}

header{
    text-align:center;
    margin-bottom:20px;
}

header img{
    width:130px;
    margin-bottom:5px;
}

h1{
    font-size:20px;
    color:#1D1D21;
    margin:0;
}

.subtitulo{
    font-size:13px;
    font-weight:normal;
    color:#555;
}

.fecha-reporte{
    text-align:right;
    font-size:10px;
    margin-bottom:10px;
}

table{
    width:100%;
    border-collapse:collapse;
    font-size:9.5px;
    margin-bottom:10px;
}

th,td{
    border:1px solid #dee2e6;
    padding:6px 4px;
    text-align:center;
    vertical-align:middle;
}

th{
    background-color:#f8f9fa;
    font-weight:bold;
}

.col-cantidad{
    width:28px !important;
}

.text-right{
    text-align:right;
    white-space:nowrap;
}

.text-success{
    color:#198754;
    font-weight:bold;
}

.text-danger{
    color:#dc3545;
    font-weight:bold;
}

.text-muted{
    color:#6c757d;
}

.small-note{
    font-size:8px;
}

.divider{
    border-top:2px solid #1D1D21;
    margin:30px 0 20px;
}

.resumen-final{
    font-size:12px;
    font-weight:bold;
    text-align:right;
}

.resumen-final .label{
    color:#000;
    font-weight:bold;
    margin-right:10px;
}

.resumen-final .value{
    color:#198754;
}

.firma{
    margin-top:50px;
    text-align:center;
}

.firma img{
    width:220px;
    margin-bottom:10px;
}

.firma p{
    font-size:14px;
    margin:0;
}
</style>

</head>

<body>

<header>
<h1>REPORTE DE VENTAS</h1>
<p class="subtitulo">{{ $negocio['nombre'] }} · Productos y Servicios</p>
</header>

<div class="fecha-reporte">
Fecha del Reporte: {{ now()->format('d/m/Y') }}
@if(!empty($filtros_texto))
<br>{{ $filtros_texto }}
@endif
</div>

<table>

<thead>
<tr>
<th>Fecha</th>
<th>Hora</th>
<th>Producto</th>
<th>Tipo</th>
<th class="col-cantidad">Cant.</th>
<th>Precio Costo</th>
<th>Precio Venta</th>
<th>Descuento</th>
<th>Permuta</th>
<th>Subtotal</th>
<th>Ganancia Final</th>
<th>Vendedor</th>
</tr>
</thead>

<tbody>

@php
$total = 0;
$gananciaTotal = 0;
$sinCosto = 0;
@endphp

@foreach($ventas as $v)

@php

$fecha = !empty($v->fecha)
    ? \Carbon\Carbon::parse($v->fecha)
    : now();

$precioCosto = $v->precio_invertido ?? $v->capital ?? 0;
$precioVenta = $v->precio_venta ?? $v->subtotal ?? 0;
$descuento   = $v->descuento ?? 0;
$permuta     = $v->permuta ?? 0;

$subtotal = $v->subtotal ?? ($precioVenta - $descuento - $permuta);
$ganancia = $v->ganancia ?? ($subtotal - $precioCosto);

$total += $subtotal;
$gananciaTotal += $ganancia;
// Servicio técnico sin costo cargado: su utilidad todavía no se conoce y no se suma
$pendiente = !empty($v->costo_pendiente);
$sinCosto += $pendiente ? 1 : 0;

$tipo = $v->tipo ?? '—';
$producto = $v->producto ?? '—';

@endphp

<tr>

<td>{{ $fecha->format('d/m/Y') }}</td>

<td>{{ $fecha->format('H:i') }}</td>

<td>{{ $producto }}</td>

<td>{{ $tipo }}</td>

<td>{{ $v->cantidad ?? 1 }}</td>

<td class="text-right">
@if($pendiente)
<span class="small-note">Costo pendiente</span>
@else
{{ number_format($precioCosto,2) }} Bs
@endif
</td>

<td class="text-right">
{{ number_format($precioVenta,2) }} Bs
</td>

<td class="text-right">
-{{ number_format($descuento,2) }} Bs
</td>

<td class="text-right">
-{{ number_format($permuta,2) }} Bs
</td>

<td class="text-right">
{{ number_format($subtotal,2) }} Bs
</td>

<td class="text-right">

@if($pendiente)

<span class="small-note">Pendiente</span>

@elseif($ganancia < 0)

<span class="text-danger">
-{{ number_format(abs($ganancia),2) }} Bs
<br>
<span class="small-note">(Se invirtió)</span>
</span>

@else

<span class="text-success">
{{ number_format($ganancia,2) }} Bs
</span>

@endif

</td>

<td>{{ $v->vendedor ?? '—' }}</td>

</tr>

@endforeach

</tbody>
</table>

<div class="divider"></div>

<div class="resumen-final">

<div>
<span class="label">Total de Ventas:</span>
<span class="value">{{ number_format($total,2) }} Bs</span>
</div>

<div>
<span class="label">Ganancia Neta Total:</span>

@if($gananciaTotal > 0)
<span class="value">{{ number_format($gananciaTotal,2) }} Bs</span>
@else
<span class="text-muted">Se invirtió</span>
@endif

</div>

@if($sinCosto > 0)
<div>
<span class="small-note">{{ $sinCosto }} {{ $sinCosto === 1 ? 'servicio técnico no tiene' : 'servicios técnicos no tienen' }} el costo cargado: su utilidad no está sumada.</span>
</div>
@endif

</div>

<div class="firma">

<p>Firma autorizada:</p>
<p>
<strong>{{ $negocio['nombre'] }}</strong><br>
Firma autorizada
</p>

</div>

</body>
</html>
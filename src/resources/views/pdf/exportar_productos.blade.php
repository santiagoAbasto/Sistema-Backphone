<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 30px 28px;
    }

    body {
      font-family: 'DejaVu Sans', sans-serif;
      font-size: 10.5px;
      color: #1e1e1e;
      background-color: #fff;
    }

    .header-wrap {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #121214;
      margin-bottom: 10px;
    }

    .brand img {
      width: 130px;
    }

    .title-top {
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      color: #121214;
      text-transform: uppercase;
      margin-top: -75px;
      margin-bottom: -1px;
    }

    .fecha-actual {
      text-align: right;
      font-size: 10px;
      margin-bottom: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 9.8px;
    }

    th {
      background-color: #F3E8DD;
      color: #121214;
      text-align: left;
      padding: 6px;
      font-weight: bold;
      border: 1px solid #E3E3DE;
      text-transform: uppercase;
    }

    td {
      padding: 6px;
      border: 1px solid #E3E3DE;
    }

    .footer-table {
      width: 100%;
      margin-top: 14px;
      font-size: 10.5px;
    }

    .footer-table td:first-child {
      text-align: right;
      font-weight: bold;
      width: 85%;
    }

    .footer-table td:last-child {
      text-align: right;
      width: 15%;
      color: #121214;
    }

    .firma {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }

    .firma-box {
      text-align: center;
    }

    .firma-box img {
      width: 140px;
      position: relative;
      top: 30px;
    }

    .firma-box p {
      margin: 0;
    }

    footer {
  margin-top: 10px;
  font-size: 9.5px;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #ccc;
  padding-top: 8px;
  color: #444;
}


    .footer-left p {
      margin: 2px 0;
      display: flex;
      align-items: center;
    }

    .footer-left img {
      width: 11px;
      height: 11px;
      margin-right: 4px;
      vertical-align: middle;
    }

    .footer-right {
      text-align: right;
      font-size: 8px;
      margin-top: -5px;
      line-height: 1.3;
    }
  </style>
</head>
<body>

  <div class="brand">
</div>

  <h1 class="title-top">{{ mb_strtoupper($negocio['nombre']) }}</h1>

  <div class="fecha-actual">
    <strong>Fecha de Exportación:</strong> {{ \Carbon\Carbon::now()->format('d/m/Y') }}
  </div>

  @php
  $tituloInventario = match($tipo) {
    'celular' => 'Celulares',
    'computadora' => 'Computadoras',
    'producto_general' => 'Productos Generales' . (isset($subtipo) && $subtipo !== 'todos' ? ': ' . $subtipo : ''),
    default => $tipo === 'producto_apple' ? 'Productos Apple' : ucfirst($tipo),
  };
  $nombreFiltrado = isset($filtroNombre) && filled($filtroNombre)
    ? ' - Nombre: ' . $filtroNombre
    : '';
@endphp

<h2 style="text-align: center; color:#121214;">
  Inventario de {{ $tituloInventario }}{{ $nombreFiltrado }}
</h2>


<table>
  <thead>
  <tr>
    <th>#</th>
    @if($tipo === 'celular')
      <th>Modelo</th>
      <th>Condición</th>
      <th>Capacidad</th>
      <th>Color</th>
      <th>Batería</th>
      <th>IMEI 1</th>
      <th>IMEI 2</th>
      <th>Estado</th>
      <th>Precio Costo</th>
      <th>Precio Venta</th>
      <th>Observaciones</th>
    @elseif($tipo === 'computadora')
      <th>Nombre</th>
      <th>Condición</th>
      <th>Procesador</th>
      <th>N° Serie</th>
      <th>Color</th>
      <th>Batería</th>
      <th>RAM</th>
      <th>Almacenamiento</th>
      <th>Procedencia</th>
      <th>Precio Costo</th>
      <th>Precio Venta</th>
      <th>Estado</th>
      <th>Observaciones</th>
    @elseif($tipo === 'producto_general')
      <th>Nombre</th>
      <th>Condición</th>
      <th>Tipo</th>
      <th>Código</th>
      <th>Procedencia</th>
      <th>Estado</th>
      <th>Precio Costo</th>
      <th>Precio Venta</th>
      <th>Observaciones</th>
      @elseif($tipo === 'producto_apple')
  <th>Modelo</th>
  <th>Condición</th>
  <th>Capacidad</th>
  <th>Batería</th>
  <th>Color</th>
  <th>N° Serie</th>
  <th>¿Tiene IMEI?</th>
  <th>IMEI 1</th>
  <th>IMEI 2</th>
  <th>Estado IMEI</th>
  <th>Procedencia</th>
  <th>Estado</th>
  <th>Precio Costo</th>
  <th>Precio Venta</th>
  <th>Observaciones</th>
@endif
  </tr>
</thead>
  <tbody>
  @foreach($productos as $p)
    <tr>
      <td>{{ $loop->iteration }}</td>

      @if($tipo === 'celular')
        <td>{{ $p->modelo }}</td>
        <td>{{ $p->condicion ?: '—' }}</td>
        <td>{{ $p->capacidad }}</td>
        <td>{{ $p->color}}</td>
        <td>{{ $p->bateria}}</td>
        <td>{{ $p->imei_1 }}</td>
        <td>{{ $p->imei_2 }}</td>
        <td>{{ ucfirst($p->estado) }}</td>
        <td>Bs {{ number_format($p->precio_costo, 2) }}</td>
        <td>Bs {{ number_format($p->precio_venta, 2) }}</td>
        <td></td>

      @elseif($tipo === 'computadora')
        <td>{{ $p->nombre }}</td>
        <td>{{ $p->condicion ?: '—' }}</td>
        <td>{{ $p->procesador }}</td>
        <td>{{ $p->numero_serie }}</td>
        <td>{{ $p->color }}</td>
        <td>{{ $p->bateria }}</td>
        <td>{{ $p->ram }}</td>
        <td>{{ $p->almacenamiento }}</td>
        <td>{{ $p->procedencia }}</td>
        <td>Bs {{ number_format($p->precio_costo, 2) }}</td>
        <td>Bs {{ number_format($p->precio_venta, 2) }}</td>
        <td>{{ $p->estado }}</td>
        <td></td>

      @elseif($tipo === 'producto_general')
        <td>{{ $p->nombre }}</td>
        <td>{{ $p->condicion ?: '—' }}</td>
        <td>{{ $p->tipo }}</td>
        <td>{{ $p->codigo }}</td>
        <td>{{ $p->procedencia }}</td>
        <td>{{ $p->estado }}</td>
        <td>Bs {{ number_format($p->precio_costo, 2) }}</td>
        <td>Bs {{ number_format($p->precio_venta, 2) }}</td>
        <td></td>

      @elseif($tipo === 'producto_apple')
        <td>{{ $p->modelo }}</td>
        <td>{{ $p->condicion ?: '—' }}</td>
        <td>{{ $p->capacidad }}</td>
        <td>{{ $p->bateria }}</td>
        <td>{{ $p->color }}</td>
        <td>{{ $p->numero_serie }}</td>
        <td>{{ $p->tiene_imei ? 'Sí' : 'No' }}</td>
        <td>{{ $p->imei_1 }}</td>
        <td>{{ $p->imei_2 }}</td>
        <td>{{ $p->estado_imei }}</td>
        <td>{{ $p->procedencia }}</td>
        <td>{{ $p->estado }}</td>
        <td>Bs {{ number_format($p->precio_costo, 2) }}</td>
        <td>Bs {{ number_format($p->precio_venta, 2) }}</td>
        <td></td>
      @endif
    </tr>
  @endforeach

  </tbody>
</table>

@php
  $valorInvertido = $productos->sum('precio_costo');
  $valorComercial = $productos->sum('precio_venta');
  $gananciaEsperada = $valorComercial - $valorInvertido;
@endphp

<table class="footer-table">
  <tr>
    <td>VALOR INVERTIDO TOTAL:</td>
    <td>Bs {{ number_format($valorInvertido, 2) }}</td>
  </tr>
  <tr>
    <td>VALOR COMERCIAL TOTAL:</td>
    <td>Bs {{ number_format($valorComercial, 2) }}</td>
  </tr>
  <tr>
    <td>GANANCIA ESPERADA:</td>
    <td>Bs {{ number_format($gananciaEsperada, 2) }}</td>
  </tr>
</table>


  <div class="firma">
    <div class="firma-box">
<div style="height: 20px;"></div>

      <p style="font-size: 12px; color: #121214;">-------------------------------</p>
      <p style="font-style: italic; font-size: 10.5px; font-weight: bold; color: #121214;">Firma autorizada - {{ $negocio['nombre'] }}</p>
    </div>
  </div>

  <footer>
    <div class="footer-left">
      @if (! empty($negocio['telefono']))
        <p><img src="{{ public_path('images/icon-phone.png') }}" alt=""> {{ $negocio['telefono'] }}</p>
      @endif
      @if (! empty($negocio['email']))
        <p>{{ $negocio['email'] }}</p>
      @endif
      @if (! empty($negocio['direccion']))
        <p><img src="{{ public_path('images/icon-location.png') }}" alt=""> {{ $negocio['direccion'] }}</p>
      @endif
    </div>
    <div class="footer-right">
      <p><strong>Validez:</strong><br>Este documento es informativo y válido solo con firma autorizada.</p>
    </div>
  </footer>

</body>
</html>

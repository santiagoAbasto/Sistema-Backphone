<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 30px 28px; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5px; color: #1e1e1e; }
    .header-wrap { display: flex; justify-content: space-between; border-bottom: 2px solid #121214; margin-bottom: 10px; }
    .brand img { width: 130px; }
    .title-top { text-align: center; font-size: 20px; font-weight: bold; color: #121214; margin-top: -75px; }
    .venta-info { text-align: right; font-size: 10px; }
    .venta-info p, .info p { margin: 1px 0; }
    .section-title { font-size: 12px; font-weight: bold; margin-top: 14px; margin-bottom: 6px; color: #121214; border-bottom: 1px solid #121214; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; text-align: center; }
    th { background-color: #F3E8DD; color: #121214; padding: 6px; border: 1px solid #E3E3DE; }
    td { padding: 6px; border: 1px solid #E3E3DE; vertical-align: top; }
    .table-right { text-align: right; }
    .resumen { width: 100%; margin-top: 14px; font-size: 10.5px; }
    .resumen td { padding: 3px 5px; }
    .resumen tr td:first-child { text-align: right; font-weight: bold; width: 85%; }
    .resumen tr td:last-child { text-align: right; width: 15%; color: #121214; }
    .notas { margin-top: 14px; font-size: 10px; border-left: 4px solid #121214; padding-left: 10px; color: #333; text-align: justify; }
  </style>
</head>

<body>
  <div class="brand">
</div>

  <h1 class="title-top">{{ mb_strtoupper($negocio['nombre']) }}</h1>

  <div class="header-wrap">
    <div class="empresa-legal" style="font-size: 9.8px; color: #333;">
      @if($negocio['nit'])<p><strong>NIT:</strong> {{ $negocio['nit'] }}</p>@endif
    </div>
    <div class="venta-info">
      <p><strong>BOLETA DE RESERVA</strong></p>
      <p>Fecha: {{ optional($reserva->created_at)->timezone(config('app.timezone'))->format('d/m/Y H:i') }}</p>
      <p>ID Reserva: #{{ $reserva->id }}</p>
      <p>Código Nota: {{ $reserva->codigo_nota ?? '---' }}</p>
      <p>Estado: {{ strtoupper($reserva->estado) }}</p>
    </div>
  </div>

  <div class="section-title">Datos del Cliente</div>
  <div class="info">
    <p><strong>Cliente:</strong> {{ $reserva->nombre_cliente }}</p>
    <p><strong>Teléfono:</strong> {{ $reserva->telefono_cliente ?? '-' }}</p>
    <p><strong>Vendedor:</strong> {{ $reserva->vendedor->name ?? '---' }}</p>
  </div>

  <div class="section-title">Productos Reservados</div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Tipo</th>
        <th>Producto</th>
        <th>Detalle</th>
        <th class="table-right">Precio</th>
        <th class="table-right">Descuento</th>
        <th class="table-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($reserva->items as $i => $item)
      @php
        $producto = $item->celular ?? $item->computadora ?? $item->productoApple ?? $item->productoGeneral;
        $nombre = $item->nombre_producto ?? $producto->modelo ?? $producto->nombre ?? 'Producto reservado';
        $detalle = trim(collect([$item->capacidad, $item->color, $item->bateria, $item->procesador, $item->ram, $item->almacenamiento])->filter()->implode(' · '));
      @endphp
      <tr>
        <td>{{ $i + 1 }}</td>
        <td>{{ strtoupper(str_replace('_', ' ', $item->tipo)) }}</td>
        <td>{{ $nombre }}</td>
        <td>{{ $detalle ?: '-' }}</td>
        <td class="table-right">Bs {{ number_format($item->precio_venta, 2) }}</td>
        <td class="table-right">Bs {{ number_format($item->descuento, 2) }}</td>
        <td class="table-right">Bs {{ number_format($item->subtotal, 2) }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  <table class="resumen">
    <tr>
      <td>Total reservado:</td>
      <td>Bs {{ number_format($reserva->subtotal, 2) }}</td>
    </tr>
    <tr>
      <td>Monto abonado:</td>
      <td>Bs {{ number_format($reserva->monto_reserva, 2) }}</td>
    </tr>
    <tr>
      <td><strong>Saldo estimado al vender:</strong></td>
      <td><strong>Bs {{ number_format(max(0, $reserva->subtotal - $reserva->monto_reserva), 2) }}</strong></td>
    </tr>
  </table>

  <div class="notas">
    <strong>Términos y condiciones:</strong>
    {{ $reserva->terminos_condiciones ?: 'La reserva se descuenta del precio final al concretar la venta. El producto queda separado mientras la reserva permanezca activa. Cambios, vencimientos o anulaciones deben ser autorizados por ' . $negocio['nombre'] . '.' }}
  </div>

  @if ($reserva->venta)
  <div class="notas">
    <strong>Venta asociada:</strong> {{ $reserva->venta->codigo_nota ?? ('#' . $reserva->venta->id) }}
  </div>
  @endif

  <table style="width: 100%; margin-top: 40px; font-size: 10.5px; text-align: center; border-collapse: collapse;">
    <tr>
      <td style="width: 50%; height: 80px; border-bottom: 1px solid #CDCDC6;"></td>
      <td style="width: 50%; height: 80px; border-bottom: 1px solid #CDCDC6;"></td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #121214; padding-top: 5px;">Firma autorizada - {{ $negocio['nombre'] }}</td>
      <td style="font-weight: bold; color: #121214; padding-top: 5px;">Firma del Cliente</td>
    </tr>
  </table>
</body>

</html>

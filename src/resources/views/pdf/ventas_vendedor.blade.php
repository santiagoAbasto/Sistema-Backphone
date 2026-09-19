<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">

  <style>
    @page { margin: 30px 28px; }

    body {
      font-family: 'DejaVu Sans', sans-serif;
      font-size: 10.5px;
      color: #1e1e1e;
      background-color: #fff;
    }

    /* ================= HEADER ================= */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #121214;
      padding-bottom: 8px;
    }

    .brand img {
      width: 130px;
    }

    .datos-vendedor {
      text-align: right;
      font-size: 10px;
      line-height: 1.4;
    }

    .titulo {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: #121214;
      margin-top: 10px;
      text-transform: uppercase;
    }

    .fecha-rango {
      text-align: center;
      font-size: 10px;
      color: #555;
      margin-bottom: 8px;
    }

    /* ================= TABLA ================= */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 10px;
    }

    th, td {
      border: 1px solid #ccc;
      padding: 6px;
      text-align: left;
    }

    th {
      background-color: #121214;
      color: #fff;
    }

    /* ================= ESTADOS ================= */
    .negativo {
      color: #dc3545;
      font-weight: bold;
    }

    .positivo {
      color: #121214;
      font-weight: bold;
    }

    /* ================= RESUMEN ================= */
    .resumen {
      width: 100%;
      margin-top: 14px;
      font-size: 10.5px;
    }

    .resumen td {
      padding: 3px 5px;
    }

    .resumen tr td:first-child {
      text-align: right;
      font-weight: bold;
      width: 85%;
    }

    .resumen tr td:last-child {
      text-align: right;
      width: 15%;
      color: #121214;
    }

    /* ================= FOOTER ================= */
    footer {
      margin-top: 20px;
      font-size: 9.5px;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      color: #444;
      display: flex;
      justify-content: space-between;
    }

    .footer-left p {
      margin: 2px 0;
    }

    .footer-right {
      text-align: right;
      font-size: 8px;
      line-height: 1.3;
    }
  </style>
</head>

<body>

  <!-- HEADER -->
  <div class="header">
    <div class="brand">
</div>

    <div class="datos-vendedor">
      <p><strong>Vendedor:</strong> {{ $vendedor->name }}</p>
      <p><strong>Fecha:</strong> {{ now()->format('d/m/Y H:i') }}</p>
    </div>
  </div>

  <div class="titulo">Resumen de Ventas del Vendedor</div>

  <div class="fecha-rango">
    Desde {{ \Carbon\Carbon::parse($fechaInicio)->format('d/m/Y') }}
    hasta {{ \Carbon\Carbon::parse($fechaFin)->format('d/m/Y') }}
  </div>

  <!-- TABLA -->
  <table>
    <thead>
      <tr>
        <th>Cliente</th>
        <th>Producto</th>
        <th>Tipo</th>
        <th>Precio</th>
        <th>Descuento</th>
        <th>Cobrado</th>
        <th>Fecha</th>
      </tr>
    </thead>
    <tbody>

      @php
        $totalVenta = 0;
        $totalDescuento = 0;
        $totalCobrado = 0;
      @endphp

      @foreach($ventas as $venta)
        @foreach($venta->items as $item)

          @php
            $producto =
              $item->celular?->modelo ??
              $item->computadora?->nombre ??
              $item->productoGeneral?->nombre ??
              $item->productoApple?->modelo ??
              $item->pieza?->nombre ??
              $item->nombre_producto ??
              ($item->tipo === 'servicio' ? 'Servicio Técnico' : '—');

            // Una línea puede llevar varias unidades (piezas, accesorios): los montos se multiplican
            $unidades = max(1, (int) $item->cantidad);
            $cobrado = $item->precio_venta * $unidades - $item->descuento * $unidades;

            $totalVenta += $item->precio_venta * $unidades;
            $totalDescuento += $item->descuento * $unidades;
            $totalCobrado += $cobrado;
          @endphp

          <tr>
            <td>{{ $venta->nombre_cliente }}</td>
            <td>{{ $unidades > 1 ? $unidades . ' × ' : '' }}{{ $producto }}</td>
            <td>{{ ucfirst(str_replace('_', ' ', $item->tipo)) }}</td>
            <td>Bs {{ number_format($item->precio_venta, 2) }}</td>
            <td>Bs {{ number_format($item->descuento, 2) }}</td>
            <td><strong>Bs {{ number_format($cobrado, 2) }}</strong></td>

            <td>{{ \Carbon\Carbon::parse($venta->created_at)->format('d/m/Y H:i') }}</td>
          </tr>

        @endforeach
      @endforeach

    </tbody>
  </table>

  <!-- RESUMEN -->
  <table class="resumen">
    <tr>
      <td>Total Vendido:</td>
      <td>Bs {{ number_format($totalVenta, 2) }}</td>
    </tr>
    <tr>
      <td>Total Descuentos:</td>
      <td>Bs {{ number_format($totalDescuento, 2) }}</td>
    </tr>
    <tr>
      <td><strong>Total Cobrado:</strong></td>
      <td><strong>Bs {{ number_format($totalCobrado, 2) }}</strong></td>
    </tr>
  </table>

  <!-- FOOTER -->
  <footer>
    <div class="footer-left">
      @if (! empty($negocio['telefono']))
        <p>📞 {{ $negocio['telefono'] }}</p>
      @endif
      @if (! empty($negocio['direccion']))
        <p>📍 {{ $negocio['direccion'] }}</p>
      @endif
    </div>

    <div class="footer-right">
      <p>
        <strong>Empresa:</strong> {{ $negocio['nombre'] }}<br>
        Documento interno válido solo con firma autorizada
      </p>
    </div>
  </footer>

</body>
</html>

<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 28px;
    }

    body {
      font-family: 'DejaVu Sans', sans-serif;
      font-size: 11px;
      color: #1e293b;
    }

    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }

    .logo img {
      width: 130px;
    }

    .doc-info {
      text-align: right;
      font-size: 10px;
    }

    .doc-info strong {
      font-size: 13px;
      color: #0f172a;
    }

    .company {
      text-align: center;
      margin-bottom: 16px;
    }

    .company h1 {
      font-size: 18px;
      margin: 4px 0;
      letter-spacing: 1px;
      color: #0f172a;
    }

    .company p {
      font-size: 9.5px;
      color: #64748b;
      margin: 0;
    }

    .section-title {
      font-size: 12px;
      font-weight: bold;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 18px;
      margin-bottom: 8px;
    }

    .box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 6px;
    }

    th,
    td {
      border: 1px solid #cbd5e1;
      padding: 6px;
    }

    th {
      background: #f1f5f9;
      text-align: center;
      color: #334155;
      font-size: 8.8px;
    }

    .right {
      text-align: right;
    }

    td.right {
      white-space: nowrap;
      font-size: 8.3px;
    }

    .product-name {
      font-weight: bold;
      color: #0f172a;
    }

    .product-details {
      margin-top: 3px;
      color: #475569;
      font-size: 8.8px;
      line-height: 1.45;
    }

    .notes-box {
      background: #f8fafc;
      border: 1px solid #dbe4ef;
      border-radius: 6px;
      padding: 8px 10px;
      color: #334155;
      font-size: 8.7px;
      line-height: 1.38;
    }

    .notes-box p {
      margin: 0 0 6px;
      page-break-inside: avoid;
    }

    .notes-box p:last-child {
      margin-bottom: 0;
    }

    .notes-box strong {
      color: #0f172a;
      font-weight: bold;
    }

    .notes-box ul,
    .notes-box ol {
      margin: 2px 0 6px 15px;
      padding: 0;
    }

    .notes-box li {
      margin-bottom: 2px;
    }

    .note-heading {
      margin: 0 0 5px;
      color: #0f172a;
      font-size: 9.2px;
      font-weight: bold;
      page-break-after: avoid;
    }

    .total-final {
      background: #0f172a;
      color: white;
      font-size: 14px;
      font-weight: bold;
      text-align: center;
    }

    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 9.5px;
      color: #64748b;
    }

    .whatsapp {
      font-weight: bold;
      color: #047857;
    }
  </style>
</head>

<body>

  @php
  /* ============================
  NORMALIZACIÓN + HELPERS
  ============================ */
  $rawItems = $cotizacion->items ?? [];

  if (is_string($rawItems)) {
  $decoded = json_decode($rawItems, true);
  $items = is_array($decoded) ? $decoded : [];
  } elseif ($rawItems instanceof \Illuminate\Support\Collection) {
  $items = $rawItems->toArray();
  } elseif (is_array($rawItems)) {
  $items = $rawItems;
  } else {
  $items = (array) $rawItems;
  }

  $num = function ($v) {
  if ($v === null) return 0;
  if (is_bool($v)) return $v ? 1 : 0;
  if (is_numeric($v)) return (float) $v;

  if (is_string($v)) {
  $s = preg_replace('/[^0-9,.\-]/', '', $v);
  if (substr_count($s, ',') === 1 && substr_count($s, '.') >= 1) {
  $s = str_replace('.', '', $s);
  $s = str_replace(',', '.', $s);
  } elseif (substr_count($s, ',') === 1 && substr_count($s, '.') === 0) {
  $s = str_replace(',', '.', $s);
  }
  return is_numeric($s) ? (float) $s : 0;
  }
  return 0;
  };

  /* ============================
  TOTALES (IGUAL FRONTEND)
  ============================ */
  $subtotalSF = 0;
  $descuentos = 0;
  $ivaTotal = 0;
  $itTotal = 0;
  $totalFinal = 0;

  $telefono = $cotizacion->telefono_completo
  ?? $cotizacion->telefono
  ?? $cotizacion->telefono_cliente
  ?? '—';
  @endphp

  <!-- BRAND + TÍTULO -->
  <div class="brand" style="text-align:center; margin-bottom: 6px;">
</div>

  <h1 class="title-top" style="
  text-align:center;
  font-size:18px;
  margin: 4px 0 8px;
  letter-spacing:1px;
  color:#0f172a;
">
    {{ mb_strtoupper($negocio['nombre']) }}
  </h1>

  <!-- HEADER INFO -->
  <div class="header-wrap" style="
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  border-bottom:2px solid #0f172a;
  padding-bottom:8px;
  margin-bottom:14px;
">

    <!-- EMPRESA / LEGAL -->
    <div class="empresa-legal" style="
    font-size:9.8px;
    color:#334155;
    line-height:1.4;
  ">
      @if($negocio['nit'])<p style="margin:0;"><strong>NIT:</strong> {{ $negocio['nit'] }}</p>@endif
      @if($negocio['direccion'])<p style="margin:0;">{{ $negocio['direccion'] }}</p>@endif
    </div>

    <!-- INFO DOCUMENTO -->
    <div class="doc-info" style="
    text-align:right;
    font-size:10px;
    color:#334155;
  ">
      <p style="margin:0; font-weight:bold; font-size:12px; color:#0f172a;">
        COTIZACIÓN
      </p>
      <p style="margin:0;">
        Fecha: {{ optional($cotizacion->fecha_cotizacion ?? $cotizacion->created_at)->format('d/m/Y') }}
      </p>
      <p style="margin:0;">
        Nº #COT-{{ $cotizacion->id }}
      </p>
    </div>

  </div>


  <!-- CLIENTE -->
  <div class="section-title">Datos del Cliente</div>
  <div class="box">
    <strong>Cliente:</strong> {{ $cotizacion->nombre_cliente ?? '—' }}<br>
    <strong>Teléfono:</strong> {{ $telefono }}<br>
    <strong>Correo:</strong> {{ $cotizacion->correo_cliente ?? '—' }}
  </div>

  <!-- DETALLE -->
  <div class="section-title">Detalle de Productos / Servicios</div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Descripción</th>
        <th>Cant.</th>
        <th class="right">P. unitario</th>
        <th class="right">Subtotal</th>
        <th class="right">Descuento</th>
        <th class="right">IVA 13%</th>
        <th class="right">IT 3%</th>
        <th class="right">Total</th>
      </tr>
    </thead>

    <tbody>
      @forelse($items as $i => $it)
      @php
      $itArr = is_array($it) ? $it : (array) $it;

      $nombre = $itArr['nombre'] ?? '—';
      $detalles = [];

      if (!empty($itArr['modelo']) && $itArr['modelo'] !== $nombre) {
      $detalles[] = 'Modelo: ' . $itArr['modelo'];
      }
      if (!empty($itArr['procesador'])) {
      $detalles[] = 'Procesador: ' . $itArr['procesador'];
      }
      if (!empty($itArr['ram'])) {
      $detalles[] = 'RAM: ' . $itArr['ram'];
      }
      if (!empty($itArr['almacenamiento'])) {
      $detalles[] = 'Almacenamiento: ' . $itArr['almacenamiento'];
      }
      if (!empty($itArr['capacidad'])) {
      $detalles[] = 'Capacidad: ' . $itArr['capacidad'];
      }
      if (!empty($itArr['color'])) {
      $detalles[] = 'Color: ' . $itArr['color'];
      }
      if (!empty($itArr['bateria'])) {
      $detalles[] = 'Batería: ' . $itArr['bateria'];
      }
      $cantidad = max(1, (int) $num($itArr['cantidad'] ?? 1));
      $precioSF = $num($itArr['precio_sin_factura'] ?? 0);
      $descRaw = $num($itArr['descuento'] ?? 0);

      $base = $precioSF * $cantidad;
      $descuentoItem = min(max(0, $descRaw), $base);
      $baseNeta = max(0, $base - $descuentoItem);

      $iva = round($baseNeta * 0.13, 2);
      $itx = round($baseNeta * 0.03, 2);
      $total = round($baseNeta + $iva + $itx, 2);

      $subtotalSF += $base;
      $descuentos += $descuentoItem;
      $ivaTotal += $iva;
      $itTotal += $itx;
      $totalFinal += $total;
      @endphp

      <tr>
        <td>{{ $i + 1 }}</td>
        <td>
          <div class="product-name">{{ $nombre }}</div>
          @if(count($detalles) > 0)
          <div class="product-details">{{ implode(' · ', $detalles) }}</div>
          @endif
        </td>
        <td class="right">{{ $cantidad }}</td>
        <td class="right">Bs {{ number_format($precioSF, 2) }}</td>
        <td class="right">Bs {{ number_format($base, 2) }}</td>
        <td class="right">- Bs {{ number_format($descuentoItem, 2) }}</td>
        <td class="right">Bs {{ number_format($iva, 2) }}</td>
        <td class="right">Bs {{ number_format($itx, 2) }}</td>
        <td class="right"><strong>Bs {{ number_format($total, 2) }}</strong></td>
      </tr>
      @empty
      <tr>
        <td colspan="9" style="text-align:center; color:#64748b;">
          No hay ítems agregados
        </td>
      </tr>
      @endforelse
    </tbody>
  </table>

  <!-- RESUMEN -->
  <div class="section-title">Resumen Final</div>

  <table>
    <tr>
      <td class="right"><strong>Importe neto sin factura:</strong></td>
      <td class="right">Bs {{ number_format($subtotalSF - $descuentos, 2) }}</td>
    </tr>

    <tr class="total-final">
      <td>IMPORTE NETO CON FACTURA</td>
      <td>Bs {{ number_format($totalFinal, 2) }}</td>
    </tr>
  </table>

  @if(!empty($cotizacion->notas_adicionales))
  @php
  $notesHtml = \Illuminate\Support\Str::markdown(
  trim($cotizacion->notas_adicionales),
  [
  'html_input' => 'strip',
  'allow_unsafe_links' => false,
  ]
  );
  $notesHtml = preg_replace(
  '/<p><strong>(.*?)<\/strong><\/p>/s',
  '<div class="note-heading">$1</div>',
  $notesHtml
  );
  @endphp
  <div class="section-title">Notas adicionales</div>
  <div class="notes-box">
    {!! $notesHtml !!}
  </div>
  @endif

  <div class="footer">
    Documento sin valor fiscal · Cotización referencial<br>
    @if($negocio['telefono'])<div class="whatsapp">{{ $negocio['telefono'] }}</div>@endif
  </div>

</body>

</html>

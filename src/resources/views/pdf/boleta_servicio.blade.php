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
    }

    /* ================= HEADER ================= */
    .header-wrap {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #121214;
      padding-bottom: 10px;
      margin-bottom: 16px;
      position: relative;
    }

    .brand img {
      width: 130px;
    }

    .empresa-legal {
      font-size: 9.3px;
      color: #334155;
      margin-top: 4px;
      line-height: 1.4;
    }

    .company-name {
      position: absolute;
      top: 32px;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      letter-spacing: 1px;
      color: #121214;
    }

    .venta-info {
      text-align: right;
      font-size: 10px;
      color: #334155;
      line-height: 1.5;
    }

    /* ================= SECTIONS ================= */
    .section-title {
      font-size: 12px;
      font-weight: bold;
      color: #121214;
      margin-top: 18px;
      margin-bottom: 6px;
      border-bottom: 1px solid #121214;
      padding-bottom: 4px;
    }

    .info {
      padding: 6px 0;
    }

    .info p {
      margin: 3px 0;
      font-size: 10.5px;
    }

    /* ================= TABLES ================= */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 10px;
    }

    thead th {
      background: #F3E8DD;
      color: #121214;
      padding: 7px 6px;
      border: 1px solid #cbd5e1;
      text-align: left;
      font-weight: bold;
    }

    tbody td {
      padding: 7px 6px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }

    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }

    .precio-servicio {
      font-size: 9.5px;
      color: #475569;
      margin-top: 3px;
      display: inline-block;
    }

    /* ================= TOTAL ================= */
    .total-final {
      margin-top: 14px;
      padding-top: 6px;
      border-top: 1px dashed #94a3b8;
      text-align: right;
      font-size: 12px;
      font-weight: bold;
      color: #121214;
    }

    /* ================= FIRMAS ================= */
    .firmas {
      margin-top: 48px;
      width: 100%;
      text-align: center;
    }

    .firmas td {
      width: 50%;
      height: 95px;
      vertical-align: bottom;
    }

    .firmas img {
      width: 150px;
      opacity: 0.95;
    }

    .firma-label {
      font-size: 9.5px;
      color: #334155;
      margin-top: 4px;
    }

    /* ================= FOOTER ================= */
    .footer {
      margin-top: 22px;
      text-align: center;
      font-size: 9.5px;
      color: #475569;
      line-height: 1.4;
    }

    .whatsapp {
      margin-top: 4px;
      font-size: 10.5px;
      font-weight: bold;
      color: #065f46;
    }
  </style>
</head>

<body>

  <!-- HEADER -->
  <div class="header-wrap">

    <!-- IZQUIERDA -->
    <div>
      <div class="brand">
</div>
      <div class="empresa-legal">
        @if($negocio['nit'])<strong>NIT:</strong> {{ $negocio['nit'] }}@endif
      </div>
    </div>

    <!-- CENTRO -->
    <div class="company-name">{{ mb_strtoupper($negocio['nombre']) }}</div>

    <!-- DERECHA -->
    <div class="venta-info">
      <p><strong>BOLETA DE SERVICIO TÉCNICO</strong></p>
      <p>Fecha: {{ optional($servicio->created_at)->timezone(config('app.timezone'))->format('d/m/Y H:i') }}</p>
      <p>Código Nota: {{ $servicio->codigo_nota }}</p>
    </div>

  </div>

  <!-- CLIENTE -->
  <div class="section-title">Datos del Cliente</div>
  <div class="info">
    <p><strong>Cliente:</strong> {{ $servicio->cliente }}</p>
    <p><strong>Teléfono:</strong> {{ $servicio->telefono ?? '—' }}</p>
  </div>

  <!-- DETALLE DEL SERVICIO -->
  <div class="section-title">Detalle del Servicio</div>
  <table>
    <thead>
      <tr>
        <th style="width:25%">Equipo</th>
        <th style="width:45%">Servicio realizado</th>
        <th style="width:30%">Registrado por</th>
      </tr>
    </thead>
    <tbody>
      @foreach ($servicios_cliente as $item)
      <tr>
        <td>{{ $servicio->equipo }}</td>
        <td>
          {{ $item['descripcion'] }}<br>
          <span class="precio-servicio">
            Precio del servicio: Bs {{ number_format($item['precio'], 2) }}
          </span>
        </td>
        <td>{{ $servicio->vendedor->name ?? '—' }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  <!-- TOTAL -->
  <div class="total-final">
    Total a pagar por el cliente: Bs {{ number_format($servicio->precio_venta, 2) }}
  </div>

  <!-- FIRMAS -->
  <table class="firmas">
    <tr>
      <td>
<br>
        <div class="firma-label">Firma autorizada – {{ $negocio['nombre'] }}</div>
      </td>
      <td>
        <div class="firma-label">
          Firma del Cliente<br>
          Conforme con la recepción del equipo
        </div>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <div class="footer">
    @if($negocio['direccion']){{ $negocio['direccion'] }}<br>@endif
    @if($negocio['telefono'])<div class="whatsapp">{{ $negocio['telefono'] }}</div>@endif
  </div>

</body>
</html>
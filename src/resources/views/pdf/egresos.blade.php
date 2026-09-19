<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 40px 35px; }
    body {
      font-family: 'DejaVu Sans', sans-serif;
      font-size: 10.5px;
      color: #333;
    }
    header { text-align: center; margin-bottom: 20px; }
    header img { width: 130px; margin-bottom: 5px; }
    h1 { font-size: 20px; color: #1D1D21; margin: 0; }
    .subtitulo { font-size: 13px; font-weight: normal; color: #555; }
    .fecha-reporte { text-align: right; font-size: 10px; margin-bottom: 10px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 10px;
    }
    th, td {
      border: 1px solid #dee2e6;
      padding: 6px 4px;
      text-align: center;
      vertical-align: middle;
      word-wrap: break-word;
    }
    th { background-color: #f8f9fa; font-weight: bold; }
    .text-right { text-align: right; white-space: nowrap; }
    .text-muted { color: #6c757d; }
    .divider { border-top: 2px solid #1D1D21; margin: 30px 0 20px; }
    .resumen-final {
      font-size: 12px;
      font-weight: bold;
      text-align: right;
    }
    .resumen-final .label { color: #000; font-weight: bold; margin-right: 10px; }
    .resumen-final .value { color: #dc3545; }
    .firma {
      margin-top: 50px;
      text-align: center;
    }
    .firma img {
      width: 220px;
      margin-bottom: 10px;
    }
    .firma p {
      font-size: 14px;
      margin: 0;
      line-height: 1.3;
    }
  </style>
</head>
<body>

<header>
<h1>REPORTE DE EGRESOS</h1>
  <p class="subtitulo">{{ $negocio['nombre'] }} · Gastos y Administración</p>
</header>

<div class="fecha-reporte">
  Fecha del Reporte: {{ now()->format('d/m/Y') }}<br>
  Rango: {{ \Carbon\Carbon::parse($fechaInicio)->format('d/m/Y') }} – {{ \Carbon\Carbon::parse($fechaFin)->format('d/m/Y') }}
  @if(!empty($tipo))
    <br>Tipo de gasto: {{ $tipo }}
  @endif
</div>

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Fecha</th>
      <th>Concepto</th>
      <th>Precio (Bs)</th>
      <th>Tipo de Gasto</th>
      <th>Frecuencia</th>
      <th>Cuotas</th>
      <th>Comentario</th>
      <th>Registrado por</th>
    </tr>
  </thead>
  <tbody>
    @php $i = 1; @endphp
    @foreach($egresos as $e)
      <tr>
        <td>{{ $i++ }}</td>
        <td>{{ \Carbon\Carbon::parse($e->created_at)->format('d/m/Y') }}</td>
        <td>{{ $e->concepto }}</td>
        <td class="text-right">{{ number_format($e->precio_invertido, 2) }} Bs</td>
        <td>{{ \App\Models\Egreso::TIPOS[$e->tipo_gasto] ?? ucfirst(str_replace('_', ' ', $e->tipo_gasto)) }}</td>
        <td>{{ $e->frecuencia ?? '—' }}</td>
        <td>
          @if($e->tipo_gasto === 'cuota_bancaria')
            {{ $e->cuotas_pendientes ?? 0 }} cuotas
          @else
            No aplica
          @endif
        </td>
        <td>{{ $e->comentario ?? '—' }}</td>
        <td>{{ $e->user->name ?? '—' }}</td>
      </tr>
    @endforeach
  </tbody>
</table>

<div class="divider"></div>

<div class="resumen-final">
  <div><span class="label">Total Gastado:</span> <span class="value">{{ number_format($total, 2) }} Bs</span></div>
</div>

<div class="firma">
  <p>Firma autorizada:</p>
<p><strong>{{ $negocio['nombre'] }}</strong><br>Firma autorizada</p>
</div>

</body>
</html>

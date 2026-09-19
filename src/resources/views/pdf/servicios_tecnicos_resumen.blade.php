<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Resumen de Servicios Técnicos</title>

    <style>
        @page { margin: 30px; }

        body {
            font-family: 'DejaVu Sans', sans-serif;
            font-size: 10.5px;
            color: #222;
        }

        /* ================= HEADER ================= */
        .brand {
            text-align: center;
            margin-bottom: 10px;
        }

        .brand img {
            height: 70px;
            margin-bottom: 6px;
        }

        .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            color: #121214;
        }

        .subtitle {
            text-align: center;
            font-size: 11px;
            color: #555;
            margin-bottom: 20px;
        }

        /* ================= TABLA ================= */
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }

        thead {
            background-color: #121214;
            color: #fff;
        }

        th {
            text-transform: uppercase;
            font-size: 8.5px;
        }

        th, td {
            border: 1px solid #ccc;
            padding: 6px;
        }

        .text-right {
            text-align: right;
        }

        /* ================= RESUMEN ================= */
        .resumen {
            margin-top: 25px;
            width: 45%;
            float: right;
            font-size: 10px;
        }

        .resumen td {
            padding: 6px;
            border: 1px solid #ccc;
        }

        .label {
            font-weight: bold;
            color: #121214;
        }

        /* ================= FIRMA ================= */
        .firma-container {
            clear: both;
            margin-top: 70px;
            text-align: center;
            font-size: 10px;
        }

        .firma-container img {
            height: 55px;
            opacity: 0.95;
        }

        .firma-label {
            margin-top: 4px;
            font-weight: bold;
            color: #121214;
        }

        .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 9px;
            color: #666;
        }

        .periodo {
            margin-top: 4px;
            font-size: 10px;
            color: #555;
        }
    </style>
</head>

<body>

    <!-- HEADER -->
    <div class="brand">
<div class="title">{{ mb_strtoupper($negocio['nombre']) }}</div>
        <div class="subtitle">Resumen Consolidado de Servicios Técnicos</div>
        @if(!empty($periodo))
            <div class="periodo">{{ $periodo }}</div>
        @endif
    </div>

    <!-- TABLA PRINCIPAL -->
    <table>
        <thead>
            <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Equipo</th>
                <th>Servicio</th>
                <th>Técnico</th>
                <th>Registrado por</th>
                @if ($conCostos ?? true)
                    <th class="text-right">Costo (Bs)</th>
                @endif
                <th class="text-right">Cobro (Bs)</th>
                <th>Fecha</th>
            </tr>
        </thead>
        <tbody>
            @php
                $totalCosto = 0;
                $totalVenta = 0;
                $totalVentaConCosto = 0;
                $sinCosto = 0;
            @endphp

            @forelse ($filas as $fila)
                @php
                    // Un trabajo sin costo cargado no se suma a la utilidad: se marca «Pendiente»
                    $pendiente = ! empty($fila['pendiente']);
                    $costo = (float) ($fila['costo'] ?? 0);
                    $venta = (float) ($fila['venta'] ?? 0);

                    $totalVenta += $venta;
                    if ($pendiente) {
                        $sinCosto++;
                    } else {
                        $totalCosto += $costo;
                        $totalVentaConCosto += $venta;
                    }
                @endphp
                <tr>
                    <td>{{ $fila['codigo_nota'] }}</td>
                    <td>{{ $fila['cliente'] }}</td>
                    <td>{{ $fila['equipo'] }}</td>
                    <td>{{ mb_strtoupper($fila['servicio'], 'UTF-8') }}</td>
                    <td>{{ $fila['tecnico'] }}</td>
                    <td>{{ $fila['vendedor'] }}</td>
                    @if ($conCostos ?? true)
                        <td class="text-right">{{ $pendiente ? 'Pendiente' : number_format($costo, 2) }}</td>
                    @endif
                    <td class="text-right">{{ number_format($venta, 2) }}</td>
                    <td>{{ \Carbon\Carbon::parse($fila['fecha'])->format('d/m/Y') }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="{{ ($conCostos ?? true) ? 9 : 8 }}" style="text-align:center;">
                        No existen registros de servicios técnicos
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <!-- RESUMEN ECONÓMICO -->
    <table class="resumen">
        @if ($conCostos ?? true)
            <tr>
                <td class="label">Total Costo Invertido</td>
                <td class="text-right">{{ number_format($totalCosto, 2) }} Bs</td>
            </tr>
        @endif
        <tr>
            <td class="label">Total Cobrado</td>
            <td class="text-right">{{ number_format($totalVenta, 2) }} Bs</td>
        </tr>
        @if ($conCostos ?? true)
            <tr>
                <td class="label">Ganancia Neta</td>
                <td class="text-right">
                    <strong style="color: {{ ($totalVentaConCosto - $totalCosto) >= 0 ? '#198754' : '#dc3545' }}">
                        {{ number_format($totalVentaConCosto - $totalCosto, 2) }} Bs
                    </strong>
                </td>
            </tr>
            @if ($sinCosto > 0)
                <tr>
                    <td class="label" colspan="2">
                        {{ $sinCosto }} {{ $sinCosto === 1 ? 'trabajo no tiene' : 'trabajos no tienen' }} el costo cargado: su utilidad no está sumada.
                    </td>
                </tr>
            @endif
        @endif
    </table>

    <!-- FIRMA -->
    <div class="firma-container">
<div class="firma-label">Firma autorizada - {{ $negocio['nombre'] }}</div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
        Documento generado automáticamente por el sistema {{ $negocio['nombre'] }}.
    </div>

</body>
</html>

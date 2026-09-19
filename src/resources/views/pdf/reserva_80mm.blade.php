<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <style>
        @page { margin: 0; }
        html, body { width: 80mm; margin: 0; padding: 0; }
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 9px; color: #111; }
        .wrapper { width: 72mm; margin: 0 auto; padding: 22px 8px 10px 8px; box-sizing: border-box; }
        .center { text-align: center; }
        .right { text-align: right; }
        .logo { text-align: center; margin-bottom: 6px; }
        .logo img { width: 95px; }
        .brand { font-size: 13px; font-weight: bold; letter-spacing: 0.5px; margin-top: 2px; }
        .brand-sub { font-size: 8px; line-height: 1.4; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .section-title { font-size: 10px; font-weight: bold; margin: 6px 0 4px; text-transform: uppercase; }
        .info p { margin: 2px 0; }
        .item { margin-bottom: 6px; }
        .name { font-weight: bold; text-transform: uppercase; }
        .meta { font-size: 8px; line-height: 1.3; margin-top: 2px; }
        .price-line { display: flex; justify-content: space-between; margin-top: 2px; font-weight: bold; }
        .total-box { margin-top: 10px; padding-top: 2px; text-align: right; }
        .total-label { font-size: 9px; font-weight: 600; color: #1f3a5f; letter-spacing: 0.4px; }
        .total-amount { font-size: 17px; font-weight: bold; color: #0f2f5c; letter-spacing: 0.6px; }
        .notes { margin-top: 6px; font-size: 8px; line-height: 1.4; }
        .footer { margin-top: 12px; text-align: center; font-size: 8px; line-height: 1.4; }
    </style>
</head>

<body>
    <div class="wrapper">
        <div class="logo">
</div>

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

        <div class="info">
            <p><strong>BOLETA DE RESERVA</strong></p>
            <p><strong>Fecha:</strong> {{ optional($reserva->created_at)->timezone(config('app.timezone'))->format('d/m/Y H:i') }}</p>
            <p><strong>N° Nota:</strong> {{ $reserva->codigo_nota }}</p>
            <p><strong>Estado:</strong> {{ strtoupper($reserva->estado) }}</p>
            <p><strong>Cliente:</strong> {{ $reserva->nombre_cliente }}</p>
            <p><strong>Tel:</strong> {{ $reserva->telefono_cliente ?? '—' }}</p>
            <p><strong>Vendedor:</strong> {{ $reserva->vendedor->name ?? '—' }}</p>
        </div>

        <div class="divider"></div>

        @foreach($reserva->items as $item)
        @php
            $producto = $item->celular ?? $item->computadora ?? $item->productoApple ?? $item->productoGeneral;
            $nombre = $item->nombre_producto ?? $producto->modelo ?? $producto->nombre ?? 'Producto reservado';
            $detalle = trim(collect([$item->capacidad, $item->color, $item->bateria, $item->procesador, $item->ram, $item->almacenamiento])->filter()->implode(' · '));
        @endphp
        <div class="item">
            <div class="name">{{ strtoupper(str_replace('_', ' ', $item->tipo)) }}</div>
            <div class="meta">
                {{ $nombre }}<br>
                {{ $detalle ?: 'Producto reservado' }}
            </div>
            <div class="price-line">
                <span>Subtotal</span>
                <span>Bs {{ number_format($item->subtotal, 2) }}</span>
            </div>
        </div>
        @endforeach

        <div class="divider"></div>

        <div class="price-line">
            <span>Total reservado</span>
            <span>Bs {{ number_format($reserva->subtotal, 2) }}</span>
        </div>
        <div class="price-line">
            <span>Monto abonado</span>
            <span>Bs {{ number_format($reserva->monto_reserva, 2) }}</span>
        </div>

        <div class="total-box">
            <div class="total-label">SALDO ESTIMADO</div>
            <div class="total-amount">Bs {{ number_format(max(0, $reserva->subtotal - $reserva->monto_reserva), 2) }}</div>
        </div>

        <div class="notes">
            <div class="section-title">Términos</div>
            {{ $reserva->terminos_condiciones ?: 'La reserva se descuenta del precio final al concretar la venta. El producto queda separado mientras la reserva permanezca activa.' }}
        </div>

        <div class="divider"></div>

        <div class="footer">
            Documento interno sin valor fiscal<br>
            Gracias por su preferencia
        </div>
    </div>
</body>

</html>

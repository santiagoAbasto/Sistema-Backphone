<?php

namespace App\Support;

/**
 * Cómo paga un cliente: lo mismo en ventas, servicios técnicos y abonos de reserva.
 * Solo lo cobrado en efectivo entra a la caja (ver EfectivoDeCaja).
 */
final class FormasDePago
{
    public const TODAS = [
        'efectivo'      => 'Efectivo',
        'qr'            => 'QR',
        'transferencia' => 'Transferencia',
        'tarjeta'       => 'Tarjeta',
    ];

    /** «QR» y no «Qr»: lo que sale impreso en las notas. */
    public static function texto(?string $clave): string
    {
        return self::TODAS[$clave] ?? ucfirst((string) $clave);
    }
}

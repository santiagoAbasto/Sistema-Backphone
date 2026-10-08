<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Las ventas también se cobran por transferencia.
 *
 * `ventas.metodo_pago` nació como enum, y en PostgreSQL eso es un CHECK que solo acepta
 * efectivo / qr / tarjeta: cambiar solo la validación hacía pasar las pruebas y fallar la
 * primera venta por transferencia en producción. Mismo arreglo que el estado del inventario
 * (2026_09_19_210000): se reescribe el CHECK. En SQLite no hay nada que ensanchar.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->reescribir(['efectivo', 'qr', 'tarjeta', 'transferencia']);
    }

    public function down(): void
    {
        // La transferencia vuelve a QR y no a efectivo: no es plata que haya entrado al cajón
        DB::table('ventas')->where('metodo_pago', 'transferencia')->update(['metodo_pago' => 'qr']);

        $this->reescribir(['efectivo', 'qr', 'tarjeta']);
    }

    private function reescribir(array $metodos): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $lista = implode(', ', array_map(fn ($m) => "'" . $m . "'", $metodos));

        DB::statement('ALTER TABLE ventas DROP CONSTRAINT IF EXISTS ventas_metodo_pago_check');
        DB::statement("ALTER TABLE ventas ADD CONSTRAINT ventas_metodo_pago_check CHECK (metodo_pago IN ({$lista}))");
    }
};

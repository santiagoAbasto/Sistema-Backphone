<?php

namespace Database\Seeders;

use App\Models\Sucursal;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * El contador de códigos de nota arranca en cero para cada sucursal.
 * Así la primera venta de Cochabamba es CBA-V001 y la de Sucre, SUC-V001.
 */
class SecuenciasSeeder extends Seeder
{
    private const CLAVES = ['ventas', 'servicio_tecnico', 'reservas'];

    public function run(): void
    {
        foreach (Sucursal::all() as $sucursal) {
            foreach (self::CLAVES as $clave) {
                DB::table('secuencias')->updateOrInsert(
                    ['clave' => $clave, 'sucursal_id' => $sucursal->id],
                    ['ultimo_numero' => 0, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        }
    }
}

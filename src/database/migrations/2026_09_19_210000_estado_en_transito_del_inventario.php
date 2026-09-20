<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * «En tránsito» pasa a ser un estado válido del inventario.
 *
 * Las tablas viejas declararon `estado` como enum, y en PostgreSQL eso es un CHECK que solo
 * acepta disponible / vendido / permuta. Un equipo que sale en un traspaso necesita un cuarto
 * estado, así que hay que ensanchar el CHECK.
 *
 * ⚠️ Ojo para la próxima: en SQLite —donde corren las pruebas— un enum se crea como `varchar`
 * sin restricción. Eso quiere decir que agregar un estado nuevo pasa los tests y revienta recién
 * en producción. Si algún día aparece otro estado, este archivo es el que hay que tocar.
 */
return new class extends Migration
{
    private const TABLAS = ['celulares', 'computadoras', 'productos_generales'];

    private const ESTADOS = ['disponible', 'vendido', 'permuta', 'en_transito'];

    public function up(): void
    {
        $this->reescribir(self::ESTADOS);
    }

    public function down(): void
    {
        // Nada puede quedar viajando si el estado deja de existir
        DB::table('celulares')->where('estado', 'en_transito')->update(['estado' => 'disponible']);
        DB::table('computadoras')->where('estado', 'en_transito')->update(['estado' => 'disponible']);
        DB::table('productos_generales')->where('estado', 'en_transito')->update(['estado' => 'disponible']);

        $this->reescribir(['disponible', 'vendido', 'permuta']);
    }

    private function reescribir(array $estados): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return; // en SQLite la columna es un varchar suelto: no hay nada que ensanchar
        }

        $lista = implode(', ', array_map(fn ($e) => "'" . $e . "'", $estados));

        foreach (self::TABLAS as $tabla) {
            $nombre = $tabla . '_estado_check';

            DB::statement("ALTER TABLE {$tabla} DROP CONSTRAINT IF EXISTS {$nombre}");
            DB::statement("ALTER TABLE {$tabla} ADD CONSTRAINT {$nombre} CHECK (estado IN ({$lista}))");
        }
    }
};

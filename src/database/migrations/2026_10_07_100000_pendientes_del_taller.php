<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lo que faltaba del taller: carnet en la nota, talleres externos y stock consumido en reparaciones.
 */
return new class extends Migration
{
    public function up(): void
    {
        // El carnet del cliente va impreso en la nota de venta de un celular.
        Schema::table('ventas', fn (Blueprint $t) => $t->string('documento_cliente', 40)->nullable()->after('telefono_cliente'));

        // Un «técnico» puede ser otro taller: se lleva el equipo y después nos factura.
        Schema::table('tecnicos', function (Blueprint $t) {
            $t->boolean('externo')->default(false)->after('especialidad');
            $t->string('empresa', 120)->nullable()->after('externo');
        });

        $this->estados(['disponible', 'vendido', 'permuta', 'en_transito', 'servicio']);

        // La liquidación de un técnico sale de la caja: queda apuntada al egreso que la pagó.
        Schema::table('liquidaciones', fn (Blueprint $t) => $t->foreignId('egreso_id')->nullable()->after('pagada_por')->constrained('egresos')->nullOnDelete());
    }

    public function down(): void
    {
        Schema::table('liquidaciones', fn (Blueprint $t) => $t->dropConstrainedForeignId('egreso_id'));

        DB::table('celulares')->where('estado', 'servicio')->update(['estado' => 'disponible']);
        DB::table('computadoras')->where('estado', 'servicio')->update(['estado' => 'disponible']);
        DB::table('productos_generales')->where('estado', 'servicio')->update(['estado' => 'disponible']);
        $this->estados(['disponible', 'vendido', 'permuta', 'en_transito']);

        Schema::table('tecnicos', fn (Blueprint $t) => $t->dropColumn(['externo', 'empresa']));
        Schema::table('ventas', fn (Blueprint $t) => $t->dropColumn('documento_cliente'));
    }

    /** El CHECK de `estado` solo existe en PostgreSQL; en SQLite la columna es un varchar suelto. */
    private function estados(array $valores): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $lista = implode(', ', array_map(fn ($e) => "'{$e}'", $valores));

        foreach (['celulares', 'computadoras', 'productos_generales'] as $tabla) {
            DB::statement("ALTER TABLE {$tabla} DROP CONSTRAINT IF EXISTS {$tabla}_estado_check");
            DB::statement("ALTER TABLE {$tabla} ADD CONSTRAINT {$tabla}_estado_check CHECK (estado IN ({$lista}))");
        }
    }
};

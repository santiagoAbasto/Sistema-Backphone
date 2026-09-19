<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * El sistema pasa a tener varias sucursales.
 *
 * Cada sucursal se administra sola: su inventario, sus ventas, sus reservas, sus servicios, sus
 * clientes y sus códigos de nota son suyos. Quien tiene una sucursal asignada solo ve la suya;
 * quien no tiene ninguna (`users.sucursal_id` en null) es super administrador y ve todas, con un
 * selector para filtrar.
 *
 * Todo lo que ya existía queda en la primera sucursal: nada se pierde ni queda huérfano.
 */
return new class extends Migration
{
    /** Las tablas cuyo contenido pertenece a una sucursal. */
    private const TABLAS = [
        'celulares',
        'computadoras',
        'productos_apple',
        'productos_generales',
        'ventas',
        'reservas',
        'servicio_tecnicos',
        'cotizaciones',
        'egresos',
        'clientes',
        'inventory_audits',
    ];

    public function up(): void
    {
        Schema::create('sucursales', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 80);
            // Va adelante de cada código de nota: CBA-V001, SUC-V001. Corto y en mayúsculas.
            $table->string('prefijo', 6)->unique();
            $table->string('ciudad', 80)->nullable();
            $table->string('direccion', 200)->nullable();
            $table->string('telefono', 40)->nullable();
            $table->boolean('activa')->default(true);
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });

        $ahora = now();
        DB::table('sucursales')->insert([
            ['nombre' => 'Cochabamba', 'prefijo' => 'CBA', 'ciudad' => 'Cochabamba', 'activa' => true, 'orden' => 1, 'created_at' => $ahora, 'updated_at' => $ahora],
            ['nombre' => 'Sucre',      'prefijo' => 'SUC', 'ciudad' => 'Sucre',      'activa' => true, 'orden' => 2, 'created_at' => $ahora, 'updated_at' => $ahora],
        ]);

        $primera = (int) DB::table('sucursales')->orderBy('orden')->value('id');

        // Quién trabaja en qué sucursal. En null = super administrador: ve todas.
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('sucursal_id')->nullable()->after('rol')->constrained('sucursales')->nullOnDelete();
        });

        // Todo lo que ya estaba cargado pertenece a la primera sucursal.
        foreach (self::TABLAS as $tabla) {
            if (! Schema::hasTable($tabla)) {
                continue;
            }

            Schema::table($tabla, function (Blueprint $table) {
                $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();
                $table->index('sucursal_id');
            });

            DB::table($tabla)->whereNull('sucursal_id')->update(['sucursal_id' => $primera]);
        }

        // Los códigos de nota se numeran por sucursal: CBA-V001 y SUC-V001 conviven sin chocar.
        Schema::table('secuencias', function (Blueprint $table) {
            $table->foreignId('sucursal_id')->nullable()->after('clave')->constrained('sucursales')->cascadeOnDelete();
        });

        DB::table('secuencias')->whereNull('sucursal_id')->update(['sucursal_id' => $primera]);

        // La clave sola ya no es única: lo es junto con la sucursal.
        $this->soltarUnicoDeClave();

        Schema::table('secuencias', function (Blueprint $table) {
            $table->unique(['clave', 'sucursal_id'], 'secuencias_clave_sucursal_unique');
        });
    }

    public function down(): void
    {
        Schema::table('secuencias', function (Blueprint $table) {
            $table->dropUnique('secuencias_clave_sucursal_unique');
            $table->dropConstrainedForeignId('sucursal_id');
        });

        foreach (array_reverse(self::TABLAS) as $tabla) {
            if (Schema::hasTable($tabla)) {
                Schema::table($tabla, fn (Blueprint $table) => $table->dropConstrainedForeignId('sucursal_id'));
            }
        }

        Schema::table('users', fn (Blueprint $table) => $table->dropConstrainedForeignId('sucursal_id'));

        Schema::dropIfExists('sucursales');
    }

    /**
     * Suelta el índice único que tenía `clave` sola.
     *
     * Se busca por sus columnas y no por su nombre: cada motor se lo pone distinto, y en PostgreSQL
     * un `DROP` de algo que no existe aborta la transacción entera de la migración.
     */
    private function soltarUnicoDeClave(): void
    {
        foreach (Schema::getIndexes('secuencias') as $indice) {
            $esUnicoDeClaveSola = ($indice['unique'] ?? false)
                && ! ($indice['primary'] ?? false)
                && ($indice['columns'] ?? []) === ['clave'];

            if ($esUnicoDeClaveSola) {
                Schema::table('secuencias', fn (Blueprint $table) => $table->dropUnique($indice['name']));
            }
        }
    }
};

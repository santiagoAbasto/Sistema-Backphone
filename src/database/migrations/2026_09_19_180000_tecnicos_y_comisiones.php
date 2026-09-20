<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Los técnicos dejan de ser un nombre escrito a mano.
 *
 * El taller no paga sueldo: trabaja por comisión sobre cada reparación. Mientras el técnico fue
 * un texto libre en la nota, no había manera de sumar lo que le tocaba ni de comprobar que un
 * equipo Android no terminó en manos del técnico de Apple. Ahora cada técnico es una ficha con
 * su especialidad y su porcentaje, y cada servicio guarda a quién se le asignó, de qué marca era
 * el equipo y con qué porcentaje se lo liquidó.
 *
 * El nombre escrito sigue guardándose en `servicio_tecnicos.tecnico`: es la foto de lo que decía
 * la nota ese día. Si mañana se corrige la ficha del técnico, las notas ya emitidas no cambian.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tecnicos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();

            $table->string('nombre', 120);
            // apple | android | ambas. Decide qué equipos puede recibir.
            $table->string('especialidad', 10)->default('ambas');
            // Lo que se lleva el técnico de la ganancia de cada servicio.
            $table->unsignedTinyInteger('comision')->default(60);

            $table->string('telefono', 40)->nullable();
            $table->text('notas')->nullable();
            $table->boolean('activo')->default(true);

            $table->timestamps();

            $table->index(['sucursal_id', 'activo']);
        });

        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->foreignId('tecnico_id')->nullable()->after('tecnico')->constrained('tecnicos')->nullOnDelete();
            // apple | android | otro. De acá sale qué técnicos se pueden elegir.
            $table->string('marca', 10)->nullable()->after('tecnico_id');
            // El porcentaje que regía el día del servicio: cambiar la ficha no reescribe el pasado.
            $table->unsignedTinyInteger('comision_porcentaje')->nullable()->after('marca');
        });

        // Los técnicos que ya figuran en las notas se convierten en fichas, una por sucursal.
        $existentes = DB::table('servicio_tecnicos')
            ->select('tecnico', 'sucursal_id')
            ->whereNotNull('tecnico')
            ->where('tecnico', '<>', '')
            ->groupBy('tecnico', 'sucursal_id')
            ->get();

        $ahora = now();

        foreach ($existentes as $fila) {
            $id = DB::table('tecnicos')->insertGetId([
                'sucursal_id'  => $fila->sucursal_id,
                'nombre'       => $fila->tecnico,
                // Sin saber a qué se dedica cada uno, todos arrancan pudiendo recibir cualquier equipo
                'especialidad' => 'ambas',
                'comision'     => 60,
                'activo'       => true,
                'created_at'   => $ahora,
                'updated_at'   => $ahora,
            ]);

            DB::table('servicio_tecnicos')
                ->where('tecnico', $fila->tecnico)
                ->where(fn ($q) => $fila->sucursal_id === null
                    ? $q->whereNull('sucursal_id')
                    : $q->where('sucursal_id', $fila->sucursal_id))
                ->update(['tecnico_id' => $id, 'comision_porcentaje' => 60]);
        }

        // Lo que se le pagó a cada técnico, semana por semana. Una fila por técnico y semana.
        Schema::create('liquidaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tecnico_id')->constrained('tecnicos')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();

            $table->date('semana_inicio');
            $table->date('semana_fin');

            // La foto del cálculo: si después se corrige un costo, la liquidación pagada no cambia.
            $table->unsignedSmallInteger('servicios')->default(0);
            $table->decimal('cobrado', 12, 2)->default(0);
            $table->decimal('repuestos', 12, 2)->default(0);
            $table->decimal('ganancia', 12, 2)->default(0);
            $table->unsignedTinyInteger('porcentaje')->default(60);
            $table->decimal('monto', 12, 2)->default(0);

            $table->foreignId('pagada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tecnico_id', 'semana_inicio']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidaciones');

        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tecnico_id');
            $table->dropColumn(['marca', 'comision_porcentaje']);
        });

        Schema::dropIfExists('tecnicos');
    }
};

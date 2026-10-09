<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La caja de cada sucursal, día por día: con cuánto arrancó, cuánto debería haber al cerrar,
 * cuánto se contó y si sobró o faltó.
 *
 * Lo que se calcula al cerrar queda guardado (lo que entró por ventas, servicios y reservas en
 * efectivo, los egresos y lo esperado): corregir una venta después no reescribe un cierre ya
 * firmado.
 *
 * Las reservas pasan a guardar cómo se pagó el abono. Sin eso, el abono en efectivo entraba al
 * cajón sin que el sistema lo contara y cada cierre con una reserva daba sobrante. Las que ya
 * existían quedan en efectivo. Como en el servicio técnico, va como string y no como enum: en
 * PostgreSQL un enum es un CHECK que SQLite no tiene.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cajas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->constrained('sucursales');
            $table->date('fecha');

            $table->decimal('monto_apertura', 12, 2);
            $table->foreignId('abierta_por')->constrained('users');
            $table->timestamp('abierta_en');

            // Lo que se calculó al cerrar
            $table->decimal('efectivo_ventas', 12, 2)->nullable();
            $table->decimal('efectivo_servicios', 12, 2)->nullable();
            $table->decimal('efectivo_reservas', 12, 2)->nullable();
            $table->decimal('egresos', 12, 2)->nullable();
            $table->decimal('esperado', 12, 2)->nullable();

            $table->decimal('monto_contado', 12, 2)->nullable();
            $table->decimal('diferencia', 12, 2)->nullable(); // contado − esperado: + sobra, − falta
            $table->text('notas')->nullable();
            $table->foreignId('cerrada_por')->nullable()->constrained('users');
            $table->timestamp('cerrada_en')->nullable();

            $table->timestamps();

            // Una caja por sucursal y por día
            $table->unique(['sucursal_id', 'fecha']);
        });

        Schema::table('reservas', function (Blueprint $table) {
            $table->string('metodo_pago', 20)->default('efectivo')->after('monto_reserva');
        });
    }

    public function down(): void
    {
        Schema::table('reservas', function (Blueprint $table) {
            $table->dropColumn('metodo_pago');
        });

        Schema::dropIfExists('cajas');
    }
};

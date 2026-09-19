<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Inventario de piezas y repuestos.
 *
 * El resto del inventario lleva un registro por unidad: un celular es una fila con su IMEI, y al
 * venderse pasa a «vendido». Con las piezas eso no sirve. De un iPhone despiezado salen quince
 * repuestos iguales, y nadie va a cargar quince filas con quince códigos: lo que se lleva es
 * **cuántas quedan**. Por eso esta tabla tiene `cantidad` y no `estado`.
 *
 * Cada movimiento del saldo queda anotado en `movimientos_pieza`: quién, cuándo, por qué y con qué
 * saldo quedó. Sin eso, un stock por cantidad no se puede auditar: se ve que faltan tres pantallas
 * y no hay manera de saber si se vendieron, se usaron en una reparación o se rompieron.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('piezas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();

            // Lo único obligatorio: nombre, cuántas hay y a cuánto entra y sale.
            $table->string('nombre', 160);
            $table->unsignedInteger('cantidad')->default(0);
            $table->decimal('precio_costo', 12, 2)->default(0);
            $table->decimal('precio_venta', 12, 2)->default(0);

            // Lo demás es opcional, pero es lo que hace encontrable un cajón con cien repuestos.
            $table->string('codigo', 60)->nullable();
            $table->string('categoria', 60)->nullable();       // Pantalla, batería, pin de carga…
            $table->string('compatibilidad', 160)->nullable(); // «iPhone 11 / 11 Pro»
            $table->string('origen', 160)->nullable();         // «Despiece iPhone 11 IMEI 35…»
            $table->unsignedSmallInteger('minimo')->default(0); // Avisar cuando queden estas o menos
            $table->text('notas')->nullable();
            $table->boolean('activa')->default(true);

            $table->timestamps();

            $table->index(['sucursal_id', 'activa']);
            $table->index('nombre');
            // Dos sucursales pueden usar el mismo código para su propia pieza; dentro de una, no.
            // Las piezas sin código no chocan entre sí: en SQL, NULL nunca es igual a NULL.
            $table->unique(['sucursal_id', 'codigo']);
        });

        Schema::create('movimientos_pieza', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pieza_id')->constrained('piezas')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();

            // alta, ingreso, venta, servicio, devolucion, ajuste
            $table->string('tipo', 20);
            // Con signo: +6 entraron, −1 salió. El saldo es cómo quedó la pieza después.
            $table->integer('cantidad');
            $table->unsignedInteger('saldo');
            $table->string('motivo', 200)->nullable();

            // De dónde vino el movimiento: una venta, un servicio técnico…
            $table->string('referencia_tipo', 30)->nullable();
            $table->unsignedBigInteger('referencia_id')->nullable();

            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['pieza_id', 'id']);
            $table->index(['referencia_tipo', 'referencia_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_pieza');
        Schema::dropIfExists('piezas');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Los productos generales pasan a llevarse por cantidad, igual que las piezas.
 *
 * Nadie va a etiquetar diez mil vidrios uno por uno. Un registro pasa a ser un producto
 * («Vidrio templado 9D · iPhone 13 · Premium») con cuántos quedan, y cada unidad que entra o sale
 * deja su renglón en `movimientos_producto_general`: quién, cuándo, por qué y con qué saldo quedó.
 * Sin eso un conteo no se puede explicar.
 *
 * Lo que ya estaba cargado de a uno sigue igual, con cantidad 1 (o 0 si ya salió). El `estado`
 * se mantiene, derivado del saldo (disponible si queda alguno, vendido si se agotó), para que todas
 * las pantallas que filtran «disponible» sigan funcionando sin cambios. Lo que viajaba en un
 * traspaso queda en 0: al llegar suma en el destino y al cancelarse vuelve al origen.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('productos_generales', function (Blueprint $table) {
            $table->unsignedInteger('cantidad')->default(1)->after('nombre');
            $table->string('modelo', 120)->nullable()->after('nombre');  // «iPhone 13 Pro Max»
            $table->string('calidad', 60)->nullable()->after('modelo');  // «Premium», «9D», «Original»
        });

        DB::table('productos_generales')->whereIn('estado', ['vendido', 'servicio', 'en_transito'])->update(['cantidad' => 0]);
        DB::table('productos_generales')->where('estado', 'en_transito')->update(['estado' => 'vendido']);

        Schema::create('movimientos_producto_general', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_general_id')->constrained('productos_generales')->cascadeOnDelete();
            $table->foreignId('sucursal_id')->nullable()->constrained('sucursales')->nullOnDelete();

            // alta, ingreso, venta, servicio, devolucion, ajuste, traspaso_sale, traspaso_entra
            $table->string('tipo', 20);
            // Con signo: +500 entraron, −2 salieron. El saldo es cómo quedó el producto después.
            $table->integer('cantidad');
            $table->unsignedInteger('saldo');
            $table->string('motivo', 200)->nullable();

            $table->string('referencia_tipo', 30)->nullable();
            $table->unsignedBigInteger('referencia_id')->nullable();

            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['producto_general_id', 'id']);
            $table->index(['referencia_tipo', 'referencia_id']);
        });

        // El historial de lo que ya había arranca con su carga, para que el saldo cierre desde el principio
        DB::statement("
            INSERT INTO movimientos_producto_general (producto_general_id, sucursal_id, tipo, cantidad, saldo, motivo, created_at, updated_at)
            SELECT id, sucursal_id, 'alta', cantidad, cantidad, 'Ya estaba en el inventario', created_at, created_at
            FROM productos_generales
            WHERE cantidad > 0
        ");
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_producto_general');

        // Lo que quedó con más de una unidad no tiene vuelta a «una fila por unidad»: queda una sola
        Schema::table('productos_generales', function (Blueprint $table) {
            $table->dropColumn(['cantidad', 'modelo', 'calidad']);
        });
    }
};

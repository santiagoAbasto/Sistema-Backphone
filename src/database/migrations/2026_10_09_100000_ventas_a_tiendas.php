<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ventas a otras tiendas, a precio mayorista.
 *
 * - Cada producto del inventario puede tener, además del precio para el cliente final, un precio
 *   para tiendas. Sin ese precio el producto no se le vende a una tienda: nunca se usa el precio
 *   de cliente final sin querer.
 * - Las tiendas que compran quedan en su propia tabla (nombre, responsable, teléfono), por
 *   sucursal como los clientes, para no volver a escribirlas en cada venta.
 * - Una venta a tienda es una venta normal con `tienda_id`: descuenta stock, numera, imprime nota
 *   y entra a la caja igual que cualquier otra.
 */
return new class extends Migration
{
    private const INVENTARIOS = ['celulares', 'computadoras', 'productos_apple', 'productos_generales', 'piezas'];

    public function up(): void
    {
        foreach (self::INVENTARIOS as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->decimal('precio_tienda', 12, 2)->nullable()->after('precio_venta');
            });
        }

        Schema::create('tiendas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sucursal_id')->constrained('sucursales');
            $table->string('nombre', 120);
            $table->string('responsable', 120)->nullable();
            $table->string('telefono', 40)->nullable();
            $table->timestamps();

            $table->unique(['sucursal_id', 'nombre']);
        });

        Schema::table('ventas', function (Blueprint $table) {
            $table->foreignId('tienda_id')->nullable()->after('reserva_id')->constrained('tiendas');
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tienda_id');
        });

        Schema::dropIfExists('tiendas');

        foreach (self::INVENTARIOS as $tabla) {
            Schema::table($tabla, function (Blueprint $table) {
                $table->dropColumn('precio_tienda');
            });
        }
    }
};

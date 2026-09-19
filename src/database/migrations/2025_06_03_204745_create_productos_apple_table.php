<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('productos_apple', function (Blueprint $table) {
            $table->id();
            $table->string('modelo');
            $table->string('capacidad');
            $table->string('bateria');
            $table->string('color');
            $table->string('numero_serie')->nullable();
            $table->string('procedencia');
            $table->decimal('precio_costo', 10, 2);
            $table->decimal('precio_venta', 10, 2);
            $table->boolean('tiene_imei')->default(false);
            $table->string('imei_1')->nullable()->unique();
            $table->string('imei_2')->nullable()->unique();
            $table->enum('estado_imei', [
                'Libre',
                'Registro seguro',
                'IMEI 1 libre y IMEI 2 registrado',
                'IMEI 2 libre y IMEI 1 registrado'
            ])->nullable();
            $table->string('estado')->default('disponible'); // Para stock
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos_apple');
    }
};

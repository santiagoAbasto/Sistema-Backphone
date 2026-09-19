<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('celulares', function (Blueprint $table) {
            $table->id();
            $table->string('modelo');
            $table->string('capacidad');
            $table->string('color');
            $table->string('bateria')->nullable();
            $table->string('imei_1')->unique();
            $table->string('imei_2')->nullable()->unique();
            $table->enum('estado_imei', [
                'libre',
                'registrado',
                'imei1_libre_imei2_registrado',
                'imei1_registrado_imei2_libre'
            ]);
            $table->string('procedencia');
            $table->decimal('precio_costo', 10, 2);
            $table->decimal('precio_venta', 10, 2);
            $table->enum('estado', ['disponible', 'vendido', 'permuta'])->default('disponible');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('celulares'); // ✅ Corregido
    }
};

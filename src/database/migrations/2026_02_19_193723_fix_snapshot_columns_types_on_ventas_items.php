<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventas_items', function (Blueprint $table) {
            $table->string('capacidad')->nullable()->change();
            $table->string('bateria')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('ventas_items', function (Blueprint $table) {
            $table->integer('capacidad')->nullable()->change();
            $table->integer('bateria')->nullable()->change();
        });
    }
};

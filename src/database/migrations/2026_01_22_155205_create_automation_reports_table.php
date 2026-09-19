<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('automation_reports', function (Blueprint $table) {
            $table->id();
            $table->string('period');        // ej: 2026-01
            $table->longText('content');     // texto del reporte
            $table->boolean('read')->default(false);
            $table->timestamps();

            $table->unique('period'); // opcional: 1 reporte por periodo
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_reports');
    }
};

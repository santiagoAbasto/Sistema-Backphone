<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automation_report_views', function (Blueprint $table) {
            $table->id();

            $table->foreignId('report_id')
                ->constrained('automation_reports')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->timestamp('viewed_at')->nullable();

            $table->timestamps();

            // 🔥 Evita duplicados (clave importante)
            $table->unique(['report_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_report_views');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('system_notifications', function (Blueprint $table) {
            $table->foreignId('report_id')
                ->nullable()
                ->constrained('automation_reports')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('system_notifications', function (Blueprint $table) {
            $table->dropForeign(['report_id']);
            $table->dropColumn('report_id');
        });
    }
};

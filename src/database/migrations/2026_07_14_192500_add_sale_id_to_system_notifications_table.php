<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('system_notifications') || Schema::hasColumn('system_notifications', 'sale_id')) {
            return;
        }

        Schema::table('system_notifications', function (Blueprint $table) {
            $table->foreignId('sale_id')
                ->nullable()
                ->after('report_id')
                ->constrained('ventas')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('system_notifications') || ! Schema::hasColumn('system_notifications', 'sale_id')) {
            return;
        }

        Schema::table('system_notifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sale_id');
        });
    }
};

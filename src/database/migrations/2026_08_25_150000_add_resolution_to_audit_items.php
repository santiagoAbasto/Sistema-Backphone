<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_audit_items', function (Blueprint $table) {
            $table->string('resolution')->nullable()->after('expected_state');
            // Values: null (pending), 'scanned', 'sold_after_audit', 'missing'
        });
    }

    public function down(): void
    {
        Schema::table('inventory_audit_items', function (Blueprint $table) {
            $table->dropColumn('resolution');
        });
    }
};

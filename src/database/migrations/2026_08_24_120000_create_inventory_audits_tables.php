<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('started_by')->constrained('users');
            $table->foreignId('closed_by')->nullable()->constrained('users');
            $table->string('status', 20)->default('open');
            $table->timestamp('started_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_audit_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inventory_audit_id')->constrained()->cascadeOnDelete();
            $table->string('source_type', 40);
            $table->unsignedBigInteger('source_id');
            $table->string('category', 40);
            $table->string('name');
            $table->string('primary_code')->nullable();
            $table->string('secondary_code')->nullable();
            $table->string('tertiary_code')->nullable();
            $table->json('details')->nullable();
            $table->string('expected_state', 40)->default('disponible');
            $table->timestamp('scanned_at')->nullable();
            $table->foreignId('scanned_by')->nullable()->constrained('users');
            $table->string('scan_value')->nullable();
            $table->timestamps();

            $table->unique(
                ['inventory_audit_id', 'source_type', 'source_id'],
                'inventory_audit_source_unique'
            );
            $table->index(['inventory_audit_id', 'category', 'scanned_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_audit_items');
        Schema::dropIfExists('inventory_audits');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automation_reports', function (Blueprint $table) {
            $table->string('engine_version')->nullable()->after('period_end');
            $table->string('prompt_version')->nullable()->after('engine_version');
            $table->timestamp('generated_at')->nullable()->after('prompt_version');
        });
    }

    public function down(): void
    {
        Schema::table('automation_reports', function (Blueprint $table) {
            $table->dropColumn([
                'engine_version',
                'prompt_version',
                'generated_at'
            ]);
        });
    }
};
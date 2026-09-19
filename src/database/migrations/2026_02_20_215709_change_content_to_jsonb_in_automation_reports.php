<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('automation_reports')) {
            return;
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("
            ALTER TABLE automation_reports
            ALTER COLUMN content TYPE jsonb
            USING content::jsonb
        ");
    }

    public function down(): void
    {
        if (! Schema::hasTable('automation_reports')) {
            return;
        }

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("
            ALTER TABLE automation_reports
            ALTER COLUMN content TYPE text
        ");
    }
};

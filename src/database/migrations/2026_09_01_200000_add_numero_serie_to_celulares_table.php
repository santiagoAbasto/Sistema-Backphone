<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('celulares', function (Blueprint $table) {
            $table->string('numero_serie', 100)->nullable()->unique()->after('imei_2');
        });
    }

    public function down(): void
    {
        Schema::table('celulares', function (Blueprint $table) {
            $table->dropUnique(['numero_serie']);
            $table->dropColumn('numero_serie');
        });
    }
};

<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->foreignId('cliente_id')
                  ->nullable()
                  ->after('user_id')
                  ->constrained('clientes')
                  ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('servicio_tecnicos', function (Blueprint $table) {
            $table->dropForeign(['cliente_id']);
            $table->dropColumn('cliente_id');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * La meta mensual del vendedor estaba escrita a mano en el controlador del panel (10.000 Bs para todos).
 * Pasa a ser un dato de cada cuenta, que el administrador carga en Sistema → Usuarios y roles.
 * En 0 significa «sin meta»: el panel del vendedor lo dice en vez de inventar una cifra.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('meta_mensual', 12, 2)->default(0)->after('rol');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('meta_mensual');
        });
    }
};

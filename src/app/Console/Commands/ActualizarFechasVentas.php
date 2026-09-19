<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Venta;

class ActualizarFechasVentas extends Command
{
    protected $signature = 'ventas:actualizar-fechas';
    protected $description = 'Asigna la fecha de creación (created_at) a todas las ventas que no tienen fecha asignada';

    public function handle()
    {
        $afectadas = Venta::whereNull('fecha')->update(['fecha' => \DB::raw('created_at')]);

        if ($afectadas > 0) {
            $this->info("✅ $afectadas ventas actualizadas con la fecha de creación.");
        } else {
            $this->info("ℹ️ No hay ventas pendientes por actualizar.");
        }

        return 0;
    }
}

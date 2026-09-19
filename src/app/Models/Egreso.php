<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Factories\HasFactory; // ✅ ESTA LÍNEA FALTABA
use Illuminate\Database\Eloquent\Model;

class Egreso extends Model
{
    use HasFactory, DeSucursal;

    /** Tipos de gasto con su nombre para mostrar. */
    public const TIPOS = [
        'servicio_basico' => 'Servicio básico',
        'cuota_bancaria' => 'Cuota bancaria',
        'gasto_personal' => 'Gasto personal',
        'sueldos' => 'Sueldos',
    ];

    protected $fillable = [
        'sucursal_id',
        'concepto',
        'precio_invertido',
        'tipo_gasto',
        'frecuencia',
        'cuotas_pendientes',
        'comentario',
        'user_id',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getCuotasFormateadasAttribute()
    {
        return $this->tipo_gasto === 'cuota_bancaria'
            ? $this->cuotas_pendientes . ' cuotas restantes'
            : 'No aplica';
    }
}

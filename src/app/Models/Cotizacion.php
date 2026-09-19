<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Cotizacion extends Model
{
    use HasFactory, DeSucursal;

    protected $table = 'cotizaciones';

    /* ===============================
     | CAMPOS ASIGNABLES
     =============================== */
    protected $fillable = [
        'sucursal_id',
        // dueño de la cotización (admin o vendedor)
        'user_id',

        // cliente asociado (opcional)
        'cliente_id',

        // snapshot del cliente (histórico)
        'nombre_cliente',
        'telefono',
        'correo_cliente',

        // detalle de productos / servicios
        'items',

        // totales
        'descuento',
        'total',

        // extras
        'notas_adicionales',
        'fecha_cotizacion',
        'drive_url',

        // estado de envío
        'enviado_por_correo',
        'enviado_por_whatsapp',
    ];

    /* ===============================
     | CASTS
     =============================== */
    protected $casts = [
        'items' => 'array',
        'descuento' => 'float',
        'total' => 'float',
        'fecha_cotizacion' => 'date',
        'enviado_por_correo' => 'boolean',
        'enviado_por_whatsapp' => 'boolean',
    ];

    /* ===============================
     | RELACIONES
     =============================== */

    // 👤 Usuario que creó la cotización (admin o vendedor)
    public function usuario()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // 🧑 Cliente asociado (opcional, pero recomendado)
    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }
}

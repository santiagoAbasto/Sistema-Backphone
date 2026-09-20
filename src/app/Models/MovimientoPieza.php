<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un renglón del historial de una pieza: cuánto entró o salió, por qué y cómo quedó el saldo.
 *
 * No lleva el filtro de sucursal: siempre se lo consulta a través de su pieza, que sí lo tiene.
 */
class MovimientoPieza extends Model
{
    protected $table = 'movimientos_pieza';

    public const ALTA      = 'alta';
    public const INGRESO   = 'ingreso';
    public const VENTA     = 'venta';
    public const SERVICIO  = 'servicio';
    public const DEVOLUCION = 'devolucion';
    public const AJUSTE    = 'ajuste';
    public const SALIDA_TRASPASO  = 'traspaso_sale';
    public const ENTRADA_TRASPASO = 'traspaso_entra';

    protected $fillable = [
        'pieza_id',
        'sucursal_id',
        'tipo',
        'cantidad',
        'saldo',
        'motivo',
        'referencia_tipo',
        'referencia_id',
        'user_id',
    ];

    protected $casts = [
        'cantidad' => 'integer',
        'saldo'    => 'integer',
    ];

    /** Cómo se lee el movimiento en el historial. */
    public const ETIQUETAS = [
        self::ALTA       => 'Carga inicial',
        self::INGRESO    => 'Ingreso',
        self::VENTA      => 'Venta',
        self::SERVICIO   => 'Servicio técnico',
        self::DEVOLUCION => 'Devolución',
        self::AJUSTE     => 'Ajuste de inventario',
        self::SALIDA_TRASPASO  => 'Salió en un traspaso',
        self::ENTRADA_TRASPASO => 'Llegó en un traspaso',
    ];

    public function pieza(): BelongsTo
    {
        return $this->belongsTo(Pieza::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function getEtiquetaAttribute(): string
    {
        return self::ETIQUETAS[$this->tipo] ?? $this->tipo;
    }
}

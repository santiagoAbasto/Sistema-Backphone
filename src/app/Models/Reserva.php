<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use App\Services\GeneradorCodigos;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Reserva extends Model
{
    use HasFactory, DeSucursal;

    protected $fillable = [
        'sucursal_id',
        'codigo_nota',
        'nombre_cliente',
        'telefono_cliente',
        'fecha',
        'subtotal',
        'monto_reserva',
        'terminos_condiciones',
        'estado',
        'venta_id',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'datetime',
        'subtotal' => 'decimal:2',
        'monto_reserva' => 'decimal:2',
    ];

    protected static function booted(): void
    {
        static::created(function (Reserva $reserva) {
            // Red de seguridad: si algo creó el registro sin pasar por GeneradorCodigos,
            // se le arma el código con el prefijo de su sucursal.
            if (empty($reserva->codigo_nota)) {
                $prefijo = GeneradorCodigos::prefijoDe($reserva->sucursal_id);
                $reserva->codigo_nota = $prefijo . '-R' . str_pad((string) $reserva->id, 3, '0', STR_PAD_LEFT);
                $reserva->saveQuietly();
            }

            // El contador de esa sucursal nunca queda por detrás de un código ya emitido.
            if (preg_match('/-R(\\d+)$/', (string) $reserva->codigo_nota, $partes)) {
                GeneradorCodigos::sincronizarSecuencia('reservas', (int) $partes[1], $reserva->sucursal_id);
            }
        });
    }

    public function items()
    {
        return $this->hasMany(ReservaItem::class);
    }

    public function vendedor()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function venta()
    {
        return $this->belongsTo(Venta::class);
    }
}

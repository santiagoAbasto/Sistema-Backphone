<?php

namespace App\Models\Concerns;

use App\Models\Sucursal;
use App\Support\SucursalActiva;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * El contenido de este modelo pertenece a una sucursal.
 *
 * Con solo usar el trait, cada consulta queda limitada a la sucursal activa y cada registro nuevo
 * se guarda en ella. No hay que acordarse de filtrar en cada controlador: si alguien olvida un
 * `where`, el alcance global lo cubre igual.
 *
 * Cuando quien mira es un super administrador con «Todas» seleccionado, no se filtra nada.
 * Para salirse a propósito (un reporte global, una migración), está `sinSucursal()`.
 */
trait DeSucursal
{
    public static function bootDeSucursal(): void
    {
        static::addGlobalScope('sucursal', function (Builder $consulta) {
            $id = SucursalActiva::id();

            if ($id !== null) {
                $consulta->where($consulta->getModel()->getTable() . '.sucursal_id', $id);
            }
        });

        static::creating(function ($modelo) {
            if ($modelo->sucursal_id === null) {
                $modelo->sucursal_id = SucursalActiva::paraGuardar();
            }
        });
    }

    /** Se salta el filtro de sucursal. Usar solo donde de verdad se quiere ver todo. */
    public function scopeSinSucursal(Builder $consulta): Builder
    {
        return $consulta->withoutGlobalScope('sucursal');
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class);
    }
}

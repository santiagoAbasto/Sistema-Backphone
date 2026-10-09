<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Otra tienda que nos compra a precio mayorista. Es de la sucursal, como los clientes. */
class Tienda extends Model
{
    use DeSucursal;

    protected $fillable = ['sucursal_id', 'nombre', 'responsable', 'telefono'];

    public function ventas(): HasMany
    {
        return $this->hasMany(Venta::class);
    }
}

<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Model;

class ProductoApple extends Model
{
    use DeSucursal;


    protected $table = 'productos_apple';

    protected $fillable = [
        'sucursal_id',
        'modelo',
        'capacidad',
        'bateria',
        'color',
        'numero_serie',
        'procedencia',
        'precio_costo',
        'precio_venta',
        'tiene_imei',
        'imei_1',
        'imei_2',
        'estado_imei',
        'estado',
        'condicion',
    ];

    protected $casts = [
        'tiene_imei' => 'boolean',
        'precio_costo' => 'float',
        'precio_venta' => 'float',
    ];

    public function ventaItems()
{
    return $this->hasMany(VentaItem::class);
}

}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VentaItem extends Model
{
    protected $table = 'ventas_items';

    protected $fillable = [
        'venta_id',
        'tipo',
        'producto_id',
        'cantidad',
        'precio_venta',
        'precio_invertido',
        'descuento',
        'subtotal',

        // 🔥 SNAPSHOT BI
        'categoria',
        'nombre_producto',
        'modelo',
        'capacidad',
        'color',
        'bateria',
        'procesador',
        'ram',
        'almacenamiento',
    ];

    public function venta()
    {
        return $this->belongsTo(Venta::class);
    }

    public function celular()
    {
        return $this->belongsTo(Celular::class, 'producto_id');
    }

    public function computadora()
    {
        return $this->belongsTo(Computadora::class, 'producto_id');
    }

    public function productoGeneral()
    {
        return $this->belongsTo(ProductoGeneral::class, 'producto_id');
    }

    public function productoApple()
    {
        return $this->belongsTo(ProductoApple::class, 'producto_id');
    }

    public function servicio()
    {
        return $this->belongsTo(ServicioTecnico::class, 'producto_id');
    }
}

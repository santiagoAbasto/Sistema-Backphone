<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReservaItem extends Model
{
    protected $fillable = [
        'reserva_id',
        'tipo',
        'producto_id',
        'cantidad',
        'precio_venta',
        'descuento',
        'subtotal',
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

    public function reserva()
    {
        return $this->belongsTo(Reserva::class);
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
}

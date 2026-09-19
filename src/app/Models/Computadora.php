<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Model;

class Computadora extends Model
{
    use DeSucursal;


    protected $fillable = [
        'sucursal_id',
        'numero_serie',
        'nombre',
        'procesador', // 👈 nuevo campo
        'bateria',
        'color',
        'ram',
        'almacenamiento',
        'procedencia',
        'precio_costo',
        'precio_venta',
        'estado',
        'condicion',
    ];
}    
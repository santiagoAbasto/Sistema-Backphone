<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductoGeneral extends Model
{
    use HasFactory, DeSucursal;

    /**
     * Nombre explícito de la tabla.
     */
    protected $table = 'productos_generales'; // 🔧 Evita que Laravel use "producto_generals"

    /**
     * Campos asignables masivamente.
     */
    protected $fillable = [
        'sucursal_id',
        'codigo',
        'tipo',
        'nombre',
        'procedencia',
        'precio_costo',
        'precio_venta',
        'estado',
        'condicion',
    ];

    // Los productos generales (accesorios) entran como nuevos, salvo que se indique otra condición
    protected $attributes = [
        'condicion' => 'Nuevo',
    ];

    // (Opcional) Puedes definir constantes si deseas usar estados por código
    public const ESTADO_DISPONIBLE = 'disponible';
    public const ESTADO_VENDIDO = 'vendido';
    public const ESTADO_PERMUTA = 'permuta';
}

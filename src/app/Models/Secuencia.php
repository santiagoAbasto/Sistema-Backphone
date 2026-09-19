<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Secuencia extends Model
{
    protected $table = 'secuencias';

    protected $fillable = [
        'clave',
        'sucursal_id',
        'ultimo_numero',
    ];
}

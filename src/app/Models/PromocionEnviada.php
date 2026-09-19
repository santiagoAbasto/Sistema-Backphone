<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PromocionEnviada extends Model
{
    use HasFactory;

    protected $fillable = [
        'cliente_id',
        'mensaje',
        'canal',
        'enviado_en',
    ];

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }
}


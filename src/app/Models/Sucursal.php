<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Una sucursal del negocio.
 *
 * Cada una se administra sola: su inventario, sus ventas, sus clientes y sus códigos de nota son
 * suyos. El `prefijo` es lo que va adelante de cada código (CBA-V001, SUC-V001), así dos sucursales
 * pueden numerar en paralelo sin pisarse.
 */
class Sucursal extends Model
{
    use HasFactory;

    protected $table = 'sucursales';

    protected $fillable = ['nombre', 'prefijo', 'ciudad', 'direccion', 'telefono', 'activa', 'orden'];

    protected $casts = [
        'activa' => 'boolean',
        'orden'  => 'integer',
    ];

    public function usuarios(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /** Las sucursales encendidas, en el orden en que se muestran. */
    public static function activas()
    {
        return static::where('activa', true)->orderBy('orden')->orderBy('id')->get();
    }

    /** Lo que el panel necesita para dibujar el selector: id, nombre y prefijo. */
    public static function paraElSelector(): array
    {
        return Cache::remember('sucursales_selector', 300, fn () => static::activas()
            ->map(fn (self $s) => [
                'id'      => $s->id,
                'nombre'  => $s->nombre,
                'prefijo' => $s->prefijo,
                'ciudad'  => $s->ciudad,
            ])
            ->all());
    }

    public static function olvidarCache(): void
    {
        Cache::forget('sucursales_selector');
    }

    protected static function booted(): void
    {
        static::saved(fn () => static::olvidarCache());
        static::deleted(fn () => static::olvidarCache());
    }

    /** El prefijo se guarda siempre en mayúsculas y sin espacios. */
    public function setPrefijoAttribute(?string $valor): void
    {
        $this->attributes['prefijo'] = mb_strtoupper(trim((string) $valor));
    }
}

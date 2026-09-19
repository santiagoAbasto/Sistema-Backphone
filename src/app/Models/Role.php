<?php

namespace App\Models;

use App\Support\Permisos;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

/**
 * Un rol del panel: un nombre, una explicación y los módulos que puede abrir.
 *
 * La clave del rol es lo que se guarda en `users.rol`, así que el middleware de siempre (`rol:admin`) sigue
 * funcionando igual. Lo que suma este modelo es el permiso por módulo, que revisa `PermisoMiddleware`.
 */
class Role extends Model
{
    protected $fillable = ['clave', 'nombre', 'descripcion', 'permisos', 'del_sistema', 'panel_propio', 'activo', 'orden'];

    protected function casts(): array
    {
        return [
            'permisos'    => 'array',
            'del_sistema'  => 'boolean',
            'panel_propio' => 'boolean',
            'activo'      => 'boolean',
        ];
    }

    private const CACHE = 'roles_permisos';

    protected static function booted(): void
    {
        static::saved(fn () => Cache::forget(self::CACHE));
        static::deleted(fn () => Cache::forget(self::CACHE));
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'rol', 'clave');
    }

    public function scopeActivos(Builder $q): void
    {
        $q->where('activo', true);
    }

    public function esAdmin(): bool
    {
        return $this->clave === 'admin';
    }

    /** Todo lo que puede: `admin` siempre lo puede todo, pase lo que pase en la base. */
    public function permisosReales(): array
    {
        return $this->esAdmin() ? [Permisos::TODO] : Permisos::limpiar($this->permisos ?? []);
    }

    public function puede(string $modulo): bool
    {
        $permisos = $this->permisosReales();

        return in_array(Permisos::TODO, $permisos, true) || in_array($modulo, $permisos, true);
    }

    /** clave => permisos, cacheado: lo consulta el middleware en cada pedido del panel. */
    public static function mapa(): array
    {
        try {
            return Cache::remember(self::CACHE, 300, fn () => static::activos()->get()
                ->mapWithKeys(fn (self $r) => [$r->clave => $r->permisosReales()])
                ->all());
        } catch (\Throwable) {
            // Sin tabla (durante una migración) el panel no se cae: manda el middleware de rol de siempre
            return [];
        }
    }

    /** ¿Este rol puede abrir este módulo? Es la única regla, la misma para el menú y para el servidor. */
    public static function permite(?string $clave, ?string $modulo): bool
    {
        // Una ruta que no pertenece a ningún módulo no se bloquea acá (lo decide el middleware)
        if ($modulo === null) {
            return true;
        }

        // Una cuenta sin rol no entra a ninguna parte del panel
        if ($clave === null || $clave === '') {
            return false;
        }

        $mapa = static::mapa();

        // Sin roles cargados todavía (durante una migración), se respeta lo de siempre: solo el admin
        if ($mapa === []) {
            return $clave === 'admin';
        }

        $permisos = $mapa[$clave] ?? [];

        return in_array(Permisos::TODO, $permisos, true) || in_array($modulo, $permisos, true);
    }
}

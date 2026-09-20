<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Quien repara, y con qué porcentaje cobra.
 *
 * El taller no paga sueldo: cada técnico se lleva un porcentaje de la ganancia de lo que repara.
 * La especialidad no es decorativa — decide qué equipos puede recibir, y el servidor la hace
 * cumplir: un equipo Android no se le puede asignar al técnico de Apple ni a mano.
 */
class Tecnico extends Model
{
    use HasFactory, DeSucursal;

    protected $table = 'tecnicos';

    public const APPLE   = 'apple';
    public const ANDROID = 'android';
    public const AMBAS   = 'ambas';

    /** Qué equipos puede recibir cada especialidad. */
    public const ESPECIALIDADES = [
        self::APPLE   => 'iPhone y equipos Apple',
        self::ANDROID => 'Android',
        self::AMBAS   => 'Cualquier equipo',
    ];

    protected $fillable = [
        'sucursal_id',
        'nombre',
        'especialidad',
        'comision',
        'telefono',
        'notas',
        'activo',
    ];

    protected $casts = [
        'comision' => 'integer',
        'activo'   => 'boolean',
    ];

    protected $attributes = [
        'especialidad' => self::AMBAS,
        'comision'     => 60,
        'activo'       => true,
    ];

    public function servicios(): HasMany
    {
        return $this->hasMany(ServicioTecnico::class);
    }

    public function liquidaciones(): HasMany
    {
        return $this->hasMany(Liquidacion::class);
    }

    public function scopeActivos(Builder $consulta): Builder
    {
        return $consulta->where('activo', true);
    }

    /**
     * Los que pueden recibir un equipo de esta marca.
     *
     * `otro` (una tablet rara, una consola) no lo cubre ninguna especialidad en particular:
     * ahí se puede elegir a cualquiera y que el taller se arregle.
     */
    public function scopeParaMarca(Builder $consulta, ?string $marca): Builder
    {
        if ($marca === null || $marca === ServicioTecnico::MARCA_OTRO) {
            return $consulta;
        }

        return $consulta->whereIn('especialidad', [$marca, self::AMBAS]);
    }

    /** ¿Este técnico puede recibir un equipo de esta marca? */
    public function atiende(?string $marca): bool
    {
        if ($marca === null || $marca === ServicioTecnico::MARCA_OTRO) {
            return true;
        }

        return $this->especialidad === self::AMBAS || $this->especialidad === $marca;
    }

    public function getEspecialidadTextoAttribute(): string
    {
        return self::ESPECIALIDADES[$this->especialidad] ?? $this->especialidad;
    }
}

<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Fundas, vidrios, cargadores y accesorios, llevados por cantidad.
 *
 * Un registro es un producto («Vidrio templado 9D · iPhone 13 · Premium») con cuántos quedan, no
 * una unidad. El saldo lo mueve `App\Services\StockPorCantidad`, que deja anotado cada movimiento
 * y, de paso, el `estado`: «disponible» si queda alguno y «vendido» si se agotó. Así todo lo que ya
 * filtraba por «disponible» (ventas, cotizaciones, exportaciones) sigue andando igual. «Permuta»
 * queda afuera de esa cuenta: lo que entregó un cliente no se vende hasta habilitarlo.
 */
class ProductoGeneral extends Model
{
    use HasFactory, DeSucursal;

    protected $table = 'productos_generales'; // Laravel buscaría «producto_generals»

    protected $fillable = [
        'sucursal_id',
        'codigo',
        'tipo',
        'nombre',
        'modelo',
        'calidad',
        'cantidad',
        'procedencia',
        'precio_costo',
        'precio_venta',
        'precio_tienda',
        'estado',
        'condicion',
    ];

    protected $casts = [
        'cantidad' => 'integer',
    ];

    // Entran como nuevos, salvo que se indique otra condición. Lo que llega en permuta es una unidad.
    protected $attributes = [
        'condicion' => 'Nuevo',
        'cantidad'  => 1,
        'estado'    => 'disponible',
    ];

    public const ESTADO_DISPONIBLE = 'disponible';
    public const ESTADO_VENDIDO = 'vendido';
    public const ESTADO_PERMUTA = 'permuta';

    /** Prefijo del código automático según el tipo: VT-00042 es un vidrio templado. */
    public const PREFIJOS = [
        'funda'           => 'FU',
        'vidrio_templado' => 'VT',
        'vidrio_camara'   => 'VC',
        'cargador_20w'    => 'C20',
        'cargador_5w'     => 'C5',
        'accesorio'       => 'AC',
        'permuta'         => 'PM',
    ];

    public function movimientos(): HasMany
    {
        return $this->hasMany(MovimientoProductoGeneral::class)->latest('id');
    }

    /** Los que se pueden vender hoy: habilitados y con saldo. */
    public function scopeDisponibles(Builder $consulta): Builder
    {
        return $consulta->where('estado', self::ESTADO_DISPONIBLE)->where('cantidad', '>', 0);
    }

    /** Cómo se nombra en una nota o en un mensaje: nombre, modelo y calidad. */
    public function etiqueta(): string
    {
        return implode(' · ', array_filter([$this->nombre, $this->modelo, $this->calidad]));
    }

    /**
     * Le pone el código del sistema si no trae uno: prefijo del tipo y el número del registro.
     * El número es el `id`, así que dos cargas a la vez nunca chocan; si alguien ya escribió ese
     * mismo código a mano, se le agrega una letra.
     */
    public function asignarCodigoAutomatico(): void
    {
        $base = (self::PREFIJOS[$this->tipo] ?? 'PG') . '-' . str_pad((string) $this->id, 5, '0', STR_PAD_LEFT);
        $codigo = $base;

        foreach (range('B', 'Z') as $letra) {
            if (! static::withoutGlobalScopes()->where('codigo', $codigo)->whereKeyNot($this->id)->exists()) {
                break;
            }
            $codigo = $base . $letra;
        }

        $this->forceFill(['codigo' => $codigo])->save();
    }
}

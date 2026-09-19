<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Los datos del negocio que se editan en Ajustes → Datos del negocio.
 *
 * Es la única fuente de la identidad comercial: el nombre que aparece en el encabezado del panel, y el nombre,
 * el NIT, el teléfono y la dirección que van impresos en boletas, cotizaciones y reportes. Se guarda como
 * pares clave/valor para que agregar un dato nuevo no obligue a migrar la tabla.
 */
class ConfiguracionNegocio extends Model
{
    protected $table = 'configuracion_negocio';

    /** Cuánto vive cada valor en caché. Los guardados invalidan lo que tocan. */
    private const TTL = 300;

    /** Lo que se edita en Ajustes → Datos del negocio, con su valor por defecto. */
    public const CLAVES = [
        'negocio_nombre'    => self::NOMBRE_POR_DEFECTO,
        'negocio_eslogan'   => null,
        'negocio_nit'       => null,
        'negocio_telefono'  => null,
        'negocio_whatsapp'  => null,
        'negocio_email'     => null,
        'negocio_direccion' => null,
        'negocio_ciudad'    => null,
        'negocio_pais'      => null,
        'negocio_horario'   => null,
        'moneda_simbolo'    => 'Bs',
    ];

    /** Qué grupo le toca a cada clave en el formulario del panel. */
    public const GRUPOS = [
        'identidad' => ['negocio_nombre', 'negocio_eslogan', 'negocio_nit', 'moneda_simbolo'],
        'contacto'  => ['negocio_telefono', 'negocio_whatsapp', 'negocio_email'],
        'ubicacion' => ['negocio_direccion', 'negocio_ciudad', 'negocio_pais', 'negocio_horario'],
    ];

    public const NOMBRE_POR_DEFECTO = 'Blackphone';

    protected $fillable = ['clave', 'valor', 'tipo', 'grupo', 'etiqueta'];

    public static function get(string $clave, mixed $default = null): mixed
    {
        $valor = Cache::remember(
            "cfg_{$clave}",
            self::TTL,
            fn () => static::where('clave', $clave)->value('valor')
        );

        return $valor ?? $default;
    }

    public static function set(string $clave, mixed $valor): void
    {
        static::updateOrCreate(['clave' => $clave], ['valor' => $valor]);
        Cache::forget("cfg_{$clave}");
    }

    /** Guarda varias claves de una vez y limpia lo que tocó. */
    public static function guardar(array $valores): void
    {
        foreach ($valores as $clave => $valor) {
            if (! array_key_exists($clave, self::CLAVES)) {
                continue;
            }
            static::set($clave, $valor === '' ? null : $valor);
        }
    }

    /** Todas las claves editables con su valor actual, listas para el formulario. */
    public static function todas(): array
    {
        $guardadas = static::pluck('valor', 'clave')->toArray();

        $salida = [];
        foreach (self::CLAVES as $clave => $porDefecto) {
            $valor = $guardadas[$clave] ?? null;
            $salida[$clave] = ($valor === null || $valor === '') ? $porDefecto : $valor;
        }

        return $salida;
    }

    /** El nombre del negocio: el del panel o «Blackphone» mientras no se cambie. Nunca queda vacío. */
    public static function nombre(): string
    {
        $nombre = trim((string) static::get('negocio_nombre'));

        return $nombre !== '' ? $nombre : self::NOMBRE_POR_DEFECTO;
    }

    /** Lo que el panel muestra en el encabezado. */
    public static function paraElPanel(): array
    {
        return [
            'nombre'  => static::nombre(),
            'eslogan' => static::get('negocio_eslogan'),
            'moneda'  => static::get('moneda_simbolo', 'Bs'),
        ];
    }

    /** El pie de cada comprobante impreso: quién emite, cómo lo contactan y dónde está. */
    public static function paraPdf(): array
    {
        $telefono = static::get('negocio_telefono') ?: static::get('negocio_whatsapp');

        $direccion = collect([static::get('negocio_direccion'), static::get('negocio_ciudad')])
            ->filter()
            ->unique()
            ->implode(', ');

        return [
            'nombre'    => static::nombre(),
            'nit'       => static::get('negocio_nit'),
            'telefono'  => $telefono ?: null,
            'direccion' => $direccion ?: null,
            'email'     => static::get('negocio_email'),
        ];
    }

    /** Invalida todo el caché de configuración (usar después de cualquier guardado masivo). */
    public static function limpiarCache(): void
    {
        foreach (array_keys(self::CLAVES) as $clave) {
            Cache::forget("cfg_{$clave}");
        }
    }
}

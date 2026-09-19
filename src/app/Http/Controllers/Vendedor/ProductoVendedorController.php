<?php

namespace App\Http\Controllers\Vendedor;

use App\Http\Controllers\Controller;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\Pieza;
use App\Models\ProductoApple;
use App\Models\ProductoGeneral;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Productos en stock: lo que el vendedor puede ofrecer hoy.
 *
 * Solo equipos en estado «disponible» y solo los datos que sirven para vender: modelo, condición comercial,
 * características y precio de venta. El precio de costo y la procedencia no salen de acá: son del administrador
 * y no viajan ni siquiera dentro del JSON de la página.
 *
 * Se envía una sola lista por vez (la pestaña abierta): así el paginador no se pisa entre pestañas y la búsqueda
 * recorre todo el inventario, no solo la página que se está viendo.
 */
class ProductoVendedorController extends Controller
{
    /** Pestaña => modelo, nombre visible, columnas que se envían, por cuáles se busca y por cuál se ordena. */
    private const TIPOS = [
        'celulares' => [
            'modelo'  => Celular::class,
            'label'   => 'Celulares',
            'vacio'   => 'No queda ningún celular disponible',
            'campos'  => ['id', 'modelo', 'condicion', 'capacidad', 'color', 'bateria', 'imei_1', 'numero_serie', 'precio_venta'],
            'buscar'  => ['modelo', 'capacidad', 'color', 'imei_1', 'imei_2', 'numero_serie'],
            'orden'   => 'modelo',
        ],
        'computadoras' => [
            'modelo'  => Computadora::class,
            'label'   => 'Computadoras',
            'vacio'   => 'No queda ninguna computadora disponible',
            'campos'  => ['id', 'nombre', 'condicion', 'procesador', 'ram', 'almacenamiento', 'bateria', 'color', 'numero_serie', 'precio_venta'],
            'buscar'  => ['nombre', 'procesador', 'ram', 'almacenamiento', 'numero_serie'],
            'orden'   => 'nombre',
        ],
        'apple' => [
            'modelo'  => ProductoApple::class,
            'label'   => 'Equipos de marca',
            'vacio'   => 'No queda ningún equipo de marca disponible',
            'campos'  => ['id', 'modelo', 'condicion', 'capacidad', 'color', 'bateria', 'imei_1', 'numero_serie', 'precio_venta'],
            'buscar'  => ['modelo', 'capacidad', 'color', 'imei_1', 'imei_2', 'numero_serie'],
            'orden'   => 'modelo',
        ],
        'generales' => [
            'modelo'  => ProductoGeneral::class,
            'label'   => 'Accesorios y otros',
            'vacio'   => 'No queda ningún accesorio disponible',
            'campos'  => ['id', 'codigo', 'tipo', 'nombre', 'condicion', 'precio_venta'],
            'buscar'  => ['codigo', 'tipo', 'nombre'],
            'orden'   => 'nombre',
        ],
        'piezas' => [
            'modelo'  => Pieza::class,
            'label'   => 'Piezas y repuestos',
            'vacio'   => 'No queda ninguna pieza en el inventario',
            'campos'  => ['id', 'codigo', 'nombre', 'categoria', 'compatibilidad', 'cantidad', 'precio_venta'],
            'buscar'  => ['codigo', 'nombre', 'categoria', 'compatibilidad'],
            'orden'   => 'nombre',
            // Las piezas llevan saldo, no estado: «disponible» es que quede al menos una.
            'saldo'   => true,
        ],
    ];

    public function index(Request $request): Response
    {
        $tipo = (string) $request->string('tipo', 'celulares');
        if (! isset(self::TIPOS[$tipo])) {
            $tipo = 'celulares';
        }

        $q = trim((string) $request->string('q'));
        $config = self::TIPOS[$tipo];

        $productos = $this->consulta($config, $q)
            ->select($config['campos'])
            ->paginate(24)
            ->withQueryString();

        return Inertia::render('Vendedor/Productos/Index', [
            'tipo'      => $tipo,
            'filtros'   => ['q' => $q],
            'productos' => $productos,
            'pestanas'  => collect(self::TIPOS)
                ->map(fn (array $c, string $clave) => [
                    'clave'  => $clave,
                    'label'  => $c['label'],
                    'vacio'  => $c['vacio'],
                    // El número es el stock real de esa pestaña, sin el filtro de búsqueda
                    'total'  => $this->consulta($c, '')->count(),
                ])->values(),
            'resumen'   => [
                'encontrados' => $productos->total(),
                // En las piezas, el valor del stock es el saldo por el precio: seis pantallas valen seis.
                'valor'       => round((float) (($config['saldo'] ?? false)
                    ? $this->consulta($config, $q)->selectRaw('COALESCE(SUM(cantidad * precio_venta), 0) AS t')->value('t')
                    : $this->consulta($config, $q)->sum('precio_venta')), 2),
                'unidades'    => ($config['saldo'] ?? false)
                    ? (int) $this->consulta($config, $q)->sum('cantidad')
                    : $productos->total(),
            ],
        ]);
    }

    /** Solo lo que está disponible para vender, con la búsqueda aplicada si hay texto. */
    private function consulta(array $config, string $q): Builder
    {
        /** @var Builder $consulta */
        $consulta = ($config['saldo'] ?? false)
            ? $config['modelo']::query()->disponibles()
            : $config['modelo']::query()->where('estado', 'disponible');

        if ($q !== '') {
            // LOWER + LIKE funciona igual en PostgreSQL y en SQLite (los tests corren en SQLite)
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], mb_strtolower($q)) . '%';
            $consulta->where(function ($w) use ($config, $like) {
                foreach ($config['buscar'] as $columna) {
                    $w->orWhereRaw("LOWER(COALESCE({$columna}, '')) LIKE ?", [$like]);
                }
            });
        }

        return $consulta->orderBy($config['orden']);
    }
}

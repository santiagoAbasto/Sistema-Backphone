<?php

namespace App\Http\Controllers\Vendedor;

use App\Http\Controllers\Controller;
use App\Models\Celular;
use App\Models\Computadora;
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
            'campos'  => ['id', 'modelo', 'condicion', 'capacidad', 'color', 'bateria', 'imei_1', 'numero_serie', 'precio_venta'],
            'buscar'  => ['modelo', 'capacidad', 'color', 'imei_1', 'imei_2', 'numero_serie'],
            'orden'   => 'modelo',
        ],
        'computadoras' => [
            'modelo'  => Computadora::class,
            'label'   => 'Computadoras',
            'campos'  => ['id', 'nombre', 'condicion', 'procesador', 'ram', 'almacenamiento', 'bateria', 'color', 'numero_serie', 'precio_venta'],
            'buscar'  => ['nombre', 'procesador', 'ram', 'almacenamiento', 'numero_serie'],
            'orden'   => 'nombre',
        ],
        'apple' => [
            'modelo'  => ProductoApple::class,
            'label'   => 'Equipos de marca',
            'campos'  => ['id', 'modelo', 'condicion', 'capacidad', 'color', 'bateria', 'imei_1', 'numero_serie', 'precio_venta'],
            'buscar'  => ['modelo', 'capacidad', 'color', 'imei_1', 'imei_2', 'numero_serie'],
            'orden'   => 'modelo',
        ],
        'generales' => [
            'modelo'  => ProductoGeneral::class,
            'label'   => 'Accesorios y otros',
            'campos'  => ['id', 'codigo', 'tipo', 'nombre', 'condicion', 'precio_venta'],
            'buscar'  => ['codigo', 'tipo', 'nombre'],
            'orden'   => 'nombre',
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
                    // El número es el stock real de esa pestaña, sin el filtro de búsqueda
                    'total'  => $this->consulta($c, '')->count(),
                ])->values(),
            'resumen'   => [
                'encontrados' => $productos->total(),
                'valor'       => round((float) $this->consulta($config, $q)->sum('precio_venta'), 2),
            ],
        ]);
    }

    /** Solo lo que está disponible para vender, con la búsqueda aplicada si hay texto. */
    private function consulta(array $config, string $q): Builder
    {
        /** @var Builder $consulta */
        $consulta = $config['modelo']::query()->where('estado', 'disponible');

        if ($q !== '') {
            // LOWER + LIKE funciona igual en PostgreSQL y en SQLite (los tests corren en SQLite)
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], mb_strtolower($q)) . '%';
            $consulta->where(function ($w) use ($config, $like) {
                foreach ($config['buscar'] as $columna) {
                    $w->orWhereRaw("LOWER({$columna}) LIKE ?", [$like]);
                }
            });
        }

        return $consulta->orderBy($config['orden']);
    }
}

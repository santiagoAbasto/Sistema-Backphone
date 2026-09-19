<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoGeneral;
use App\Models\ProductoApple;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

/**
 * Exportar datos → «Exportaciones» (un PDF por inventario y por tipo) y «Exportador» (búsqueda por nombre).
 *
 * Todos los PDF salen de la misma plantilla (`pdf.exportar_productos`) y llevan el pie con los datos de la tienda,
 * que se leen de Configuración y de Ubicaciones: no se escriben en la plantilla.
 */
class ExportController extends Controller
{
    /** Los cuatro inventarios que se pueden exportar, con el campo por el que se busca. */
    public const INVENTARIOS = ['celulares', 'computadoras', 'productos_generales', 'productos_apple'];

    /** El pie de todos los PDF: el nombre, el teléfono y la dirección de verdad de la tienda. */
    private function datosTienda(): array
    {
        return \App\Models\ConfiguracionNegocio::paraPdf();
    }

    private function streamOrViewPdf($pdf, string $filename, string $title, string $routeName, array $routeParams = [])
    {
        if (! request()->boolean('raw')) {
            return view('pdf.viewer', [
                'title' => $title,
                'pdfUrl' => route($routeName, array_merge($routeParams, ['raw' => 1])),
            ]);
        }

        return $pdf->stream($filename);
    }

    private function normalizeSearchText(?string $value): string
    {
        $text = Str::ascii(Str::lower((string) $value));
        $text = preg_replace('/[^a-z0-9]+/', ' ', $text);

        return trim(preg_replace('/\s+/', ' ', $text));
    }

    private function searchTerms(string $value): array
    {
        $stopWords = ['de', 'del', 'la', 'las', 'el', 'los', 'para', 'por'];

        return collect(explode(' ', $this->normalizeSearchText($value)))
            ->filter(fn ($term) => $term !== '' && ! in_array($term, $stopWords, true))
            ->values()
            ->all();
    }

    private function matchesNameFilter(?string $value, string $filter): bool
    {
        $haystack = $this->normalizeSearchText($value);

        foreach ($this->searchTerms($filter) as $term) {
            $variants = [$term];

            if (Str::endsWith($term, 's') && Str::length($term) > 3) {
                $variants[] = Str::substr($term, 0, -1);
            }

            if ($term === 'iphone') {
                $variants[] = 'ip';
            }

            if ($term === 'ip') {
                $variants[] = 'iphone';
            }

            if (! collect($variants)->contains(fn ($variant) => str_contains($haystack, $variant))) {
                return false;
            }
        }

        return true;
    }

    private function inventoryConfig(string $inventory): array
    {
        return match ($inventory) {
            'celulares' => [
                'model' => Celular::class,
                'column' => 'modelo',
                'tipo' => 'celular',
                'label' => 'Celulares',
            ],
            'computadoras' => [
                'model' => Computadora::class,
                'column' => 'nombre',
                'tipo' => 'computadora',
                'label' => 'Computadoras',
            ],
            'productos_apple' => [
                'model' => ProductoApple::class,
                'column' => 'modelo',
                'tipo' => 'producto_apple',
                'label' => 'Equipos de marca',
            ],
            default => [
                'model' => ProductoGeneral::class,
                'column' => 'nombre',
                'tipo' => 'producto_general',
                'label' => 'Productos Generales',
            ],
        };
    }

    private function sortFilteredProducts($products, string $inventory)
    {
        if ($inventory === 'productos_generales') {
            return $products
                ->sortBy([
                    fn ($a, $b) => strnatcasecmp((string) $a->nombre, (string) $b->nombre),
                    fn ($a, $b) => strnatcasecmp((string) $a->codigo, (string) $b->codigo),
                ])
                ->values();
        }

        if ($inventory === 'celulares') {
            return $products
                ->sortBy([
                    fn ($a, $b) => strnatcasecmp((string) $a->modelo, (string) $b->modelo),
                    fn ($a, $b) => strnatcasecmp((string) $a->capacidad, (string) $b->capacidad),
                    fn ($a, $b) => strnatcasecmp((string) $a->color, (string) $b->color),
                ])
                ->values();
        }

        return $products->sortBy('id')->values();
    }

    public function index()
    {
        // Cada tipo de producto general, con cuántos hay disponibles: así el panel no ofrece un PDF vacío
        $subtipos = ProductoGeneral::query()
            ->whereNotNull('tipo')
            ->selectRaw('tipo, count(*) as total, sum(case when estado = ? then 1 else 0 end) as disponibles', ['disponible'])
            ->groupBy('tipo')
            ->orderBy('tipo')
            ->get()
            ->map(fn ($f) => [
                'tipo'        => $f->tipo,
                'label'       => self::nombreDeTipo($f->tipo),
                'total'       => (int) $f->total,
                'disponibles' => (int) $f->disponibles,
            ])
            ->values();

        return Inertia::render('Admin/Exportaciones/Index', [
            'subtipos'     => $subtipos,
            'inventarios'  => $this->resumenInventarios(),
            'tienda'       => $this->datosTienda(),
        ]);
    }

    public function personalizado()
    {
        return Inertia::render('Admin/Exportaciones/Personalizado', [
            'defaults' => [
                'inventario'       => 'productos_generales',
                'nombre'           => '',
                'solo_disponibles' => true,
            ],
            'inventarios' => $this->resumenInventarios(),
        ]);
    }

    /**
     * Cuántos productos saldrían con lo que hay escrito ahora, con una muestra.
     * Lo llama el buscador del exportador mientras se escribe: así nadie genera un PDF vacío.
     */
    public function contar(Request $request): \Illuminate\Http\JsonResponse
    {
        $validated = $request->validate([
            'inventario'       => ['required', 'string', 'in:' . implode(',', self::INVENTARIOS)],
            'nombre'           => ['nullable', 'string', 'max:120'],
            'solo_disponibles' => ['nullable'],
        ]);

        $nombre = trim((string) ($validated['nombre'] ?? ''));
        if ($nombre === '') {
            return response()->json(['total' => 0, 'muestra' => []]);
        }

        $config = $this->inventoryConfig($validated['inventario']);
        $model  = $config['model'];
        $column = $config['column'];

        $query = $model::query();
        if ($request->boolean('solo_disponibles', true)) {
            $query->where('estado', 'disponible');
        }

        $encontrados = $query->get()->filter(fn ($p) => $this->matchesNameFilter($p->{$column}, $nombre));

        return response()->json([
            'total'   => $encontrados->count(),
            'muestra' => $this->sortFilteredProducts($encontrados, $validated['inventario'])
                ->take(6)
                ->map(fn ($p) => [
                    'nombre' => (string) $p->{$column},
                    'estado' => $p->estado,
                    'precio' => (float) $p->precio_venta,
                ])
                ->values(),
        ]);
    }

    /** Cuántos hay en cada inventario, para que cada tarjeta diga qué va a traer. */
    private function resumenInventarios(): array
    {
        return collect(self::INVENTARIOS)->map(function (string $inventario) {
            $config = $this->inventoryConfig($inventario);
            $model  = $config['model'];

            return [
                'value'       => $inventario,
                'label'       => $config['label'],
                'busca_por'   => $config['column'] === 'modelo' ? 'modelo' : 'nombre',
                'total'       => $model::count(),
                'disponibles' => $model::where('estado', 'disponible')->count(),
            ];
        })->all();
    }

    /** «vidrio_templado» → «Vidrio templado». */
    private static function nombreDeTipo(string $tipo): string
    {
        return Str::ucfirst(str_replace('_', ' ', $tipo));
    }

    public function celulares()
    {
        // Celulares disponibles
        $productos = Celular::where('estado', 'disponible')
            ->orderBy('modelo')
            ->get();

        $pdf = Pdf::loadView('pdf.exportar_productos', [
            'productos' => $productos,
            'tipo' => 'celular',
            'tienda' => $this->datosTienda(),
        ])->setPaper('a4', 'landscape');

        return $this->streamOrViewPdf(
            $pdf,
            'inventario-celulares.pdf',
            'Inventario Celulares',
            'admin.exportar.celulares'
        );
    }

    public function computadoras()
    {
        // Computadoras disponibles
        $productos = Computadora::where('estado', 'disponible')
            ->orderBy('nombre')
            ->get();

        $pdf = Pdf::loadView('pdf.exportar_productos', [
            'productos' => $productos,
            'tipo' => 'computadora',
            'tienda' => $this->datosTienda(),
        ])->setPaper('a4', 'landscape');

        return $this->streamOrViewPdf(
            $pdf,
            'inventario-computadoras.pdf',
            'Inventario Computadoras',
            'admin.exportar.computadoras'
        );
    }

    public function productosApple()
    {
        // Productos Apple disponibles
        $productos = ProductoApple::where('estado', 'disponible')
            ->orderBy('modelo')
            ->get();

        $pdf = Pdf::loadView('pdf.exportar_productos', [
            'productos' => $productos,
            'tipo' => 'producto_apple',
            'tienda' => $this->datosTienda(),
        ])->setPaper('a4', 'landscape');

        return $this->streamOrViewPdf(
            $pdf,
            'inventario-productos-apple.pdf',
            'Inventario Productos Apple',
            'admin.exportar.productos-apple'
        );
    }

    public function productosGenerales()
    {
        // Todos los productos generales disponibles
        $productos = ProductoGeneral::where('estado', 'disponible')
            ->orderBy('codigo') // si son formateados como "VIDRIO: 1"
            ->get()
            ->sortBy(function ($p) {
                preg_match('/\d+/', $p->codigo, $matches);
                return isset($matches[0]) ? (int) $matches[0] : 0;
            });

        $pdf = Pdf::loadView('pdf.exportar_productos', [
            'productos' => $productos,
            'tipo' => 'producto_general',
            'subtipo' => 'todos',
            'tienda' => $this->datosTienda(),
        ])->setPaper('a4', 'landscape');

        return $this->streamOrViewPdf(
            $pdf,
            'inventario-productos-generales.pdf',
            'Inventario Productos Generales',
            'admin.exportar.productos-generales'
        );
    }


    public function productosGeneralesPorTipo($tipo)
    {
        // Subcategoría específica
        $productos = ProductoGeneral::where('tipo', $tipo)
            ->where('estado', 'disponible')
            ->get()
            ->sortBy(function ($p) {
                preg_match('/\d+/', $p->codigo, $matches);
                return isset($matches[0]) ? (int) $matches[0] : 0;
            });

        if ($productos->isEmpty()) {
            return back()->with('error', 'No hay productos de ese tipo.');
        }

        $pdf = Pdf::loadView('pdf.exportar_productos', [
            'productos' => $productos,
            'tipo' => 'producto_general',
            'subtipo' => ucfirst($tipo),
            'tienda' => $this->datosTienda(),
        ])->setPaper('a4', 'landscape');

        return $this->streamOrViewPdf(
            $pdf,
            "productos-generales-{$tipo}.pdf",
            'Inventario ' . ucfirst($tipo),
            'admin.exportar.productos-generales.tipo',
            ['tipo' => $tipo]
        );
    }

    public function porNombre(Request $request)
    {
        $validated = $request->validate([
            'inventario' => ['required', 'string', 'in:celulares,computadoras,productos_generales,productos_apple'],
            'nombre' => ['required', 'string', 'max:120'],
            'solo_disponibles' => ['nullable'],
        ]);

        $inventory = $validated['inventario'];
        $name = trim($validated['nombre']);
        $onlyAvailable = $request->boolean('solo_disponibles', true);
        $config = $this->inventoryConfig($inventory);
        $model = $config['model'];
        $column = $config['column'];

        $query = $model::query();

        if ($onlyAvailable) {
            $query->where('estado', 'disponible');
        }

        $products = $this->sortFilteredProducts(
            $query->get()->filter(fn ($product) => $this->matchesNameFilter($product->{$column}, $name)),
            $inventory
        );

        if ($products->isEmpty()) {
            return back()->with('error', 'No hay productos con ese nombre.');
        }

        $pdf = Pdf::loadView('pdf.exportar_productos', [
            'productos' => $products,
            'tipo' => $config['tipo'],
            'subtipo' => $config['label'],
            'filtroNombre' => $name,
            'soloDisponibles' => $onlyAvailable,
            'tienda' => $this->datosTienda(),
        ])->setPaper('a4', 'landscape');

        return $this->streamOrViewPdf(
            $pdf,
            'inventario-' . Str::slug($name) . '.pdf',
            'Inventario ' . $config['label'] . ' - ' . $name,
            'admin.exportar.por-nombre',
            [
                'inventario' => $inventory,
                'nombre' => $name,
                'solo_disponibles' => $onlyAvailable ? 1 : 0,
            ]
        );
    }

    public function fundasMagsafe14ProMax(Request $request)
    {
        $request->merge([
            'inventario' => 'productos_generales',
            'nombre' => 'fundas magsafe de 14 pro max',
            'solo_disponibles' => $request->input('solo_disponibles', 1),
        ]);

        return $this->porNombre($request);
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateInventoryAuditPdf;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\InventoryAudit;
use App\Models\InventoryAuditItem;
use App\Models\ProductoApple;
use App\Models\ProductoGeneral;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class InventoryAuditController extends Controller
{
    public function index(): Response
    {
        $audit = InventoryAudit::query()
            ->with(['items.scanner', 'starter', 'closer'])
            ->latest('id')
            ->first();

        if ($audit?->status === 'open') {
            $this->syncPostStartMovements($audit);
            $audit->load(['items.scanner', 'starter', 'closer']);
        } elseif ($audit && ! is_file(self::pdfCachePath($audit))) {
            GenerateInventoryAuditPdf::dispatch($audit->id);
        }

        $history = InventoryAudit::query()
            ->with('starter:id,name')
            ->withCount([
                'items as expected_count' => fn ($query) => $query->where('expected_state', 'disponible'),
                'items as scanned_count' => fn ($query) => $query
                    ->where('expected_state', 'disponible')
                    ->whereNotNull('scanned_at'),
                'items as received_count' => fn ($query) => $query->where('expected_state', 'received_after_start'),
                'items as sold_count' => fn ($query) => $query
                    ->where('expected_state', 'disponible')
                    ->where('resolution', 'sold_after_audit'),
            ])
            ->latest('id')
            ->limit(8)
            ->get()
            ->map(fn (InventoryAudit $item) => [
                'id' => $item->id,
                'status' => $item->status,
                'started_at' => $item->started_at?->toIso8601String(),
                'closed_at' => $item->closed_at?->toIso8601String(),
                'started_by' => $item->starter?->name,
                'expected' => $item->expected_count,
                'scanned' => $item->scanned_count,
                'received_after_start' => $item->received_count,
                'sold_after_audit' => $item->sold_count,
                // Los vendidos durante la auditoría no son faltantes
                'missing' => $item->expected_count - $item->scanned_count - $item->sold_count,
            ]);

        return Inertia::render('Admin/InventoryAudits/Index', [
            'audit' => $audit ? $this->serializeAudit($audit) : null,
            'history' => $history,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $openAudit = InventoryAudit::query()->where('status', 'open')->first();

        if ($openAudit) {
            return redirect()->route('admin.inventory-audits.index')
                ->with('error', 'Ya existe una auditoría abierta. Ciérrala antes de iniciar otra.');
        }

        DB::transaction(function () use ($request) {
            $audit = InventoryAudit::create([
                'started_by' => $request->user()->id,
                'status' => 'open',
                'started_at' => now(),
            ]);

            $rows = $this->inventorySnapshot($audit->id);
            foreach (array_chunk($rows, 500) as $chunk) {
                InventoryAuditItem::insert($chunk);
            }
        });

        return redirect()->route('admin.inventory-audits.index')
            ->with('success', 'Auditoría iniciada. Ya puedes comenzar a escanear.');
    }

    public function scan(Request $request, InventoryAudit $inventoryAudit): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:255'],
        ]);

        if ($inventoryAudit->status !== 'open') {
            return response()->json([
                'message' => 'Esta auditoría ya está cerrada y no admite más escaneos.',
            ], 422);
        }

        $this->syncPostStartMovements($inventoryAudit);

        $code = trim($validated['code']);
        $normalized = $this->normalizeCode($code);

        // Candidatos a probar: el código exacto y variantes con S inicial agregada/quitada.
        // El escáner de cubos/accesorios a veces lee "SHHY50635..." y otras "HHY50635..."
        $candidates = array_values(array_unique(array_filter([
            $normalized,
            str_starts_with($normalized, 'S') ? substr($normalized, 1) : null,
            !str_starts_with($normalized, 'S') ? 'S' . $normalized : null,
        ])));

        $matches = $inventoryAudit->items()
            ->where(function ($query) use ($candidates) {
                foreach ($candidates as $candidate) {
                    $query->orWhereRaw("UPPER(REPLACE(REPLACE(TRIM(COALESCE(primary_code,'')), ' ', ''), '-', '')) = ?", [$candidate])
                        ->orWhereRaw("UPPER(REPLACE(REPLACE(TRIM(COALESCE(secondary_code,'')), ' ', ''), '-', '')) = ?", [$candidate])
                        ->orWhereRaw("UPPER(REPLACE(REPLACE(TRIM(COALESCE(tertiary_code,'')), ' ', ''), '-', '')) = ?", [$candidate]);
                }
            })
            ->get()
            ->unique('id'); // por si acaso algún candidato matchea el mismo item dos veces

        // Accept corrected IMEI/serial values only for products already in the snapshot.
        if ($matches->isEmpty()) {
            $matches = $this->matchesByCurrentIdentifiers($inventoryAudit, $candidates);
        }

        if ($matches->isEmpty() && strlen($normalized) >= 8) {
            $matches = $this->matchesByUniqueCurrentPrefix($inventoryAudit, $candidates);

            if ($matches->count() > 1) {
                return response()->json([
                    'message' => 'El codigo esta incompleto y coincide con mas de un producto. Escanea o escribe el identificador completo.',
                    'ambiguous' => true,
                ], 409);
            }
        }

        if ($matches->isEmpty()) {
            return response()->json([
                'message' => 'Código no encontrado entre los productos disponibles al iniciar la auditoría.',
            ], 404);
        }

        if ($matches->count() > 1) {
            // Varios registros con el mismo código (ej: accesorios con múltiples unidades).
            // Si quedan unidades sin escanear, confirmar la primera disponible.
            $unscanned = $matches->whereNull('scanned_at');

            if ($unscanned->isEmpty()) {
                return response()->json([
                    'message' => 'Todas las unidades con este código ya fueron escaneadas.',
                    'duplicate' => true,
                    'item' => $this->serializeItem($matches->first()->load('scanner')),
                ], 409);
            }

            $item = $unscanned->first();
        } else {
            $item = $matches->first();
        }

        if ($item->scanned_at) {
            return response()->json([
                'message' => 'Este producto ya fue escaneado.',
                'duplicate' => true,
                'item' => $this->serializeItem($item->load('scanner')),
            ], 409);
        }

        $item->update([
            'scanned_at' => now(),
            'scanned_by' => $request->user()->id,
            'scan_value' => $code,
        ]);

        $inventoryAudit->load(['items.scanner', 'starter', 'closer']);

        $isPostStart = $item->expected_state === 'received_after_start';

        return response()->json([
            'message' => $isPostStart
                ? 'Producto registrado como ingreso posterior. No altera el conteo inicial.'
                : 'Producto confirmado fisicamente.',
            'audit' => $this->serializeAudit($inventoryAudit),
            'item' => $this->serializeItem($item->fresh('scanner')),
            'post_start' => $isPostStart,
        ]);
    }

    public function close(Request $request, InventoryAudit $inventoryAudit): RedirectResponse
    {
        if ($inventoryAudit->status !== 'open') {
            return redirect()->route('admin.inventory-audits.index')
                ->with('error', 'La auditoría ya estaba cerrada.');
        }

        $this->syncPostStartMovements($inventoryAudit);

        DB::transaction(function () use ($request, $inventoryAudit) {
            // Only initial inventory participates in the physical count.
            $inventoryAudit->items()
                ->where('expected_state', 'disponible')
                ->whereNotNull('scanned_at')
                ->update(['resolution' => 'scanned']);

            // Classify only initial, unscanned inventory.
            $unscanned = $inventoryAudit->items()
                ->where('expected_state', 'disponible')
                ->whereNull('scanned_at')
                ->get();

            $modelClasses = [
                'celular'        => Celular::class,
                'computadora'    => Computadora::class,
                'producto_apple' => ProductoApple::class,
                'producto_general' => ProductoGeneral::class,
            ];

            foreach ($unscanned->groupBy('source_type') as $sourceType => $items) {
                $modelClass = $modelClasses[$sourceType] ?? null;
                if (! $modelClass) {
                    $items->each(fn ($i) => $i->update(['resolution' => 'missing']));
                    continue;
                }

                $sourceIds = $items->pluck('source_id')->toArray();
                $soldIds = $modelClass::whereIn('id', $sourceIds)
                    ->whereIn('estado', ['vendido', 'reservado'])
                    ->pluck('id')
                    ->flip();

                foreach ($items as $item) {
                    $item->update([
                        'resolution' => isset($soldIds[$item->source_id]) ? 'sold_after_audit' : 'missing',
                    ]);
                }
            }

            $inventoryAudit->update([
                'status'    => 'closed',
                'closed_by' => $request->user()->id,
                'closed_at' => now(),
            ]);
        });

        GenerateInventoryAuditPdf::dispatch($inventoryAudit->id);

        return redirect()->route('admin.inventory-audits.index')
            ->with('success', 'Auditoría cerrada. El informe PDF se está preparando para descarga directa.');
    }

    public function pdf(Request $request, InventoryAudit $inventoryAudit)
    {
        abort_if($inventoryAudit->status !== 'closed', 404, 'La auditoría aún no está cerrada.');

        $cachedPath = self::pdfCachePath($inventoryAudit);
        if (is_file($cachedPath)) {
            return $this->servePdf($request, $inventoryAudit, $cachedPath);
        }

        $inventoryAudit->load(['items', 'starter', 'closer']);

        // Collect source IDs by type
        $sourceIds = ['celular' => [], 'computadora' => [], 'producto_apple' => [], 'producto_general' => []];
        foreach ($inventoryAudit->items as $item) {
            if (array_key_exists($item->source_type, $sourceIds)) {
                $sourceIds[$item->source_type][] = $item->source_id;
            }
        }

        // Bulk-load prices from each source model
        $priceMap = [
            'celular'         => Celular::whereIn('id', $sourceIds['celular'])->get(['id', 'precio_costo', 'precio_venta'])->keyBy('id'),
            'computadora'     => Computadora::whereIn('id', $sourceIds['computadora'])->get(['id', 'precio_costo', 'precio_venta'])->keyBy('id'),
            'producto_apple'  => ProductoApple::whereIn('id', $sourceIds['producto_apple'])->get(['id', 'precio_costo', 'precio_venta'])->keyBy('id'),
            'producto_general' => ProductoGeneral::whereIn('id', $sourceIds['producto_general'])->get(['id', 'precio_costo', 'precio_venta'])->keyBy('id'),
        ];

        $items = $inventoryAudit->items->map(function ($item) use ($priceMap) {
            $source = $priceMap[$item->source_type][$item->source_id] ?? null;
            return [
                'id'           => $item->id,
                'category'     => $item->category,
                'name'         => $item->name,
                'primary_code' => $item->primary_code,
                'details'      => $item->details ?? [],
                'resolution'   => $item->resolution,
                'expected_state' => $item->expected_state,
                'post_start'    => $item->expected_state === 'received_after_start',
                'scanned'      => (bool) $item->scanned_at,
                'precio_costo' => (float) ($source?->precio_costo ?? 0),
                'precio_venta' => (float) ($source?->precio_venta ?? 0),
            ];
        });

        $byCategory = $items->groupBy('category');

        $initialItems     = $items->where('expected_state', 'disponible');
        $totalExpected    = $initialItems->count();
        $totalScanned     = $initialItems->where('scanned', true)->count();
        $totalSoldAfter   = $initialItems->where('resolution', 'sold_after_audit')->count();
        $totalReceivedAfter = $items->where('expected_state', 'received_after_start')->count();
        $totalMissing     = $initialItems->where('resolution', 'missing')->count();
        $perdidaVenta     = $items->where('resolution', 'missing')->sum('precio_venta');
        $perdidaCosto     = $items->where('resolution', 'missing')->sum('precio_costo');

        $pdf = Pdf::loadView('pdf.auditoria_inventario', [
            'audit'         => $inventoryAudit,
            'byCategory'    => $byCategory,
            'totalExpected' => $totalExpected,
            'totalScanned'  => $totalScanned,
            'totalSoldAfter' => $totalSoldAfter,
            'totalReceivedAfter' => $totalReceivedAfter,
            'totalMissing'  => $totalMissing,
            'perdidaVenta'  => $perdidaVenta,
            'perdidaCosto'  => $perdidaCosto,
        ])->setPaper('a4', 'portrait');

        $directory = dirname($cachedPath);
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $temporaryPath = $cachedPath.'.tmp-'.getmypid();
        file_put_contents($temporaryPath, $pdf->output());
        rename($temporaryPath, $cachedPath);

        return $this->servePdf($request, $inventoryAudit, $cachedPath);
    }

    public static function pdfCachePath(InventoryAudit $audit): string
    {
        return storage_path('app/inventory-audits/auditoria-inventario-'.$audit->id.'.pdf');
    }

    private function servePdf(Request $request, InventoryAudit $audit, string $path)
    {
        $filename = 'auditoria-inventario-'.$audit->id.'.pdf';
        $headers = ['Content-Type' => 'application/pdf', 'Cache-Control' => 'private, max-age=3600'];

        return $request->boolean('download')
            ? response()->download($path, $filename, $headers)
            : response()->file($path, $headers);
    }

    private function inventorySnapshot(int $auditId): array
    {
        $now = now();
        $rows = [];

        foreach (Celular::where('estado', 'disponible')->get() as $product) {
            $primary = $product->numero_serie ?: $product->imei_1;
            $secondary = $product->numero_serie ? $product->imei_1 : $product->imei_2;
            $tertiary = $product->numero_serie ? $product->imei_2 : null;
            $rows[] = $this->snapshotRow($auditId, 'celular', $product->id, 'celulares',
                $product->modelo, $primary, $secondary,
                [$product->capacidad, $product->color, $product->bateria], $now, $tertiary);
        }

        foreach (Computadora::where('estado', 'disponible')->get() as $product) {
            $rows[] = $this->snapshotRow($auditId, 'computadora', $product->id, 'computadoras',
                $product->nombre, $product->numero_serie, null,
                [$product->procesador, $product->ram, $product->almacenamiento, $product->color], $now);
        }

        foreach (ProductoApple::where('estado', 'disponible')->get() as $product) {
            $primary = $product->numero_serie ?: $product->imei_1;
            $secondary = $product->numero_serie ? $product->imei_1 : $product->imei_2;
            $tertiary = $product->numero_serie ? $product->imei_2 : null;
            $rows[] = $this->snapshotRow($auditId, 'producto_apple', $product->id, 'productos_apple',
                $product->modelo, $primary, $secondary,
                [$product->capacidad, $product->color, $product->bateria], $now, $tertiary);
        }

        foreach (ProductoGeneral::where('estado', 'disponible')->get() as $product) {
            $rows[] = $this->snapshotRow($auditId, 'producto_general', $product->id, 'productos_generales',
                $product->nombre ?: str_replace('_', ' ', $product->tipo), $product->codigo, null,
                [str_replace('_', ' ', $product->tipo), $product->procedencia], $now);
        }

        return $rows;
    }

    private function snapshotRow(
        int $auditId,
        string $sourceType,
        int $sourceId,
        string $category,
        string $name,
        ?string $primaryCode,
        ?string $secondaryCode,
        array $details,
        $now,
        ?string $tertiaryCode = null
    ): array {
        return [
            'inventory_audit_id' => $auditId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'category' => $category,
            'name' => $name,
            'primary_code' => $primaryCode,
            'secondary_code' => $secondaryCode,
            'tertiary_code' => $tertiaryCode,
            'details' => json_encode(array_values(array_filter($details, fn ($value) => filled($value)))),
            'expected_state' => 'disponible',
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    private function serializeAudit(InventoryAudit $audit): array
    {
        $items = $audit->items
            ->sortBy([['category', 'asc'], ['name', 'asc']])
            ->values();
        $initialItems   = $items->where('expected_state', 'disponible');
        $postStartItems = $items->where('expected_state', 'received_after_start');
        $scanned        = $initialItems->whereNotNull('scanned_at')->count();
        $soldAfterAudit = $initialItems->where('resolution', 'sold_after_audit')->count();
        $missing        = $audit->status === 'closed'
            ? $initialItems->where('resolution', 'missing')->count()
            : ($initialItems->count() - $scanned);

        return [
            'id'               => $audit->id,
            'status'           => $audit->status,
            'started_at'       => $audit->started_at?->toIso8601String(),
            'closed_at'        => $audit->closed_at?->toIso8601String(),
            'started_by'       => $audit->starter?->name,
            'closed_by'        => $audit->closer?->name,
            'expected'         => $initialItems->count(),
            'scanned'          => $scanned,
            'sold_after_audit' => $soldAfterAudit,
            'received_after_start' => $postStartItems->count(),
            'missing'          => $missing,
            'items'            => $items->map(fn ($item) => $this->serializeItem($item))->all(),
        ];
    }

    private function serializeItem(InventoryAuditItem $item): array
    {
        return [
            'id'             => $item->id,
            'category'       => $item->category,
            'name'           => $item->name,
            'primary_code'   => $item->primary_code,
            'secondary_code' => $item->secondary_code,
            'tertiary_code'  => $item->tertiary_code,
            'details'        => $item->details ?? [],
            'resolution'     => $item->resolution,
            'expected_state' => $item->expected_state,
            'post_start'     => $item->expected_state === 'received_after_start',
            'scanned'        => (bool) $item->scanned_at,
            'scanned_at'     => $item->scanned_at?->toIso8601String(),
            'scanned_by'     => $item->scanner?->name,
        ];
    }

    private function normalizeCode(string $code): string
    {
        return strtoupper(preg_replace('/[^A-Z0-9]/i', '', trim($code)) ?? '');
    }

    private function matchesByCurrentIdentifiers(InventoryAudit $audit, array $candidates)
    {
        $snapshotItems = $audit->items()
            ->whereIn('source_type', ['celular', 'producto_apple'])
            ->get();

        if ($snapshotItems->isEmpty()) {
            return collect();
        }

        $models = [
            'celular' => Celular::class,
            'producto_apple' => ProductoApple::class,
        ];
        $matchedItemIds = collect();

        foreach ($snapshotItems->groupBy('source_type') as $sourceType => $items) {
            $products = $models[$sourceType]::query()
                ->whereIn('id', $items->pluck('source_id'))
                ->get(['id', 'numero_serie', 'imei_1', 'imei_2']);

            $sourceIds = $products
                ->filter(function ($product) use ($candidates) {
                    $identifiers = collect([
                        $product->numero_serie,
                        $product->imei_1,
                        $product->imei_2,
                    ])->filter()->map(fn ($value) => $this->normalizeCode((string) $value));

                    return $identifiers->intersect($candidates)->isNotEmpty();
                })
                ->pluck('id');

            $matchedItemIds->push(...$items->whereIn('source_id', $sourceIds)->pluck('id'));
        }

        return $audit->items()->whereIn('id', $matchedItemIds->unique())->get();
    }
    private function matchesByUniqueCurrentPrefix(InventoryAudit $audit, array $candidates)
    {
        $candidates = collect($candidates)->filter(fn ($value) => strlen($value) >= 8);
        if ($candidates->isEmpty()) {
            return collect();
        }

        $matchedItemIds = collect();
        foreach ($this->inventorySourceDefinitions() as $sourceType => $definition) {
            $items = $audit->items()->where('source_type', $sourceType)->get();
            if ($items->isEmpty()) {
                continue;
            }

            $products = $definition['model']::query()
                ->whereIn('id', $items->pluck('source_id'))
                ->get();

            $sourceIds = $products->filter(function ($product) use ($definition, $candidates) {
                $identifiers = collect(($definition['codes'])($product))
                    ->filter()
                    ->map(fn ($value) => $this->normalizeCode((string) $value));

                return $identifiers->contains(function ($identifier) use ($candidates) {
                    return $candidates->contains(
                        fn ($candidate) => str_starts_with($identifier, $candidate)
                    );
                });
            })->pluck('id');

            $matchedItemIds->push(...$items->whereIn('source_id', $sourceIds)->pluck('id'));
        }

        return $audit->items()->whereIn('id', $matchedItemIds->unique())->get();
    }

    private function syncPostStartMovements(InventoryAudit $audit): void
    {
        if ($audit->status !== 'open') {
            return;
        }

        $now = now();
        foreach ($this->inventorySourceDefinitions() as $sourceType => $definition) {
            $knownIds = $audit->items()
                ->where('source_type', $sourceType)
                ->pluck('source_id');

            $products = $definition['model']::query()
                ->whereNotIn('id', $knownIds)
                ->where(function ($query) use ($audit) {
                    $query->where('created_at', '>=', $audit->started_at)
                        ->orWhere('estado', 'disponible');
                })
                ->get();

            foreach ($products as $product) {
                $codes = array_values(($definition['codes'])($product));
                InventoryAuditItem::firstOrCreate(
                    [
                        'inventory_audit_id' => $audit->id,
                        'source_type' => $sourceType,
                        'source_id' => $product->id,
                    ],
                    [
                        'category' => $definition['category'],
                        'name' => ($definition['name'])($product),
                        'primary_code' => $codes[0] ?? null,
                        'secondary_code' => $codes[1] ?? null,
                        'tertiary_code' => $codes[2] ?? null,
                        'details' => array_values(array_filter([
                            ...($definition['details'])($product),
                            'Estado actual: ' . $product->estado,
                        ], fn ($value) => filled($value))),
                        'expected_state' => 'received_after_start',
                        'resolution' => 'received_after_audit',
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]
                );
            }
        }
    }

    private function inventorySourceDefinitions(): array
    {
        return [
            'celular' => [
                'model' => Celular::class,
                'category' => 'celulares',
                'name' => fn ($product) => $product->modelo,
                'codes' => fn ($product) => [$product->numero_serie, $product->imei_1, $product->imei_2],
                'details' => fn ($product) => [$product->capacidad, $product->color, $product->bateria],
            ],
            'computadora' => [
                'model' => Computadora::class,
                'category' => 'computadoras',
                'name' => fn ($product) => $product->nombre,
                'codes' => fn ($product) => [$product->numero_serie],
                'details' => fn ($product) => [$product->procesador, $product->ram, $product->almacenamiento, $product->color],
            ],
            'producto_apple' => [
                'model' => ProductoApple::class,
                'category' => 'productos_apple',
                'name' => fn ($product) => $product->modelo,
                'codes' => fn ($product) => [$product->numero_serie, $product->imei_1, $product->imei_2],
                'details' => fn ($product) => [$product->capacidad, $product->color, $product->bateria],
            ],
            'producto_general' => [
                'model' => ProductoGeneral::class,
                'category' => 'productos_generales',
                'name' => fn ($product) => $product->nombre ?: str_replace('_', ' ', $product->tipo),
                'codes' => fn ($product) => [$product->codigo],
                'details' => fn ($product) => [str_replace('_', ' ', $product->tipo), $product->procedencia],
            ],
        ];
    }

}

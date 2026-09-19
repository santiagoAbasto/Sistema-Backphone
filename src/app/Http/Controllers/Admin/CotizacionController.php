<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Cotizacion;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoGeneral;
use App\Models\ProductoApple;
use App\Models\Cliente;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Mail\CotizacionMailable;
use Google_Client;
use Google_Service_Drive;
use Google_Service_Drive_Permission;

class CotizacionController extends Controller
{
    /* ======================================================
       INDEX ADMIN
    ====================================================== */
    public function index()
    {
        return Inertia::render('Admin/Cotizaciones/Index', [
            'cotizaciones' => Cotizacion::with('usuario:id,name')->latest()->get(),
        ]);
    }

    /* ======================================================
       INDEX VENDEDOR
    ====================================================== */
    public function indexVendedor()
    {
        return Inertia::render('Vendedor/Cotizaciones/Index', [
            'cotizaciones' => Cotizacion::where('user_id', auth()->id())->with('usuario:id,name')->latest()->get(),
        ]);
    }

    /* ======================================================
       CREATE
    ====================================================== */
    public function create()
    {
        return $this->vistaCreate();
    }

    public function createVendedor()
    {
        return $this->vistaCreate();
    }

    private function vistaCreate()
    {
        return Inertia::render(
            auth()->user()->rol === 'admin'
                ? 'Admin/Cotizaciones/Create'
                : 'Vendedor/Cotizaciones/Create',
            [
                'fechaHoy' => now()->toDateString(),
                'celulares' => Celular::where('estado', 'disponible')->get(),
                'computadoras' => Computadora::where('estado', 'disponible')->get(),
                'productosGenerales' => ProductoGeneral::where('estado', 'disponible')->get(),
                'productosApple' => ProductoApple::where('estado', 'disponible')->get(),
            ]
        );
    }

    /* ======================================================
       STORE (ADMIN + VENDEDOR)
    ====================================================== */
    public function store(Request $request)
    {
        $this->guardarCotizacion($request);
        return redirect()->route('admin.cotizaciones.index')
            ->with('success', 'Cotización registrada correctamente.');
    }

    public function storeVendedor(Request $request)
    {
        $this->guardarCotizacion($request);
        return redirect()->route('vendedor.cotizaciones.index')
            ->with('success', 'Cotización registrada correctamente.');
    }

    private function guardarCotizacion(Request $request)
    {
        $request->validate([
            'nombre_cliente' => 'required|string|max:255',
            'telefono_completo' => 'required|string|regex:/^\+\d{8,15}$/',
            'correo_cliente' => 'nullable|email|max:255',
            'fecha_cotizacion' => 'required|date',
            'items' => 'required|array|min:1',
            'items.*.nombre' => 'required|string',
            'items.*.tipo' => 'nullable|string|in:celular,computadora,producto_general,producto_apple',
            'items.*.modelo' => 'nullable|string|max:255',
            'items.*.procesador' => 'nullable|string|max:100',
            'items.*.ram' => 'nullable|string|max:50',
            'items.*.almacenamiento' => 'nullable|string|max:100',
            'items.*.capacidad' => 'nullable|string|max:100',
            'items.*.color' => 'nullable|string|max:100',
            'items.*.bateria' => 'nullable|string|max:100',
            'items.*.cantidad' => 'required|integer|min:1',
            'items.*.precio_sin_factura' => 'required|numeric|min:0',
            'items.*.descuento' => 'nullable|numeric|min:0',
            // Impuestos y totales se recalculan abajo; lo que mande la pantalla no cuenta
            'items.*.iva' => 'nullable|numeric|min:0',
            'items.*.it' => 'nullable|numeric|min:0',
            'items.*.total' => 'nullable|numeric|min:0',
        ], [
            'telefono_completo.required' => 'Escribe el número de WhatsApp del cliente.',
            'telefono_completo.regex' => 'Revisa el número de WhatsApp: debe llevar el código de país, por ejemplo +591 70000000.',
            'items.required' => 'Agrega al menos un producto a la cotización.',
            'items.min' => 'Agrega al menos un producto a la cotización.',
        ]);

        $telefono = preg_replace('/\D/', '', $request->telefono_completo);
        $correo = $request->filled('correo_cliente') ? trim($request->correo_cliente) : null;

        $cliente = Cliente::firstOrCreate(
            [
                'user_id' => Auth::id(),
                'telefono' => $telefono,
            ],
            [
                'nombre' => $request->nombre_cliente,
                'correo' => $correo,
            ]
        );

        // Si el cliente ya existía sin correo, se completa con el que se escribió
        if ($correo && ! $cliente->correo) {
            $cliente->update(['correo' => $correo]);
        }

        // Impuestos y totales se calculan aquí, con la misma fórmula del PDF
        $items = collect($request->items)->map(function ($i) {
            $cantidad = (int) $i['cantidad'];
            $precio = round((float) $i['precio_sin_factura'], 2);
            $subtotal = $precio * $cantidad;
            $descuento = min(max(0, round((float) ($i['descuento'] ?? 0), 2)), $subtotal);
            $neto = $subtotal - $descuento;
            $iva = round($neto * 0.13, 2);
            $it = round($neto * 0.03, 2);

            return [
                'nombre' => $i['nombre'],
                'tipo' => $i['tipo'] ?? null,
                'modelo' => $i['modelo'] ?? null,
                'procesador' => $i['procesador'] ?? null,
                'ram' => $i['ram'] ?? null,
                'almacenamiento' => $i['almacenamiento'] ?? null,
                'capacidad' => $i['capacidad'] ?? null,
                'color' => $i['color'] ?? null,
                'bateria' => $i['bateria'] ?? null,
                'cantidad' => $cantidad,
                'precio_sin_factura' => $precio,
                'descuento' => $descuento,
                'iva' => $iva,
                'it' => $it,
                'total' => round($neto + $iva + $it, 2),
            ];
        })->toArray();

        $total = round(collect($items)->sum('total'), 2);


        $cotizacion = Cotizacion::create([
            'user_id' => Auth::id(),
            'cliente_id' => $cliente->id,
            // La cotización lleva exactamente los datos escritos en el formulario
            'nombre_cliente' => $request->nombre_cliente,
            'telefono' => $telefono,
            'correo_cliente' => $correo,
            'fecha_cotizacion' => $request->fecha_cotizacion,
            'notas_adicionales' => $request->notas_adicionales ?? '',
            'items' => $items,
            'total' => $total,
        ]);

        $driveUrl = $this->exportarPDFYGuardar($cotizacion->id);
        if ($driveUrl) {
            $cotizacion->update(['drive_url' => $driveUrl]);
        }

        if ($correo) {
            Mail::to($correo)->queue(new CotizacionMailable($cotizacion));
            $cotizacion->update(['enviado_por_correo' => true]);
        }

        return $cotizacion;
    }

    /* ======================================================
       PDF + GOOGLE DRIVE
    ====================================================== */
    private function exportarPDFYGuardar($id)
    {
        $cotizacion = Cotizacion::findOrFail($id);
        $pdf = Pdf::loadView('pdf.cotizacion', compact('cotizacion'));
        $content = $pdf->output();

        try {
            $credentialsPath = storage_path('app/google/credentials.json');
            $folderId = env('GOOGLE_DRIVE_FOLDER_ID');

            if (!file_exists($credentialsPath) || !$folderId) {
                Log::warning('Cotización creada sin subir PDF a Drive: falta configuración.', [
                    'cotizacion_id' => $cotizacion->id,
                ]);
                return null;
            }

            $client = new Google_Client();
            $client->setAuthConfig($credentialsPath);
            $client->addScope(Google_Service_Drive::DRIVE_FILE);
            $client->setAccessType('offline');

            $tokenPath = storage_path('app/google/token.json');
            if (file_exists($tokenPath)) {
                $client->setAccessToken(json_decode(file_get_contents($tokenPath), true));
            }

            $service = new Google_Service_Drive($client);

            $file = $service->files->create(
                new \Google_Service_Drive_DriveFile([
                    'name' => "cotizacion_{$id}.pdf",
                    'parents' => [$folderId],
                ]),
                [
                    'data' => $content,
                    'mimeType' => 'application/pdf',
                    'uploadType' => 'multipart',
                    'fields' => 'id',
                ]
            );

            $service->permissions->create($file->id, new Google_Service_Drive_Permission([
                'type' => 'anyone',
                'role' => 'reader',
            ]));

            return "https://drive.google.com/file/d/{$file->id}/view";
        } catch (\Throwable $e) {
            Log::warning('Cotización creada, pero falló la subida del PDF a Google Drive.', [
                'cotizacion_id' => $cotizacion->id,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function exportarPDF($id)
    {
        $cotizacion = Cotizacion::findOrFail($id);

        if (auth()->user()->rol === 'vendedor' && $cotizacion->user_id !== auth()->id()) {
            abort(403);
        }

        return Pdf::loadView('pdf.cotizacion', compact('cotizacion'))
            ->stream("cotizacion_{$cotizacion->id}.pdf");
    }

    private function urlPDF(Cotizacion $cotizacion): string
    {
        if ($cotizacion->drive_url) {
            return $cotizacion->drive_url;
        }

        return auth()->user()->rol === 'vendedor'
            ? route('vendedor.cotizaciones.pdf', $cotizacion->id)
            : route('admin.cotizaciones.pdf', $cotizacion->id);
    }

    /**
     * Mensaje de WhatsApp de una cotización: el mismo en el envío individual y en lote.
     * El total va con el mismo formato que el PDF que abre el cliente.
     */
    private function mensajeWhatsapp(Cotizacion $cotizacion): string
    {
        return "Hola {$cotizacion->nombre_cliente}, gracias por confiar en " . \App\Models\ConfiguracionNegocio::nombre() . ".\n\n"
            . "*Cotización N.º COT-{$cotizacion->id}*\n"
            . 'Total: Bs ' . number_format((float) $cotizacion->total, 2) . "\n"
            . 'Ver PDF: ' . $this->urlPDF($cotizacion);
    }

    /* ======================================================
       WHATSAPP INDIVIDUAL
    ====================================================== */
    public function whatsappFinal($id)
    {
        $cotizacion = Cotizacion::findOrFail($id);

        if (auth()->user()->rol === 'vendedor' && $cotizacion->user_id !== auth()->id()) {
            abort(403);
        }

        $numero = preg_replace('/\D/', '', (string) $cotizacion->telefono);
        if (strlen($numero) < 8) {
            return back()->with('error', 'La cotización no tiene un número de WhatsApp válido.');
        }

        // Queda registrado que se abrió WhatsApp con el mensaje listo
        $cotizacion->update(['enviado_por_whatsapp' => true]);

        return redirect()->away(
            "https://wa.me/{$numero}?text=" . rawurlencode($this->mensajeWhatsapp($cotizacion))
        );
    }

    public function whatsappFinalLibre(Request $request)
    {
        $id = $request->query('id') ?? $request->query('cotizacion_id');

        if (!$id) {
            return back()->with('error', 'Selecciona una cotización para enviar por WhatsApp.');
        }

        return $this->whatsappFinal($id);
    }

    /* ======================================================
       WHATSAPP LOTE ✅
    ====================================================== */
    public function enviarLoteWhatsapp(Request $request)
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
        ], [
            'ids.required' => 'Elige al menos una cotización.',
            'ids.min' => 'Elige al menos una cotización.',
        ]);

        $links = [];
        $omitidas = [];

        foreach ($request->input('ids') as $id) {
            $cotizacion = Cotizacion::find($id);
            if (!$cotizacion) continue;

            if (auth()->user()->rol === 'vendedor' && $cotizacion->user_id !== auth()->id()) continue;

            $numero = preg_replace('/\D/', '', (string) $cotizacion->telefono);
            if (strlen($numero) < 8) {
                $omitidas[] = $cotizacion->nombre_cliente;
                continue;
            }

            $mensaje = $this->mensajeWhatsapp($cotizacion);

            $links[] = [
                'id' => $cotizacion->id,
                'cotizacion_id' => $cotizacion->id,
                'nombre' => $cotizacion->nombre_cliente,
                'telefono' => $numero,
                'total' => number_format((float) $cotizacion->total, 2),
                'pdf' => $this->urlPDF($cotizacion),
                'mensaje' => $mensaje,
                'link' => "https://wa.me/{$numero}?text=" . rawurlencode($mensaje),
            ];
        }

        return Inertia::render(
            auth()->user()->rol === 'admin'
                ? 'Admin/Cotizaciones/WhatsappLote'
                : 'Vendedor/Cotizaciones/WhatsappLote',
            ['links' => $links, 'omitidas' => $omitidas]
        );
    }
    /* ======================================================
   REENVIAR COTIZACIÓN POR CORREO
====================================================== */
    /* ======================================================
   REENVIAR CORREO (ADMIN + VENDEDOR)
====================================================== */
    public function reenviarCorreo($id)
    {
        $cotizacion = Cotizacion::findOrFail($id);

        // 🔐 Seguridad por rol
        if (auth()->user()->rol === 'vendedor' && $cotizacion->user_id !== auth()->id()) {
            abort(403);
        }

        // 📧 Reenviar correo
        if ($cotizacion->correo_cliente) {
            Mail::to($cotizacion->correo_cliente)
                ->queue(new CotizacionMailable($cotizacion));

            $cotizacion->update([
                'enviado_por_correo' => true,
            ]);
        }

        return back()->with('success', 'Cotización reenviada por correo.');
    }
}

<?php

namespace Tests\Feature;

use App\Models\ConfiguracionNegocio;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Los comprobantes no llevan ningún dato de un negocio escrito a mano.
 *
 * El nombre, el NIT, la dirección y el teléfono salen siempre de Ajustes → Datos del negocio.
 * Esta prueba lee las plantillas: si alguien vuelve a escribir una dirección, un teléfono o una
 * marca en el código, falla acá y no llega al cliente.
 */
class ComprobantesConDatosDelNegocioTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Lo que nunca puede aparecer escrito en una plantilla de comprobante.
     * Son datos que cambian con cada negocio: si están en el código, el cliente
     * recibe una boleta con los datos de otro.
     */
    private const PROHIBIDO = [
        // Una dirección concreta
        '/\bav\.?\s+[a-záéíóúñ]/i',
        '/\bcalle\s+[a-záéíóúñ]/i',
        // Un número de teléfono
        '/\+?\d{3}[\s\-]?\d{7,}/',
        '/wa\.me\/\d/',
        // Un NIT o identificación tributaria
        '/\bNIT[:\s]*<?\/?strong>?[:\s]*\d/i',
        // Una razón social escrita a mano
        '/\bcontribuyente\b\s*:?\s*<?\/?strong>?\s*[a-záéíóúñ]/i',
    ];

    public function test_ninguna_plantilla_de_comprobante_trae_datos_escritos_a_mano(): void
    {
        $plantillas = array_merge(
            glob(resource_path('views/pdf/*.blade.php')),
            glob(resource_path('views/emails/*.blade.php')),
        );

        $this->assertNotEmpty($plantillas, 'No se encontró ninguna plantilla de comprobante.');

        $hallazgos = [];

        foreach ($plantillas as $ruta) {
            $contenido = file_get_contents($ruta);

            foreach (self::PROHIBIDO as $patron) {
                if (preg_match($patron, $contenido, $coincidencia)) {
                    $hallazgos[] = basename($ruta) . ' → ' . trim($coincidencia[0]);
                }
            }
        }

        $this->assertSame([], $hallazgos, "Hay datos escritos a mano en los comprobantes:\n" . implode("\n", $hallazgos));
    }

    public function test_las_plantillas_nunca_anidan_blade_dentro_de_blade(): void
    {
        // `{{ '... {{ $x }}' }}` compila mal y rompe el PDF entero en tiempo de ejecución.
        $hallazgos = [];

        foreach (glob(resource_path('views/pdf/*.blade.php')) as $ruta) {
            if (preg_match('/\{\{[^}]*\{\{/', file_get_contents($ruta))) {
                $hallazgos[] = basename($ruta);
            }
        }

        $this->assertSame([], $hallazgos, 'Blade anidado en: ' . implode(', ', $hallazgos));
    }

    public function test_el_nombre_del_negocio_llega_a_toda_plantilla_de_comprobante(): void
    {
        ConfiguracionNegocio::guardar(['negocio_nombre' => 'Servitec BO']);

        // El composer de AppServiceProvider comparte $negocio con pdf.* y emails.*
        $vista = view('pdf.viewer', ['pdfUrl' => '/x.pdf'])->render();

        $this->assertStringContainsString('Servitec BO', $vista);
    }
}

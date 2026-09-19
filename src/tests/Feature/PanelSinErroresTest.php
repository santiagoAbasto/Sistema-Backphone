<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Control de cierre: el administrador abre cada pantalla del panel que no necesita un registro (listados, formularios
 * nuevos y reportes) y ninguna puede responder con un error del servidor. Una ruta nueva entra sola.
 */
class PanelSinErroresTest extends TestCase
{
    use RefreshDatabase;

    public function test_ninguna_pantalla_del_panel_responde_con_error(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $conError = [];

        foreach (Route::getRoutes() as $ruta) {
            $nombre = (string) $ruta->getName();
            $sinParametros = ! str_contains($ruta->uri(), '{');

            // Los PDF y exportaciones tienen sus propias pruebas: acá solo las pantallas
            $esExportacion = preg_match('/export|pdf|boleta|recibo/i', $nombre) === 1;

            if (! str_starts_with($nombre, 'admin.') || ! in_array('GET', $ruta->methods(), true) || ! $sinParametros || $esExportacion) {
                continue;
            }

            $respuesta = $this->actingAs($admin)->get('/' . ltrim($ruta->uri(), '/'));

            if ($respuesta->getStatusCode() >= 500) {
                $conError[] = $nombre . ' (' . $ruta->uri() . ') → ' . $respuesta->getStatusCode();
            }
        }

        $this->assertSame([], $conError, "Pantallas con error:\n" . implode("\n", $conError));
    }
}

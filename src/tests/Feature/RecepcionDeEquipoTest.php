<?php

namespace Tests\Feature;

use App\Models\ServicioTecnico;
use App\Models\User;
use App\Support\RecepcionDeEquipo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Cómo llega el equipo al taller.
 *
 * La nota de recepción existe para una sola cosa: responder sola cuando el cliente vuelve diciendo
 * que su equipo no estaba así. Por eso lo que se prueba acá es que lo marcado se guarde tal cual,
 * que lo no marcado no se invente, y que el código de desbloqueo quede anotado —o quede anotado
 * que no lo dejó— y salga impreso en las dos notas.
 */
class RecepcionDeEquipoTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function formulario(array $recepcion, array $extra = []): array
    {
        return array_merge([
            'cliente'          => 'Jhonny Camacho',
            'telefono'         => '70000000',
            'equipo'           => 'iPhone 12 Pro',
            'tecnico_id'       => $this->tecnicoDePrueba('Taller')->id,
            'marca'            => 'apple',
            'fecha'            => '2026-09-19',
            'detalle_servicio' => json_encode([['descripcion' => 'Cambio de pantalla', 'costo' => 300, 'precio' => 700]]),
            'precio_venta'     => 700,
            'recepcion'        => $recepcion,
        ], $extra);
    }

    private function registrar(array $recepcion, array $extra = []): ServicioTecnico
    {
        $this->actingAs($this->admin())
            ->post(route('admin.servicios.store'), $this->formulario($recepcion, $extra))
            ->assertRedirect(route('admin.servicios.index'));

        return ServicioTecnico::latest('id')->firstOrFail();
    }

    // ─── Lo que se guarda ────────────────────────────────────────────────────

    public function test_la_revision_se_guarda_tal_cual_se_marco(): void
    {
        $servicio = $this->registrar([
            'revision' => [
                ['etiqueta' => 'Enciende', 'estado' => 'si'],
                ['etiqueta' => 'Pantalla sin fisuras', 'estado' => 'no'],
                ['etiqueta' => 'Face ID / Touch ID', 'estado' => 'nc'],
                ['etiqueta' => 'Bandeja del chip trabada', 'estado' => 'si'],
            ],
            'desbloqueo' => ['modo' => 'deja', 'tipo' => 'pin', 'valor' => '4417'],
        ]);

        $this->assertSame([
            ['etiqueta' => 'Enciende', 'estado' => 'si'],
            ['etiqueta' => 'Pantalla sin fisuras', 'estado' => 'no'],
            ['etiqueta' => 'Face ID / Touch ID', 'estado' => 'nc'],
            ['etiqueta' => 'Bandeja del chip trabada', 'estado' => 'si'],
        ], $servicio->recepcion['revision']);

        $this->assertSame(
            ['modo' => 'deja', 'tipo' => 'pin', 'valor' => '4417'],
            $servicio->recepcion['desbloqueo']
        );
    }

    public function test_un_punto_sin_marcar_no_se_guarda_como_revisado(): void
    {
        // El navegador manda los puntos sin estado; guardarlos sería decir que se revisaron
        $servicio = $this->registrar([
            'revision' => [
                ['etiqueta' => 'Enciende', 'estado' => 'si'],
                ['etiqueta' => 'Carga', 'estado' => ''],
                ['etiqueta' => '', 'estado' => 'si'],
                ['etiqueta' => 'ENCIENDE', 'estado' => 'no'],
            ],
            'desbloqueo' => ['modo' => 'sin_bloqueo'],
        ]);

        // Queda el primero: el vacío y el sin estado se caen, y el repetido no pisa al original
        $this->assertSame([['etiqueta' => 'Enciende', 'estado' => 'si']], $servicio->recepcion['revision']);
        $this->assertSame(['modo' => 'sin_bloqueo'], $servicio->recepcion['desbloqueo']);
    }

    public function test_que_el_cliente_no_deje_el_codigo_tambien_queda_anotado(): void
    {
        $servicio = $this->registrar([
            'revision'   => [['etiqueta' => 'Enciende', 'estado' => 'si']],
            // Aunque venga un código colgado, un «no deja» no guarda ninguno
            'desbloqueo' => ['modo' => 'no_deja', 'tipo' => 'pin', 'valor' => '9999'],
        ]);

        $this->assertSame(['modo' => 'no_deja'], $servicio->recepcion['desbloqueo']);
        $this->assertSame(
            'El cliente no deja el código de desbloqueo.',
            RecepcionDeEquipo::textoDesbloqueo($servicio->recepcion['desbloqueo'])
        );
    }

    public function test_un_servicio_sin_recepcion_queda_en_null_y_no_rompe_nada(): void
    {
        $servicio = $this->registrar([]);

        $this->assertNull($servicio->recepcion);

        $this->actingAs($this->admin())
            ->get(route('admin.servicios.boleta', $servicio))
            ->assertOk();
    }

    public function test_un_estado_inventado_se_rechaza(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.servicios.store'), $this->formulario([
                'revision' => [['etiqueta' => 'Enciende', 'estado' => 'quizas']],
            ]))
            ->assertSessionHasErrors('recepcion.revision.0.estado');

        $this->assertSame(0, ServicioTecnico::count());
    }

    // ─── Lo que se imprime ───────────────────────────────────────────────────

    public function test_la_revision_y_el_codigo_salen_en_las_dos_notas(): void
    {
        $servicio = $this->registrar([
            'revision' => [
                ['etiqueta' => 'Enciende', 'estado' => 'si'],
                ['etiqueta' => 'Pantalla sin fisuras', 'estado' => 'no'],
                ['etiqueta' => 'Face ID / Touch ID', 'estado' => 'nc'],
            ],
            'desbloqueo' => ['modo' => 'deja', 'tipo' => 'patron', 'valor' => 'L invertida'],
        ]);

        foreach (['admin.servicios.boleta', 'admin.servicios.recibo80mm'] as $ruta) {
            $pdf = $this->actingAs($this->admin())->get(route($ruta, $servicio));
            $pdf->assertOk();

            // dompdf comprime el texto, así que se revisa el HTML que se le entrega
            $html = view(
                $ruta === 'admin.servicios.boleta' ? 'pdf.boleta_servicio' : 'pdf.recibo_servicio_80mm',
                [
                    'servicio'          => $servicio,
                    'servicios_cliente' => $servicio->trabajos(),
                    'negocio'           => \App\Models\ConfiguracionNegocio::paraPdf(),
                ]
            )->render();

            $this->assertStringContainsString('Patrón L invertida', $html);
            $this->assertStringContainsString('Pantalla sin fisuras', $html);
            $this->assertStringContainsString('No se pudo probar', $html);
        }
    }

    // ─── El formulario ───────────────────────────────────────────────────────

    public function test_el_formulario_recibe_los_puntos_que_trae_el_sistema(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.servicios.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Servicios/Create')
                ->where('revision', RecepcionDeEquipo::PUNTOS));
    }
}

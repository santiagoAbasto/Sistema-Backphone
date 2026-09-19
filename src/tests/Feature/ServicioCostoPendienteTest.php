<?php

namespace Tests\Feature;

use App\Models\ServicioTecnico;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Servicio técnico: el vendedor registra solo lo que paga el cliente (con eso sale la nota) y al administrador le
 * llega el aviso para cargar el costo. Hasta que lo carga, la utilidad de ese servicio no se suma en ningún reporte.
 */
class ServicioCostoPendienteTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Admin']);
    }

    private function vendedor(): User
    {
        return User::factory()->create(['rol' => 'vendedor', 'name' => 'Vendedora Ana']);
    }

    /** Lo que manda el formulario: el vendedor no debería mandar costos, pero se prueba que no se guarden igual. */
    private function formulario(array $trabajos, array $datos = []): array
    {
        return array_merge([
            'cliente'          => 'María Rojas',
            'telefono'         => '70000001',
            'equipo'           => 'iPhone 13',
            'tecnico'          => 'AXEL',
            'fecha'            => '2026-09-16',
            'detalle_servicio' => json_encode($trabajos),
            'precio_venta'     => 999,
        ], $datos);
    }

    private function servicioDelVendedor(User $vendedor): ServicioTecnico
    {
        $this->actingAs($vendedor)->post(route('vendedor.servicios.store'), $this->formulario([
            ['descripcion' => 'Cambio de batería', 'precio' => 250],
            ['descripcion' => 'Limpieza', 'precio' => 100],
        ]));

        return ServicioTecnico::latest('id')->firstOrFail();
    }

    // ─── Vendedor ───────────────────────────────────────────────────────────────

    public function test_el_vendedor_registra_solo_lo_que_cobra_y_el_costo_queda_pendiente(): void
    {
        $vendedor = $this->vendedor();

        $this->actingAs($vendedor)
            ->post(route('vendedor.servicios.store'), $this->formulario([
                ['descripcion' => 'Cambio de batería', 'costo' => 100, 'precio' => 250],
                ['descripcion' => '<b>Limpieza</b>', 'costo' => 10, 'precio' => 100],
            ], ['precio_costo' => 110]))
            ->assertRedirect(route('vendedor.servicios.index'))
            ->assertSessionHas('success', 'Servicio técnico registrado. Ya puedes imprimir la nota.');

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertTrue($servicio->costo_pendiente);
        $this->assertSame(0.0, (float) $servicio->precio_costo);
        // El total sale de los trabajos, no del número que manda el navegador
        $this->assertSame(350.0, (float) $servicio->precio_venta);
        $this->assertNull($servicio->costo_cargado_por);

        $trabajos = json_decode($servicio->detalle_servicio, true);
        $this->assertSame([
            ['descripcion' => 'Cambio de batería', 'precio' => 250],
            ['descripcion' => 'Limpieza', 'precio' => 100],
        ], $trabajos);
    }

    public function test_al_registrarlo_le_llega_el_aviso_al_administrador(): void
    {
        $servicio = $this->servicioDelVendedor($this->vendedor());

        $aviso = SystemNotification::where('servicio_tecnico_id', $servicio->id)->firstOrFail();
        $this->assertSame('servicio_sin_costo', $aviso->type);
        $this->assertFalse((bool) $aviso->read);
        $this->assertStringContainsString($servicio->codigo_nota, $aviso->message);
        $this->assertStringContainsString('Carga el costo', $aviso->message);

        $this->actingAs($this->admin())
            ->getJson('/admin/notifications')
            ->assertOk()
            ->assertJsonPath('notifications.0.type', 'servicio_sin_costo');
    }

    public function test_la_nota_del_cliente_sale_en_el_momento(): void
    {
        $vendedor = $this->vendedor();
        $servicio = $this->servicioDelVendedor($vendedor);

        $respuesta = $this->actingAs($vendedor)->get(route('vendedor.servicios.boleta', $servicio));

        $respuesta->assertOk();
        $this->assertSame('application/pdf', $respuesta->headers->get('content-type'));
    }

    public function test_al_vendedor_no_le_viaja_el_costo_ni_por_la_busqueda_rapida(): void
    {
        $vendedor = $this->vendedor();
        ServicioTecnico::create([
            'codigo_nota' => 'AT-ST900', 'cliente' => 'María Rojas', 'equipo' => 'iPhone 13', 'tecnico' => 'AXEL',
            'detalle_servicio' => json_encode([['descripcion' => 'Batería', 'costo' => 100, 'precio' => 250]]),
            'precio_costo' => 100, 'precio_venta' => 250, 'fecha' => '2026-09-16', 'user_id' => $vendedor->id,
        ]);

        $servicio = $this->actingAs($vendedor)
            ->getJson(route('vendedor.servicios.index', ['buscar' => 'María']))
            ->assertOk()
            ->json('servicios.0');

        $this->assertArrayNotHasKey('precio_costo', $servicio);
        $this->assertArrayNotHasKey('costo_pendiente', $servicio);
        $this->assertArrayNotHasKey('costo', json_decode($servicio['detalle_servicio'], true)[0]);
    }

    // ─── Administrador ──────────────────────────────────────────────────────────

    public function test_la_lista_del_administrador_cuenta_y_filtra_los_que_esperan_su_costo(): void
    {
        $this->servicioDelVendedor($this->vendedor());
        $admin = $this->admin();
        $this->actingAs($admin)->post(route('admin.servicios.store'), $this->formulario([
            ['descripcion' => 'Pantalla', 'costo' => 300, 'precio' => 500],
        ]));

        $this->actingAs($admin)->get(route('admin.servicios.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('pendientesDeCosto', 1)
                ->has('servicios', 2));

        $this->actingAs($admin)->get(route('admin.servicios.index', ['pendientes' => 1]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('pendientesDeCosto', 1)
                ->has('servicios', 1)
                ->where('servicios.0.costo_pendiente', true));
    }

    public function test_el_administrador_carga_el_costo_y_la_nota_no_cambia(): void
    {
        $servicio = $this->servicioDelVendedor($this->vendedor());
        $admin = $this->admin();

        $this->actingAs($admin)
            ->patch(route('admin.servicios.costo', $servicio), ['costos' => [120, 15.5]])
            ->assertRedirect()
            ->assertSessionHas('success', "Costo cargado en {$servicio->codigo_nota}: deja una utilidad de Bs 214.50.");

        $servicio->refresh();
        $this->assertFalse($servicio->costo_pendiente);
        $this->assertSame(135.5, (float) $servicio->precio_costo);
        $this->assertSame(350.0, (float) $servicio->precio_venta);
        $this->assertSame($admin->id, $servicio->costo_cargado_por);
        $this->assertNotNull($servicio->costo_cargado_en);
        $this->assertSame(214.5, $servicio->gananciaParaReportes());

        // Lo que dice la nota (trabajo y cobro) queda igual; solo se suma el costo
        $this->assertSame([
            ['descripcion' => 'Cambio de batería', 'precio' => 250, 'costo' => 120],
            ['descripcion' => 'Limpieza', 'precio' => 100, 'costo' => 15.5],
        ], json_decode($servicio->detalle_servicio, true));

        // El aviso del Resumen queda leído
        $this->assertTrue((bool) SystemNotification::where('servicio_tecnico_id', $servicio->id)->value('read'));
    }

    public function test_el_costo_se_carga_para_cada_trabajo_y_no_puede_ser_negativo(): void
    {
        $servicio = $this->servicioDelVendedor($this->vendedor());
        $admin = $this->admin();

        $this->actingAs($admin)
            ->patch(route('admin.servicios.costo', $servicio), ['costos' => [120]])
            ->assertSessionHasErrors(['costos' => 'Carga el costo de cada trabajo del servicio.']);

        $this->actingAs($admin)
            ->patch(route('admin.servicios.costo', $servicio), ['costos' => [120, -5]])
            ->assertSessionHasErrors('costos.1');

        $this->assertTrue($servicio->fresh()->costo_pendiente);
    }

    public function test_solo_el_administrador_carga_el_costo(): void
    {
        $vendedor = $this->vendedor();
        $servicio = $this->servicioDelVendedor($vendedor);

        $this->actingAs($vendedor)
            ->patch("/admin/servicios/{$servicio->id}/costo", ['costos' => [1, 1]])
            ->assertForbidden();

        $this->assertTrue($servicio->fresh()->costo_pendiente);
    }

    public function test_el_administrador_puede_dejar_el_costo_para_despues(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post(route('admin.servicios.store'), $this->formulario([
                ['descripcion' => 'Pantalla', 'costo' => 300, 'precio' => 500],
                ['descripcion' => 'Diagnóstico', 'precio' => 50],
            ]))
            ->assertRedirect(route('admin.servicios.index'));

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertTrue($servicio->costo_pendiente);
        // El aviso es para lo que registran otros: el administrador ya está en la lista
        $this->assertSame(0, SystemNotification::count());

        $this->actingAs($admin)->post(route('admin.servicios.store'), $this->formulario([
            ['descripcion' => 'Batería', 'costo' => 100, 'precio' => 250],
        ]));

        $completo = ServicioTecnico::latest('id')->firstOrFail();
        $this->assertFalse($completo->costo_pendiente);
        $this->assertSame($admin->id, $completo->costo_cargado_por);
    }

    // ─── Reportes ───────────────────────────────────────────────────────────────

    public function test_un_servicio_sin_costo_no_suma_utilidad_en_los_reportes(): void
    {
        $this->servicioDelVendedor($this->vendedor());
        $admin = $this->admin();
        $this->actingAs($admin)->post(route('admin.servicios.store'), $this->formulario([
            ['descripcion' => 'Pantalla', 'costo' => 300, 'precio' => 500],
        ]));

        $this->actingAs($admin)->get(route('admin.reportes.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                // Solo cuenta la pantalla (500 − 300); el servicio del vendedor espera su costo
                ->where('resumen.ganancia_servicio', fn ($v) => (float) $v === 200.0)
                ->where('resumen.servicios_sin_costo', 1)
                ->where('resumen.total_ventas', fn ($v) => (float) $v === 850.0));
    }
}

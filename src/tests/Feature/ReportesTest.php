<?php

namespace Tests\Feature;

use App\Models\ServicioTecnico;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ReportesTest extends TestCase
{
    use RefreshDatabase;

    private int $numero = 0;

    private function servicio(User $user, array $datos = []): ServicioTecnico
    {
        $this->numero++;

        return ServicioTecnico::create(array_merge([
            'codigo_nota' => sprintf('AT-ST%03d', $this->numero),
            'cliente' => 'Cliente ' . $this->numero,
            'equipo' => 'iPhone 13',
            'detalle_servicio' => json_encode([['descripcion' => 'Cambio de batería', 'costo' => 100, 'precio' => 250]]),
            'precio_costo' => 100,
            'precio_venta' => 250,
            'tecnico' => 'AXEL',
            'fecha' => '2026-09-10',
            'user_id' => $user->id,
        ], $datos));
    }

    public function test_el_detalle_viene_paginado_y_el_resumen_cuenta_todo_el_periodo(): void
    {
        $admin = User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
        for ($i = 0; $i < 30; $i++) {
            $this->servicio($admin);
        }

        $periodo = ['fecha_inicio' => '2026-09-01', 'fecha_fin' => '2026-09-20'];

        $this->actingAs($admin)
            ->get(route('admin.reportes.index', $periodo))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Reportes/Index')
                ->has('ventas.data', 25)
                ->where('ventas.total', 30)
                ->where('ventas.last_page', 2)
                ->where('resumen.movimientos', 30)
                ->where('totales_vista.movimientos', 30)
                ->where('totales_vista.ganancia', 4500)
                ->where('por_vendedor.0.nombre', 'Administrador')
                ->where('por_vendedor.0.movimientos', 30)
                ->where('vendedores.0.name', 'Administrador'));

        $this->actingAs($admin)
            ->get(route('admin.reportes.index', $periodo + ['page' => 2]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('ventas.data', 5)
                ->where('ventas.current_page', 2));

        // Una página que ya no existe muestra la última
        $this->actingAs($admin)
            ->get(route('admin.reportes.index', $periodo + ['page' => 9]))
            ->assertInertia(fn (Assert $page) => $page->where('ventas.current_page', 2));

        $this->actingAs($admin)
            ->get(route('admin.reportes.index', $periodo + ['por_pagina' => 50]))
            ->assertInertia(fn (Assert $page) => $page
                ->has('ventas.data', 30)
                ->where('ventas.last_page', 1));
    }

    public function test_tipo_y_busqueda_filtran_solo_la_tabla(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->servicio($admin, ['codigo_nota' => 'AT-ST900']);
        $this->servicio($admin, ['codigo_nota' => 'AT-ST901']);

        $this->actingAs($admin)
            ->get(route('admin.reportes.index', ['buscar' => 'st900']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('ventas.total', 1)
                ->where('ventas.data.0.codigo', 'AT-ST900')
                ->where('resumen.movimientos', 2));

        $this->actingAs($admin)
            ->get(route('admin.reportes.index', ['tipo' => 'Celular']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('ventas.total', 0)
                ->where('conteo_tipos.Servicio Técnico', 2));
    }

    public function test_filas_por_pagina_no_permitidas_muestran_error(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->get(route('admin.reportes.index', ['por_pagina' => 7]))
            ->assertSessionHasErrors('por_pagina');
    }

    public function test_el_pdf_sale_con_el_tipo_elegido(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->servicio($admin);

        $response = $this->actingAs($admin)
            ->get(route('admin.reportes.exportar', ['tipo' => 'Servicio Técnico']));

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }
}

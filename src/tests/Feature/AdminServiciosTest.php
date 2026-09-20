<?php

namespace Tests\Feature;

use App\Models\ServicioTecnico;
use App\Models\Tecnico;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class AdminServiciosTest extends TestCase
{
    use RefreshDatabase;

    private int $numero = 0;

    private function servicio(User $user, array $datos = []): ServicioTecnico
    {
        $this->numero++;

        return ServicioTecnico::create(array_merge([
            'codigo_nota' => sprintf('AT-ST%03d', $this->numero),
            'cliente' => 'Cliente ' . $this->numero,
            'telefono' => '7000000' . $this->numero,
            'equipo' => 'iPhone 13',
            'detalle_servicio' => json_encode([
                ['descripcion' => 'Cambio de batería', 'costo' => 100, 'precio' => 250],
            ]),
            'precio_costo' => 100,
            'precio_venta' => 250,
            'fecha' => '2026-09-10',
            'user_id' => $user->id,
        ], $this->conTecnico($datos)));
    }

    /** El nombre del técnico se guarda igual que en producción: copiado de su ficha. */
    private function conTecnico(array $datos): array
    {
        $ficha = $this->tecnicoDePrueba($datos['tecnico'] ?? 'AXEL');
        unset($datos['tecnico']);

        return $datos + [
            'tecnico'             => $ficha->nombre,
            'tecnico_id'          => $ficha->id,
            'marca'               => 'apple',
            'comision_porcentaje' => $ficha->comision,
        ];
    }

    public function test_listado_filtra_por_tecnico_y_periodo_y_comparte_opciones(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $vendedor = User::factory()->create(['rol' => 'vendedor']);
        User::factory()->create(['rol' => 'vendedor']); // sin servicios: no aparece en el filtro

        $this->servicio($admin, ['tecnico' => 'AXEL']);
        $this->servicio($vendedor, ['tecnico' => 'EDSON']);
        $this->servicio($vendedor, ['tecnico' => 'AXEL', 'fecha' => '2026-08-01']);

        $axel = Tecnico::where('nombre', 'AXEL')->firstOrFail();

        // Se filtra por la ficha y no por el nombre escrito: así un técnico al que después le
        // corrigen el nombre no pierde sus servicios viejos.
        $this->actingAs($admin)
            ->get(route('admin.servicios.index', ['tecnico_id' => $axel->id]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Servicios/Index')
                ->has('servicios', 2)
                ->where('filtros.tecnico_id', (string) $axel->id)
                ->has('tecnicos', 2)
                ->where('tecnicos.0.nombre', 'AXEL')
                ->where('tecnicos.1.nombre', 'EDSON')
                ->has('vendedores', 2));

        $this->actingAs($admin)
            ->get(route('admin.servicios.index', [
                'tecnico_id' => $axel->id,
                'fecha_inicio' => '2026-09-01',
                'fecha_fin' => '2026-09-20',
            ]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('servicios', 1)
                ->where('servicios.0.user_id', $admin->id));
    }

    public function test_admin_exporta_el_pdf_de_los_servicios_filtrados(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->servicio($admin);

        $response = $this->actingAs($admin)->get(route('admin.servicios.exportarFiltrado', [
            'fecha_inicio' => '2026-09-01',
            'fecha_fin' => '2026-09-20',
            'tecnico_id' => Tecnico::where('nombre', 'AXEL')->value('id'),
        ]));

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }

    public function test_el_formulario_ofrece_las_fichas_de_tecnico_y_las_marcas(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->tecnicoDePrueba('AXEL', Tecnico::APPLE);
        $this->tecnicoDePrueba('MARCELO', Tecnico::ANDROID);
        $this->tecnicoDePrueba('ARCHIVADO')->update(['activo' => false]);

        $this->actingAs($admin)
            ->get(route('admin.servicios.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Servicios/Create')
                // El archivado no se ofrece: no se le puede asignar un equipo nuevo
                ->has('tecnicos', 2)
                ->where('tecnicos.0.nombre', 'AXEL')
                ->where('tecnicos.0.especialidad', 'apple')
                ->where('tecnicos.1.nombre', 'MARCELO')
                ->has('marcas', 3));
    }

    public function test_vendedor_exporta_su_pdf_con_los_parametros_que_manda_su_pantalla(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);
        $this->servicio($vendedor);

        // Su pantalla siempre manda los tres parámetros, aunque estén vacíos
        $this->actingAs($vendedor)
            ->get(route('vendedor.servicios.exportarFiltrado') . '?fecha_inicio=&fecha_fin=&vendedor_id=')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->actingAs($vendedor)
            ->get(route('vendedor.servicios.exportarFiltrado') . '?fecha_inicio=2026-09-01&fecha_fin=2026-09-20&vendedor_id=')
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');
    }

    public function test_el_pdf_del_vendedor_solo_incluye_sus_servicios(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);
        $otro = User::factory()->create(['rol' => 'vendedor']);
        $admin = User::factory()->create(['rol' => 'admin']);
        $propio = $this->servicio($vendedor);
        $this->servicio($otro);
        $this->servicio($admin);

        $pdf = Mockery::mock(\Barryvdh\DomPDF\PDF::class);
        $pdf->shouldReceive('setPaper')->andReturnSelf();
        $pdf->shouldReceive('download')->andReturn(response('%PDF', 200, ['Content-Type' => 'application/pdf']));

        $filas = null;
        Pdf::shouldReceive('loadView')->once()->andReturnUsing(function ($vista, $datos) use (&$filas, $pdf) {
            $filas = $datos['filas'];

            return $pdf;
        });

        $this->actingAs($vendedor)
            ->get(route('vendedor.servicios.exportarFiltrado'))
            ->assertOk();

        $this->assertSame([$propio->codigo_nota], $filas->pluck('codigo_nota')->unique()->values()->all());
    }

    public function test_cada_rol_solo_puede_usar_su_propio_boton_de_exportar(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $vendedor = User::factory()->create(['rol' => 'vendedor']);

        $this->actingAs($vendedor)->get(route('admin.servicios.exportarFiltrado'))->assertForbidden();
        $this->actingAs($admin)->get(route('vendedor.servicios.exportarFiltrado'))->assertForbidden();
    }
}

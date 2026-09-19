<?php

namespace Tests\Feature;

use App\Models\Egreso;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class EgresosTest extends TestCase
{
    use RefreshDatabase;

    private function egreso(User $user, array $datos = [], ?string $fecha = null): Egreso
    {
        $egreso = Egreso::create(array_merge([
            'concepto' => 'Luz de la tienda',
            'precio_invertido' => 250,
            'tipo_gasto' => 'servicio_basico',
            'user_id' => $user->id,
        ], $datos));

        if ($fecha) {
            $egreso->forceFill(['created_at' => $fecha])->save();
        }

        return $egreso;
    }

    public function test_registrar_un_egreso_guarda_y_vuelve_al_listado(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->post(route('admin.egresos.store'), [
                'concepto' => 'Luz de la tienda',
                'precio_invertido' => 250.5,
                'tipo_gasto' => 'servicio_basico',
                'frecuencia' => 'Mensual',
                'cuotas_pendientes' => 5, // no aplica a un servicio básico
                'comentario' => '',
            ])
            ->assertRedirect(route('admin.egresos.index'))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('egresos', [
            'concepto' => 'Luz de la tienda',
            'tipo_gasto' => 'servicio_basico',
            'frecuencia' => 'Mensual',
            'cuotas_pendientes' => null,
            'user_id' => $admin->id,
        ]);
    }

    public function test_una_cuota_bancaria_guarda_las_cuotas_pendientes(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->post(route('admin.egresos.store'), [
                'concepto' => 'Cuota del préstamo',
                'precio_invertido' => 1200,
                'tipo_gasto' => 'cuota_bancaria',
                'cuotas_pendientes' => 12,
            ])
            ->assertRedirect(route('admin.egresos.index'));

        $this->assertDatabaseHas('egresos', ['concepto' => 'Cuota del préstamo', 'cuotas_pendientes' => 12]);
    }

    public function test_un_monto_en_cero_no_se_acepta(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->post(route('admin.egresos.store'), [
                'concepto' => 'Luz',
                'precio_invertido' => 0,
                'tipo_gasto' => 'servicio_basico',
            ])
            ->assertSessionHasErrors(['precio_invertido' => 'El monto debe ser mayor a cero.']);

        $this->assertSame(0, Egreso::count());
    }

    public function test_listado_filtra_por_periodo_y_solo_trae_el_nombre_de_quien_registro(): void
    {
        $admin = User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
        $this->egreso($admin, [], '2026-09-10 10:00:00');
        $this->egreso($admin, ['concepto' => 'Luz de agosto'], '2026-08-10 10:00:00');

        $this->actingAs($admin)
            ->get(route('admin.egresos.index', ['fecha_inicio' => '2026-09-01', 'fecha_fin' => '2026-09-30']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Egresos/Index')
                ->has('egresos', 1)
                ->where('egresos.0.concepto', 'Luz de la tienda')
                ->where('egresos.0.user', ['id' => $admin->id, 'name' => 'Administrador'])
                ->where('filtros.fecha_inicio', '2026-09-01')
                ->where('filtros.fecha_fin', '2026-09-30'));
    }

    public function test_un_periodo_al_reves_muestra_un_error_claro(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->get(route('admin.egresos.index', ['fecha_inicio' => '2026-09-30', 'fecha_fin' => '2026-09-01']))
            ->assertSessionHasErrors(['fecha_fin' => 'La fecha final no puede ser anterior a la inicial.']);
    }

    public function test_el_pdf_sale_con_el_periodo_y_el_tipo_elegidos(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->egreso($admin, ['concepto' => 'Sueldo de septiembre', 'tipo_gasto' => 'sueldos'], '2026-09-10 10:00:00');
        $this->egreso($admin, [], '2026-09-11 10:00:00');

        $pdf = Mockery::mock(\Barryvdh\DomPDF\PDF::class);
        $pdf->shouldReceive('setPaper')->andReturnSelf();
        $pdf->shouldReceive('stream')->andReturn(response('%PDF', 200, ['Content-Type' => 'application/pdf']));

        $datos = null;
        Pdf::shouldReceive('loadView')->once()->andReturnUsing(function ($vista, $d) use (&$datos, $pdf) {
            $datos = $d;

            return $pdf;
        });

        $this->actingAs($admin)
            ->get(route('admin.egresos.exportar-pdf', [
                'fecha_inicio' => '2026-09-01',
                'fecha_fin' => '2026-09-30',
                'tipo_gasto' => 'sueldos',
            ]))
            ->assertOk();

        $this->assertSame(['Sueldo de septiembre'], $datos['egresos']->pluck('concepto')->all());
        $this->assertSame('Sueldos', $datos['tipo']);
    }

    public function test_el_pdf_real_se_genera(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->egreso($admin);

        $response = $this->actingAs($admin)->get(route('admin.egresos.exportar-pdf'));

        $response->assertOk();
        $this->assertSame('application/pdf', $response->headers->get('content-type'));
        $this->assertStringStartsWith('%PDF', $response->getContent());
    }
}

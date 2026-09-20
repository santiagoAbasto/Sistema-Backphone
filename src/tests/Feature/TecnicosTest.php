<?php

namespace Tests\Feature;

use App\Models\Liquidacion;
use App\Models\ServicioTecnico;
use App\Models\Tecnico;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Técnicos y comisiones.
 *
 * El taller no paga sueldo: reparte la ganancia de cada reparación. Lo que se prueba acá es lo
 * que hace que ese reparto se pueda defender — que un Android no termine en manos del técnico de
 * Apple, que el porcentaje del día quede congelado en el servicio, y que la cuenta salga de la
 * ganancia y no de lo que pagó el cliente.
 */
class TecnicosTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function axel(): Tecnico
    {
        return $this->tecnicoDePrueba('Axel', Tecnico::APPLE, 60);
    }

    private function marcelo(): Tecnico
    {
        return $this->tecnicoDePrueba('Marcelo', Tecnico::ANDROID, 60);
    }

    /** Un servicio registrado por el formulario, como lo manda la pantalla. */
    private function registrar(User $quien, Tecnico $tecnico, string $marca, array $trabajos, array $extra = [])
    {
        return $this->actingAs($quien)->post(route('admin.servicios.store'), array_merge([
            'cliente'          => 'María Rojas',
            'telefono'         => '70000000',
            'equipo'           => 'Equipo',
            'tecnico_id'       => $tecnico->id,
            'marca'            => $marca,
            'fecha'            => '2026-09-16',
            'detalle_servicio' => json_encode($trabajos),
            'precio_venta'     => 0,
        ], $extra));
    }

    // ─── La regla del taller ─────────────────────────────────────────────────

    public function test_un_equipo_android_no_se_le_asigna_al_tecnico_de_apple(): void
    {
        $axel = $this->axel();

        // Va directo al servidor, sin pasar por el desplegable que ya lo esconde
        $this->registrar($this->admin(), $axel, 'android', [
            ['descripcion' => 'Cambio de pantalla', 'costo' => 200, 'precio' => 500],
        ])->assertSessionHasErrors('tecnico_id');

        $this->assertSame(0, ServicioTecnico::count());
    }

    public function test_el_tecnico_que_atiende_todo_recibe_cualquier_equipo(): void
    {
        $comodin = $this->tecnicoDePrueba('Comodín', Tecnico::AMBAS, 50);

        foreach (['apple', 'android', 'otro'] as $marca) {
            $this->registrar($this->admin(), $comodin, $marca, [
                ['descripcion' => 'Revisión', 'costo' => 0, 'precio' => 100],
            ])->assertRedirect(route('admin.servicios.index'));
        }

        $this->assertSame(3, ServicioTecnico::count());
    }

    public function test_el_formulario_solo_ofrece_tecnicos_activos(): void
    {
        $this->axel();
        $this->marcelo();
        $this->tecnicoDePrueba('Jubilado')->update(['activo' => false]);

        $this->actingAs($this->admin())
            ->get(route('admin.servicios.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('tecnicos', 2)
                ->where('tecnicos.0.especialidad', 'apple')
                ->where('tecnicos.1.especialidad', 'android'));
    }

    // ─── Lo que queda guardado ───────────────────────────────────────────────

    public function test_el_servicio_congela_el_porcentaje_del_dia(): void
    {
        $axel = $this->axel();

        $this->registrar($this->admin(), $axel, 'apple', [
            ['descripcion' => 'Cambio de pantalla', 'costo' => 180, 'precio' => 700],
        ]);

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertSame($axel->id, $servicio->tecnico_id);
        $this->assertSame('Axel', $servicio->tecnico);
        $this->assertSame('apple', $servicio->marca);
        $this->assertSame(60, $servicio->comision_porcentaje);

        // Le suben la comisión: los servicios ya registrados no cambian
        $axel->update(['comision' => 70]);

        $this->assertSame(60, $servicio->fresh()->comision_porcentaje);
        $this->assertSame(312.0, $servicio->fresh()->comisionDelTecnico());
    }

    public function test_la_comision_sale_de_la_ganancia_y_no_de_lo_que_pago_el_cliente(): void
    {
        $axel = $this->axel();

        $this->registrar($this->admin(), $axel, 'apple', [
            ['descripcion' => 'Cambio de pantalla', 'costo' => 180, 'precio' => 700],
        ]);

        $servicio = ServicioTecnico::firstOrFail();

        // 700 cobrados − 180 de repuesto = 520 de ganancia. El 60 % son 312, no el 60 % de 700.
        $this->assertSame(312.0, $servicio->comisionDelTecnico());
        $this->assertSame(208.0, $servicio->parteDeLaTienda());
    }

    public function test_sin_el_costo_cargado_todavia_no_hay_comision(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);
        $axel = $this->axel();

        $this->actingAs($vendedor)->post(route('vendedor.servicios.store'), [
            'cliente'          => 'María Rojas',
            'equipo'           => 'iPhone 12',
            'tecnico_id'       => $axel->id,
            'marca'            => 'apple',
            'fecha'            => '2026-09-16',
            'detalle_servicio' => json_encode([['descripcion' => 'Cambio de pantalla', 'precio' => 700]]),
            'precio_venta'     => 700,
        ])->assertRedirect(route('vendedor.servicios.index'));

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertTrue($servicio->costo_pendiente);
        // Poner cero sería decir que el técnico no ganó nada: hasta que esté el costo, no se sabe
        $this->assertNull($servicio->comisionDelTecnico());
    }

    public function test_un_servicio_cobrado_bajo_el_costo_lo_absorbe_la_tienda(): void
    {
        $axel = $this->axel();

        $this->registrar($this->admin(), $axel, 'apple', [
            ['descripcion' => 'Cambio de pantalla', 'costo' => 300, 'precio' => 200],
        ]);

        $servicio = ServicioTecnico::firstOrFail();
        // La pérdida no se le descuenta al técnico de otra reparación
        $this->assertSame(0.0, $servicio->comisionDelTecnico());
    }

    // ─── La semana ───────────────────────────────────────────────────────────

    public function test_la_pantalla_suma_la_semana_de_cada_tecnico(): void
    {
        $admin = $this->admin();
        $axel = $this->axel();
        $this->marcelo();

        $this->registrar($admin, $axel, 'apple', [['descripcion' => 'Pantalla', 'costo' => 180, 'precio' => 700]]);
        $this->registrar($admin, $axel, 'apple', [['descripcion' => 'Batería', 'costo' => 100, 'precio' => 300]]);

        $this->actingAs($admin)
            ->get(route('admin.tecnicos.index', ['semana' => '2026-09-16']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Tecnicos/Index')
                ->where('semana.inicio', '2026-09-14')
                ->where('semana.fin', '2026-09-20')
                ->has('comisiones', 2)
                ->where('comisiones.0.nombre', 'Axel')
                ->where('comisiones.0.servicios', 2)
                // Enteros: así es como salen en el JSON cuando el monto no tiene centavos
                ->where('comisiones.0.cobrado', 1000)
                ->where('comisiones.0.repuestos', 280)
                ->where('comisiones.0.ganancia', 720)
                ->where('comisiones.0.comision', 432)
                ->where('comisiones.0.tienda', 288)
                // Marcelo no reparó nada: sale en cero, no desaparece
                ->where('comisiones.1.nombre', 'Marcelo')
                ->where('comisiones.1.servicios', 0));
    }

    public function test_la_semana_se_paga_y_queda_guardado_el_calculo(): void
    {
        $admin = $this->admin();
        $axel = $this->axel();
        $this->registrar($admin, $axel, 'apple', [['descripcion' => 'Pantalla', 'costo' => 180, 'precio' => 700]]);

        $this->actingAs($admin)
            ->post(route('admin.tecnicos.liquidar', $axel), ['semana' => '2026-09-16'])
            ->assertSessionHas('success');

        $liquidacion = Liquidacion::firstOrFail();
        $this->assertSame($axel->id, $liquidacion->tecnico_id);
        $this->assertSame('2026-09-14', $liquidacion->semana_inicio->toDateString());
        $this->assertSame(312.0, (float) $liquidacion->monto);
        $this->assertSame(520.0, (float) $liquidacion->ganancia);
        $this->assertSame(60, $liquidacion->porcentaje);
        $this->assertSame($admin->id, $liquidacion->pagada_por);

        // Si después se corrige un costo de esa semana, lo ya pagado no cambia
        ServicioTecnico::firstOrFail()->update(['precio_costo' => 400]);
        $this->assertSame(312.0, (float) $liquidacion->fresh()->monto);
    }

    public function test_no_se_paga_una_semana_con_costos_sin_cargar(): void
    {
        $admin = $this->admin();
        $vendedor = User::factory()->create(['rol' => 'vendedor']);
        $axel = $this->axel();

        $this->actingAs($vendedor)->post(route('vendedor.servicios.store'), [
            'cliente' => 'María Rojas', 'equipo' => 'iPhone 12',
            'tecnico_id' => $axel->id, 'marca' => 'apple', 'fecha' => '2026-09-16',
            'detalle_servicio' => json_encode([['descripcion' => 'Pantalla', 'precio' => 700]]),
            'precio_venta' => 700,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.tecnicos.liquidar', $axel), ['semana' => '2026-09-16'])
            ->assertSessionHas('error');

        $this->assertSame(0, Liquidacion::count());
    }

    public function test_los_servicios_sin_tecnico_se_avisan_en_vez_de_perderse(): void
    {
        $admin = $this->admin();

        ServicioTecnico::create([
            'codigo_nota' => 'CBA-ST900', 'cliente' => 'Cliente viejo', 'equipo' => 'iPhone 8',
            'detalle_servicio' => json_encode([['descripcion' => 'Pantalla', 'costo' => 100, 'precio' => 300]]),
            'precio_costo' => 100, 'precio_venta' => 300, 'tecnico' => 'Alguien',
            'fecha' => '2026-09-16', 'user_id' => $admin->id, 'costo_pendiente' => false,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.tecnicos.index', ['semana' => '2026-09-16']))
            ->assertInertia(fn (Assert $page) => $page->where('sinTecnico', 1));
    }

    // ─── Las fichas ──────────────────────────────────────────────────────────

    public function test_un_tecnico_que_ya_reparo_se_archiva_en_vez_de_borrarse(): void
    {
        $admin = $this->admin();
        $axel = $this->axel();
        $this->registrar($admin, $axel, 'apple', [['descripcion' => 'Pantalla', 'costo' => 180, 'precio' => 700]]);

        $this->actingAs($admin)->delete(route('admin.tecnicos.destroy', $axel))->assertSessionHas('success');

        // Sigue existiendo: si se borrara, el servicio pagado quedaría apuntando a nadie
        $this->assertFalse($axel->fresh()->activo);
        $this->assertSame($axel->id, ServicioTecnico::firstOrFail()->tecnico_id);
    }

    public function test_un_tecnico_sin_servicios_si_se_borra(): void
    {
        $tecnico = $this->tecnicoDePrueba('Recién llegado');

        $this->actingAs($this->admin())->delete(route('admin.tecnicos.destroy', $tecnico));

        $this->assertNull($tecnico->fresh());
    }

    public function test_la_ficha_no_se_guarda_sin_decir_que_equipos_atiende(): void
    {
        // «Cualquier equipo» ya no viene marcado solo: elegirlo tiene que ser a propósito, porque
        // es la opción que apaga la regla que separa Android de Apple.
        $this->actingAs($this->admin())
            ->post(route('admin.tecnicos.store'), ['nombre' => 'Sin definir', 'comision' => 60])
            ->assertSessionHasErrors('especialidad');

        $this->assertSame(0, Tecnico::count());
    }

    public function test_la_comision_no_puede_pasar_de_cien(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.tecnicos.store'), [
                'nombre' => 'Ambicioso', 'especialidad' => 'ambas', 'comision' => 120,
            ])
            ->assertSessionHasErrors('comision');

        $this->assertSame(0, Tecnico::count());
    }

    public function test_el_vendedor_no_entra_a_tecnicos_y_comisiones(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);
        $axel = $this->axel();

        $this->actingAs($vendedor)->get(route('admin.tecnicos.index'))->assertForbidden();
        $this->actingAs($vendedor)->post(route('admin.tecnicos.liquidar', $axel), ['semana' => '2026-09-16'])->assertForbidden();
    }
}

<?php

namespace Tests\Feature;

use App\Models\Caja;
use App\Models\Egreso;
use App\Models\Reserva;
use App\Models\ServicioTecnico;
use App\Models\Sucursal;
use App\Models\User;
use App\Models\Venta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * La caja de cada sucursal: se abre con lo que hay en el cajón, se cierra contando, y el sistema
 * dice si sobra o falta. Solo cuenta lo cobrado en efectivo.
 */
class CajaTest extends TestCase
{
    use RefreshDatabase;

    private Sucursal $cochabamba;

    private Sucursal $sucre;

    private int $nota = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $this->sucre      = Sucursal::where('prefijo', 'SUC')->firstOrFail();
    }

    private function hoy(): string
    {
        return now('America/La_Paz')->toDateString();
    }

    private function de(Sucursal $sucursal, string $rol = 'admin'): User
    {
        return User::factory()->create(['rol' => $rol, 'sucursal_id' => $sucursal->id]);
    }

    private function abrir(User $quien, Sucursal $sucursal, float $monto, string $panel = 'admin')
    {
        return $this->actingAs($quien)->post(route("$panel.caja.abrir"), [
            'sucursal_id' => $sucursal->id, 'monto_apertura' => $monto,
        ]);
    }

    private function venta(User $quien, float $cobro, string $pago, string $fecha): Venta
    {
        $this->actingAs($quien);

        return Venta::create([
            'nombre_cliente' => 'Cliente', 'fecha' => $fecha, 'codigo_nota' => 'CJ-V' . ++$this->nota,
            'tipo_venta' => 'producto', 'precio_venta' => $cobro, 'subtotal' => $cobro,
            'metodo_pago' => $pago, 'user_id' => $quien->id,
        ]);
    }

    private function servicio(User $quien, float $cobro, string $pago, string $fecha): ServicioTecnico
    {
        $this->actingAs($quien);

        return ServicioTecnico::create([
            'codigo_nota' => 'CJ-S' . ++$this->nota, 'cliente' => 'Cliente', 'equipo' => 'iPhone 13',
            'detalle_servicio' => json_encode([['descripcion' => 'Pantalla', 'costo' => 50, 'precio' => $cobro]]),
            'precio_costo' => 50, 'precio_venta' => $cobro, 'metodo_pago' => $pago,
            'tecnico' => 'AXEL', 'fecha' => $fecha, 'user_id' => $quien->id,
        ]);
    }

    private function reserva(User $quien, float $abono, string $pago): Reserva
    {
        $this->actingAs($quien);

        return Reserva::create([
            'codigo_nota' => 'CJ-R' . ++$this->nota, 'nombre_cliente' => 'Cliente', 'fecha' => now('America/La_Paz'),
            'subtotal' => $abono * 3, 'monto_reserva' => $abono, 'metodo_pago' => $pago,
            'estado' => 'activa', 'user_id' => $quien->id,
        ]);
    }

    // ─── Abrir ──────────────────────────────────────────────────────────────

    public function test_se_abre_una_vez_por_dia_y_por_sucursal(): void
    {
        $jefa = $this->de($this->cochabamba);

        $this->abrir($jefa, $this->cochabamba, 200)->assertSessionHasNoErrors();

        $caja = Caja::sole();
        $this->assertSame($this->hoy(), $caja->fecha->toDateString());
        $this->assertSame($this->cochabamba->id, $caja->sucursal_id);
        $this->assertSame($jefa->id, $caja->abierta_por);
        $this->assertSame(200.0, (float) $caja->monto_apertura);

        $this->abrir($jefa, $this->cochabamba, 300)->assertSessionHasErrors('monto_apertura');
        $this->assertSame(1, Caja::count());
    }

    public function test_no_se_abre_un_dia_nuevo_con_el_anterior_sin_cerrar(): void
    {
        $jefa = $this->de($this->cochabamba);
        Caja::create([
            'sucursal_id' => $this->cochabamba->id, 'fecha' => now('America/La_Paz')->subDay()->toDateString(),
            'monto_apertura' => 100, 'abierta_por' => $jefa->id, 'abierta_en' => now()->subDay(),
        ]);

        $this->abrir($jefa, $this->cochabamba, 200)->assertSessionHasErrors('monto_apertura');
        $this->assertSame(1, Caja::count());
    }

    public function test_nadie_abre_la_caja_de_otra_sucursal(): void
    {
        $this->abrir($this->de($this->sucre), $this->cochabamba, 200)->assertForbidden();
        $this->assertSame(0, Caja::count());
    }

    // ─── Cerrar ─────────────────────────────────────────────────────────────

    public function test_el_cierre_cuenta_solo_el_efectivo_y_dice_cuanto_falta(): void
    {
        $jefa = $this->de($this->cochabamba);
        $hoy  = $this->hoy();
        $this->abrir($jefa, $this->cochabamba, 200);

        $this->venta($jefa, 5000, 'efectivo', $hoy);
        $this->venta($jefa, 3000, 'qr', $hoy);
        $this->venta($jefa, 1000, 'transferencia', $hoy);
        $this->servicio($jefa, 250, 'efectivo', $hoy);
        $this->servicio($jefa, 100, 'tarjeta', $hoy);
        $this->reserva($jefa, 300, 'efectivo');
        $this->reserva($jefa, 400, 'qr');
        Egreso::create(['concepto' => 'Almuerzo', 'precio_invertido' => 80, 'tipo_gasto' => 'servicio_basico', 'user_id' => $jefa->id]);

        // 200 + 5000 + 250 + 300 − 80 = 5670; en el cajón contaron 20 menos
        $this->actingAs($jefa)
            ->post(route('admin.caja.cerrar', Caja::sole()), ['monto_contado' => 5650, 'notas' => 'Vuelto mal dado'])
            ->assertSessionHasNoErrors();

        $caja = Caja::sole()->fresh();
        $this->assertFalse($caja->estaAbierta());
        $this->assertSame(5000.0, (float) $caja->efectivo_ventas);
        $this->assertSame(250.0, (float) $caja->efectivo_servicios);
        $this->assertSame(300.0, (float) $caja->efectivo_reservas);
        $this->assertSame(80.0, (float) $caja->egresos);
        $this->assertSame(5670.0, (float) $caja->esperado);
        $this->assertSame(-20.0, (float) $caja->diferencia);
        $this->assertSame($jefa->id, $caja->cerrada_por);

        // Cerrada no se vuelve a cerrar
        $this->actingAs($jefa)->post(route('admin.caja.cerrar', $caja), ['monto_contado' => 1])->assertSessionHasErrors('monto_contado');
    }

    public function test_lo_que_entra_despues_del_cierre_no_cambia_lo_firmado_y_se_avisa(): void
    {
        $jefa = $this->de($this->cochabamba);
        $hoy  = $this->hoy();
        $this->abrir($jefa, $this->cochabamba, 100);
        $this->venta($jefa, 500, 'efectivo', $hoy);
        $this->actingAs($jefa)->post(route('admin.caja.cerrar', Caja::sole()), ['monto_contado' => 600]);

        $this->venta($jefa, 150, 'efectivo', $hoy);

        $this->assertSame(600.0, (float) Caja::sole()->esperado);
        $this->actingAs($jefa)
            ->get(route('admin.caja.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Caja/Index')
                ->where('cajas.0.caja.esperado', 600)
                ->where('cajas.0.caja.diferencia', 0)
                ->where('cajas.0.caja.despues_del_cierre', 150));
    }

    public function test_el_vendedor_cuenta_a_ciegas(): void
    {
        $vendedora = $this->de($this->cochabamba, 'vendedor');
        $this->abrir($vendedora, $this->cochabamba, 100, 'vendedor')->assertSessionHasNoErrors();
        $this->venta($vendedora, 400, 'efectivo', $this->hoy());

        // Con la caja abierta no sabe cuánto debería haber
        $this->actingAs($vendedora)
            ->get(route('vendedor.caja.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Caja/Index')
                ->where('aCiegas', true)
                ->where('cajas.0.caja.monto_apertura', 100)
                ->where('cajas.0.caja.esperado', null)
                ->where('cajas.0.caja.movimientos', null));

        $this->actingAs($vendedora)->post(route('vendedor.caja.cerrar', Caja::sole()), ['monto_contado' => 480])->assertSessionHasNoErrors();

        // Cerrada, ve el resultado: faltan 20
        $this->actingAs($vendedora)
            ->get(route('vendedor.caja.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('cajas.0.caja.esperado', 500)
                ->where('cajas.0.caja.diferencia', -20));
    }

    public function test_una_sucursal_no_cierra_la_caja_de_otra(): void
    {
        $this->abrir($this->de($this->cochabamba), $this->cochabamba, 100);

        $this->actingAs($this->de($this->sucre))
            ->post(route('admin.caja.cerrar', Caja::withoutGlobalScopes()->sole()), ['monto_contado' => 100])
            ->assertNotFound();

        $this->assertTrue(Caja::withoutGlobalScopes()->sole()->estaAbierta());
    }

    // ─── Reservas y Resumen ─────────────────────────────────────────────────

    public function test_la_reserva_pide_como_se_pago_el_abono(): void
    {
        $this->actingAs($this->de($this->cochabamba))
            ->postJson(route('admin.reservas.store'), ['nombre_cliente' => 'Ana', 'monto_reserva' => 100, 'items' => []])
            ->assertJsonValidationErrors('metodo_pago');
    }

    public function test_el_resumen_de_hoy_arranca_con_la_apertura(): void
    {
        $jefa = $this->de($this->cochabamba);
        $this->abrir($jefa, $this->cochabamba, 200);
        $this->venta($jefa, 1000, 'efectivo', $this->hoy());

        $super = User::factory()->create(['rol' => 'admin', 'sucursal_id' => null]);
        $this->actingAs($super)
            ->get(route('admin.dashboard', ['periodo' => 'dia']))
            ->assertInertia(fn (Assert $page) => $page
                ->where('resumen_total.efectivo_un_dia', true)
                ->where('resumen_total.efectivo_por_sucursal.0.sucursal', 'Cochabamba')
                ->where('resumen_total.efectivo_por_sucursal.0.apertura', 200)
                ->where('resumen_total.efectivo_por_sucursal.0.efectivo', 1200)
                ->where('resumen_total.efectivo_por_sucursal.1.apertura', null)
                ->where('resumen_total.efectivo_en_caja', 1200));
    }
}

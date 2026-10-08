<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\ConfiguracionNegocio;
use App\Models\Egreso;
use App\Models\ProductoGeneral;
use App\Models\ServicioTecnico;
use App\Models\Sucursal;
use App\Models\Tecnico;
use App\Models\User;
use App\Models\Venta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Lo que el taller pidió: carnet en la nota, cláusula, caja, stock usado en reparaciones y
 * talleres externos que facturan después.
 */
class TallerTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function accesorio(float $costo = 40, float $venta = 120): ProductoGeneral
    {
        return ProductoGeneral::create([
            'codigo' => 'CUBO' . fake()->unique()->numberBetween(1, 9999), 'tipo' => 'cargador_20w',
            'nombre' => 'Cubo 20W', 'procedencia' => 'China',
            'precio_costo' => $costo, 'precio_venta' => $venta, 'estado' => 'disponible',
        ]);
    }

    private function servicio(User $quien, Tecnico $tecnico, array $trabajos, array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($quien)->post(route('admin.servicios.store'), array_merge([
            'cliente' => 'María Rojas', 'equipo' => 'iPhone 12',
            'tecnico_id' => $tecnico->id, 'marca' => 'apple', 'metodo_pago' => 'efectivo', 'fecha' => '2026-10-07',
            'detalle_servicio' => json_encode($trabajos), 'precio_venta' => 0,
        ], $extra));
    }

    /** Un servicio cobrado hoy, para que entre en el Resumen del mes. */
    private function cobradoHoy(User $quien, Tecnico $tecnico, int $cobro, string $pago): \Illuminate\Testing\TestResponse
    {
        return $this->servicio($quien, $tecnico, [['descripcion' => 'Cambio de pantalla', 'costo' => 50, 'precio' => $cobro]], [
            'metodo_pago' => $pago, 'fecha' => now('America/La_Paz')->toDateString(),
        ]);
    }

    // ─── El producto disponible se usa en la reparación, no se vende ─────────

    public function test_un_producto_del_stock_usado_en_una_reparacion_no_es_una_venta(): void
    {
        $admin = $this->admin();
        $cubo = $this->accesorio(40, 120);

        $this->servicio($admin, $this->tecnicoDePrueba(), [
            ['tipo' => 'producto_general', 'producto_id' => $cubo->id, 'descripcion' => 'Cargador de reemplazo', 'precio' => 150],
        ])->assertRedirect(route('admin.servicios.index'));

        // Salió del stock con su propio estado: ni disponible ni vendido
        $this->assertSame('servicio', $cubo->refresh()->estado);
        $this->assertSame(0, Venta::count());

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertFalse($servicio->costo_pendiente);
        // El costo del servicio es lo que costó el accesorio, no lo que se cobraba por él
        $this->assertSame(40.0, (float) $servicio->precio_costo);
        $this->assertSame(150.0, (float) $servicio->precio_venta);
        $this->assertSame($cubo->id, $servicio->trabajos()[0]['producto_id']);
    }

    public function test_no_se_puede_usar_en_una_reparacion_algo_que_ya_salio(): void
    {
        $cubo = $this->accesorio();
        $cubo->update(['estado' => 'vendido']);

        $this->servicio($this->admin(), $this->tecnicoDePrueba(), [
            ['tipo' => 'producto_general', 'producto_id' => $cubo->id, 'descripcion' => 'Cargador', 'precio' => 150],
        ])->assertSessionHasErrors('detalle_servicio');

        $this->assertSame(0, ServicioTecnico::count());
    }

    // ─── Otro taller se lleva el equipo ─────────────────────────────────────

    public function test_un_taller_externo_deja_el_costo_pendiente_y_no_cobra_comision(): void
    {
        $externo = Tecnico::create([
            'nombre' => 'Juan', 'empresa' => 'TecnoFix', 'especialidad' => Tecnico::AMBAS,
            'externo' => true, 'comision' => 0,
        ]);

        // El administrador manda el costo igual: no se guarda, porque todavía no lo facturaron
        $this->servicio($this->admin(), $externo, [
            ['descripcion' => 'Cambio de placa', 'costo' => 500, 'precio' => 1200],
        ])->assertRedirect(route('admin.servicios.index'));

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertTrue($servicio->costo_pendiente);
        $this->assertSame(0, $servicio->comision_porcentaje);
        $this->assertNull($servicio->comisionDelTecnico());
        $this->assertSame('Juan · TecnoFix', $externo->quien_es);
    }

    // ─── Pagarle al técnico sale de la caja ─────────────────────────────────

    public function test_pagar_la_semana_deja_el_egreso_en_la_caja(): void
    {
        $admin = $this->admin();
        $axel = $this->tecnicoDePrueba('Axel', Tecnico::APPLE, 60);

        $this->servicio($admin, $axel, [
            ['descripcion' => 'Cambio de pantalla', 'costo' => 180, 'precio' => 700],
        ]);

        $this->actingAs($admin)
            ->post(route('admin.tecnicos.liquidar', $axel), ['semana' => '2026-10-07'])
            ->assertSessionHas('success');

        $egreso = Egreso::firstOrFail();
        $this->assertSame(312.0, (float) $egreso->precio_invertido);
        $this->assertSame('sueldos', $egreso->tipo_gasto);
        $this->assertStringContainsString('Axel', $egreso->concepto);
        $this->assertSame($egreso->id, \App\Models\Liquidacion::firstOrFail()->egreso_id);
    }

    // ─── El Resumen ─────────────────────────────────────────────────────────

    public function test_el_resumen_muestra_los_egresos_y_el_efectivo_en_caja(): void
    {
        $admin = $this->admin();

        $celular = Celular::create([
            'modelo' => 'iPhone 13', 'capacidad' => '128GB', 'color' => 'Negro', 'estado_imei' => 'libre',
            'imei_1' => '350000000000001', 'procedencia' => 'EE. UU.',
            'precio_costo' => 4000, 'precio_venta' => 5000, 'estado' => 'disponible', 'condicion' => 'Nuevo',
        ]);

        $this->actingAs($admin)->postJson(route('admin.ventas.store'), [
            'nombre_cliente' => 'Carlos', 'tipo_venta' => 'producto', 'es_permuta' => false,
            'metodo_pago' => 'efectivo', 'documento_cliente' => '7654321 CB',
            'items' => [['tipo' => 'celular', 'producto_id' => $celular->id, 'cantidad' => 1, 'descuento' => 0]],
        ])->assertOk();

        Egreso::create([
            'concepto' => 'Luz', 'precio_invertido' => 300, 'tipo_gasto' => 'servicio_basico', 'user_id' => $admin->id,
        ]);

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Dashboard')
                // El egreso sale en el Resumen: antes se calculaba y no se mostraba en ningún lado
                ->where('resumen_total.egresos_total', 300)
                // 5000 cobrados en efectivo menos los 300 que salieron
                ->where('resumen_total.efectivo_en_caja', 4700));
    }

    // ─── La caja ────────────────────────────────────────────────────────────

    public function test_el_servicio_guarda_como_pago_el_cliente(): void
    {
        $admin = $this->admin();
        $tecnico = $this->tecnicoDePrueba();

        // Sin forma de pago no se registra: darla por efectivo inflaría la caja sin que nadie lo note
        $this->cobradoHoy($admin, $tecnico, 250, '')->assertSessionHasErrors('metodo_pago');
        $this->cobradoHoy($admin, $tecnico, 250, 'cripto')->assertSessionHasErrors('metodo_pago');
        $this->assertSame(0, ServicioTecnico::count());

        $this->cobradoHoy($admin, $tecnico, 250, 'transferencia')->assertSessionHasNoErrors();
        $this->assertSame('transferencia', ServicioTecnico::sole()->metodo_pago);
        $this->assertSame('Transferencia', ServicioTecnico::sole()->metodoPagoTexto());
    }

    public function test_en_la_caja_solo_entra_lo_cobrado_en_efectivo(): void
    {
        $admin = $this->admin();
        $tecnico = $this->tecnicoDePrueba();

        $this->cobradoHoy($admin, $tecnico, 250, 'efectivo');
        $this->cobradoHoy($admin, $tecnico, 200, 'qr');
        $this->cobradoHoy($admin, $tecnico, 120, 'tarjeta');
        $this->cobradoHoy($admin, $tecnico, 90, 'transferencia');

        $this->actingAs($admin)
            ->get(route('admin.dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                // Antes contaba los cuatro como efectivo: 660. En el cajón quedaron 250.
                ->where('resumen_total.efectivo_en_caja', 250));
    }

    public function test_la_caja_se_ve_por_sucursal(): void
    {
        $cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $sucre      = Sucursal::where('prefijo', 'SUC')->firstOrFail();

        $jefes = [];
        foreach ([[$cochabamba, 300], [$sucre, 500]] as [$sucursal, $cobro]) {
            $jefes[$sucursal->id] = User::factory()->create(['rol' => 'admin', 'sucursal_id' => $sucursal->id]);
            $tecnico = Tecnico::create([
                'nombre' => 'Técnico ' . $sucursal->prefijo, 'especialidad' => Tecnico::AMBAS,
                'comision' => 60, 'activo' => true, 'sucursal_id' => $sucursal->id,
            ]);
            $this->cobradoHoy($jefes[$sucursal->id], $tecnico, $cobro, 'efectivo')->assertSessionHasNoErrors();
        }

        // Un gasto que salió del cajón de Sucre no le resta a Cochabamba
        Egreso::create([
            'concepto' => 'Almuerzo', 'precio_invertido' => 80, 'tipo_gasto' => 'servicio_basico',
            'user_id' => $jefes[$sucre->id]->id, 'sucursal_id' => $sucre->id,
        ]);

        // El super administrador mirando todas: el total y lo que quedó en cada una
        $super = User::factory()->create(['rol' => 'admin', 'sucursal_id' => null]);
        $this->actingAs($super)
            ->get(route('admin.dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('resumen_total.efectivo_en_caja', 720)
                ->where('resumen_total.efectivo_por_sucursal.0.sucursal', 'Cochabamba')
                ->where('resumen_total.efectivo_por_sucursal.0.efectivo', 300)
                ->where('resumen_total.efectivo_por_sucursal.1.sucursal', 'Sucre')
                ->where('resumen_total.efectivo_por_sucursal.1.efectivo', 420));

        // El de Sucre ve solo su cajón
        $this->actingAs($jefes[$sucre->id])
            ->get(route('admin.dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('resumen_total.efectivo_en_caja', 420)
                ->has('resumen_total.efectivo_por_sucursal', 1)
                ->where('resumen_total.efectivo_por_sucursal.0.efectivo', 420));
    }

    // ─── La nota ────────────────────────────────────────────────────────────

    public function test_el_carnet_queda_en_la_venta_y_en_el_cliente(): void
    {
        $admin = $this->admin();
        $celular = Celular::create([
            'modelo' => 'iPhone 13', 'capacidad' => '128GB', 'color' => 'Negro', 'estado_imei' => 'libre',
            'imei_1' => '350000000000002', 'procedencia' => 'EE. UU.',
            'precio_costo' => 4000, 'precio_venta' => 5000, 'estado' => 'disponible', 'condicion' => 'Nuevo',
        ]);

        $this->actingAs($admin)->postJson(route('admin.ventas.store'), [
            'nombre_cliente' => 'Carlos Terrazas', 'telefono_cliente' => '70000000',
            'documento_cliente' => '7654321 CB', 'tipo_venta' => 'producto', 'es_permuta' => false,
            'metodo_pago' => 'efectivo',
            'items' => [['tipo' => 'celular', 'producto_id' => $celular->id, 'cantidad' => 1, 'descuento' => 0]],
        ])->assertOk();

        $venta = Venta::firstOrFail();
        $this->assertSame('7654321 CB', $venta->documento_cliente);
        $this->assertDatabaseHas('clientes', ['telefono' => '70000000', 'documento' => '7654321 CB']);

        $html = view('pdf.boleta', [
            'venta' => $venta->load('items', 'vendedor'),
            'sumaSubtotalItems' => 5000, 'valorPermuta' => 0, 'montoReserva' => 0, 'totalAPagar' => 5000,
            'negocio' => ConfiguracionNegocio::paraPdf(),
        ])->render();

        $this->assertStringContainsString('7654321 CB', $html);
    }

    public function test_la_clausula_sale_en_las_dos_notas_de_servicio(): void
    {
        ConfiguracionNegocio::guardar(['servicio_clausula' => 'Pasados 30 días el equipo no se reclama.']);

        $this->servicio($this->admin(), $this->tecnicoDePrueba(), [
            ['descripcion' => 'Cambio de batería', 'costo' => 100, 'precio' => 250],
        ]);

        $servicio = ServicioTecnico::firstOrFail();

        foreach (['pdf.boleta_servicio', 'pdf.recibo_servicio_80mm'] as $vista) {
            $html = view($vista, [
                'servicio' => $servicio,
                'servicios_cliente' => $servicio->trabajos(),
                'negocio' => ConfiguracionNegocio::paraPdf(),
            ])->render();

            $this->assertStringContainsString('Pasados 30 días el equipo no se reclama.', $html);
        }
    }
}

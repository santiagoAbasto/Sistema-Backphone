<?php

namespace Tests\Feature;

use App\Models\MovimientoPieza;
use App\Models\MovimientoProductoGeneral;
use App\Models\ProductoGeneral;
use App\Models\ServicioTecnico;
use App\Models\Sucursal;
use App\Models\Traspaso;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Los productos generales van por cantidad: se cargan con cuántos llegaron, el sistema les pone el
 * código y cada venta, reparación o traspaso descuenta del saldo dejando su renglón. Lo que importa
 * es que el saldo nunca mienta: que no baje de cero, que cada unidad que se mueve quede anotada y
 * que un conteo explique la diferencia sin pisar lo que se vendió mientras tanto.
 */
class ProductosGeneralesPorCantidadTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function vidrio(array $datos = []): ProductoGeneral
    {
        return ProductoGeneral::create(array_merge([
            'codigo'       => fake()->unique()->bothify('VID-####'),
            'tipo'         => 'vidrio_templado',
            'nombre'       => 'Vidrio templado 9D',
            'modelo'       => 'iPhone 13',
            'calidad'      => 'Premium',
            'cantidad'     => 10,
            'procedencia'  => 'CHINA',
            'precio_costo' => 3,
            'precio_venta' => 20,
            'estado'       => 'disponible',
        ], $datos));
    }

    private function vidrioEn(Sucursal $sucursal, array $datos = []): ProductoGeneral
    {
        return ProductoGeneral::withoutGlobalScope('sucursal')->create(array_merge([
            'sucursal_id' => $sucursal->id, 'codigo' => fake()->unique()->bothify('VID-####'), 'tipo' => 'vidrio_templado',
            'nombre' => 'Vidrio templado 9D', 'modelo' => 'iPhone 13', 'calidad' => 'Premium', 'cantidad' => 10,
            'procedencia' => 'CHINA', 'precio_costo' => 3, 'precio_venta' => 20, 'estado' => 'disponible',
        ], $datos));
    }

    private function venta(User $quien, ProductoGeneral $producto, int $cantidad): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($quien)->postJson(route($quien->rol === 'admin' ? 'admin.ventas.store' : 'vendedor.ventas.store'), [
            'nombre_cliente' => 'María Rojas', 'telefono_cliente' => '70000000', 'tipo_venta' => 'producto',
            'es_permuta' => false, 'metodo_pago' => 'efectivo',
            'items' => [['tipo' => 'producto_general', 'producto_id' => $producto->id, 'cantidad' => $cantidad, 'descuento' => 0]],
        ]);
    }

    // ─── Carga ───────────────────────────────────────────────────────────────

    public function test_se_carga_con_su_cantidad_y_el_sistema_le_pone_el_codigo(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.productos-generales.store'), [
                'tipo' => 'vidrio_templado', 'nombre' => 'Vidrio templado 9D', 'modelo' => ' iPhone 13 ', 'calidad' => 'Premium',
                'cantidad' => 500, 'procedencia' => 'CHINA', 'precio_costo' => 3, 'precio_venta' => 20, 'condicion' => 'Nuevo',
            ])
            ->assertRedirect(route('admin.productos-generales.index'))
            ->assertSessionHas('success', fn ($m) => str_contains($m, '500 unidades') && str_contains($m, 'VT-'));

        $vidrio = ProductoGeneral::sole();
        $this->assertSame('VT-' . str_pad((string) $vidrio->id, 5, '0', STR_PAD_LEFT), $vidrio->codigo);
        $this->assertSame(500, $vidrio->cantidad);
        $this->assertSame('iPhone 13', $vidrio->modelo);
        $this->assertSame('disponible', $vidrio->estado);

        // El historial arranca con la carga: el saldo se puede explicar desde la primera unidad
        $alta = MovimientoProductoGeneral::sole();
        $this->assertSame(MovimientoPieza::ALTA, $alta->tipo);
        $this->assertSame(500, $alta->cantidad);
        $this->assertSame(500, $alta->saldo);
        $this->assertSame('CHINA', $alta->motivo);
    }

    public function test_el_codigo_automatico_no_pisa_uno_escrito_a_mano(): void
    {
        // Alguien ya usó a mano el código que le tocaría al próximo registro
        $this->vidrio(['codigo' => 'VT-00002']);

        $this->actingAs($this->admin())->post(route('admin.productos-generales.store'), [
            'tipo' => 'vidrio_templado', 'nombre' => 'Vidrio de privacidad', 'cantidad' => 40, 'procedencia' => 'CHINA',
            'precio_costo' => 5, 'precio_venta' => 35, 'condicion' => 'Nuevo',
        ])->assertSessionHasNoErrors();

        $this->assertSame('VT-00002B', ProductoGeneral::where('nombre', 'Vidrio de privacidad')->value('codigo'));
    }

    public function test_cargar_pide_al_menos_una_unidad(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.productos-generales.store'), [
                'tipo' => 'funda', 'nombre' => 'Funda', 'cantidad' => 0, 'procedencia' => 'CHINA',
                'precio_costo' => 5, 'precio_venta' => 35, 'condicion' => 'Nuevo',
            ])
            ->assertSessionHasErrors(['cantidad' => 'Tiene que entrar al menos una unidad.']);

        $this->assertSame(0, ProductoGeneral::count());
    }

    public function test_editar_la_ficha_no_mueve_el_saldo(): void
    {
        $vidrio = $this->vidrio();

        $this->actingAs($this->admin())->put(route('admin.productos-generales.update', $vidrio), [
            'codigo' => $vidrio->codigo, 'tipo' => 'vidrio_templado', 'nombre' => 'Vidrio templado 9D', 'modelo' => 'iPhone 13 Pro',
            'calidad' => 'Premium', 'cantidad' => 999, 'procedencia' => 'CHINA', 'precio_costo' => 3, 'precio_venta' => 25,
            'condicion' => 'Nuevo',
        ])->assertSessionHasNoErrors();

        $vidrio->refresh();
        $this->assertSame(10, $vidrio->cantidad);
        $this->assertSame('iPhone 13 Pro', $vidrio->modelo);
        $this->assertSame(0, MovimientoProductoGeneral::count());
    }

    // ─── Venta ───────────────────────────────────────────────────────────────

    public function test_vender_descuenta_del_saldo_y_al_agotarse_ya_no_se_ofrece(): void
    {
        $admin = $this->admin();
        $vidrio = $this->vidrio(['cantidad' => 5]);

        $this->venta($admin, $vidrio, 3)->assertOk();

        $this->assertSame(2, $vidrio->refresh()->cantidad);
        $item = VentaItem::sole();
        $this->assertSame(3, $item->cantidad);
        $this->assertSame(60.0, (float) $item->subtotal);
        $this->assertSame(9.0, (float) $item->precio_invertido);
        // La nota dice cuál vidrio se llevó, aunque mañana se corrija la ficha
        $this->assertSame('Vidrio templado 9D', $item->nombre_producto);
        $this->assertSame('iPhone 13 · Premium', $item->modelo);

        $venta = MovimientoProductoGeneral::where('tipo', MovimientoPieza::VENTA)->sole();
        $this->assertSame(-3, $venta->cantidad);
        $this->assertSame(2, $venta->saldo);
        $this->assertSame(Venta::sole()->id, (int) $venta->referencia_id);

        // No se vende más de lo que queda, y nada se toca
        $this->venta($admin, $vidrio, 3)->assertStatus(422)->assertJsonValidationErrors(['items.0.cantidad']);
        $this->assertSame(2, $vidrio->refresh()->cantidad);

        // Agotado: queda como vendido y desaparece de lo que se ofrece al vender
        $this->venta($admin, $vidrio, 2)->assertOk();
        $this->assertSame(0, $vidrio->refresh()->cantidad);
        $this->assertSame('vendido', $vidrio->estado);
        $this->actingAs($admin)->getJson(route('api.stock.productos_generales'))->assertExactJson([]);

        // Entra mercadería y vuelve a estar a la venta
        $this->actingAs($admin)
            ->post(route('admin.productos-generales.stock', $vidrio), ['accion' => 'ingreso', 'cantidad' => 50, 'motivo' => 'Pedido de octubre'])
            ->assertSessionHas('success');
        $this->assertSame(50, $vidrio->refresh()->cantidad);
        $this->assertSame('disponible', $vidrio->estado);
    }

    public function test_editar_la_venta_devuelve_lo_que_se_saco_de_mas(): void
    {
        $admin = $this->admin();
        $vidrio = $this->vidrio();
        $this->venta($admin, $vidrio, 4)->assertOk();
        $item = VentaItem::sole();

        $this->actingAs($admin)->put(route('admin.ventas.update', Venta::sole()), [
            'nombre_cliente' => 'María Rojas', 'metodo_pago' => 'efectivo',
            'items' => [[
                'id' => $item->id, 'tipo' => 'producto_general', 'producto_id' => $vidrio->id,
                'cantidad' => 1, 'precio_venta' => 20, 'precio_invertido' => 0, 'descuento' => 0,
            ]],
        ])->assertSessionHasNoErrors();

        $this->assertSame(9, $vidrio->refresh()->cantidad);
        $this->assertSame(1, $item->refresh()->cantidad);
        // El costo lo pone el inventario, no lo que mande el navegador
        $this->assertSame(3.0, (float) $item->precio_invertido);
        $this->assertDatabaseHas('movimientos_producto_general', ['tipo' => 'devolucion', 'cantidad' => 3, 'saldo' => 9]);
    }

    public function test_lo_que_llego_en_permuta_no_se_vende_hasta_habilitarlo(): void
    {
        $admin = $this->admin();
        $funda = $this->vidrio(['tipo' => 'permuta', 'estado' => 'permuta', 'cantidad' => 1]);

        $this->venta($admin, $funda, 1)->assertStatus(422)->assertJsonValidationErrors(['items.0.producto_id']);
        $this->assertSame(1, $funda->refresh()->cantidad);

        $this->actingAs($admin)->patch(route('admin.productos-generales.habilitar', $funda))->assertSessionHas('success');
        $this->venta($admin, $funda, 1)->assertOk();
        $this->assertSame('vendido', $funda->refresh()->estado);
    }

    public function test_los_productos_generales_ya_no_se_reservan(): void
    {
        $this->actingAs($this->admin())
            ->postJson(route('admin.reservas.store'), [
                'nombre_cliente' => 'Ana', 'monto_reserva' => 10, 'metodo_pago' => 'efectivo',
                'items' => [['tipo' => 'producto_general', 'producto_id' => $this->vidrio()->id, 'cantidad' => 1]],
            ])
            ->assertJsonValidationErrors('items.0.tipo');
    }

    public function test_al_vendedor_le_llega_el_saldo_pero_nunca_el_costo(): void
    {
        $this->vidrio(['cantidad' => 7]);
        $vendedora = User::factory()->create(['rol' => 'vendedor']);

        $fila = $this->actingAs($vendedora)->getJson(route('api.stock.productos_generales'))->assertOk()->json('0');

        $this->assertSame(7, $fila['cantidad']);
        $this->assertSame('iPhone 13', $fila['modelo']);
        $this->assertArrayNotHasKey('precio_costo', $fila);
        $this->assertArrayNotHasKey('procedencia', $fila);
    }

    // ─── Reparación y traspaso ───────────────────────────────────────────────

    public function test_una_reparacion_usa_unidades_del_saldo(): void
    {
        $vidrio = $this->vidrio();

        $this->actingAs($this->admin())->post(route('admin.servicios.store'), [
            'cliente' => 'María Rojas', 'equipo' => 'iPhone 13', 'tecnico_id' => $this->tecnicoDePrueba()->id,
            'marca' => 'apple', 'metodo_pago' => 'efectivo', 'fecha' => '2026-10-18', 'precio_venta' => 0,
            'detalle_servicio' => json_encode([
                ['tipo' => 'producto_general', 'producto_id' => $vidrio->id, 'cantidad' => 2, 'descripcion' => 'Vidrio delantero y trasero', 'precio' => 50],
            ]),
        ])->assertRedirect(route('admin.servicios.index'));

        $this->assertSame(8, $vidrio->refresh()->cantidad);
        $this->assertSame(0, Venta::count());
        // El costo de la reparación es lo que costaron los dos vidrios
        $this->assertSame(6.0, (float) ServicioTecnico::sole()->precio_costo);
        $this->assertDatabaseHas('movimientos_producto_general', ['tipo' => 'servicio', 'cantidad' => -2, 'saldo' => 8]);
    }

    public function test_el_traspaso_manda_parte_del_saldo_y_suma_en_el_mismo_producto_del_destino(): void
    {
        $cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $sucre = Sucursal::where('prefijo', 'SUC')->firstOrFail();
        $super = User::factory()->create(['rol' => 'admin', 'sucursal_id' => null]);
        $origen  = $this->vidrioEn($cochabamba, ['codigo' => 'CBA-VT', 'cantidad' => 500]);
        $destino = $this->vidrioEn($sucre, ['codigo' => 'SUC-VT', 'cantidad' => 20]);
        $otro    = $this->vidrioEn($cochabamba, ['codigo' => 'CBA-VT14', 'modelo' => 'iPhone 14', 'cantidad' => 80]);

        $this->actingAs($super)->post(route('admin.traspasos.store'), [
            'origen_sucursal_id' => $cochabamba->id, 'destino_sucursal_id' => $sucre->id,
            'items' => [
                ['tipo' => 'producto_general', 'producto_id' => $origen->id, 'cantidad' => 100],
                ['tipo' => 'producto_general', 'producto_id' => $otro->id, 'cantidad' => 30],
            ],
        ])->assertSessionHasNoErrors();

        // En el camino no se vende en ninguna de las dos
        $this->assertSame(400, $origen->refresh()->cantidad);
        $this->assertSame(50, $otro->refresh()->cantidad);

        $this->actingAs(User::factory()->create(['rol' => 'admin', 'sucursal_id' => $sucre->id]))
            ->post(route('admin.traspasos.recibir', Traspaso::sole()))
            ->assertSessionHas('success');

        // El que ya tenían suma; el que no tenían se abre con su ficha y un código propio
        $this->assertSame(120, $destino->refresh()->cantidad);
        $nuevo = ProductoGeneral::withoutGlobalScope('sucursal')->where('sucursal_id', $sucre->id)->where('modelo', 'iPhone 14')->sole();
        $this->assertSame(30, $nuevo->cantidad);
        $this->assertSame('disponible', $nuevo->estado);
        $this->assertStringStartsWith('VT-', $nuevo->codigo);
        $this->assertSame(20.0, (float) $nuevo->precio_venta);
    }

    public function test_cancelar_el_traspaso_devuelve_las_unidades_al_origen(): void
    {
        $cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $super = User::factory()->create(['rol' => 'admin', 'sucursal_id' => null]);
        $vidrio = $this->vidrioEn($cochabamba, ['cantidad' => 60]);

        $this->actingAs($super)->post(route('admin.traspasos.store'), [
            'origen_sucursal_id' => $cochabamba->id,
            'destino_sucursal_id' => Sucursal::where('prefijo', 'SUC')->value('id'),
            'items' => [['tipo' => 'producto_general', 'producto_id' => $vidrio->id, 'cantidad' => 60]],
        ])->assertSessionHasNoErrors();
        $this->assertSame('vendido', $vidrio->refresh()->estado); // los 60 van en la caja

        $this->actingAs($super)->post(route('admin.traspasos.cancelar', Traspaso::sole()))->assertSessionHas('success');

        $vidrio->refresh();
        $this->assertSame(60, $vidrio->cantidad);
        $this->assertSame('disponible', $vidrio->estado);
    }

    // ─── Conteo ──────────────────────────────────────────────────────────────

    public function test_el_conteo_anota_las_diferencias_y_no_pisa_lo_que_se_vendio_mientras_tanto(): void
    {
        $admin = $this->admin();
        $faltan = $this->vidrio(['cantidad' => 10]);
        $justo = $this->vidrio(['cantidad' => 5, 'modelo' => 'iPhone 14']);
        $cambio = $this->vidrio(['cantidad' => 7, 'modelo' => 'iPhone 15']); // se vendieron 2 mientras se contaba

        $this->actingAs($admin)->post(route('admin.productos-generales.conteo.guardar'), [
            'nota' => 'fin de mes',
            'conteos' => [
                ['id' => $faltan->id, 'contado' => 8, 'esperado' => 10],
                ['id' => $justo->id, 'contado' => 5, 'esperado' => 5],
                ['id' => $cambio->id, 'contado' => 9, 'esperado' => 9],
            ],
        ])
            ->assertRedirect(route('admin.productos-generales.conteo'))
            ->assertSessionHas('success', fn ($m) => str_contains($m, 'faltan 2'))
            ->assertSessionHas('error', fn ($m) => str_contains($m, 'iPhone 15'));

        $this->assertSame(8, $faltan->refresh()->cantidad);
        $this->assertSame(5, $justo->refresh()->cantidad);
        $this->assertSame(7, $cambio->refresh()->cantidad);

        // Solo la diferencia real queda anotada, con quién la encontró y por qué
        $ajuste = MovimientoProductoGeneral::sole();
        $this->assertSame($faltan->id, $ajuste->producto_general_id);
        $this->assertSame(MovimientoPieza::AJUSTE, $ajuste->tipo);
        $this->assertSame(-2, $ajuste->cantidad);
        $this->assertSame($admin->id, $ajuste->user_id);
        $this->assertStringStartsWith('Conteo físico del ', $ajuste->motivo);
        $this->assertStringEndsWith('· fin de mes', $ajuste->motivo);
    }

    public function test_la_planilla_de_conteo_trae_el_inventario_sin_lo_de_permuta(): void
    {
        $this->vidrio();
        $this->vidrio(['cantidad' => 0, 'estado' => 'vendido']);
        $this->vidrio(['tipo' => 'permuta', 'estado' => 'permuta', 'cantidad' => 1]);

        $this->actingAs($this->admin())
            ->get(route('admin.productos-generales.conteo'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ProductosGenerales/Conteo')
                ->has('productos', 2)
                ->has('ultimos', 0));
    }

    public function test_el_vendedor_no_cuenta_ni_mueve_el_saldo(): void
    {
        $vidrio = $this->vidrio();
        $vendedora = User::factory()->create(['rol' => 'vendedor']);

        $this->actingAs($vendedora)->post(route('admin.productos-generales.stock', $vidrio), ['accion' => 'ingreso', 'cantidad' => 50])->assertForbidden();
        $this->actingAs($vendedora)->post(route('admin.productos-generales.conteo.guardar'), [
            'conteos' => [['id' => $vidrio->id, 'contado' => 0, 'esperado' => 10]],
        ])->assertForbidden();

        $this->assertSame(10, $vidrio->refresh()->cantidad);
    }
}

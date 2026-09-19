<?php

namespace Tests\Feature;

use App\Models\MovimientoPieza;
use App\Models\Pieza;
use App\Models\ServicioTecnico;
use App\Models\Sucursal;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Inventario de piezas y repuestos.
 *
 * Es el único inventario que se lleva por cantidad, así que lo que se prueba acá es lo que hace
 * distinto a un saldo de una fila por unidad: que nunca quede en negativo, que cada unidad que
 * entra o sale deje su renglón, y que el costo de una pieza lo ponga siempre el servidor.
 */
class PiezasTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function vendedor(): User
    {
        return User::factory()->create(['rol' => 'vendedor', 'name' => 'Vendedora']);
    }

    private function pieza(array $datos = []): Pieza
    {
        return Pieza::create(array_merge([
            'nombre'         => 'Pantalla incell',
            'categoria'      => 'Pantalla',
            'compatibilidad' => 'iPhone 11',
            'cantidad'       => 6,
            'precio_costo'   => 180,
            'precio_venta'   => 420,
        ], $datos));
    }

    private function ventaDe(User $usuario, Pieza $pieza, int $cantidad): \Illuminate\Testing\TestResponse
    {
        $ruta = $usuario->rol === 'admin' ? 'admin.ventas.store' : 'vendedor.ventas.store';

        return $this->actingAs($usuario)->postJson(route($ruta), [
            'nombre_cliente'   => 'María Rojas',
            'telefono_cliente' => '70000000',
            'tipo_venta'       => 'producto',
            'es_permuta'       => false,
            'metodo_pago'      => 'efectivo',
            'items'            => [
                ['tipo' => 'pieza', 'producto_id' => $pieza->id, 'cantidad' => $cantidad, 'descuento' => 0],
            ],
        ]);
    }

    private function servicio(User $usuario, array $trabajos, array $extra = []): \Illuminate\Testing\TestResponse
    {
        $ruta = $usuario->rol === 'admin' ? 'admin.servicios.store' : 'vendedor.servicios.store';

        return $this->actingAs($usuario)->post(route($ruta), array_merge([
            'cliente'          => 'María Rojas',
            'telefono'         => '70000000',
            'equipo'           => 'iPhone 11',
            'tecnico'          => 'Taller',
            'fecha'            => '2026-09-19',
            'detalle_servicio' => json_encode($trabajos),
            'precio_venta'     => 0,
        ], $extra));
    }

    // ─── Alta y edición ──────────────────────────────────────────────────────

    public function test_al_cargar_una_pieza_queda_anotado_de_donde_salio(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.piezas.store'), [
                'nombre'         => 'Pin de carga',
                'categoria'      => 'Pin de carga',
                'compatibilidad' => 'iPhone 12',
                'cantidad'       => 4,
                'precio_costo'   => 35,
                'precio_venta'   => 90,
                'origen'         => 'Despiece iPhone 12',
                'minimo'         => 2,
            ])
            ->assertRedirect(route('admin.piezas.index'));

        $pieza = Pieza::firstOrFail();
        $this->assertSame(4, $pieza->cantidad);

        $movimiento = MovimientoPieza::firstOrFail();
        $this->assertSame(MovimientoPieza::ALTA, $movimiento->tipo);
        $this->assertSame(4, $movimiento->cantidad);
        $this->assertSame(4, $movimiento->saldo);
        $this->assertSame('Despiece iPhone 12', $movimiento->motivo);
    }

    public function test_editar_la_ficha_no_mueve_el_saldo(): void
    {
        $pieza = $this->pieza();

        $this->actingAs($this->admin())
            ->put(route('admin.piezas.update', $pieza), [
                'nombre'       => 'Pantalla incell (nueva tanda)',
                'cantidad'     => 999, // se ignora a propósito: el saldo no se edita acá
                'precio_costo' => 200,
                'precio_venta' => 450,
            ])
            ->assertRedirect(route('admin.piezas.index'));

        $pieza->refresh();
        $this->assertSame('Pantalla incell (nueva tanda)', $pieza->nombre);
        $this->assertSame(6, $pieza->cantidad);
        $this->assertSame(450.0, (float) $pieza->precio_venta);
        $this->assertSame(0, MovimientoPieza::count());
    }

    public function test_ingresar_suma_y_ajustar_deja_el_saldo_contado(): void
    {
        $pieza = $this->pieza(['cantidad' => 2]);
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post(route('admin.piezas.stock', $pieza), ['accion' => 'ingreso', 'cantidad' => 5, 'motivo' => 'Llegó el pedido'])
            ->assertRedirect();
        $this->assertSame(7, $pieza->refresh()->cantidad);

        $this->actingAs($admin)
            ->post(route('admin.piezas.stock', $pieza), ['accion' => 'ajuste', 'cantidad' => 4, 'motivo' => 'Conteo físico'])
            ->assertRedirect();
        $this->assertSame(4, $pieza->refresh()->cantidad);

        $ajuste = MovimientoPieza::where('tipo', MovimientoPieza::AJUSTE)->firstOrFail();
        // El ajuste guarda la diferencia, que es lo que después hay que poder explicar
        $this->assertSame(-3, $ajuste->cantidad);
        $this->assertSame(4, $ajuste->saldo);
        $this->assertSame($admin->id, $ajuste->user_id);
    }

    public function test_un_ajuste_que_no_cambia_nada_no_ensucia_el_historial(): void
    {
        $pieza = $this->pieza(['cantidad' => 3]);

        $this->actingAs($this->admin())
            ->post(route('admin.piezas.stock', $pieza), ['accion' => 'ajuste', 'cantidad' => 3]);

        $this->assertSame(3, $pieza->refresh()->cantidad);
        $this->assertSame(0, MovimientoPieza::count());
    }

    // ─── Venta ───────────────────────────────────────────────────────────────

    public function test_vender_piezas_descuenta_el_saldo_y_deja_el_movimiento(): void
    {
        $pieza = $this->pieza();

        $this->ventaDe($this->admin(), $pieza, 2)->assertOk();

        $this->assertSame(4, $pieza->refresh()->cantidad);

        $venta = Venta::firstOrFail();
        $item = VentaItem::firstOrFail();
        $this->assertSame('pieza', $item->tipo);
        $this->assertSame(2, $item->cantidad);
        $this->assertSame(840.0, (float) $item->subtotal);
        // El costo lo vuelve a calcular el servidor desde la ficha de la pieza
        $this->assertSame(360.0, (float) $item->precio_invertido);
        // El nombre queda copiado en la venta: la nota no cambia si mañana se corrige la ficha
        $this->assertSame('Pantalla incell', $item->nombre_producto);

        $movimiento = MovimientoPieza::where('tipo', MovimientoPieza::VENTA)->firstOrFail();
        $this->assertSame(-2, $movimiento->cantidad);
        $this->assertSame(4, $movimiento->saldo);
        $this->assertSame('Venta', $movimiento->referencia_tipo);
        $this->assertSame($venta->id, (int) $movimiento->referencia_id);
    }

    public function test_no_se_puede_vender_mas_de_lo_que_queda(): void
    {
        $pieza = $this->pieza(['cantidad' => 2]);

        $this->ventaDe($this->admin(), $pieza, 3)
            ->assertStatus(422)
            ->assertJsonValidationErrors(['items.0.cantidad']);

        // Ni la venta ni el saldo se tocaron
        $this->assertSame(2, $pieza->refresh()->cantidad);
        $this->assertSame(0, Venta::count());
        $this->assertSame(0, MovimientoPieza::count());
    }

    public function test_una_pieza_que_ya_salio_no_se_borra(): void
    {
        $pieza = $this->pieza();
        $admin = $this->admin();
        $this->ventaDe($admin, $pieza, 1);

        $this->actingAs($admin)
            ->delete(route('admin.piezas.destroy', $pieza))
            ->assertSessionHas('error');

        $this->assertNotNull($pieza->fresh());
    }

    // ─── Servicio técnico ────────────────────────────────────────────────────

    public function test_una_pieza_usada_en_un_servicio_sale_del_stock_con_su_costo_real(): void
    {
        $pieza = $this->pieza();

        $this->servicio($this->admin(), [
            ['pieza_id' => $pieza->id, 'cantidad' => 2, 'descripcion' => 'Cambio de pantalla', 'precio' => 900],
            ['descripcion' => 'Mano de obra', 'costo' => 0, 'precio' => 150],
        ])->assertRedirect(route('admin.servicios.index'));

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertFalse($servicio->costo_pendiente);
        $this->assertSame(360.0, (float) $servicio->precio_costo);
        $this->assertSame(1050.0, (float) $servicio->precio_venta);

        $trabajos = $servicio->trabajos();
        $this->assertSame($pieza->id, $trabajos[0]['pieza_id']);
        $this->assertSame(360.0, (float) $trabajos[0]['costo']);

        $this->assertSame(4, $pieza->refresh()->cantidad);
        $movimiento = MovimientoPieza::where('tipo', MovimientoPieza::SERVICIO)->firstOrFail();
        $this->assertSame(-2, $movimiento->cantidad);
        $this->assertSame('ServicioTecnico', $movimiento->referencia_tipo);
    }

    public function test_el_vendedor_usa_una_pieza_sin_ver_ni_mandar_su_costo(): void
    {
        $pieza = $this->pieza();

        // Manda un costo inventado a propósito: el servidor tiene que ignorarlo
        $this->servicio($this->vendedor(), [
            ['pieza_id' => $pieza->id, 'cantidad' => 1, 'descripcion' => 'Cambio de pantalla', 'costo' => 1, 'precio' => 500],
        ])->assertRedirect(route('vendedor.servicios.index'));

        $servicio = ServicioTecnico::firstOrFail();
        // Todo salió del inventario: el costo ya está y no hay nada que cargar después
        $this->assertFalse($servicio->costo_pendiente);
        $this->assertSame(180.0, (float) $servicio->precio_costo);
        $this->assertSame(5, $pieza->refresh()->cantidad);
    }

    public function test_un_servicio_del_vendedor_con_un_trabajo_a_mano_sigue_esperando_su_costo(): void
    {
        $pieza = $this->pieza();
        $vendedor = $this->vendedor();

        $this->servicio($vendedor, [
            ['pieza_id' => $pieza->id, 'cantidad' => 1, 'descripcion' => 'Cambio de pantalla', 'precio' => 500],
            ['descripcion' => 'Reballing', 'precio' => 200],
        ]);

        $servicio = ServicioTecnico::firstOrFail();
        $this->assertTrue($servicio->costo_pendiente);

        // Al vendedor no le viaja el costo de la pieza ni siquiera dentro del detalle
        $this->actingAs($vendedor)
            ->get(route('vendedor.servicios.index'))
            ->assertInertia(fn (Assert $page) => $page->where('servicios.0.detalle_servicio', fn ($detalle) => ! str_contains($detalle, 'costo')));

        // El administrador solo carga el trabajo escrito a mano; el de la pieza no se pisa
        $this->actingAs($this->admin())
            ->patch(route('admin.servicios.costo', $servicio), ['costos' => ['', 40]])
            ->assertSessionHas('success');

        $servicio->refresh();
        $this->assertFalse($servicio->costo_pendiente);
        $this->assertSame(220.0, (float) $servicio->precio_costo);
        $this->assertSame(180.0, (float) $servicio->trabajos()[0]['costo']);
    }

    public function test_un_servicio_que_pide_mas_piezas_de_las_que_hay_no_se_guarda(): void
    {
        $pieza = $this->pieza(['cantidad' => 2]);

        // Dos renglones de la misma pieza suman: entre los dos se pasan del saldo
        $this->servicio($this->admin(), [
            ['pieza_id' => $pieza->id, 'cantidad' => 1, 'descripcion' => 'Pantalla del cliente', 'precio' => 420],
            ['pieza_id' => $pieza->id, 'cantidad' => 2, 'descripcion' => 'Pantallas de repuesto', 'precio' => 840],
        ])->assertSessionHasErrors('detalle_servicio');

        $this->assertSame(0, ServicioTecnico::count());
        $this->assertSame(2, $pieza->refresh()->cantidad);
    }

    // ─── Lo que ve el vendedor ───────────────────────────────────────────────

    public function test_al_vendedor_le_llega_el_precio_y_el_saldo_pero_nunca_el_costo(): void
    {
        $this->pieza();
        $vendedor = $this->vendedor();

        $this->actingAs($vendedor)
            ->getJson(route('api.stock.piezas'))
            ->assertOk()
            ->assertJsonPath('0.precio_venta', '420.00')
            ->assertJsonPath('0.cantidad', 6)
            ->assertJsonMissingPath('0.precio_costo');

        $this->actingAs($vendedor)
            ->get(route('vendedor.productos.index', ['tipo' => 'piezas']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Productos/Index')
                ->has('productos.data', 1)
                ->where('productos.data.0.nombre', 'Pantalla incell')
                ->missing('productos.data.0.precio_costo'));

        // Y el formulario de servicio técnico tampoco se lo manda
        $this->actingAs($vendedor)
            ->get(route('vendedor.servicios.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->missing('piezas.0.precio_costo'));
    }

    public function test_la_lista_de_ventas_del_vendedor_no_arrastra_el_costo_dentro_del_producto(): void
    {
        $pieza = $this->pieza();
        $vendedor = $this->vendedor();
        $this->ventaDe($vendedor, $pieza, 2);

        // El costo viaja dentro de venta.items.pieza, no en el primer nivel: si se purga solo la
        // superficie, el vendedor termina viendo lo que paga la tienda por cada repuesto.
        $respuesta = $this->actingAs($vendedor)->get(route('vendedor.ventas.index'));
        $respuesta->assertOk();

        $this->assertStringNotContainsString('precio_costo', $respuesta->getContent());
        $this->assertStringNotContainsString('precio_invertido', $respuesta->getContent());
        $this->assertStringNotContainsString('ganancia_neta', $respuesta->getContent());
        // Y lo que sí necesita para trabajar sigue estando
        $respuesta->assertInertia(fn (Assert $page) => $page
            ->component('Vendedor/Ventas/Index')
            ->where('ventas.0.items.0.nombre_producto', 'Pantalla incell')
            ->where('ventas.0.items.0.cantidad', 2));
    }

    public function test_las_piezas_agotadas_o_archivadas_no_se_ofrecen(): void
    {
        $this->pieza(['nombre' => 'Sin stock', 'cantidad' => 0]);
        $this->pieza(['nombre' => 'Archivada', 'activa' => false]);
        $this->pieza(['nombre' => 'A la venta']);

        $this->actingAs($this->admin())
            ->getJson(route('api.stock.piezas'))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.nombre', 'A la venta');
    }

    public function test_el_vendedor_no_administra_el_inventario_de_piezas(): void
    {
        $pieza = $this->pieza();
        $vendedor = $this->vendedor();

        $this->actingAs($vendedor)->get(route('admin.piezas.index'))->assertForbidden();
        $this->actingAs($vendedor)->post(route('admin.piezas.stock', $pieza), ['accion' => 'ingreso', 'cantidad' => 50])->assertForbidden();

        $this->assertSame(6, $pieza->refresh()->cantidad);
    }

    // ─── Sucursales ──────────────────────────────────────────────────────────

    public function test_cada_sucursal_tiene_su_propio_cajon_de_piezas(): void
    {
        $cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $sucre      = Sucursal::where('prefijo', 'SUC')->firstOrFail();

        Pieza::withoutGlobalScope('sucursal')->create([
            'sucursal_id' => $cochabamba->id, 'nombre' => 'Pantalla de Cochabamba',
            'cantidad' => 3, 'precio_costo' => 100, 'precio_venta' => 300,
        ]);
        Pieza::withoutGlobalScope('sucursal')->create([
            'sucursal_id' => $sucre->id, 'nombre' => 'Pantalla de Sucre',
            'cantidad' => 3, 'precio_costo' => 100, 'precio_venta' => 300,
        ]);

        $deSucre = User::factory()->create(['rol' => 'admin', 'sucursal_id' => $sucre->id]);

        $this->actingAs($deSucre)
            ->get(route('admin.piezas.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('piezas.data', 1)
                ->where('piezas.data.0.nombre', 'Pantalla de Sucre')
                ->where('resumen.unidades', 3));
    }
}

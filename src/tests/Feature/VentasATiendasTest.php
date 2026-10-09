<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\Cliente;
use App\Models\Pieza;
use App\Models\Role;
use App\Models\Tienda;
use App\Models\User;
use App\Models\Venta;
use App\Services\EfectivoDeCaja;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Ventas a otras tiendas, a precio mayorista: una venta normal con `tienda_id`, al precio que se
 * ajusta al vender, y solo de lo que tiene precio para tiendas.
 */
class VentasATiendasTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin']);
    }

    private function celular(array $datos = []): Celular
    {
        return Celular::create(array_merge([
            'modelo' => 'IPHONE 15 PRO', 'capacidad' => '256 GB', 'color' => 'NEGRO', 'bateria' => '90',
            'imei_1' => fake()->unique()->numerify('35#############'), 'estado_imei' => 'libre', 'procedencia' => 'EEUU',
            'precio_costo' => 6000, 'precio_venta' => 7500, 'precio_tienda' => 6800, 'estado' => 'disponible',
        ], $datos));
    }

    private function pieza(array $datos = []): Pieza
    {
        return Pieza::create(array_merge([
            'nombre' => 'Pantalla incell', 'categoria' => 'Pantalla', 'compatibilidad' => 'iPhone 11',
            'cantidad' => 6, 'precio_costo' => 180, 'precio_venta' => 420, 'precio_tienda' => 300,
        ], $datos));
    }

    private function cuerpo(array $items, array $extra = []): array
    {
        return array_merge([
            'tienda' => ['nombre' => 'Tienda Pérez', 'responsable' => 'Juan Pérez', 'telefono' => '70011122'],
            'metodo_pago' => 'efectivo',
            'items' => $items,
        ], $extra);
    }

    private function linea(string $tipo, int $id, float $precio, int $cantidad = 1): array
    {
        return ['tipo' => $tipo, 'producto_id' => $id, 'cantidad' => $cantidad, 'precio' => $precio];
    }

    private function vender(User $quien, array $cuerpo): \Illuminate\Testing\TestResponse
    {
        return $this->actingAs($quien)->postJson(route('admin.ventas-tiendas.store'), $cuerpo);
    }

    // ─── Vender a una tienda ────────────────────────────────────────────────

    public function test_vende_un_celular_y_una_pieza_al_precio_ajustado(): void
    {
        $celular = $this->celular();
        $pieza   = $this->pieza();

        $respuesta = $this->vender($this->admin(), $this->cuerpo([
            $this->linea('celular', $celular->id, 6500),
            $this->linea('pieza', $pieza->id, 280, 2),
        ], ['descuento' => 500]))->assertOk()->assertJsonStructure(['message', 'venta_id']);

        $tienda = Tienda::sole();
        $this->assertSame('Tienda Pérez', $tienda->nombre);
        $this->assertSame('Juan Pérez', $tienda->responsable);
        $this->assertSame('70011122', $tienda->telefono);

        $venta = Venta::findOrFail($respuesta->json('venta_id'));
        $this->assertSame($tienda->id, $venta->tienda_id);
        $this->assertSame('Tienda Pérez', $venta->nombre_cliente);
        $this->assertSame('producto', $venta->tipo_venta);
        $this->assertSame(7060.0, (float) $venta->subtotal);
        // Lo que se cobra es lo ajustado, y el descuento que mande el navegador no entra
        $this->assertSame(0.0, (float) $venta->descuento);
        $this->assertSame(7060.0 - 6000 - 360, (float) $venta->ganancia_neta);

        $items = $venta->items->keyBy('tipo');
        $this->assertSame(6500.0, (float) $items['celular']->precio_venta);
        $this->assertSame(280.0, (float) $items['pieza']->precio_venta);
        $this->assertSame(2, (int) $items['pieza']->cantidad);
        $this->assertSame(560.0, (float) $items['pieza']->subtotal);

        $this->assertSame('vendido', $celular->refresh()->estado);
        $this->assertSame(4, $pieza->refresh()->cantidad);
    }

    public function test_una_segunda_venta_a_la_misma_tienda_no_la_duplica(): void
    {
        $admin = $this->admin();

        $this->vender($admin, $this->cuerpo([$this->linea('celular', $this->celular()->id, 6500)]))->assertOk();

        // Otro día, escrita con otras mayúsculas y con un responsable nuevo
        $this->vender($admin, $this->cuerpo([$this->linea('pieza', $this->pieza()->id, 300)], [
            'tienda' => ['nombre' => ' tienda  PÉREZ', 'responsable' => 'Ana Pérez', 'telefono' => ''],
        ]))->assertOk();

        $tienda = Tienda::sole();
        $this->assertSame('Ana Pérez', $tienda->responsable);
        // El teléfono no vino: se conserva el que ya tenía
        $this->assertSame('70011122', $tienda->telefono);
        $this->assertSame(2, $tienda->ventas()->count());
    }

    public function test_un_producto_sin_precio_para_tiendas_no_se_vende_y_no_se_vende_nada(): void
    {
        $celular = $this->celular();
        $pieza   = $this->pieza(['precio_tienda' => null]);

        $this->vender($this->admin(), $this->cuerpo([
            $this->linea('celular', $celular->id, 6500),
            $this->linea('pieza', $pieza->id, 300),
        ]))->assertStatus(422)->assertJsonValidationErrors('items.1.producto_id');

        $this->assertSame(0, Venta::count());
        $this->assertSame(0, Tienda::count());
        $this->assertSame('disponible', $celular->refresh()->estado);
        $this->assertSame(6, $pieza->refresh()->cantidad);
    }

    public function test_el_precio_es_obligatorio_y_mayor_a_cero(): void
    {
        $celular = $this->celular();
        $admin   = $this->admin();

        $this->vender($admin, $this->cuerpo([['tipo' => 'celular', 'producto_id' => $celular->id, 'cantidad' => 1]]))
            ->assertStatus(422)->assertJsonValidationErrors('items.0.precio');

        $this->vender($admin, $this->cuerpo([$this->linea('celular', $celular->id, 0)]))
            ->assertStatus(422)->assertJsonValidationErrors('items.0.precio');

        $this->assertSame(0, Venta::count());
        $this->assertSame('disponible', $celular->refresh()->estado);
    }

    public function test_pide_la_forma_de_pago_sin_valor_por_defecto_y_los_datos_de_la_tarjeta(): void
    {
        $celular = $this->celular();
        $admin   = $this->admin();
        $lineas  = [$this->linea('celular', $celular->id, 6500)];

        $sinPago = $this->cuerpo($lineas);
        unset($sinPago['metodo_pago']);
        $this->vender($admin, $sinPago)->assertStatus(422)->assertJsonValidationErrors('metodo_pago');

        $this->vender($admin, $this->cuerpo($lineas, ['metodo_pago' => 'tarjeta']))
            ->assertStatus(422)->assertJsonValidationErrors(['inicio_tarjeta', 'fin_tarjeta']);

        $this->vender($admin, $this->cuerpo($lineas, ['metodo_pago' => 'tarjeta', 'inicio_tarjeta' => '4557', 'fin_tarjeta' => '5678']))
            ->assertOk();
        $this->assertSame('tarjeta', Venta::sole()->metodo_pago);
    }

    // ─── Quién puede ────────────────────────────────────────────────────────

    public function test_un_vendedor_o_un_rol_sin_el_permiso_no_entra_ni_vende(): void
    {
        $celular = $this->celular();
        Cache::flush();
        Role::create(['clave' => 'encargado', 'nombre' => 'Encargado', 'permisos' => ['ventas'], 'activo' => true]);

        foreach (['vendedor', 'encargado'] as $rol) {
            $usuario = User::factory()->create(['rol' => $rol]);

            $this->actingAs($usuario)->get(route('admin.ventas-tiendas.index'))->assertForbidden();
            $this->actingAs($usuario)->get(route('admin.ventas-tiendas.create'))->assertForbidden();
            $this->actingAs($usuario)->get(route('admin.ventas-tiendas.productos', ['q' => 'iphone']))->assertForbidden();
            $this->vender($usuario, $this->cuerpo([$this->linea('celular', $celular->id, 6500)]))->assertForbidden();
        }

        $this->assertSame(0, Venta::count());
        $this->assertSame('disponible', $celular->refresh()->estado);
    }

    public function test_un_rol_con_el_permiso_entra_y_abre_la_nota_sin_el_de_ventas(): void
    {
        Cache::flush();
        Role::create(['clave' => 'mayorista', 'nombre' => 'Mayorista', 'permisos' => ['ventas_tiendas'], 'activo' => true]);
        $usuario = User::factory()->create(['rol' => 'mayorista']);

        $ventaId = $this->vender($usuario, $this->cuerpo([$this->linea('celular', $this->celular()->id, 6500)]))
            ->assertOk()->json('venta_id');

        $this->actingAs($usuario)->get(route('admin.ventas-tiendas.index'))->assertOk();
        $this->actingAs($usuario)->get(route('admin.ventas-tiendas.boleta', $ventaId))->assertOk();
        $this->actingAs($usuario)->get(route('admin.ventas-tiendas.boleta80', $ventaId))->assertOk();
        // Sin el permiso de Ventas, la nota por la ruta de ventas sigue cerrada
        $this->actingAs($usuario)->get(route('admin.ventas.boleta', $ventaId))->assertForbidden();
    }

    public function test_la_nota_de_una_venta_comun_no_se_abre_por_este_modulo(): void
    {
        $admin = $this->admin();
        $venta = Venta::create([
            'nombre_cliente' => 'Cliente', 'fecha' => now(), 'tipo_venta' => 'producto', 'metodo_pago' => 'efectivo',
            'precio_venta' => 100, 'subtotal' => 100, 'user_id' => $admin->id,
        ]);

        $this->actingAs($admin)->get(route('admin.ventas-tiendas.boleta', $venta))->assertNotFound();
    }

    // ─── Nadie convierte una venta común en venta a tienda ──────────────────

    public function test_mandar_tienda_id_o_precio_por_la_venta_comun_no_la_vuelve_venta_a_tienda(): void
    {
        $admin   = $this->admin();
        $celular = $this->celular();
        $tienda  = Tienda::create(['nombre' => 'Tienda Pérez']);

        $this->actingAs($admin)->postJson(route('admin.ventas.store'), [
            'nombre_cliente' => 'Cliente', 'tipo_venta' => 'producto', 'es_permuta' => false, 'metodo_pago' => 'efectivo',
            'tienda_id' => $tienda->id,
            'items' => [['tipo' => 'celular', 'producto_id' => $celular->id, 'cantidad' => 1, 'precio' => 1, 'descuento' => 0]],
        ])->assertOk();

        $venta = Venta::sole();
        $this->assertNull($venta->tienda_id);
        // Cobra el precio de cliente final del inventario, no el que mandó el navegador
        $this->assertSame(7500.0, (float) $venta->items->sole()->precio_venta);
        $this->assertSame(0, $tienda->ventas()->count());
    }

    public function test_una_venta_a_tienda_no_se_edita_por_la_pantalla_de_ventas_ni_anota_un_cliente(): void
    {
        $admin = $this->admin();
        $celular = $this->celular();
        $this->vender($admin, $this->cuerpo([$this->linea('celular', $celular->id, 6500)]))->assertOk();
        $venta = Venta::sole();

        // La edición común recalcula con el precio de cliente final: perdería el mayorista
        $this->actingAs($admin)->get(route('admin.ventas.edit', $venta))->assertNotFound();
        $this->actingAs($admin)->put(route('admin.ventas.update', $venta), [])->assertNotFound();
        $this->assertSame(6500.0, (float) $venta->fresh()->items->sole()->precio_venta);

        // La tienda tiene su propia lista: no aparece entre los clientes
        $this->assertSame(0, Cliente::count());
    }

    public function test_la_venta_a_tienda_no_aparece_en_la_lista_de_ventas(): void
    {
        $admin = $this->admin();
        Venta::create([
            'nombre_cliente' => 'Cliente común', 'fecha' => now(), 'tipo_venta' => 'producto', 'metodo_pago' => 'efectivo',
            'precio_venta' => 100, 'subtotal' => 100, 'user_id' => $admin->id,
        ]);
        $this->vender($admin, $this->cuerpo([$this->linea('celular', $this->celular()->id, 6500)]))->assertOk();

        $this->actingAs($admin)->get(route('admin.ventas.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Ventas/Index')
                ->has('ventas', 1)
                ->where('ventas.0.nombre_cliente', 'Cliente común'));

        // El buscador de notas de esa pantalla tampoco la trae
        $this->actingAs($admin)->getJson(route('admin.ventas.buscarNota', ['codigo_nota' => 'Tienda']))->assertJsonCount(0);

        $this->actingAs($admin)->get(route('admin.ventas-tiendas.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/VentasTiendas/Index')
                ->has('ventas.data', 1)
                ->where('ventas.data.0.tienda', 'Tienda Pérez')
                ->where('ventas.data.0.responsable', 'Juan Pérez')
                ->where('ventas.data.0.total', 6500)
                ->where('ventas.data.0.items', 1)
                ->has('tiendas', 1));
    }

    // ─── Caja ───────────────────────────────────────────────────────────────

    public function test_una_venta_a_tienda_en_efectivo_suma_a_la_caja(): void
    {
        $this->vender($this->admin(), $this->cuerpo([
            $this->linea('celular', $this->celular()->id, 6500),
            $this->linea('pieza', $this->pieza()->id, 280, 2),
        ]))->assertOk();

        $venta = Venta::sole();
        $hoy   = now('America/La_Paz')->toDateString();

        $this->assertSame(7060.0, EfectivoDeCaja::movimientos($venta->sucursal_id, $hoy, $hoy)['ventas']);
    }

    // ─── Búsqueda de productos ──────────────────────────────────────────────

    public function test_la_busqueda_solo_ofrece_lo_que_tiene_precio_para_tiendas(): void
    {
        $con    = $this->celular(['modelo' => 'IPHONE 15 PRO']);
        $this->celular(['modelo' => 'IPHONE 13', 'precio_tienda' => null]);
        $this->celular(['modelo' => 'IPHONE 12', 'estado' => 'vendido']);
        $this->pieza(['nombre' => 'Pantalla iPhone 11']);
        $this->pieza(['nombre' => 'Batería iPhone 11', 'precio_tienda' => null]);
        $this->pieza(['nombre' => 'Flex iPhone 11', 'cantidad' => 0]);

        $resultado = $this->actingAs($this->admin())
            ->getJson(route('admin.ventas-tiendas.productos', ['q' => 'iphone']))
            ->assertOk()->assertJsonCount(2);

        $this->assertSame(['IPHONE 15 PRO', 'Pantalla iPhone 11'], $resultado->json('*.nombre'));

        $celular = $resultado->json('0');
        $this->assertSame('celular', $celular['tipo']);
        $this->assertSame($con->id, $celular['id']);
        $this->assertSame(6800.0, (float) $celular['precio_tienda']);
        $this->assertSame(7500.0, (float) $celular['precio_venta']);
        $this->assertNull($celular['cantidad']);
        $this->assertArrayNotHasKey('precio_costo', $celular);

        $this->assertSame(6, $resultado->json('1.cantidad'));
    }

    public function test_la_busqueda_sin_texto_no_trae_nada(): void
    {
        $this->celular();

        $this->actingAs($this->admin())->getJson(route('admin.ventas-tiendas.productos'))->assertOk()->assertJsonCount(0);
    }

    // ─── Nota impresa ───────────────────────────────────────────────────────

    public function test_la_nota_dice_la_tienda_y_el_responsable(): void
    {
        $admin   = $this->admin();
        $ventaId = $this->vender($admin, $this->cuerpo([$this->linea('celular', $this->celular()->id, 6500)]))->json('venta_id');
        $venta   = Venta::with(['items', 'vendedor'])->findOrFail($ventaId);

        foreach (['pdf.boleta', 'pdf.boleta_80mm'] as $vista) {
            $html = view($vista, [
                'venta' => $venta, 'sumaSubtotalItems' => 6500, 'valorPermuta' => 0, 'montoReserva' => 0, 'totalAPagar' => 6500,
            ])->render();

            $this->assertStringContainsString('Tienda:', $html);
            $this->assertStringContainsString('Tienda Pérez', $html);
            $this->assertStringContainsString('Responsable:', $html);
            $this->assertStringContainsString('Juan Pérez', $html);
        }
    }
}

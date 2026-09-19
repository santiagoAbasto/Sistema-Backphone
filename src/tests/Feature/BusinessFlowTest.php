<?php

namespace Tests\Feature;

use App\Models\Computadora;
use App\Models\ProductoGeneral;
use App\Models\Secuencia;
use App\Models\ServicioTecnico;
use App\Models\User;
use App\Models\Venta;
use App\Services\GeneradorCodigos;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BusinessFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_store_servicio_tecnico_with_multiple_items(): void
    {
        $admin = User::factory()->create([
            'rol' => 'admin',
        ]);

        $response = $this
            ->actingAs($admin)
            ->post(route('admin.servicios.store'), [
                'cliente' => 'Cliente Demo',
                'telefono' => '70000000',
                'equipo' => 'iPhone 13',
                'tecnico' => 'Edson',
                'fecha' => '2026-04-02',
                'detalle_servicio' => json_encode([
                    ['descripcion' => 'Pantalla', 'costo' => 200, 'precio' => 350],
                    ['descripcion' => 'Bateria', 'costo' => 100, 'precio' => 180],
                ]),
                'notas_adicionales' => 'Equipo con garantia',
                'precio_costo' => 300,
                'precio_venta' => 530,
            ]);

        $response->assertRedirect(route('admin.servicios.index'));

        $this->assertDatabaseHas('servicio_tecnicos', [
            'cliente' => 'Cliente Demo',
            'equipo' => 'iPhone 13',
            'tecnico' => 'Edson',
            'precio_costo' => 300,
            'precio_venta' => 530,
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('clientes', [
            'nombre' => 'Cliente Demo',
            'telefono' => '70000000',
            'user_id' => $admin->id,
        ]);
    }

    public function test_admin_can_register_a_product_sale(): void
    {
        $admin = User::factory()->create([
            'rol' => 'admin',
        ]);

        $producto = ProductoGeneral::create([
            'codigo' => 'PG-001',
            'tipo' => 'accesorio',
            'nombre' => 'Cargador',
            'procedencia' => 'tienda',
            'precio_costo' => 25,
            'precio_venta' => 40,
            'estado' => 'disponible',
        ]);

        $response = $this
            ->actingAs($admin)
            ->postJson(route('admin.ventas.store'), [
                'nombre_cliente' => 'Cliente Venta',
                'telefono_cliente' => '75555555',
                'tipo_venta' => 'producto',
                'es_permuta' => false,
                'tipo_permuta' => null,
                'metodo_pago' => 'efectivo',
                'precio_invertido' => 25,
                'precio_venta' => 40,
                'descuento' => 0,
                'items' => [
                    [
                        'tipo' => 'producto_general',
                        'producto_id' => $producto->id,
                        'cantidad' => 1,
                        'precio_venta' => 40,
                        'precio_invertido' => 25,
                        'descuento' => 0,
                        'subtotal' => 40,
                    ],
                ],
            ]);

        $response
            ->assertOk()
            ->assertJsonStructure(['message', 'venta_id']);

        $ventaId = $response->json('venta_id');

        $this->assertDatabaseHas('ventas', [
            'id' => $ventaId,
            'nombre_cliente' => 'Cliente Venta',
            'tipo_venta' => 'producto',
            'user_id' => $admin->id,
        ]);

        $this->assertDatabaseHas('ventas_items', [
            'venta_id' => $ventaId,
            'producto_id' => $producto->id,
            'tipo' => 'producto_general',
        ]);

        $this->assertDatabaseHas('productos_generales', [
            'id' => $producto->id,
            'estado' => 'vendido',
        ]);
    }

    public function test_stock_search_returns_computer_name_for_authenticated_users(): void
    {
        $admin = User::factory()->create([
            'rol' => 'admin',
        ]);

        $computadora = Computadora::create([
            'nombre' => 'MacBook Pro',
            'procesador' => 'M3',
            'numero_serie' => 'SERIE-123',
            'color' => 'Space Black',
            'bateria' => '100%',
            'ram' => '16GB',
            'almacenamiento' => '512GB',
            'procedencia' => 'tienda',
            'precio_costo' => 1000,
            'precio_venta' => 1400,
            'estado' => 'disponible',
        ]);

        $response = $this
            ->actingAs($admin)
            ->postJson(route('api.stock.buscar_codigo'), [
                'codigo' => $computadora->numero_serie,
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('tipo', 'computadora')
            ->assertJsonPath('producto.nombre', 'MacBook Pro');
    }

    public function test_guest_cannot_access_private_stock_endpoints(): void
    {
        $this->get(route('api.stock.celulares'))
            ->assertRedirect(route('login'));

        $this->post('/api/permuta/celular', [])
            ->assertRedirect(route('login'));
    }

    public function test_previewing_next_service_code_does_not_consume_the_sequence(): void
    {
        $preview = GeneradorCodigos::siguienteServicioTecnico();

        // El código lleva adelante el prefijo de la sucursal: CBA-ST001, SUC-ST001…
        $prefijo = \App\Models\Sucursal::activas()->first()->prefijo;
        $this->assertSame("{$prefijo}-ST001", $preview);
        $this->assertDatabaseMissing('secuencias', [
            'clave' => 'servicio_tecnico',
        ]);
    }

    public function test_failed_service_creation_does_not_consume_the_sequence(): void
    {
        $preview = GeneradorCodigos::siguienteServicioTecnico();

        try {
            GeneradorCodigos::crearServicioTecnicoConCodigo(function () {
                throw new \RuntimeException('Fallo simulado');
            });
            $this->fail('The simulated failure should have been thrown.');
        } catch (\RuntimeException $e) {
            $this->assertSame('Fallo simulado', $e->getMessage());
        }

        $this->assertSame($preview, GeneradorCodigos::siguienteServicioTecnico());
        $this->assertNull(Secuencia::where('clave', 'servicio_tecnico')->first());
    }

    public function test_key_admin_and_vendor_list_pages_render_for_authenticated_users(): void
    {
        $admin = User::factory()->create([
            'rol' => 'admin',
        ]);

        $vendedor = User::factory()->create([
            'rol' => 'vendedor',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.servicios.index'))
            ->assertOk();

        auth()->logout();

        $this->actingAs($vendedor)
            ->get(route('vendedor.ventas.index'))
            ->assertOk();
    }

    public function test_vendedor_cannot_view_other_users_service_documents(): void
    {
        $owner = User::factory()->create([
            'rol' => 'vendedor',
        ]);

        $otherVendor = User::factory()->create([
            'rol' => 'vendedor',
        ]);

        $servicio = ServicioTecnico::create([
            'codigo_nota' => 'AT-ST001',
            'cliente' => 'Cliente Ajeno',
            'telefono' => '70000001',
            'equipo' => 'iPhone 14',
            'detalle_servicio' => json_encode([
                ['descripcion' => 'Pantalla', 'precio' => 200],
            ]),
            'precio_costo' => 100,
            'precio_venta' => 200,
            'tecnico' => 'Tech',
            'fecha' => now()->toDateString(),
            'user_id' => $owner->id,
        ]);

        $this->actingAs($otherVendor)
            ->get(route('vendedor.servicios.boleta', $servicio))
            ->assertNotFound();

        $this->actingAs($otherVendor)
            ->get(route('vendedor.servicios.recibo80mm', $servicio))
            ->assertNotFound();
    }

    public function test_vendedor_cannot_view_other_users_sales_documents(): void
    {
        $owner = User::factory()->create([
            'rol' => 'vendedor',
        ]);

        $otherVendor = User::factory()->create([
            'rol' => 'vendedor',
        ]);

        $venta = Venta::create([
            'nombre_cliente' => 'Cliente Ajeno',
            'telefono_cliente' => '78888888',
            'fecha' => now()->toDateString(),
            'codigo_nota' => 'AT-V001',
            'tipo_venta' => 'producto',
            'es_permuta' => false,
            'tipo_permuta' => null,
            'cantidad' => 1,
            'precio_invertido' => 10,
            'precio_venta' => 20,
            'ganancia_neta' => 10,
            'subtotal' => 20,
            'descuento' => 0,
            'valor_permuta' => 0,
            'metodo_pago' => 'efectivo',
            'user_id' => $owner->id,
        ]);

        $this->actingAs($otherVendor)
            ->get(route('vendedor.ventas.boleta', $venta))
            ->assertNotFound();

        $this->actingAs($otherVendor)
            ->get(route('vendedor.ventas.boleta80', $venta))
            ->assertNotFound();
    }
}

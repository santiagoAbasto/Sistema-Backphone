<?php

namespace Tests\Feature;

use App\Models\ProductoApple;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductosAppleTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function producto(array $datos = []): ProductoApple
    {
        return ProductoApple::create(array_merge([
            'modelo'       => 'AIRPODS PRO 3 GEN',
            'capacidad'    => '-',
            'bateria'      => '100 SELLADO',
            'color'        => 'WHITE',
            'numero_serie' => fake()->unique()->bothify('??########'),
            'procedencia'  => 'EEUU',
            'precio_costo' => 1500,
            'precio_venta' => 1990,
            'tiene_imei'   => false,
            'estado'       => 'disponible',
        ], $datos));
    }

    private function datosValidos(array $cambios = []): array
    {
        return array_merge([
            'modelo'       => 'iPad Air M4',
            'capacidad'    => '128 GB',
            'bateria'      => '100 SELLADO',
            'color'        => 'Morado',
            'numero_serie' => 'll49whxm16',
            'tiene_imei'   => false,
            'procedencia'  => 'EEUU',
            'precio_costo' => 4500,
            'precio_venta' => 5600,
            'estado'       => 'disponible',
            'condicion'    => 'Nuevo',
        ], $cambios);
    }

    public function test_el_listado_marca_los_que_tienen_historial(): void
    {
        $admin = $this->admin();
        $vendido = $this->producto(['estado' => 'vendido']);
        $venta = Venta::create([
            'nombre_cliente' => 'Cliente', 'telefono_cliente' => '70000000', 'fecha' => '2026-09-08',
            'codigo_nota' => 'AT-V950', 'tipo_venta' => 'producto', 'precio_venta' => 1990, 'subtotal' => 1990, 'user_id' => $admin->id,
        ]);
        VentaItem::create([
            'venta_id' => $venta->id, 'tipo' => 'producto_apple', 'producto_id' => $vendido->id, 'cantidad' => 1,
            'precio_venta' => 1990, 'precio_invertido' => 1500, 'descuento' => 0, 'subtotal' => 1990,
        ]);
        $this->producto();

        $this->actingAs($admin)
            ->get(route('admin.productos-apple.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ProductosApple/Index')
                ->has('productos', 2)
                ->where('conHistorial', [$vendido->id]));

        $this->actingAs($admin)
            ->get(route('admin.productos-apple.edit', $vendido))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ProductosApple/Edit')
                ->has('historial', 1)
                ->where('bloqueo', 'Figura en una venta y se conserva para no perder el historial.'));

        $this->actingAs($admin)
            ->delete(route('admin.productos-apple.destroy', $vendido))
            ->assertSessionHas('error');
        $this->assertDatabaseHas('productos_apple', ['id' => $vendido->id]);
    }

    public function test_registrar_sin_imei_ni_capacidad_guarda_guiones_y_serie_en_mayusculas(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.productos-apple.store'), $this->datosValidos([
                'modelo' => 'AirPods 4', 'capacidad' => '', 'bateria' => '', 'imei_1' => '123', 'return_to' => '/admin/productos-apple/create',
            ]))
            ->assertRedirect('/admin/productos-apple/create')
            ->assertSessionHas('success');

        $this->assertDatabaseHas('productos_apple', [
            'modelo' => 'AirPods 4', 'capacidad' => '-', 'bateria' => '-', 'numero_serie' => 'LL49WHXM16', 'imei_1' => null, 'condicion' => 'Nuevo',
        ]);
    }

    public function test_con_imei_se_exige_imei_valido_y_la_serie_no_se_repite(): void
    {
        $this->producto(['numero_serie' => 'LL49WHXM16']);

        $this->actingAs($this->admin())
            ->from(route('admin.productos-apple.create'))
            ->post(route('admin.productos-apple.store'), $this->datosValidos([
                'numero_serie' => ' ll49whxm16 ', 'tiene_imei' => true, 'imei_1' => '12345', 'estado_imei' => '',
            ]))
            ->assertSessionHasErrors([
                'numero_serie' => 'Ya hay un producto Apple con este número de serie.',
                'imei_1'       => 'El IMEI tiene 15 dígitos.',
                'estado_imei'  => 'Elige el estado del IMEI.',
            ]);

        $this->assertDatabaseCount('productos_apple', 1);
    }

    public function test_marcar_varios_y_habilitar_uno_en_permuta(): void
    {
        $admin = $this->admin();
        $a = $this->producto();
        $b = $this->producto(['estado' => 'permuta']);

        $this->actingAs($admin)
            ->patch(route('admin.productos-apple.condicion'), ['ids' => [$a->id, $b->id], 'condicion' => 'Seminuevo'])
            ->assertSessionHas('success', 'Listo: 2 productos quedaron como Seminuevo.');

        $this->actingAs($admin)->patch(route('admin.productos-apple.habilitar', $b))->assertSessionHas('success');

        $this->assertSame('Seminuevo', $a->fresh()->condicion);
        $this->assertSame('disponible', $b->fresh()->estado);
    }
}

<?php

namespace Tests\Feature;

use App\Models\ProductoGeneral;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductosGeneralesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function producto(array $datos = []): ProductoGeneral
    {
        return ProductoGeneral::create(array_merge([
            'codigo'       => fake()->unique()->bothify('FUNDA_####'),
            'tipo'         => 'funda',
            'nombre'       => 'FUNDA DE SILICONA IP 15 PRO',
            'procedencia'  => 'GZ STORES',
            'precio_costo' => 25,
            'precio_venta' => 60,
            'estado'       => 'disponible',
        ], $datos));
    }

    private function datosValidos(array $cambios = []): array
    {
        return array_merge([
            'codigo'       => 'cubo20_1',
            'tipo'         => 'cargador_20w',
            'nombre'       => 'Cubo 20 W original',
            'procedencia'  => 'CHINA',
            'precio_costo' => 40,
            'precio_venta' => 120,
            'estado'       => 'disponible',
            'condicion'    => 'Nuevo',
        ], $cambios);
    }

    public function test_el_listado_y_la_edicion_muestran_el_historial(): void
    {
        $admin = $this->admin();
        $vendido = $this->producto(['estado' => 'vendido']);
        $venta = Venta::create([
            'nombre_cliente' => 'Cliente', 'telefono_cliente' => '70000000', 'fecha' => '2026-09-08',
            'codigo_nota' => 'AT-V970', 'tipo_venta' => 'producto', 'precio_venta' => 60, 'subtotal' => 60, 'user_id' => $admin->id,
        ]);
        VentaItem::create([
            'venta_id' => $venta->id, 'tipo' => 'producto_general', 'producto_id' => $vendido->id, 'cantidad' => 1,
            'precio_venta' => 60, 'precio_invertido' => 25, 'descuento' => 0, 'subtotal' => 60,
        ]);
        $this->producto();

        $this->actingAs($admin)
            ->get(route('admin.productos-generales.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ProductosGenerales/Index')
                ->has('productos', 2)
                ->where('conHistorial', [$vendido->id]));

        $this->actingAs($admin)
            ->get(route('admin.productos-generales.edit', $vendido))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/ProductosGenerales/Edit')
                ->has('historial', 1)
                ->where('bloqueo', 'Figura en una venta y se conserva para no perder el historial.')
                ->has('sugerencias.nombres'));

        $this->actingAs($admin)->delete(route('admin.productos-generales.destroy', $vendido))->assertSessionHas('error');
        $this->assertDatabaseHas('productos_generales', ['id' => $vendido->id]);
    }

    public function test_registrar_otro_vuelve_al_formulario_con_codigo_en_mayusculas(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.productos-generales.store'), $this->datosValidos(['return_to' => '/admin/productos-generales/create']))
            ->assertRedirect('/admin/productos-generales/create')
            ->assertSessionHas('success');

        $this->assertDatabaseHas('productos_generales', ['codigo' => 'CUBO20_1', 'condicion' => 'Nuevo']);
    }

    public function test_el_codigo_no_se_repite_y_los_mensajes_son_claros(): void
    {
        $this->producto(['codigo' => 'CUBO20_1']);

        $this->actingAs($this->admin())
            ->from(route('admin.productos-generales.create'))
            ->post(route('admin.productos-generales.store'), $this->datosValidos(['codigo' => ' cubo20_1 ', 'tipo' => 'celular', 'nombre' => '']))
            ->assertSessionHasErrors([
                'codigo' => 'Ya hay un producto con este código.',
                'tipo'   => 'Elige el tipo de producto.',
                'nombre' => 'Escribe el nombre.',
            ]);

        $this->assertDatabaseCount('productos_generales', 1);

        $this->actingAs($this->admin())
            ->getJson(route('admin.productos-generales.verificar-codigo', ['codigo' => 'cubo20_1']))
            ->assertJson(['existe' => true]);
    }

    public function test_un_producto_de_permuta_se_edita_sin_cambiar_su_tipo(): void
    {
        $producto = $this->producto(['tipo' => 'permuta', 'estado' => 'permuta']);

        $this->actingAs($this->admin())
            ->put(route('admin.productos-generales.update', $producto), $this->datosValidos(['codigo' => $producto->codigo, 'tipo' => 'permuta']))
            ->assertRedirect(route('admin.productos-generales.index'))
            ->assertSessionHasNoErrors();

        $this->assertSame('permuta', $producto->fresh()->tipo);
    }
}

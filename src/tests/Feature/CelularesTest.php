<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CelularesTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function celular(array $datos = []): Celular
    {
        return Celular::create(array_merge([
            'modelo'       => 'IPHONE 15 PRO',
            'capacidad'    => '256 GB',
            'color'        => 'NEGRO',
            'bateria'      => '90',
            'imei_1'       => '356789012345678',
            'estado_imei'  => 'libre',
            'procedencia'  => 'EEUU',
            'precio_costo' => 6000,
            'precio_venta' => 7500,
            'estado'       => 'disponible',
        ], $datos));
    }

    private function datosValidos(array $cambios = []): array
    {
        return array_merge([
            'modelo'       => 'iPhone 16 Pro Max',
            'capacidad'    => '256 GB',
            'color'        => 'Natural',
            'bateria'      => '100 SELLADO',
            'imei_1'       => '490154203237518',
            'imei_2'       => null,
            'numero_serie' => 'f2lxk1abcd',
            'estado_imei'  => 'libre',
            'procedencia'  => 'EEUU',
            'precio_costo' => 8000,
            'precio_venta' => 9500,
            'estado'       => 'disponible',
            'condicion'    => 'Seminuevo',
        ], $cambios);
    }

    private function vender(Celular $celular, User $user, string $codigo = 'AT-V900'): Venta
    {
        $venta = Venta::create([
            'nombre_cliente'   => 'Sharol Rojas',
            'telefono_cliente' => '61676196',
            'fecha'            => '2026-09-08',
            'codigo_nota'      => $codigo,
            'tipo_venta'       => 'producto',
            'precio_venta'     => 7500,
            'subtotal'         => 7500,
            'user_id'          => $user->id,
        ]);

        VentaItem::create([
            'venta_id'         => $venta->id,
            'tipo'             => 'celular',
            'producto_id'      => $celular->id,
            'cantidad'         => 1,
            'precio_venta'     => 7500,
            'precio_invertido' => 6000,
            'descuento'        => 0,
            'subtotal'         => 7500,
        ]);

        return $venta;
    }

    public function test_el_listado_marca_los_que_no_se_pueden_eliminar(): void
    {
        $admin = $this->admin();
        $vendido = $this->celular(['estado' => 'vendido']);
        $this->vender($vendido, $admin);
        $this->celular(['imei_1' => '356789012345670']);

        $this->actingAs($admin)
            ->get(route('admin.celulares.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Celulares/Index')
                ->has('celulares', 2)
                ->where('conHistorial', [$vendido->id]));
    }

    public function test_el_vendedor_va_a_su_pantalla_de_productos(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);

        $this->actingAs($vendedor)
            ->get(route('vendedor.celulares.index'))
            ->assertRedirect(route('vendedor.productos.index'));
    }

    public function test_registrar_muestra_mensajes_claros(): void
    {
        $this->actingAs($this->admin())
            ->from(route('admin.celulares.create'))
            ->post(route('admin.celulares.store'), $this->datosValidos(['modelo' => '', 'imei_1' => '123']))
            ->assertSessionHasErrors([
                'modelo' => 'Escribe el modelo.',
                'imei_1' => 'El IMEI tiene 15 dígitos.',
            ]);

        $this->assertDatabaseCount('celulares', 0);
    }

    public function test_un_imei_no_se_repite_ni_como_imei_2_de_otro_equipo(): void
    {
        $this->celular(['imei_2' => '490154203237518']);

        $this->actingAs($this->admin())
            ->from(route('admin.celulares.create'))
            ->post(route('admin.celulares.store'), $this->datosValidos())
            ->assertSessionHasErrors(['imei_1' => 'Ya hay un celular registrado con este IMEI.']);

        $this->assertDatabaseCount('celulares', 1);
    }

    public function test_registrar_otro_vuelve_al_formulario_sin_salir_del_sistema(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post(route('admin.celulares.store'), $this->datosValidos(['return_to' => '/admin/celulares/create']))
            ->assertRedirect('/admin/celulares/create')
            ->assertSessionHas('success');

        $this->assertDatabaseHas('celulares', [
            'imei_1'       => '490154203237518',
            'numero_serie' => 'F2LXK1ABCD',
            'bateria'      => '100 SELLADO',
        ]);

        // Una dirección de otra web no se sigue
        $this->actingAs($admin)
            ->post(route('admin.celulares.store'), $this->datosValidos([
                'imei_1'       => '358051325422989',
                'numero_serie' => null,
                'return_to'    => 'https://otra-web.example/entrar',
            ]))
            ->assertRedirect(route('admin.celulares.index'));
    }

    public function test_la_edicion_muestra_el_historial_y_por_que_no_se_elimina(): void
    {
        $admin = $this->admin();
        $celular = $this->celular(['estado' => 'vendido']);
        $this->vender($celular, $admin, 'AT-V900');

        $this->actingAs($admin)
            ->get(route('admin.celulares.edit', $celular))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Celulares/Edit')
                ->where('celular.id', $celular->id)
                ->has('historial', 1)
                ->where('historial.0.titulo', 'Venta')
                ->where('historial.0.codigo', 'AT-V900')
                ->where('bloqueo', 'Figura en una venta y se conserva para no perder el historial.')
                ->has('sugerencias.modelos'));
    }

    public function test_no_se_elimina_un_celular_con_ventas_pero_si_uno_sin_movimientos(): void
    {
        $admin = $this->admin();
        $vendido = $this->celular(['estado' => 'vendido']);
        $this->vender($vendido, $admin);
        $libre = $this->celular(['imei_1' => '356789012345679']);

        $this->actingAs($admin)
            ->from(route('admin.celulares.index'))
            ->delete(route('admin.celulares.destroy', $vendido))
            ->assertRedirect(route('admin.celulares.index'))
            ->assertSessionHas('error');
        $this->assertDatabaseHas('celulares', ['id' => $vendido->id]);

        $this->actingAs($admin)
            ->delete(route('admin.celulares.destroy', $libre))
            ->assertRedirect(route('admin.celulares.index'))
            ->assertSessionHas('success');
        $this->assertDatabaseMissing('celulares', ['id' => $libre->id]);
    }

    public function test_editar_un_equipo_antiguo_con_imei_cruzado_se_puede_guardar(): void
    {
        $admin = $this->admin();
        $antiguo = $this->celular(['imei_1' => '111111111111111']);
        $this->celular(['imei_1' => '222222222222222', 'imei_2' => '111111111111111']);

        // Solo cambia el precio: los IMEI quedan como estaban
        $this->actingAs($admin)
            ->put(route('admin.celulares.update', $antiguo), $this->datosValidos([
                'imei_1'       => '111111111111111',
                'numero_serie' => null,
                'precio_venta' => 7200,
            ]))
            ->assertRedirect(route('admin.celulares.index'))
            ->assertSessionHas('success');
        $this->assertDatabaseHas('celulares', ['id' => $antiguo->id, 'precio_venta' => 7200]);

        // Pero no se puede cambiar a un IMEI que ya usa otro equipo
        $this->actingAs($admin)
            ->from(route('admin.celulares.edit', $antiguo))
            ->put(route('admin.celulares.update', $antiguo), $this->datosValidos([
                'imei_1'       => '222222222222222',
                'numero_serie' => null,
            ]))
            ->assertSessionHasErrors(['imei_1' => 'Ya hay un celular registrado con este IMEI.']);
    }
}

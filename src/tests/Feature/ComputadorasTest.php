<?php

namespace Tests\Feature;

use App\Models\Computadora;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ComputadorasTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function computadora(array $datos = []): Computadora
    {
        return Computadora::create(array_merge([
            'nombre'         => 'MACBOOK AIR 13 INCH',
            'procesador'     => 'M4',
            'numero_serie'   => fake()->unique()->bothify('??########??'),
            'color'          => 'STARLIGHT',
            'bateria'        => '100 - 25 CICLOS',
            'ram'            => '16 GB',
            'almacenamiento' => '256 GB',
            'procedencia'    => 'EEUU',
            'precio_costo'   => 10700,
            'precio_venta'   => 12900,
            'estado'         => 'disponible',
        ], $datos));
    }

    private function datosValidos(array $cambios = []): array
    {
        return array_merge([
            'nombre'         => 'MacBook Pro 14',
            'procesador'     => 'M4 Pro',
            'numero_serie'   => 'c02xk1abcd',
            'color'          => 'Negro espacial',
            'bateria'        => '100 - 12 CICLOS',
            'ram'            => '24 GB',
            'almacenamiento' => '512 GB',
            'procedencia'    => 'EEUU',
            'precio_costo'   => 15000,
            'precio_venta'   => 18500,
            'estado'         => 'disponible',
            'condicion'      => 'Seminuevo',
        ], $cambios);
    }

    private function vender(Computadora $computadora, User $user, string $codigo = 'AT-V900'): void
    {
        $venta = Venta::create([
            'nombre_cliente'   => 'Cliente',
            'telefono_cliente' => '70000000',
            'fecha'            => '2026-09-08',
            'codigo_nota'      => $codigo,
            'tipo_venta'       => 'producto',
            'precio_venta'     => 12900,
            'subtotal'         => 12900,
            'user_id'          => $user->id,
        ]);

        VentaItem::create([
            'venta_id'         => $venta->id,
            'tipo'             => 'computadora',
            'producto_id'      => $computadora->id,
            'cantidad'         => 1,
            'precio_venta'     => 12900,
            'precio_invertido' => 10700,
            'descuento'        => 0,
            'subtotal'         => 12900,
        ]);
    }

    public function test_el_listado_marca_las_que_no_se_pueden_eliminar(): void
    {
        $admin = $this->admin();
        $vendida = $this->computadora(['estado' => 'vendido']);
        $this->vender($vendida, $admin);
        $this->computadora();

        $this->actingAs($admin)
            ->get(route('admin.computadoras.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Computadoras/Index')
                ->has('computadoras', 2)
                ->where('conHistorial', [$vendida->id]));
    }

    public function test_el_vendedor_va_a_su_pantalla_de_productos(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);

        $this->actingAs($vendedor)
            ->get(route('vendedor.computadoras.index'))
            ->assertRedirect(route('vendedor.productos.index'));
    }

    public function test_registrar_muestra_mensajes_claros(): void
    {
        $this->actingAs($this->admin())
            ->from(route('admin.computadoras.create'))
            ->post(route('admin.computadoras.store'), $this->datosValidos(['nombre' => '', 'numero_serie' => '', 'ram' => '']))
            ->assertSessionHasErrors([
                'nombre'       => 'Escribe el nombre del equipo.',
                'numero_serie' => 'Escribe el número de serie.',
                'ram'          => 'Elige o escribe la memoria RAM.',
            ]);

        $this->assertDatabaseCount('computadoras', 0);
    }

    public function test_el_numero_de_serie_no_se_repite_aunque_se_escriba_distinto(): void
    {
        $this->computadora(['numero_serie' => 'C02XK1ABCD']);

        $this->actingAs($this->admin())
            ->from(route('admin.computadoras.create'))
            ->post(route('admin.computadoras.store'), $this->datosValidos(['numero_serie' => ' c02xk1abcd ']))
            ->assertSessionHasErrors(['numero_serie' => 'Ya hay una computadora con este número de serie.']);

        $this->assertDatabaseCount('computadoras', 1);
    }

    public function test_registrar_otra_vuelve_al_formulario_sin_salir_del_sistema(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)
            ->post(route('admin.computadoras.store'), $this->datosValidos(['return_to' => '/admin/computadoras/create']))
            ->assertRedirect('/admin/computadoras/create')
            ->assertSessionHas('success');

        $this->assertDatabaseHas('computadoras', ['numero_serie' => 'C02XK1ABCD', 'condicion' => 'Seminuevo', 'ram' => '24 GB']);

        $this->actingAs($admin)
            ->post(route('admin.computadoras.store'), $this->datosValidos([
                'numero_serie' => 'FVFXC2ABQ6L4',
                'return_to'    => 'https://otra-web.example/entrar',
            ]))
            ->assertRedirect(route('admin.computadoras.index'));
    }

    public function test_la_edicion_muestra_el_historial_y_por_que_no_se_elimina(): void
    {
        $admin = $this->admin();
        $computadora = $this->computadora(['estado' => 'vendido']);
        $this->vender($computadora, $admin, 'AT-V901');

        $this->actingAs($admin)
            ->get(route('admin.computadoras.edit', $computadora))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Computadoras/Edit')
                ->where('computadora.id', $computadora->id)
                ->has('historial', 1)
                ->where('historial.0.titulo', 'Venta')
                ->where('historial.0.codigo', 'AT-V901')
                ->where('bloqueo', 'Figura en una venta y se conserva para no perder el historial.')
                ->has('sugerencias.nombres')
                ->has('sugerencias.procesadores'));
    }

    public function test_no_se_elimina_una_computadora_vendida_pero_si_una_sin_movimientos(): void
    {
        $admin = $this->admin();
        $vendida = $this->computadora(['estado' => 'vendido']);
        $this->vender($vendida, $admin);
        $libre = $this->computadora();

        $this->actingAs($admin)
            ->from(route('admin.computadoras.index'))
            ->delete(route('admin.computadoras.destroy', $vendida))
            ->assertRedirect(route('admin.computadoras.index'))
            ->assertSessionHas('error');
        $this->assertDatabaseHas('computadoras', ['id' => $vendida->id]);

        $this->actingAs($admin)
            ->delete(route('admin.computadoras.destroy', $libre))
            ->assertRedirect(route('admin.computadoras.index'))
            ->assertSessionHas('success');
        $this->assertDatabaseMissing('computadoras', ['id' => $libre->id]);
    }

    public function test_marcar_varias_computadoras_de_una_vez(): void
    {
        $a = $this->computadora();
        $b = $this->computadora();

        $this->actingAs($this->admin())
            ->from(route('admin.computadoras.index'))
            ->patch(route('admin.computadoras.condicion'), ['ids' => [$a->id, $b->id], 'condicion' => 'Seminuevo'])
            ->assertRedirect(route('admin.computadoras.index'))
            ->assertSessionHas('success', 'Listo: 2 computadoras quedaron como Seminuevo.');

        $this->assertSame('Seminuevo', $a->fresh()->condicion);
        $this->assertSame('Seminuevo', $b->fresh()->condicion);
    }
}

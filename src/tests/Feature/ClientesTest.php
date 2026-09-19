<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\Cotizacion;
use App\Models\ServicioTecnico;
use App\Models\User;
use App\Models\Venta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ClientesTest extends TestCase
{
    use RefreshDatabase;

    private function cliente(User $user, array $datos = []): Cliente
    {
        return Cliente::create(array_merge([
            'user_id' => $user->id,
            'nombre' => 'Sharol Rojas',
            'telefono' => '+591 61676196',
        ], $datos));
    }

    private function venta(User $user, string $telefono, string $codigo, float $monto): Venta
    {
        return Venta::create([
            'nombre_cliente' => 'Cliente',
            'telefono_cliente' => $telefono,
            'fecha' => '2026-09-08',
            'codigo_nota' => $codigo,
            'tipo_venta' => 'producto',
            'precio_venta' => $monto,
            'subtotal' => $monto,
            'user_id' => $user->id,
        ]);
    }

    public function test_listado_solo_trae_el_nombre_de_quien_registro(): void
    {
        $admin = User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
        $this->cliente($admin);

        $this->actingAs($admin)
            ->get(route('admin.clientes.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Clientes/Index')
                ->has('clientes', 1)
                ->where('clientes.0.usuario', ['id' => $admin->id, 'name' => 'Administrador']));
    }

    public function test_la_edicion_muestra_la_actividad_del_cliente(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $cliente = $this->cliente($admin);

        // La venta guarda el teléfono en otro formato: se encuentra por los últimos 8 dígitos
        $this->venta($admin, '61676196', 'AT-V900', 9300);
        $this->venta($admin, '+591 70000000', 'AT-V901', 500); // de otra persona

        ServicioTecnico::create([
            'codigo_nota' => 'AT-ST900',
            'cliente_id' => $cliente->id,
            'cliente' => 'Sharol Rojas',
            'equipo' => 'iPhone 13',
            'detalle_servicio' => '[]',
            'precio_costo' => 100,
            'precio_venta' => 250,
            'tecnico' => 'AXEL',
            'fecha' => '2026-09-10',
            'user_id' => $admin->id,
        ]);

        Cotizacion::create([
            'user_id' => $admin->id,
            'cliente_id' => $cliente->id,
            'nombre_cliente' => 'Sharol Rojas',
            'telefono' => '59161676196',
            'items' => [],
            'total' => 1200,
            'fecha_cotizacion' => '2026-09-11',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.clientes.edit', $cliente))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Clientes/Edit')
                ->where('cliente.id', $cliente->id)
                ->where('actividad.ventas.cantidad', 1)
                ->where('actividad.ventas.total', 9300)
                ->where('actividad.servicios', 1)
                ->where('actividad.cotizaciones', 1)
                ->where('actividad.reservas', 0)
                ->has('actividad.recientes', 3));
    }

    public function test_actualizar_guarda_el_documento_y_vuelve_al_listado(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $cliente = $this->cliente($admin);

        $this->actingAs($admin)
            ->put(route('admin.clientes.update', $cliente), [
                'nombre' => 'Sharol Rojas Vargas',
                'telefono' => '+591 61676196',
                'correo' => 'sharol@example.com',
                'documento' => '1234567 CB',
            ])
            ->assertRedirect(route('admin.clientes.index'))
            ->assertSessionHas('success');

        $this->assertDatabaseHas('clientes', [
            'id' => $cliente->id,
            'nombre' => 'Sharol Rojas Vargas',
            'correo' => 'sharol@example.com',
            'documento' => '1234567 CB',
        ]);
    }

    public function test_un_telefono_incompleto_muestra_un_mensaje_claro(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $cliente = $this->cliente($admin);

        $this->actingAs($admin)
            ->put(route('admin.clientes.update', $cliente), [
                'nombre' => 'Sharol Rojas',
                'telefono' => '123',
            ])
            ->assertSessionHasErrors(['telefono' => 'El teléfono parece incompleto.']);

        $this->assertSame('+591 61676196', $cliente->fresh()->telefono);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_exact_imei_finds_an_available_phone_even_with_surrounding_spaces(): void
    {
        $user = User::factory()->create(['rol' => 'vendedor']); // la búsqueda de stock es solo para el equipo
        $phone = Celular::create([
            'modelo' => 'iPhone 17 Pro Max',
            'capacidad' => '256 GB',
            'color' => 'Natural',
            'imei_1' => '358051325422989',
            'estado_imei' => 'libre',
            'procedencia' => 'Tienda',
            'precio_costo' => 7000,
            'precio_venta' => 9000,
            'estado' => 'disponible',
        ]);

        $this->actingAs($user)
            ->postJson(route('api.stock.buscar_codigo'), ['codigo' => ' 358051325422989 '])
            ->assertOk()
            ->assertJsonPath('tipo', 'celular')
            ->assertJsonPath('producto.id', $phone->id)
            ->assertJsonPath('producto.nombre', 'iPhone 17 Pro Max');
    }

    public function test_sold_phone_is_not_returned_by_imei_search(): void
    {
        $user = User::factory()->create(['rol' => 'vendedor']); // la búsqueda de stock es solo para el equipo
        Celular::create([
            'modelo' => 'iPhone vendido',
            'capacidad' => '128 GB',
            'color' => 'Negro',
            'imei_1' => '350000000000001',
            'estado_imei' => 'libre',
            'procedencia' => 'Tienda',
            'precio_costo' => 1,
            'precio_venta' => 2,
            'estado' => 'vendido',
        ]);

        $this->actingAs($user)
            ->postJson(route('api.stock.buscar_codigo'), ['codigo' => '350000000000001'])
            ->assertNotFound();
    }
}

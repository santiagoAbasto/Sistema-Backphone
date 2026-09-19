<?php

namespace Tests\Feature;

use App\Models\Egreso;
use App\Models\ProductoGeneral;
use App\Models\User;
use App\Models\Venta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Serie del gráfico "Resumen económico": datos reales, sin fechas futuras y con los mismos totales que las tarjetas. */
class DashboardSerieTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin']);
    }

    public function test_daily_series_has_every_day_and_no_future_dates(): void
    {
        $inicio = now()->subDays(9)->toDateString();

        $this->actingAs($this->admin())
            ->get(route('admin.dashboard', ['fecha_inicio' => $inicio, 'fecha_fin' => now()->addDays(5)->toDateString()]))
            ->assertOk()
            ->assertInertia(fn ($p) => $p
                ->where('serie.granularidad', 'dia')
                ->has('serie.puntos', 10)
                ->where('serie.puntos.0.fecha', $inicio)
                ->where('serie.puntos.9.fecha', now()->toDateString())
                ->where('serie.puntos.9.ingresos', 0));
    }

    public function test_long_ranges_are_grouped_by_month(): void
    {
        $inicio = now()->startOfMonth()->subMonths(5)->toDateString();

        $this->actingAs($this->admin())
            ->get(route('admin.dashboard', ['fecha_inicio' => $inicio, 'fecha_fin' => now()->toDateString()]))
            ->assertOk()
            ->assertInertia(fn ($p) => $p
                ->where('serie.granularidad', 'mes')
                ->has('serie.puntos', 6)
                ->where('serie.puntos.5.fecha', now()->format('Y-m')));
    }

    public function test_series_totals_match_the_dashboard_cards(): void
    {
        $admin = $this->admin();

        $producto = ProductoGeneral::create([
            'codigo' => 'PG-900', 'tipo' => 'accesorio', 'nombre' => 'Cargador', 'procedencia' => 'tienda',
            'precio_costo' => 25, 'precio_venta' => 40, 'estado' => 'disponible',
        ]);

        $this->actingAs($admin)->postJson(route('admin.ventas.store'), [
            'nombre_cliente' => 'Cliente Serie', 'telefono_cliente' => '75555555', 'tipo_venta' => 'producto',
            'es_permuta' => false, 'tipo_permuta' => null, 'metodo_pago' => 'efectivo',
            'precio_invertido' => 25, 'precio_venta' => 40, 'descuento' => 0,
            'items' => [[
                'tipo' => 'producto_general', 'producto_id' => $producto->id, 'cantidad' => 1,
                'precio_venta' => 40, 'precio_invertido' => 25, 'descuento' => 0, 'subtotal' => 40,
            ]],
        ])->assertOk();

        // En PostgreSQL la columna `fecha` es DATE; en la base de pruebas (SQLite) quedaría con hora y saldría del rango
        Venta::query()->update(['fecha' => now()->toDateString()]);

        Egreso::create(['concepto' => 'Luz', 'precio_invertido' => 5, 'tipo_gasto' => 'servicio_basico', 'user_id' => $admin->id]);

        $props = $this->actingAs($admin)
            ->get(route('admin.dashboard', ['fecha_inicio' => now()->subDays(6)->toDateString(), 'fecha_fin' => now()->toDateString()]))
            ->assertOk()
            ->viewData('page')['props'];

        $puntos = collect($props['serie']['puntos']);
        $total  = $props['resumen_total'];

        $this->assertEqualsWithDelta(40, (float) $total['total_ventas'], 0.01); // la venta sí está en el período
        $this->assertEqualsWithDelta((float) $total['total_ventas'], $puntos->sum('ingresos'), 0.01);
        $this->assertEqualsWithDelta((float) $total['total_costo'] + (float) $total['total_permuta'], $puntos->sum('inversion'), 0.01);
        $this->assertEqualsWithDelta((float) $total['utilidad_disponible'], $puntos->sum('utilidad'), 0.01);

        $hoy = $puntos->firstWhere('fecha', now()->toDateString());
        $this->assertEqualsWithDelta(40, $hoy['ingresos'], 0.01);
        $this->assertEqualsWithDelta(25, $hoy['inversion'], 0.01);
        $this->assertEqualsWithDelta(10, $hoy['utilidad'], 0.01); // 40 − 25 de costo − 5 de egreso
        $this->assertSame(1, $hoy['ventas']);

        // Vela de utilidad del día: abre con la venta (+15) y cierra con el egreso (−5)
        $this->assertEquals(['o' => 15, 'h' => 15, 'l' => -5, 'c' => -5], $hoy['velas']['utilidad']);
        $this->assertEquals(['o' => 40, 'h' => 40, 'l' => 40, 'c' => 40], $hoy['velas']['ingresos']);
        $this->assertEqualsWithDelta(15, $hoy['categorias']['Productos Generales'], 0.01);

        // Movimientos uno por uno: la venta y después el egreso, sin datos internos del inventario
        $movs = collect($props['serie']['movimientos']);
        $this->assertSame(['venta', 'egreso'], $movs->pluck('tipo')->all());
        $this->assertSame('Cargador', $movs->first()['etiqueta']);
        $this->assertSame(2, $props['serie']['movimientos_total']);
        $this->assertStringNotContainsString('PG-900', json_encode($movs));
    }
}

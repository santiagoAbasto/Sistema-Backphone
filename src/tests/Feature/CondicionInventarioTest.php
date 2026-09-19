<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\ProductoGeneral;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** La condición (Nuevo / Seminuevo) se carga en el inventario y alimenta la tienda y la API. */
class CondicionInventarioTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin']);
    }

    private function celular(array $datos = []): Celular
    {
        return Celular::create(array_merge([
            'modelo'       => 'IPHONE 15 PRO',
            'capacidad'    => '256 GB',
            'color'        => 'NEGRO',
            'bateria'      => '90',
            'imei_1'       => fake()->unique()->numerify('35#############'),
            'estado_imei'  => 'libre',
            'procedencia'  => 'EEUU',
            'precio_costo' => 6000,
            'precio_venta' => 7500,
            'estado'       => 'disponible',
        ], $datos));
    }


    /** Lo que envía el formulario de edición con los datos guardados del equipo. */
    private function datosDe(Celular $celular, array $cambios = []): array
    {
        return array_merge($celular->only([
            'modelo', 'capacidad', 'color', 'bateria', 'imei_1', 'imei_2', 'numero_serie',
            'estado_imei', 'procedencia', 'precio_costo', 'precio_venta', 'estado', 'condicion',
        ]), $cambios);
    }

    /** Accesorio como los que había antes: sin condición (salvo que se indique). */
    private function accesorio(string $codigo, string $nombre = 'CUBO 20 W ORIGINAL', float $precio = 300, ?string $condicion = null): ProductoGeneral
    {
        return ProductoGeneral::create([
            'codigo'       => $codigo,
            'tipo'         => 'cargador_20w',
            'nombre'       => $nombre,
            'procedencia'  => 'Proveedor',
            'precio_costo' => 150,
            'precio_venta' => $precio,
            'estado'       => 'disponible',
            'condicion'    => $condicion,
        ]);
    }

    public function test_registrar_un_celular_pide_la_condicion(): void
    {
        $admin = $this->admin();
        $datos = [
            'modelo'       => 'iPhone 16',
            'capacidad'    => '128 GB',
            'color'        => 'Negro',
            'bateria'      => '100 SELLADO',
            'imei_1'       => '490154203237518',
            'estado_imei'  => 'libre',
            'procedencia'  => 'EEUU',
            'precio_costo' => 6000,
            'precio_venta' => 7000,
            'estado'       => 'disponible',
        ];

        $this->actingAs($admin)->from(route('admin.celulares.create'))
            ->post(route('admin.celulares.store'), $datos)
            ->assertSessionHasErrors(['condicion' => 'Elige si es nuevo o seminuevo.']);

        $this->actingAs($admin)->from(route('admin.celulares.create'))
            ->post(route('admin.celulares.store'), $datos + ['condicion' => 'Usado'])
            ->assertSessionHasErrors(['condicion' => 'Elige si es nuevo o seminuevo.']);

        $this->actingAs($admin)
            ->post(route('admin.celulares.store'), $datos + ['condicion' => 'Nuevo'])
            ->assertRedirect(route('admin.celulares.index'));

        $this->assertDatabaseHas('celulares', ['imei_1' => '490154203237518', 'condicion' => 'Nuevo']);
    }

    public function test_los_productos_generales_entran_como_nuevos(): void
    {
        // Sin indicar condición, un producto general queda como Nuevo
        $nuevo = ProductoGeneral::create([
            'codigo'       => 'AC-10',
            'tipo'         => 'funda',
            'nombre'       => 'FUNDA SILICONA 15 PRO',
            'procedencia'  => 'CHINA',
            'precio_costo' => 30,
            'precio_venta' => 80,
            'estado'       => 'disponible',
        ]);
        $this->assertSame('Nuevo', $nuevo->fresh()->condicion);

        // Los que estaban sin condición pasan a Nuevo con la migración
        $antiguo = $this->accesorio('AC-11');
        $this->assertNull($antiguo->fresh()->condicion);
        (require database_path('migrations/2026_09_14_130000_marcar_productos_generales_como_nuevos.php'))->up();
        $this->assertSame('Nuevo', $antiguo->fresh()->condicion);
    }

    public function test_marcar_varios_celulares_de_una_vez(): void
    {
        $admin = $this->admin();
        $a = $this->celular();
        $b = $this->celular();

        $this->actingAs($admin)
            ->from(route('admin.celulares.index'))
            ->patch(route('admin.celulares.condicion'), ['ids' => [$a->id, $b->id], 'condicion' => 'Seminuevo'])
            ->assertRedirect(route('admin.celulares.index'))
            ->assertSessionHas('success', 'Listo: 2 celulares quedaron como Seminuevo.');

        $this->assertSame('Seminuevo', $a->fresh()->condicion);
        $this->assertSame('Seminuevo', $b->fresh()->condicion);

        $this->actingAs($admin)
            ->from(route('admin.celulares.index'))
            ->patch(route('admin.celulares.condicion'), ['ids' => [$a->id]])
            ->assertSessionHasErrors(['condicion' => 'Elige si es nuevo o seminuevo.']);
    }

    public function test_los_demas_productos_tambien_guardan_la_condicion(): void
    {
        $admin = $this->admin();
        $computadora = [
            'nombre'         => 'MACBOOK AIR M2',
            'procesador'     => 'M2',
            'numero_serie'   => 'C02XYZ123',
            'color'          => 'GRIS',
            'bateria'        => '95',
            'ram'            => '8',
            'almacenamiento' => '256',
            'procedencia'    => 'EEUU',
            'precio_costo'   => 5000,
            'precio_venta'   => 6500,
            'estado'         => 'disponible',
        ];

        $this->actingAs($admin)->from(route('admin.computadoras.create'))
            ->post(route('admin.computadoras.store'), $computadora)
            ->assertSessionHasErrors(['condicion' => 'Elige si es nuevo o seminuevo.']);

        $this->actingAs($admin)
            ->post(route('admin.computadoras.store'), $computadora + ['condicion' => 'Seminuevo'])
            ->assertRedirect(route('admin.computadoras.index'));
        $this->assertDatabaseHas('computadoras', ['numero_serie' => 'C02XYZ123', 'condicion' => 'Seminuevo']);

        $this->actingAs($admin)
            ->post(route('admin.productos-apple.store'), [
                'modelo'       => 'IPAD AIR',
                'capacidad'    => '256 GB',
                'bateria'      => '100',
                'color'        => 'AZUL',
                'numero_serie' => null,
                'procedencia'  => 'EEUU',
                'precio_costo' => 4000,
                'precio_venta' => 5200,
                'tiene_imei'   => false,
                'imei_1'       => null,
                'imei_2'       => null,
                'estado_imei'  => null,
                'condicion'    => 'Nuevo',
            ])
            ->assertRedirect(route('admin.productos-apple.index'));
        $this->assertDatabaseHas('productos_apple', ['modelo' => 'IPAD AIR', 'condicion' => 'Nuevo']);

        $this->actingAs($admin)->from(route('admin.productos-generales.create'))
            ->post(route('admin.productos-generales.store'), [
                'codigo'       => 'FUNDA-001',
                'tipo'         => 'funda',
                'nombre'       => 'FUNDA SILICONA 15 PRO',
                'procedencia'  => 'CHINA',
                'precio_costo' => 30,
                'precio_venta' => 80,
                'estado'       => 'disponible',
                'condicion'    => 'Nuevo',
            ])
            ->assertSessionHasNoErrors();
        $this->assertDatabaseHas('productos_generales', ['codigo' => 'FUNDA-001', 'condicion' => 'Nuevo']);
    }

    public function test_la_busqueda_de_stock_muestra_la_condicion(): void
    {
        $celular = $this->celular(['condicion' => 'Seminuevo']);

        $this->actingAs($this->admin())
            ->postJson(route('api.stock.buscar_codigo'), ['codigo' => $celular->imei_1])
            ->assertOk()
            ->assertJsonPath('producto.condicion', 'Seminuevo');
    }
}

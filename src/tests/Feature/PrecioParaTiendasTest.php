<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\Pieza;
use App\Models\ProductoGeneral;
use App\Models\Sucursal;
use App\Models\Traspaso;
use App\Models\User;
use App\Support\SinCostos;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * El «precio para tiendas» del inventario: el precio mayorista, opcional, que carga el administrador.
 *
 * Lo que importa: que se guarde tal cual, que vacío sea null (nunca 0, porque 0 sería vender gratis a
 * una tienda) y que el vendedor, que vende a cliente final, no lo reciba por ninguna pantalla.
 */
class PrecioParaTiendasTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
    }

    private function vendedor(): User
    {
        return User::factory()->create(['rol' => 'vendedor', 'name' => 'Vendedora']);
    }

    /** Los tres tipos que se prueban: cada uno con su ruta, su modelo y un alta válida. */
    public static function tipos(): array
    {
        return [
            'celular'          => ['celular'],
            'producto general' => ['general'],
            'pieza'            => ['pieza'],
        ];
    }

    private function tipo(string $clave): array
    {
        return match ($clave) {
            'celular' => [
                'modelo' => Celular::class,
                'store'  => route('admin.celulares.store'),
                'update' => fn ($m) => route('admin.celulares.update', $m),
                'datos'  => [
                    'modelo' => 'iPhone 16 Pro Max', 'capacidad' => '256 GB', 'color' => 'Natural', 'bateria' => '100 SELLADO',
                    'imei_1' => '490154203237518', 'estado_imei' => 'libre', 'procedencia' => 'EEUU',
                    'precio_costo' => 8000, 'precio_venta' => 9500, 'estado' => 'disponible', 'condicion' => 'Seminuevo',
                ],
            ],
            'general' => [
                'modelo' => ProductoGeneral::class,
                'store'  => route('admin.productos-generales.store'),
                'update' => fn ($m) => route('admin.productos-generales.update', $m),
                'datos'  => [
                    'codigo' => 'CUBO20_1', 'tipo' => 'cargador_20w', 'nombre' => 'Cubo 20 W original', 'procedencia' => 'CHINA',
                    'precio_costo' => 40, 'precio_venta' => 120, 'estado' => 'disponible', 'condicion' => 'Nuevo',
                ],
            ],
            'pieza' => [
                'modelo' => Pieza::class,
                'store'  => route('admin.piezas.store'),
                'update' => fn ($m) => route('admin.piezas.update', $m),
                'datos'  => [
                    'nombre' => 'Pantalla incell', 'categoria' => 'Pantalla', 'compatibilidad' => 'iPhone 11',
                    'cantidad' => 6, 'precio_costo' => 180, 'precio_venta' => 420,
                ],
            ],
        };
    }

    private function celular(array $datos = []): Celular
    {
        return Celular::create(array_merge([
            'modelo' => 'IPHONE 15 PRO', 'capacidad' => '256 GB', 'color' => 'NEGRO', 'bateria' => '90',
            'imei_1' => '356789012345678', 'estado_imei' => 'libre', 'procedencia' => 'EEUU',
            'precio_costo' => 6000, 'precio_venta' => 7500, 'precio_tienda' => 7000, 'estado' => 'disponible',
        ], $datos));
    }

    // ─── Alta y edición ──────────────────────────────────────────────────────

    #[DataProvider('tipos')]
    public function test_el_alta_con_precio_para_tiendas_lo_guarda(string $clave): void
    {
        $t = $this->tipo($clave);

        $this->actingAs($this->admin())
            ->post($t['store'], $t['datos'] + ['precio_tienda' => 105.5])
            ->assertSessionHasNoErrors();

        $this->assertEquals(105.5, $t['modelo']::firstOrFail()->precio_tienda);
    }

    #[DataProvider('tipos')]
    public function test_el_alta_sin_mandar_el_precio_para_tiendas_queda_en_null(string $clave): void
    {
        $t = $this->tipo($clave);

        $this->actingAs($this->admin())->post($t['store'], $t['datos'])->assertSessionHasNoErrors();

        $this->assertNull($t['modelo']::firstOrFail()->precio_tienda);
    }

    #[DataProvider('tipos')]
    public function test_el_alta_con_el_campo_vacio_queda_en_null_y_no_en_cero(string $clave): void
    {
        $t = $this->tipo($clave);

        // Así viaja el campo de un formulario sin llenar
        $this->actingAs($this->admin())->post($t['store'], $t['datos'] + ['precio_tienda' => ''])->assertSessionHasNoErrors();

        $this->assertNull($t['modelo']::firstOrFail()->precio_tienda);
    }

    #[DataProvider('tipos')]
    public function test_la_edicion_cambia_el_precio_para_tiendas_y_se_puede_vaciar(string $clave): void
    {
        $t = $this->tipo($clave);
        $admin = $this->admin();

        $this->actingAs($admin)->post($t['store'], $t['datos'] + ['precio_tienda' => 100])->assertSessionHasNoErrors();
        $producto = $t['modelo']::firstOrFail();

        $this->actingAs($admin)->put($t['update']($producto), $t['datos'] + ['precio_tienda' => 130.25])
            ->assertSessionHasNoErrors();
        $this->assertEquals(130.25, $producto->refresh()->precio_tienda);

        // Vaciar el campo en el formulario lo deja sin precio para tiendas, no en cero
        $this->actingAs($admin)->put($t['update']($producto), $t['datos'] + ['precio_tienda' => null])
            ->assertSessionHasNoErrors();
        $this->assertNull($producto->refresh()->precio_tienda);
    }

    #[DataProvider('tipos')]
    public function test_un_precio_para_tiendas_negativo_o_invalido_da_error(string $clave): void
    {
        $t = $this->tipo($clave);
        $admin = $this->admin();

        foreach ([-5, 'abc', 100000000] as $malo) {
            $this->actingAs($admin)->post($t['store'], $t['datos'] + ['precio_tienda' => $malo])
                ->assertSessionHasErrors('precio_tienda');
        }
        $this->assertSame(0, $t['modelo']::count());

        // El mismo control al editar: el valor guardado no se pisa
        $this->actingAs($admin)->post($t['store'], $t['datos'] + ['precio_tienda' => 100]);
        $producto = $t['modelo']::firstOrFail();
        $this->actingAs($admin)->put($t['update']($producto), $t['datos'] + ['precio_tienda' => -1])
            ->assertSessionHasErrors('precio_tienda');
        $this->assertEquals(100, $producto->refresh()->precio_tienda);
    }

    public function test_cero_o_negativo_no_es_un_precio_para_tiendas(): void
    {
        $t = $this->tipo('celular');
        $mensaje = 'El precio para tiendas tiene que ser mayor a cero. Si no le vendes a tiendas, déjalo vacío.';

        // Cero sería «se vende a tiendas gratis»: si no hay precio, el campo va vacío
        foreach ([0, -5] as $precio) {
            $this->actingAs($this->admin())->post($t['store'], $t['datos'] + ['precio_tienda' => $precio])
                ->assertSessionHasErrors(['precio_tienda' => $mensaje]);
        }
    }

    // ─── El administrador lo ve ──────────────────────────────────────────────

    public function test_el_listado_del_administrador_trae_el_precio_para_tiendas(): void
    {
        $this->celular();
        ProductoGeneral::create([
            'codigo' => 'FUNDA_1', 'tipo' => 'funda', 'nombre' => 'Funda', 'procedencia' => 'GZ',
            'precio_costo' => 25, 'precio_venta' => 60, 'precio_tienda' => 45, 'estado' => 'disponible',
        ]);
        Pieza::create(['nombre' => 'Batería', 'cantidad' => 3, 'precio_costo' => 80, 'precio_venta' => 200, 'precio_tienda' => 150]);

        $admin = $this->admin();

        $this->actingAs($admin)->get(route('admin.celulares.index'))
            ->assertInertia(fn (Assert $p) => $p->where('celulares.0.precio_tienda', fn ($v) => (float) $v === 7000.0));
        $this->actingAs($admin)->get(route('admin.productos-generales.index'))
            ->assertInertia(fn (Assert $p) => $p->where('productos.0.precio_tienda', fn ($v) => (float) $v === 45.0));
        $this->actingAs($admin)->get(route('admin.piezas.index'))
            ->assertInertia(fn (Assert $p) => $p->where('piezas.data.0.precio_tienda', fn ($v) => (float) $v === 150.0));
    }

    // ─── El vendedor no lo recibe ────────────────────────────────────────────

    public function test_la_api_de_stock_no_le_manda_el_precio_para_tiendas_al_vendedor(): void
    {
        $this->celular();
        ProductoGeneral::create([
            'codigo' => 'FUNDA_1', 'tipo' => 'funda', 'nombre' => 'Funda', 'procedencia' => 'GZ',
            'precio_costo' => 25, 'precio_venta' => 60, 'precio_tienda' => 45, 'estado' => 'disponible',
        ]);
        Pieza::create(['nombre' => 'Batería', 'cantidad' => 3, 'precio_costo' => 80, 'precio_venta' => 200, 'precio_tienda' => 150]);

        $vendedor = $this->vendedor();
        foreach (['api.stock.celulares', 'api.stock.productos_generales', 'api.stock.piezas'] as $ruta) {
            $this->actingAs($vendedor)->getJson(route($ruta))
                ->assertOk()
                ->assertJsonCount(1)
                ->assertJsonMissingPath('0.precio_tienda');
        }

        // El administrador sí lo recibe (menos en las piezas, que arman su propia lista de columnas)
        $this->actingAs($this->admin())->getJson(route('api.stock.celulares'))
            ->assertJsonPath('0.precio_tienda', fn ($v) => (float) $v === 7000.0);
    }

    public function test_el_stock_del_vendedor_no_manda_el_precio_para_tiendas(): void
    {
        $this->celular();

        $this->actingAs($this->vendedor())->get(route('vendedor.productos.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('productos.data.0.precio_tienda')
                ->where('productos.data.0.precio_venta', fn ($v) => (float) $v === 7500.0));
    }

    public function test_la_cotizacion_del_vendedor_no_manda_el_precio_para_tiendas_ni_el_costo(): void
    {
        $this->celular();

        $this->actingAs($this->vendedor())->get(route('vendedor.cotizaciones.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Cotizaciones/Create')
                ->has('celulares', 1)
                ->missing('celulares.0.precio_tienda')
                ->missing('celulares.0.precio_costo')
                ->where('celulares.0.precio_venta', fn ($v) => (float) $v === 7500.0));

        // El administrador cotiza viendo todo
        $this->actingAs($this->admin())->get(route('admin.cotizaciones.create'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('celulares.0.precio_tienda', fn ($v) => (float) $v === 7000.0));
    }

    public function test_sin_costos_quita_el_precio_para_tiendas_en_cualquier_nivel(): void
    {
        $fila = ['id' => 1, 'precio_venta' => 60, 'precio_tienda' => 45, 'items' => [['precio_tienda' => 45, 'precio_venta' => 60]]];

        $this->assertArrayNotHasKey('precio_tienda', SinCostos::deArreglo($fila));
        $this->assertArrayNotHasKey('precio_tienda', SinCostos::deArreglo($fila)['items'][0]);

        $anidado = SinCostos::purgar(['venta' => ['items' => [['celular' => $fila]]]]);
        $this->assertArrayNotHasKey('precio_tienda', $anidado['venta']['items'][0]['celular']);
        $this->assertSame(60, $anidado['venta']['items'][0]['celular']['precio_venta']);
    }

    // ─── Otros caminos que crean productos ───────────────────────────────────

    public function test_una_pieza_que_llega_por_traspaso_conserva_el_precio_para_tiendas(): void
    {
        $cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $sucre = Sucursal::where('prefijo', 'SUC')->firstOrFail();
        $pieza = Pieza::withoutGlobalScope('sucursal')->create([
            'sucursal_id' => $cochabamba->id, 'nombre' => 'Pantalla incell', 'categoria' => 'Pantalla',
            'compatibilidad' => 'iPhone 11', 'cantidad' => 6, 'precio_costo' => 180, 'precio_venta' => 420, 'precio_tienda' => 350,
        ]);
        $superAdmin = User::factory()->create(['rol' => 'admin', 'sucursal_id' => null]);

        $this->actingAs($superAdmin)->post(route('admin.traspasos.store'), [
            'origen_sucursal_id'  => $cochabamba->id,
            'destino_sucursal_id' => $sucre->id,
            'items'               => [['tipo' => 'pieza', 'producto_id' => $pieza->id, 'cantidad' => 4]],
        ])->assertSessionHas('success');
        $this->actingAs($superAdmin)->post(route('admin.traspasos.recibir', Traspaso::firstOrFail()));

        $llegada = Pieza::withoutGlobalScope('sucursal')->where('sucursal_id', $sucre->id)->firstOrFail();
        $this->assertEquals(350, $llegada->precio_tienda);
    }
}

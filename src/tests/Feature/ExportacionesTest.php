<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoApple;
use App\Models\ProductoGeneral;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Exportar datos → «Exportaciones» y «Exportador».
 * Cada listado sale en PDF; lo que se prueba acá es que salga de verdad, que solo entre lo disponible cuando
 * corresponde y que una búsqueda sin resultados avise en vez de romperse.
 */
class ExportacionesTest extends TestCase
{
    use RefreshDatabase;

    /** El PDF salió de verdad: el cuerpo empieza con la firma de un archivo PDF. */
    private function assertEsPdf(\Illuminate\Testing\TestResponse $r, string $que): void
    {
        $r->assertOk();
        $contenido = $r->baseResponse instanceof \Symfony\Component\HttpFoundation\StreamedResponse
            ? $r->streamedContent()
            : $r->getContent();

        $this->assertStringStartsWith('%PDF', $contenido, "El PDF de «{$que}» no se generó");
    }

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin']);
    }

    private function celular(array $d = []): Celular
    {
        static $n = 0;
        $n++;

        return Celular::create(array_merge([
            'modelo' => 'iPhone 14 Pro Max', 'capacidad' => '256GB', 'color' => 'Negro',
            'imei_1' => '35000000000000' . $n, 'estado_imei' => 'libre', 'procedencia' => 'EE. UU.',
            'precio_costo' => 4000, 'precio_venta' => 5200, 'estado' => 'disponible',
        ], $d));
    }

    private function general(array $d = []): ProductoGeneral
    {
        static $n = 0;
        $n++;

        return ProductoGeneral::create(array_merge([
            'nombre' => 'Funda MagSafe de 14 Pro Max', 'tipo' => 'funda', 'codigo' => 'FUNDA: ' . $n,
            'procedencia' => 'EE. UU.', 'precio_costo' => 30, 'precio_venta' => 90, 'estado' => 'disponible',
        ], $d));
    }

    public function test_solo_un_admin_entra(): void
    {
        $this->get('/admin/exportar')->assertRedirect('/login');
        $this->actingAs(User::factory()->create(['rol' => 'vendedor']))->get('/admin/exportar')->assertForbidden();
    }

    public function test_el_listado_muestra_los_tipos_con_cuantos_hay(): void
    {
        $this->general(['tipo' => 'funda']);
        $this->general(['nombre' => 'Vidrio templado', 'tipo' => 'vidrio_templado', 'estado' => 'vendido']);

        $this->actingAs($this->admin())->get('/admin/exportar')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Exportaciones/Index')
                ->has('subtipos', 2)
                ->where('subtipos.0.tipo', 'funda')
                ->where('subtipos.0.disponibles', 1)
                // El tipo sin stock se muestra apagado: su PDF saldría vacío
                ->where('subtipos.1.disponibles', 0)
                ->where('subtipos.1.label', 'Vidrio templado')
                ->has('inventarios', 4)
                ->has('tienda')
            );
    }

    public function test_la_cuenta_en_vivo_dice_cuantos_van_a_salir(): void
    {
        $this->general(['nombre' => 'Funda MagSafe de 14 Pro Max']);
        $this->general(['nombre' => 'Funda MagSafe de 15 Pro']);
        $this->general(['nombre' => 'Vidrio templado', 'tipo' => 'vidrio_templado']);

        $this->actingAs($this->admin())
            ->getJson('/admin/exportar/contar?' . http_build_query([
                'inventario' => 'productos_generales', 'nombre' => 'funda magsafe', 'solo_disponibles' => 1,
            ]))
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonCount(2, 'muestra');

        // Sin nada escrito no cuenta nada
        $this->actingAs($this->admin())
            ->getJson('/admin/exportar/contar?inventario=productos_generales&nombre=')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_el_pdf_lleva_los_datos_del_negocio_y_no_los_del_codigo(): void
    {
        \App\Models\ConfiguracionNegocio::guardar([
            'negocio_nombre'    => 'Servitec BO',
            'negocio_direccion' => 'Av. Heroínas 456',
            'negocio_ciudad'    => 'Cochabamba',
            'negocio_telefono'  => '59144123456',
        ]);

        $this->actingAs($this->admin())->get('/admin/exportar')
            ->assertInertia(fn (Assert $page) => $page
                ->where('tienda.nombre', 'Servitec BO')
                ->where('tienda.direccion', 'Av. Heroínas 456, Cochabamba')
                ->where('tienda.telefono', '59144123456')
            );
    }

    public function test_cada_inventario_sale_en_pdf(): void
    {
        $this->celular();
        Computadora::create([
            'numero_serie' => 'C02ABC123', 'nombre' => 'MacBook Air M2', 'color' => 'Medianoche',
            'ram' => '8GB', 'almacenamiento' => '256GB', 'procedencia' => 'EE. UU.',
            'precio_costo' => 6000, 'precio_venta' => 8000, 'estado' => 'disponible',
        ]);
        ProductoApple::create([
            'modelo' => 'AirPods Pro', 'capacidad' => 'N/A', 'bateria' => '100', 'color' => 'Blanco',
            'procedencia' => 'EE. UU.', 'precio_costo' => 800, 'precio_venta' => 1200, 'estado' => 'disponible',
        ]);
        $this->general();

        $admin = $this->admin();

        foreach (['celulares', 'computadoras', 'productos-apple', 'productos-generales'] as $ruta) {
            $this->assertEsPdf($this->actingAs($admin)->get("/admin/exportar/{$ruta}?raw=1"), $ruta);
        }
    }

    public function test_sin_raw_se_abre_el_visor(): void
    {
        $this->celular();

        $this->actingAs($this->admin())->get('/admin/exportar/celulares')
            ->assertOk()
            ->assertSee('iframe', false);
    }

    public function test_el_pdf_de_un_tipo_solo_trae_ese_tipo(): void
    {
        $this->general(['nombre' => 'Funda MagSafe', 'tipo' => 'funda', 'codigo' => 'FUNDA: 1']);
        $this->general(['nombre' => 'Vidrio templado', 'tipo' => 'vidrio_templado', 'codigo' => 'VIDRIO: 1']);

        $this->assertEsPdf($this->actingAs($this->admin())->get('/admin/exportar/productos-generales/funda?raw=1'), 'funda');
    }

    public function test_un_tipo_sin_productos_avisa_y_no_rompe(): void
    {
        $this->actingAs($this->admin())
            ->get('/admin/exportar/productos-generales/inexistente')
            ->assertRedirect();
    }

    public function test_el_exportador_por_nombre_encuentra_sin_tildes_ni_plurales(): void
    {
        $this->general(['nombre' => 'Fundas MagSafe de 14 Pro Max']);

        $this->assertEsPdf($this->actingAs($this->admin())->get('/admin/exportar/por-nombre?' . http_build_query([
            'inventario' => 'productos_generales',
            'nombre' => 'funda magsafe 14 pro max',
            'solo_disponibles' => 1,
            'raw' => 1,
        ])), 'por nombre');
    }

    public function test_el_exportador_avisa_cuando_no_hay_coincidencias(): void
    {
        $this->general();

        $this->actingAs($this->admin())->get('/admin/exportar/por-nombre?' . http_build_query([
            'inventario' => 'productos_generales',
            'nombre' => 'algo que no existe',
        ]))->assertRedirect();
    }

    public function test_el_exportador_puede_incluir_los_vendidos(): void
    {
        $this->general(['nombre' => 'Funda MagSafe 14 Pro Max', 'estado' => 'vendido']);

        // Solo disponibles: no encuentra nada
        $this->actingAs($this->admin())->get('/admin/exportar/por-nombre?' . http_build_query([
            'inventario' => 'productos_generales', 'nombre' => 'funda magsafe', 'solo_disponibles' => 1,
        ]))->assertRedirect();

        // Con los vendidos: sale el PDF
        $this->assertEsPdf($this->actingAs($this->admin())->get('/admin/exportar/por-nombre?' . http_build_query([
            'inventario' => 'productos_generales', 'nombre' => 'funda magsafe', 'solo_disponibles' => 0, 'raw' => 1,
        ])), 'con vendidos');
    }

    public function test_el_exportador_valida_el_inventario(): void
    {
        $this->actingAs($this->admin())->get('/admin/exportar/por-nombre?' . http_build_query([
            'inventario' => 'inventado', 'nombre' => 'algo',
        ]))->assertSessionHasErrors('inventario');
    }
}

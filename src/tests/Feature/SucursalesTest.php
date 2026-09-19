<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\Cliente;
use App\Models\Sucursal;
use App\Models\User;
use App\Services\GeneradorCodigos;
use App\Support\SucursalActiva;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Cada sucursal se administra sola.
 *
 * Lo que se prueba acá es la baranda del sistema: que alguien de Cochabamba no vea, ni tocando la
 * dirección a mano, nada de Sucre; y que el super administrador sí vea todo y pueda filtrar.
 */
class SucursalesTest extends TestCase
{
    use RefreshDatabase;

    private Sucursal $cochabamba;
    private Sucursal $sucre;

    protected function setUp(): void
    {
        parent::setUp();

        $this->cochabamba = Sucursal::where('prefijo', 'CBA')->firstOrFail();
        $this->sucre      = Sucursal::where('prefijo', 'SUC')->firstOrFail();
    }

    private function superAdmin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'sucursal_id' => null]);
    }

    private function adminDe(Sucursal $sucursal): User
    {
        return User::factory()->create(['rol' => 'admin', 'sucursal_id' => $sucursal->id]);
    }

    private function celularEn(Sucursal $sucursal, string $imei): Celular
    {
        return Celular::withoutGlobalScope('sucursal')->create([
            'sucursal_id' => $sucursal->id,
            'modelo' => 'Equipo ' . $sucursal->prefijo, 'capacidad' => '128GB', 'color' => 'Negro',
            'estado_imei' => 'libre', 'imei_1' => $imei, 'procedencia' => 'EE. UU.',
            'precio_costo' => 1000, 'precio_venta' => 1500, 'estado' => 'disponible', 'condicion' => 'Nuevo',
        ]);
    }

    // ─── Las dos sucursales del sistema ──────────────────────────────────────

    public function test_el_sistema_arranca_con_las_dos_sucursales(): void
    {
        $this->assertSame(['Cochabamba', 'Sucre'], Sucursal::activas()->pluck('nombre')->all());
        $this->assertSame(['CBA', 'SUC'], Sucursal::activas()->pluck('prefijo')->all());
    }

    // ─── Aislamiento ─────────────────────────────────────────────────────────

    public function test_cada_sucursal_solo_ve_su_inventario(): void
    {
        $deCochabamba = $this->celularEn($this->cochabamba, '350000000000001');
        $deSucre      = $this->celularEn($this->sucre, '350000000000002');

        $this->actingAs($this->adminDe($this->cochabamba))
            ->get(route('admin.celulares.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('celulares', 1)
                ->where('celulares.0.id', $deCochabamba->id));

        $this->actingAs($this->adminDe($this->sucre))
            ->get(route('admin.celulares.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('celulares', 1)
                ->where('celulares.0.id', $deSucre->id));
    }

    public function test_no_se_abre_un_registro_de_otra_sucursal_ni_escribiendo_la_direccion(): void
    {
        $deSucre = $this->celularEn($this->sucre, '350000000000003');

        // El alcance global lo deja fuera de la consulta: para Cochabamba, ese equipo no existe
        $this->actingAs($this->adminDe($this->cochabamba))
            ->get(route('admin.celulares.edit', $deSucre->id))
            ->assertNotFound();
    }

    public function test_el_super_admin_ve_las_dos_y_puede_filtrar(): void
    {
        $this->celularEn($this->cochabamba, '350000000000004');
        $this->celularEn($this->sucre, '350000000000005');

        $jefe = $this->superAdmin();

        // Sin elegir nada, ve el negocio entero
        $this->actingAs($jefe)->get(route('admin.celulares.index'))
            ->assertInertia(fn (Assert $page) => $page->has('celulares', 2));

        // Al elegir Sucre, solo ve Sucre
        $this->actingAs($jefe)->post(route('admin.sucursal-activa.update'), ['sucursal_id' => $this->sucre->id]);
        $this->actingAs($jefe)->get(route('admin.celulares.index'))
            ->assertInertia(fn (Assert $page) => $page->has('celulares', 1));

        // Y al volver a «Todas», las dos otra vez
        $this->actingAs($jefe)->post(route('admin.sucursal-activa.update'), ['sucursal_id' => null]);
        $this->actingAs($jefe)->get(route('admin.celulares.index'))
            ->assertInertia(fn (Assert $page) => $page->has('celulares', 2));
    }

    public function test_quien_tiene_sucursal_no_puede_cambiarse_a_otra(): void
    {
        $deCochabamba = $this->adminDe($this->cochabamba);

        $this->actingAs($deCochabamba)
            ->post(route('admin.sucursal-activa.update'), ['sucursal_id' => $this->sucre->id]);

        $this->actingAs($deCochabamba);
        $this->assertSame($this->cochabamba->id, SucursalActiva::id());
    }

    public function test_lo_que_se_carga_queda_en_la_sucursal_de_quien_lo_carga(): void
    {
        $this->actingAs($this->adminDe($this->sucre));

        $cliente = Cliente::create(['nombre' => 'Cliente de prueba', 'telefono' => '700', 'user_id' => auth()->id()]);

        $this->assertSame($this->sucre->id, $cliente->sucursal_id);
    }

    // ─── Códigos de nota ─────────────────────────────────────────────────────

    public function test_cada_sucursal_numera_sus_codigos_por_su_cuenta(): void
    {
        $this->assertSame('CBA-V001', GeneradorCodigos::siguienteVenta($this->cochabamba->id));
        $this->assertSame('SUC-V001', GeneradorCodigos::siguienteVenta($this->sucre->id));

        // Consumir uno en Cochabamba no mueve el contador de Sucre
        GeneradorCodigos::crearVentaConCodigo(fn (string $codigo) => $codigo, $this->cochabamba->id);

        $this->assertSame('CBA-V002', GeneradorCodigos::siguienteVenta($this->cochabamba->id));
        $this->assertSame('SUC-V001', GeneradorCodigos::siguienteVenta($this->sucre->id));
    }

    public function test_los_codigos_de_dos_sucursales_nunca_chocan(): void
    {
        $unoDeCada = [
            GeneradorCodigos::crearVentaConCodigo(fn ($c) => $c, $this->cochabamba->id),
            GeneradorCodigos::crearVentaConCodigo(fn ($c) => $c, $this->sucre->id),
        ];

        $this->assertSame(['CBA-V001', 'SUC-V001'], $unoDeCada);
        $this->assertCount(2, array_unique($unoDeCada));
    }

    // ─── Dar acceso: rol y sucursal ──────────────────────────────────────────

    public function test_al_dar_acceso_se_elige_rol_y_sucursal(): void
    {
        $this->actingAs($this->superAdmin())
            ->post(route('admin.usuarios.store'), [
                'name' => 'Vendedor de Sucre', 'email' => 'sucre@ejemplo.test',
                'rol' => 'vendedor', 'sucursal_id' => $this->sucre->id,
                'password' => 'Clave1234', 'password_confirmation' => 'Clave1234',
            ])
            ->assertSessionHasNoErrors();

        $creado = User::where('email', 'sucre@ejemplo.test')->firstOrFail();

        $this->assertSame('vendedor', $creado->rol);
        $this->assertSame($this->sucre->id, $creado->sucursal_id);
        $this->assertFalse($creado->esSuperAdmin());
    }

    public function test_sin_sucursal_la_cuenta_es_super_administradora(): void
    {
        $this->actingAs($this->superAdmin())
            ->post(route('admin.usuarios.store'), [
                'name' => 'Segundo jefe', 'email' => 'jefe2@ejemplo.test',
                'rol' => 'admin', 'sucursal_id' => null,
                'password' => 'Clave1234', 'password_confirmation' => 'Clave1234',
            ])
            ->assertSessionHasNoErrors();

        $this->assertTrue(User::where('email', 'jefe2@ejemplo.test')->firstOrFail()->esSuperAdmin());
    }

    public function test_un_admin_de_sucursal_no_puede_crear_super_administradores(): void
    {
        $this->actingAs($this->adminDe($this->cochabamba))
            ->post(route('admin.usuarios.store'), [
                'name' => 'Intento', 'email' => 'intento@ejemplo.test',
                'rol' => 'admin', 'sucursal_id' => null,
                'password' => 'Clave1234', 'password_confirmation' => 'Clave1234',
            ])
            ->assertSessionHasErrors('sucursal_id');

        $this->assertDatabaseMissing('users', ['email' => 'intento@ejemplo.test']);
    }

    public function test_un_admin_de_sucursal_no_puede_dar_acceso_a_otra(): void
    {
        $this->actingAs($this->adminDe($this->cochabamba))
            ->post(route('admin.usuarios.store'), [
                'name' => 'Ajeno', 'email' => 'ajeno@ejemplo.test',
                'rol' => 'vendedor', 'sucursal_id' => $this->sucre->id,
                'password' => 'Clave1234', 'password_confirmation' => 'Clave1234',
            ])
            ->assertSessionHasErrors('sucursal_id');
    }

    public function test_un_admin_de_sucursal_solo_ve_las_cuentas_de_la_suya(): void
    {
        $this->adminDe($this->sucre);
        $propio = $this->adminDe($this->cochabamba);

        $this->actingAs($propio)->get(route('admin.usuarios.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('soySuperAdmin', false)
                ->has('usuarios', 1)
                ->where('usuarios.0.id', $propio->id));
    }

    // ─── Administrar las sucursales ──────────────────────────────────────────

    public function test_solo_un_super_admin_administra_las_sucursales(): void
    {
        $this->actingAs($this->adminDe($this->cochabamba))
            ->get(route('admin.sucursales.index'))
            ->assertForbidden();

        $this->actingAs($this->superAdmin())
            ->get(route('admin.sucursales.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Sucursales/Index')->has('sucursales', 2));
    }

    public function test_se_puede_crear_una_tercera_sucursal(): void
    {
        $this->actingAs($this->superAdmin())
            ->post(route('admin.sucursales.store'), [
                'nombre' => 'La Paz', 'prefijo' => 'lpz', 'ciudad' => 'La Paz',
            ])
            ->assertSessionHasNoErrors();

        $creada = Sucursal::where('nombre', 'La Paz')->firstOrFail();

        // El prefijo se guarda siempre en mayúsculas
        $this->assertSame('LPZ', $creada->prefijo);
        $this->assertSame('LPZ-V001', GeneradorCodigos::siguienteVenta($creada->id));
    }

    public function test_dos_sucursales_no_pueden_tener_el_mismo_prefijo(): void
    {
        $this->actingAs($this->superAdmin())
            ->post(route('admin.sucursales.store'), ['nombre' => 'Otra', 'prefijo' => 'CBA'])
            ->assertSessionHasErrors('prefijo');
    }

    public function test_una_sucursal_con_movimiento_no_se_borra(): void
    {
        $this->celularEn($this->cochabamba, '350000000000006');

        $this->actingAs($this->superAdmin())
            ->delete(route('admin.sucursales.destroy', $this->cochabamba->id))
            ->assertSessionHas('error');

        $this->assertDatabaseHas('sucursales', ['id' => $this->cochabamba->id]);
    }

    public function test_siempre_queda_al_menos_una_sucursal_encendida(): void
    {
        $jefe = $this->superAdmin();

        $this->actingAs($jefe)->patch(route('admin.sucursales.visibilidad', $this->sucre->id));
        $this->assertFalse($this->sucre->fresh()->activa);

        // La última encendida no se puede apagar
        $this->actingAs($jefe)->patch(route('admin.sucursales.visibilidad', $this->cochabamba->id))
            ->assertSessionHas('error');

        $this->assertTrue($this->cochabamba->fresh()->activa);
    }
}

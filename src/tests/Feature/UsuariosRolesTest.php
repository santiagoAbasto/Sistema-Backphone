<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Support\Permisos;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Sistema → Usuarios y roles.
 *
 * Lo importante acá no es la pantalla: es que el permiso se cumpla en el servidor. Lo que un rol no tiene marcado
 * no se abre escribiendo la dirección a mano, y las barandas (el último administrador, cambiarse el rol a uno mismo)
 * no se pueden saltar.
 */
class UsuariosRolesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin']);
    }

    private function rol(array $permisos, array $extra = []): Role
    {
        Cache::flush();

        return Role::create(array_merge([
            'clave'    => 'encargado',
            'nombre'   => 'Encargado de tienda',
            'permisos' => $permisos,
            'activo'   => true,
        ], $extra));
    }

    // ─── Permisos de verdad ─────────────────────────────────────────────────

    public function test_los_dos_roles_del_sistema_quedan_cargados(): void
    {
        $this->assertDatabaseHas('roles', ['clave' => 'admin', 'del_sistema' => true]);
        $this->assertDatabaseHas('roles', ['clave' => 'vendedor', 'del_sistema' => true, 'panel_propio' => true]);

        $this->assertSame(['*'], Role::where('clave', 'admin')->first()->permisosReales());
    }

    public function test_un_rol_nuevo_entra_solo_a_lo_que_tiene_marcado(): void
    {
        $this->rol(['ventas', 'clientes']);
        $encargado = User::factory()->create(['rol' => 'encargado']);

        // Lo que tiene marcado: entra
        $this->actingAs($encargado)->get('/admin/ventas')->assertOk();
        $this->actingAs($encargado)->get('/admin/clientes')->assertOk();

        // Lo que no: 403, aunque escriba la dirección a mano
        $this->actingAs($encargado)->get('/admin/egresos')->assertForbidden();
        $this->actingAs($encargado)->get('/admin/configuracion/negocio')->assertForbidden();
        $this->actingAs($encargado)->get('/admin/usuarios')->assertForbidden();
    }

    public function test_lo_que_no_esta_en_ningun_modulo_queda_para_administradores(): void
    {
        $this->rol(['ventas']);
        $encargado = User::factory()->create(['rol' => 'encargado']);

        // `admin.google.auth` no pertenece a ningún módulo del catálogo
        $this->actingAs($encargado)->get('/admin/exportar')->assertForbidden();
        $this->actingAs($this->admin())->get('/admin/exportar')->assertOk();
    }

    public function test_el_administrador_entra_a_todo_aunque_le_borren_los_permisos(): void
    {
        Role::where('clave', 'admin')->update(['permisos' => json_encode([])]);
        Cache::flush();

        $this->actingAs($this->admin())->get('/admin/usuarios')->assertOk();
        $this->actingAs($this->admin())->get('/admin/configuracion/negocio')->assertOk();
    }

    public function test_una_cuenta_con_un_rol_que_ya_no_existe_no_entra_al_panel(): void
    {
        // El rol se borró, o la cuenta quedó con un valor viejo: no abre nada
        $huerfano = User::factory()->create(['rol' => 'rol-borrado']);

        $this->actingAs($huerfano)->get('/admin/ventas')->assertForbidden();
        $this->actingAs($huerfano)->get('/admin/usuarios')->assertForbidden();
    }

    public function test_un_rol_apagado_deja_de_abrir_el_panel(): void
    {
        $rol = $this->rol(['ventas']);
        $encargado = User::factory()->create(['rol' => 'encargado']);

        $this->actingAs($encargado)->get('/admin/ventas')->assertOk();

        $rol->update(['activo' => false]);
        Cache::flush();

        $this->actingAs($encargado)->get('/admin/ventas')->assertForbidden();
    }

    public function test_el_menu_recibe_los_permisos_del_rol(): void
    {
        $this->rol(['ventas', 'clientes']);
        $encargado = User::factory()->create(['rol' => 'encargado']);

        $this->actingAs($encargado)->get('/admin/ventas')
            ->assertInertia(fn (Assert $page) => $page->where('auth.permisos', ['ventas', 'clientes']));

        $this->actingAs($this->admin())->get('/admin/usuarios')
            ->assertInertia(fn (Assert $page) => $page->where('auth.permisos', ['*']));
    }

    // ─── La pantalla ────────────────────────────────────────────────────────

    public function test_la_pantalla_lista_usuarios_roles_y_modulos(): void
    {
        User::factory()->create(['rol' => 'vendedor', 'name' => 'Lucía Fernández']);

        $this->actingAs($this->admin())->get('/admin/usuarios')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Usuarios/Index')
                ->has('usuarios', 2)
                ->has('roles', 2)
                ->has('permisos')
                ->where('resumen.admins', 1)
                ->has('yo')
            );
    }

    public function test_la_busqueda_de_usuarios_funciona_en_cualquier_base(): void
    {
        User::factory()->create(['rol' => 'vendedor', 'name' => 'Lucia Ferreira', 'email' => 'Lucia@Correo.com']);

        $this->actingAs($this->admin())->get('/admin/usuarios?q=FERREIRA')
            ->assertInertia(fn (Assert $page) => $page->has('usuarios', 1));

        $this->actingAs($this->admin())->get('/admin/usuarios?q=lucia@correo')
            ->assertInertia(fn (Assert $page) => $page->has('usuarios', 1));
    }

    // ─── Usuarios ───────────────────────────────────────────────────────────

    public function test_crear_un_usuario_con_su_rol_y_su_contrasena(): void
    {
        $this->actingAs($this->admin())->post('/admin/usuarios', [
            'name' => '  Martín Ibáñez  ',
            'email' => 'MARTIN@correo.com',
            'rol' => 'vendedor',
            'password' => 'unaclave123',
            'password_confirmation' => 'unaclave123',
        ])->assertRedirect()->assertSessionHas('success');

        $u = User::where('email', 'martin@correo.com')->first();
        $this->assertNotNull($u);
        $this->assertSame('Martín Ibáñez', $u->name);
        $this->assertSame('vendedor', $u->rol);
        // La contraseña se guarda cifrada, nunca en claro
        $this->assertNotSame('unaclave123', $u->password);
        $this->assertTrue(Hash::check('unaclave123', $u->password));
    }

    public function test_la_contrasena_pide_letras_numeros_y_largo(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->post('/admin/usuarios', [
            'name' => 'Prueba', 'email' => 'p@correo.com', 'rol' => 'vendedor',
            'password' => 'corta1', 'password_confirmation' => 'corta1',
        ])->assertSessionHasErrors('password');

        $this->actingAs($admin)->post('/admin/usuarios', [
            'name' => 'Prueba', 'email' => 'p@correo.com', 'rol' => 'vendedor',
            'password' => 'sololetrasaqui', 'password_confirmation' => 'sololetrasaqui',
        ])->assertSessionHasErrors('password');

        $this->actingAs($admin)->post('/admin/usuarios', [
            'name' => 'Prueba', 'email' => 'p@correo.com', 'rol' => 'vendedor',
            'password' => 'clavebuena1', 'password_confirmation' => 'otracosa1',
        ])->assertSessionHasErrors('password');
    }

    public function test_no_se_puede_crear_un_usuario_con_un_rol_que_no_existe(): void
    {
        $this->actingAs($this->admin())->post('/admin/usuarios', [
            'name' => 'Prueba', 'email' => 'p@correo.com', 'rol' => 'inventado',
            'password' => 'clavebuena1', 'password_confirmation' => 'clavebuena1',
        ])->assertSessionHasErrors('rol');
    }

    public function test_nadie_se_cambia_el_rol_a_si_mismo(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->patch("/admin/usuarios/{$admin->id}", [
            'name' => $admin->name, 'email' => $admin->email, 'rol' => 'vendedor',
        ])->assertSessionHasErrors('rol');

        $this->assertSame('admin', $admin->fresh()->rol);
    }

    public function test_no_se_puede_dejar_la_tienda_sin_administrador(): void
    {
        $admin = $this->admin();
        $otro = User::factory()->create(['rol' => 'admin']);

        // Con dos administradores sí se puede bajar a uno
        $this->actingAs($admin)->patch("/admin/usuarios/{$otro->id}", [
            'name' => $otro->name, 'email' => $otro->email, 'rol' => 'vendedor',
        ])->assertSessionHasNoErrors();

        // Y ahora ya no: queda uno solo
        $this->actingAs($admin)->delete("/admin/usuarios/{$admin->id}")->assertSessionHasErrors('usuario');
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_borrar_un_usuario_le_quita_el_acceso(): void
    {
        $otro = User::factory()->create(['rol' => 'vendedor']);

        $this->actingAs($this->admin())->delete("/admin/usuarios/{$otro->id}")
            ->assertRedirect()->assertSessionHas('success');

        $this->assertDatabaseMissing('users', ['id' => $otro->id]);
    }

    public function test_cambiar_la_contrasena_de_otro_sin_tocar_lo_demas(): void
    {
        $otro = User::factory()->create(['rol' => 'vendedor', 'name' => 'Lucía']);

        $this->actingAs($this->admin())->patch("/admin/usuarios/{$otro->id}", [
            'name' => 'Lucía', 'email' => $otro->email, 'rol' => 'vendedor',
            'password' => 'nuevaclave1', 'password_confirmation' => 'nuevaclave1',
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check('nuevaclave1', $otro->fresh()->password));
    }

    // ─── Roles ──────────────────────────────────────────────────────────────

    public function test_crear_un_rol_le_arma_su_clave(): void
    {
        $this->actingAs($this->admin())->post('/admin/roles', [
            'nombre' => 'Encargado de tienda',
            'descripcion' => 'Atiende el local',
            'permisos' => ['ventas', 'inventario'],
        ])->assertRedirect()->assertSessionHas('success');

        $rol = Role::where('nombre', 'Encargado de tienda')->first();
        $this->assertSame('encargado-de-tienda', $rol->clave);
        $this->assertSame(['ventas', 'inventario'], $rol->permisos);
        $this->assertFalse($rol->del_sistema);
    }

    public function test_un_rol_sin_modulos_no_se_guarda(): void
    {
        $this->actingAs($this->admin())->post('/admin/roles', [
            'nombre' => 'Rol vacío', 'permisos' => [],
        ])->assertSessionHasErrors('permisos');
    }

    public function test_un_modulo_inventado_se_rechaza(): void
    {
        $this->actingAs($this->admin())->post('/admin/roles', [
            'nombre' => 'Rol raro', 'permisos' => ['ventas', 'modulo-que-no-existe'],
        ])->assertSessionHasErrors('permisos.1');
    }

    public function test_al_administrador_no_se_le_pueden_quitar_permisos(): void
    {
        $rolAdmin = Role::where('clave', 'admin')->first();

        $this->actingAs($this->admin())->patch("/admin/roles/{$rolAdmin->id}", [
            'nombre' => 'Administrador', 'permisos' => ['ventas'], 'activo' => true,
        ])->assertSessionHasNoErrors();

        $this->assertSame(['*'], $rolAdmin->fresh()->permisos);
    }

    public function test_los_roles_del_sistema_no_se_borran(): void
    {
        $vendedor = Role::where('clave', 'vendedor')->first();

        $this->actingAs($this->admin())->delete("/admin/roles/{$vendedor->id}")
            ->assertSessionHasErrors('rol');

        $this->assertDatabaseHas('roles', ['clave' => 'vendedor']);
    }

    public function test_un_rol_con_gente_no_se_borra(): void
    {
        $rol = $this->rol(['ventas']);
        User::factory()->create(['rol' => 'encargado']);

        $this->actingAs($this->admin())->delete("/admin/roles/{$rol->id}")
            ->assertSessionHasErrors('rol');

        $this->assertDatabaseHas('roles', ['clave' => 'encargado']);
    }

    public function test_un_rol_vacio_si_se_borra(): void
    {
        $rol = $this->rol(['ventas']);

        $this->actingAs($this->admin())->delete("/admin/roles/{$rol->id}")
            ->assertRedirect()->assertSessionHas('success');

        $this->assertDatabaseMissing('roles', ['clave' => 'encargado']);
    }

    public function test_cambiar_los_permisos_de_un_rol_cambia_el_acceso_al_instante(): void
    {
        $rol = $this->rol(['ventas']);
        $encargado = User::factory()->create(['rol' => 'encargado']);

        $this->actingAs($encargado)->get('/admin/egresos')->assertForbidden();

        $this->actingAs($this->admin())->patch("/admin/roles/{$rol->id}", [
            'nombre' => 'Encargado de tienda', 'permisos' => ['ventas', 'egresos'], 'activo' => true,
        ])->assertSessionHasNoErrors();

        $this->actingAs($encargado)->get('/admin/egresos')->assertOk();
    }

    public function test_el_catalogo_de_modulos_cubre_las_rutas_del_panel(): void
    {
        // Cada módulo existe y tiene al menos una ruta que le corresponde
        foreach (Permisos::claves() as $clave) {
            $this->assertNotSame('', Permisos::etiqueta($clave));
        }

        $this->assertSame('ventas', Permisos::moduloDeRuta('admin.ventas.index'));
        $this->assertSame('ajustes', Permisos::moduloDeRuta('admin.configuracion.negocio.edit'));
        $this->assertSame('inventario', Permisos::moduloDeRuta('admin.celulares.index'));
        $this->assertSame('usuarios', Permisos::moduloDeRuta('admin.roles.store'));
        $this->assertNull(Permisos::moduloDeRuta('profile.edit'));
    }
}

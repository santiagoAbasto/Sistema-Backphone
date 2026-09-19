<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Mi perfil: lo que cada persona puede cambiar de su propia cuenta.
 *
 * La baranda que importa: nadie se amplía el acceso a sí mismo ni borra su cuenta, porque las
 * ventas quedan a su nombre.
 */
class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_pantalla_se_abre_con_los_datos_de_la_cuenta(): void
    {
        $usuario = User::factory()->create(['rol' => 'admin', 'name' => 'Ana Michel']);

        $this->actingAs($usuario)
            ->get(route('profile.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Profile/Edit')
                ->where('cuenta.name', 'Ana Michel')
                ->where('cuenta.iniciales', 'AM')
                ->where('cuenta.foto_url', null)
                ->where('cuenta.rol_nombre', 'Administrador')
                ->where('cuenta.es_super_admin', true));
    }

    public function test_se_puede_cambiar_el_nombre_y_el_correo(): void
    {
        $usuario = User::factory()->create();

        $this->actingAs($usuario)
            ->patch(route('profile.update'), ['name' => 'Nombre Nuevo', 'email' => 'nuevo@ejemplo.test'])
            ->assertSessionHasNoErrors();

        $usuario->refresh();

        $this->assertSame('Nombre Nuevo', $usuario->name);
        $this->assertSame('nuevo@ejemplo.test', $usuario->email);
        // Al cambiar el correo hay que volver a verificarlo
        $this->assertNull($usuario->email_verified_at);
    }

    public function test_si_el_correo_no_cambia_sigue_verificado(): void
    {
        $usuario = User::factory()->create();

        $this->actingAs($usuario)
            ->patch(route('profile.update'), ['name' => 'Otro Nombre', 'email' => $usuario->email]);

        $this->assertNotNull($usuario->refresh()->email_verified_at);
    }

    public function test_nadie_se_cambia_el_rol_ni_la_sucursal_desde_su_perfil(): void
    {
        $usuario = User::factory()->create(['rol' => 'vendedor', 'sucursal_id' => 1]);

        $this->actingAs($usuario)->patch(route('profile.update'), [
            'name' => $usuario->name,
            'email' => $usuario->email,
            // Lo que llegue de más se ignora: no está en las reglas del formulario
            'rol' => 'admin',
            'sucursal_id' => null,
        ]);

        $usuario->refresh();

        $this->assertSame('vendedor', $usuario->rol);
        $this->assertSame(1, $usuario->sucursal_id);
    }

    public function test_una_cuenta_no_se_borra_a_si_misma(): void
    {
        $usuario = User::factory()->create();

        // La ruta se retiró: /profile existe para ver y guardar, pero no acepta DELETE
        $this->assertFalse(app('router')->has('profile.destroy'));

        $this->actingAs($usuario)->delete('/profile')->assertMethodNotAllowed();

        $this->assertDatabaseHas('users', ['id' => $usuario->id]);
    }

    // ─── Foto de perfil ──────────────────────────────────────────────────────

    public function test_se_puede_subir_una_foto(): void
    {
        Storage::fake('public');
        $usuario = User::factory()->create();

        $this->actingAs($usuario)
            ->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('yo.jpg', 800, 600)])
            ->assertSessionHasNoErrors();

        $usuario->refresh();

        $this->assertNotNull($usuario->foto);
        Storage::disk('public')->assertExists($usuario->foto);
        $this->assertStringContainsString($usuario->foto, $usuario->foto_url);
    }

    public function test_la_foto_se_guarda_cuadrada_y_chica(): void
    {
        Storage::fake('public');
        $usuario = User::factory()->create();

        $this->actingAs($usuario)
            ->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('panoramica.jpg', 1600, 900)]);

        $binario = Storage::disk('public')->get($usuario->refresh()->foto);
        [$ancho, $alto] = getimagesizefromstring($binario);

        $this->assertSame(256, $ancho);
        $this->assertSame(256, $alto);
    }

    public function test_subir_una_foto_nueva_borra_la_anterior(): void
    {
        Storage::fake('public');
        $usuario = User::factory()->create();

        $this->actingAs($usuario)->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('a.jpg', 400, 400)]);
        $primera = $usuario->refresh()->foto;

        $this->actingAs($usuario)->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('b.jpg', 400, 400)]);
        $segunda = $usuario->refresh()->foto;

        $this->assertNotSame($primera, $segunda);
        Storage::disk('public')->assertMissing($primera);
        Storage::disk('public')->assertExists($segunda);
    }

    public function test_quitar_la_foto_devuelve_las_iniciales(): void
    {
        Storage::fake('public');
        $usuario = User::factory()->create(['name' => 'Lucia Ferreira']);

        $this->actingAs($usuario)->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('yo.jpg', 400, 400)]);
        $ruta = $usuario->refresh()->foto;

        $this->actingAs($usuario)->delete(route('profile.foto.quitar'))->assertSessionHasNoErrors();

        $usuario->refresh();

        $this->assertNull($usuario->foto);
        $this->assertNull($usuario->foto_url);
        $this->assertSame('LF', $usuario->iniciales);
        Storage::disk('public')->assertMissing($ruta);
    }

    public function test_un_archivo_que_no_es_imagen_no_pasa(): void
    {
        Storage::fake('public');
        $usuario = User::factory()->create();

        $this->actingAs($usuario)
            ->post(route('profile.foto'), ['foto' => UploadedFile::fake()->create('planilla.pdf', 300, 'application/pdf')])
            ->assertSessionHasErrors('foto');

        $this->assertNull($usuario->refresh()->foto);
    }

    public function test_una_imagen_demasiado_chica_no_pasa(): void
    {
        Storage::fake('public');
        $usuario = User::factory()->create();

        $this->actingAs($usuario)
            ->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('mini.jpg', 60, 60)])
            ->assertSessionHasErrors('foto');
    }

    public function test_la_foto_solo_la_cambia_quien_tiene_la_sesion(): void
    {
        Storage::fake('public');

        $this->post(route('profile.foto'), ['foto' => UploadedFile::fake()->image('yo.jpg', 400, 400)])
            ->assertRedirect(route('login'));
    }

    // ─── Contraseña ──────────────────────────────────────────────────────────

    public function test_se_puede_cambiar_la_contrasena(): void
    {
        $usuario = User::factory()->create(['password' => bcrypt('ClaveVieja1!')]);

        $this->actingAs($usuario)
            ->put(route('password.update'), [
                'current_password' => 'ClaveVieja1!',
                'password' => 'ClaveNueva1!',
                'password_confirmation' => 'ClaveNueva1!',
            ])
            ->assertSessionHasNoErrors();

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('ClaveNueva1!', $usuario->refresh()->password));
    }

    public function test_sin_la_contrasena_actual_no_se_cambia(): void
    {
        $usuario = User::factory()->create(['password' => bcrypt('ClaveVieja1!')]);

        $this->actingAs($usuario)
            ->put(route('password.update'), [
                'current_password' => 'LaQueNoEs1!',
                'password' => 'ClaveNueva1!',
                'password_confirmation' => 'ClaveNueva1!',
            ])
            ->assertSessionHasErrors('current_password');

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('ClaveVieja1!', $usuario->refresh()->password));
    }
}

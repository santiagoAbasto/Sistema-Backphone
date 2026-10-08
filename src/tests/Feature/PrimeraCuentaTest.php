<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * La primera cuenta de una instalación y los correos: el comando que crea al super administrador,
 * y que una mayúscula en el correo no deje a nadie afuera.
 */
class PrimeraCuentaTest extends TestCase
{
    use RefreshDatabase;

    private function crear(string $email, string $clave, ?string $repetida = null): \Illuminate\Testing\PendingCommand
    {
        return $this->artisan('usuarios:super-admin', ['email' => $email])
            ->expectsQuestion('Contraseña (no se ve al escribirla)', $clave)
            ->expectsQuestion('Repite la contraseña', $repetida ?? $clave);
    }

    public function test_el_comando_crea_un_super_administrador(): void
    {
        $this->crear('Axel@Blackphone.com.bo', 'Clave1234')->assertSuccessful();

        $axel = User::sole();

        $this->assertSame('axel@blackphone.com.bo', $axel->email);
        $this->assertSame('Axel', $axel->name);
        $this->assertSame('admin', $axel->rol);
        $this->assertTrue($axel->esSuperAdmin());
        $this->assertNotNull($axel->email_verified_at);
        $this->assertTrue(Hash::check('Clave1234', $axel->password));
    }

    public function test_si_las_claves_no_coinciden_no_crea_nada(): void
    {
        $this->crear('axel@blackphone.com.bo', 'Clave1234', 'Clave9999')->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_pide_la_misma_clave_que_el_panel(): void
    {
        $this->crear('axel@blackphone.com.bo', 'corta')->assertFailed();
        $this->crear('axel@blackphone.com.bo', 'solamenteletras')->assertFailed();

        $this->assertSame(0, User::count());
    }

    public function test_no_pisa_una_cuenta_que_ya_existe(): void
    {
        $existente = User::factory()->create(['email' => 'axel@blackphone.com.bo']);

        $this->artisan('usuarios:super-admin', ['email' => 'AXEL@blackphone.com.bo'])->assertFailed();

        $this->assertSame(1, User::count());
        $this->assertSame($existente->password, $existente->fresh()->password);
    }

    public function test_entra_aunque_escriba_el_correo_con_mayusculas(): void
    {
        $this->crear('axel@blackphone.com.bo', 'Clave1234')->assertSuccessful();

        $this->post('/login', ['email' => ' Axel@Blackphone.com.bo ', 'password' => 'Clave1234'])
            ->assertSessionHasNoErrors();

        $this->assertAuthenticatedAs(User::sole());
    }

    public function test_el_panel_guarda_el_correo_en_minusculas(): void
    {
        $jefe = User::factory()->create(['email' => 'jefe@ejemplo.test']);
        $jefe->rol = 'admin';
        $jefe->save();

        $this->actingAs($jefe)
            ->post(route('admin.usuarios.store'), [
                'name' => 'María', 'email' => 'Maria@Ejemplo.test', 'rol' => 'vendedor',
                'password' => 'Clave1234', 'password_confirmation' => 'Clave1234',
            ])
            ->assertSessionHasNoErrors();

        $this->assertTrue(User::where('email', 'maria@ejemplo.test')->exists());

        // Y el duplicado con otra combinación de mayúsculas lo frena la validación, no la base.
        $this->actingAs($jefe)
            ->post(route('admin.usuarios.store'), [
                'name' => 'María otra vez', 'email' => 'MARIA@ejemplo.test', 'rol' => 'vendedor',
                'password' => 'Clave1234', 'password_confirmation' => 'Clave1234',
            ])
            ->assertSessionHasErrors('email');
    }
}

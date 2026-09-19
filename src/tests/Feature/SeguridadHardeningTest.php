<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Endurecimiento: alcance del token de automatización (H5) y horario laboral del vendedor.
 */
class SeguridadHardeningTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow(); // limpia cualquier hora fijada
        parent::tearDown();
    }

    /* ─── H5: alcance del token de automatización ────────────────────────── */

    public function test_el_token_de_n8n_abre_sus_endpoints_pero_no_el_export_financiero(): void
    {
        config(['automation.token' => 'token-de-n8n', 'automation.export_token' => '']);

        // n8n sigue funcionando con su token de siempre
        $this->withHeader('X-AUTOMATION-TOKEN', 'token-de-n8n')
            ->getJson('/api/automation/test')
            ->assertOk();

        // pero ese mismo token YA NO abre el export financiero (H5 cerrado)
        $this->withHeader('X-AUTOMATION-TOKEN', 'token-de-n8n')
            ->get('/api/automation/reportes/exportar')
            ->assertUnauthorized();
    }

    public function test_el_export_financiero_solo_abre_con_su_token_propio(): void
    {
        config(['automation.token' => 'token-de-n8n', 'automation.export_token' => 'token-export-aparte']);

        // sin el token propio: cerrado
        $this->withHeader('X-AUTOMATION-TOKEN', 'token-de-n8n')
            ->get('/api/automation/reportes/exportar')
            ->assertUnauthorized();

        // con el token propio: pasa la puerta (200 o descarga; lo importante es que NO es 401)
        $r = $this->withHeader('X-AUTOMATION-TOKEN', 'token-export-aparte')
            ->get('/api/automation/reportes/exportar');
        $this->assertNotSame(401, $r->getStatusCode(), 'el token del export debería pasar la autorización');
    }

    public function test_la_rotacion_mantiene_valido_el_token_anterior(): void
    {
        // Durante la ventana de gracia, el token viejo (en previos) sigue valiendo para n8n.
        config(['automation.token' => 'token-nuevo', 'automation.tokens_previos' => 'token-viejo, otro-viejo']);

        $this->withHeader('X-AUTOMATION-TOKEN', 'token-nuevo')->getJson('/api/automation/test')->assertOk();
        $this->withHeader('X-AUTOMATION-TOKEN', 'token-viejo')->getJson('/api/automation/test')->assertOk();
        $this->withHeader('X-AUTOMATION-TOKEN', 'token-inventado')->getJson('/api/automation/test')->assertUnauthorized();
    }

    /* ─── Horario laboral del vendedor ───────────────────────────────────── */

    private function vendedor(): User
    {
        return User::factory()->create(['rol' => 'vendedor', 'password' => Hash::make('clave-secreta-123')]);
    }

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin', 'password' => Hash::make('clave-secreta-123')]);
    }

    private function intentarLogin(User $u): \Illuminate\Testing\TestResponse
    {
        return $this->post('/login', ['email' => $u->email, 'password' => 'clave-secreta-123']);
    }

    public function test_el_vendedor_entra_dentro_del_horario(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 10:00', 'America/La_Paz')); // miércoles 10:00
        $this->intentarLogin($this->vendedor())->assertSessionHasNoErrors();
        $this->assertAuthenticated();
    }

    public function test_el_vendedor_no_entra_despues_de_las_19(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 20:00', 'America/La_Paz'));
        $this->intentarLogin($this->vendedor())->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_el_vendedor_no_entra_en_el_corte_de_mediodia(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 13:30', 'America/La_Paz')); // entre 13:00 y 14:00
        $this->intentarLogin($this->vendedor())->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_el_vendedor_no_entra_antes_de_las_9(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 08:30', 'America/La_Paz'));
        $this->intentarLogin($this->vendedor())->assertSessionHasErrors('email');
        $this->assertGuest();
    }

    public function test_el_admin_entra_a_cualquier_hora(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-16 23:30', 'America/La_Paz'));
        $this->intentarLogin($this->admin())->assertSessionHasNoErrors();
        $this->assertAuthenticated();
    }
}

<?php

namespace Tests\Feature\Auth;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * El registro público está DESHABILITADO en Blackphone.
 * Solo administradores autenticados pueden crear cuentas vía /admin/register.
 * Estos tests verifican que la restricción funciona correctamente.
 */
class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_register_route_is_unavailable_for_guests(): void
    {
        $this->get('/register')->assertStatus(404);
    }

    public function test_public_register_post_is_unavailable_for_guests(): void
    {
        $this->post('/register', [
            'name'                  => 'Test User',
            'email'                 => 'test@example.com',
            'password'              => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertStatus(404);
    }

    public function test_admin_register_requires_authentication(): void
    {
        $this->get('/admin/register')->assertRedirect('/login');
    }
}

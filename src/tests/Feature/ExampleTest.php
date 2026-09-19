<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_raiz_manda_al_acceso_a_quien_no_inicio_sesion(): void
    {
        $this->get('/')->assertRedirect(route('login'));
    }
}

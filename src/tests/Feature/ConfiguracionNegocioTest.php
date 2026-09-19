<?php

namespace Tests\Feature;

use App\Models\ConfiguracionNegocio;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Ajustes → Datos del negocio: lo que se guarda acá es lo que sale impreso en los comprobantes.
 */
class ConfiguracionNegocioTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['rol' => 'admin']);
    }

    public function test_la_pantalla_trae_los_valores_actuales(): void
    {
        $this->actingAs($this->admin())
            ->get(route('admin.configuracion.negocio.edit'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Configuracion/Negocio')
                ->where('valores.negocio_nombre', 'Blackphone')
                ->where('valores.moneda_simbolo', 'Bs')
                ->has('grupos.identidad')
                ->has('grupos.contacto')
                ->has('grupos.ubicacion'));
    }

    public function test_guardar_cambia_lo_que_sale_en_los_comprobantes(): void
    {
        $this->actingAs($this->admin())
            ->from(route('admin.configuracion.negocio.edit'))
            ->post(route('admin.configuracion.negocio.update'), [
                'negocio_nombre'    => 'Servitec BO',
                'negocio_eslogan'   => 'Tecnología que sí anda',
                'negocio_nit'       => '9876543',
                'negocio_telefono'  => '59170000000',
                'negocio_whatsapp'  => '',
                'negocio_email'     => 'hola@servitec.test',
                'negocio_direccion' => 'Av. Siempre Viva 742',
                'negocio_ciudad'    => 'Santa Cruz',
                'negocio_pais'      => 'Bolivia',
                'negocio_horario'   => 'Lunes a viernes, de 9 a 18',
                'moneda_simbolo'    => 'Bs',
            ])
            ->assertRedirect(route('admin.configuracion.negocio.edit'))
            ->assertSessionHas('success');

        $pdf = ConfiguracionNegocio::paraPdf();

        $this->assertSame('Servitec BO', $pdf['nombre']);
        $this->assertSame('9876543', $pdf['nit']);
        $this->assertSame('59170000000', $pdf['telefono']);
        $this->assertSame('Av. Siempre Viva 742, Santa Cruz', $pdf['direccion']);
    }

    public function test_sin_telefono_el_comprobante_usa_el_whatsapp(): void
    {
        ConfiguracionNegocio::guardar([
            'negocio_telefono' => '',
            'negocio_whatsapp' => '59171111111',
        ]);

        $this->assertSame('59171111111', ConfiguracionNegocio::paraPdf()['telefono']);
    }

    public function test_el_nombre_nunca_queda_vacio(): void
    {
        $this->actingAs($this->admin())
            ->post(route('admin.configuracion.negocio.update'), ['negocio_nombre' => '', 'moneda_simbolo' => 'Bs'])
            ->assertSessionHasErrors('negocio_nombre');

        // Y si la fila se vacía por otro camino, el sistema vuelve a su nombre por defecto
        ConfiguracionNegocio::set('negocio_nombre', null);
        $this->assertSame('Blackphone', ConfiguracionNegocio::nombre());
    }

    public function test_el_vendedor_no_entra(): void
    {
        $vendedor = User::factory()->create(['rol' => 'vendedor']);

        $this->actingAs($vendedor)
            ->get(route('admin.configuracion.negocio.edit'))
            ->assertForbidden();
    }
}

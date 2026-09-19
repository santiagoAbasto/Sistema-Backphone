<?php

namespace Tests\Feature;

use App\Mail\CotizacionMailable;
use App\Models\Cliente;
use App\Models\Cotizacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CotizacionesTest extends TestCase
{
    use RefreshDatabase;

    private function datos(array $extra = []): array
    {
        return array_merge([
            'nombre_cliente' => 'Centro Móvil',
            'telefono_completo' => '+59176402042',
            'correo_cliente' => 'compras@example.com',
            'fecha_cotizacion' => '2026-09-14',
            'notas_adicionales' => '**Condiciones**',
            'items' => [[
                'nombre' => 'MacBook Air',
                'tipo' => 'computadora',
                'cantidad' => 2,
                'precio_sin_factura' => 1000,
                'descuento' => 100,
                // Valores falsos: el servidor debe ignorarlos y calcular
                'iva' => 1,
                'it' => 1,
                'total' => 1,
            ]],
        ], $extra);
    }

    private function cotizacion(User $user, array $datos = []): Cotizacion
    {
        return Cotizacion::create(array_merge([
            'user_id' => $user->id,
            'nombre_cliente' => 'Centro Móvil',
            'telefono' => '59176402042',
            'correo_cliente' => 'compras@example.com',
            'items' => [['nombre' => 'MacBook Air', 'cantidad' => 1, 'precio_sin_factura' => 1900, 'descuento' => 0, 'iva' => 247, 'it' => 57, 'total' => 2204]],
            'total' => 2204,
            'fecha_cotizacion' => '2026-09-14',
            'drive_url' => 'https://drive.google.com/file/d/abc/view',
        ], $datos));
    }

    public function test_el_servidor_calcula_impuestos_y_totales_como_el_pdf(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->post(route('admin.cotizaciones.store'), $this->datos())
            ->assertRedirect(route('admin.cotizaciones.index'));

        $cotizacion = Cotizacion::firstOrFail();
        $item = $cotizacion->items[0];

        // (2 × 1000 − 100) = 1900 → IVA 247 · IT 57 · total 2204
        $this->assertEquals(100, $item['descuento']);
        $this->assertEquals(247, $item['iva']);
        $this->assertEquals(57, $item['it']);
        $this->assertEquals(2204, $item['total']);
        $this->assertEquals(2204, $cotizacion->total);

        Mail::assertQueued(CotizacionMailable::class, fn ($mail) => $mail->hasTo('compras@example.com'));
        $this->assertTrue($cotizacion->enviado_por_correo);
    }

    public function test_la_cotizacion_usa_los_datos_escritos_y_completa_el_correo_del_cliente(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['rol' => 'admin']);
        $cliente = Cliente::create([
            'user_id' => $admin->id,
            'nombre' => 'Nombre anterior',
            'telefono' => '59176402042',
        ]);

        $this->actingAs($admin)->post(route('admin.cotizaciones.store'), $this->datos());

        $cotizacion = Cotizacion::firstOrFail();
        $this->assertSame('Centro Móvil', $cotizacion->nombre_cliente);
        $this->assertSame('compras@example.com', $cotizacion->correo_cliente);
        $this->assertSame($cliente->id, $cotizacion->cliente_id);
        $this->assertSame('compras@example.com', $cliente->fresh()->correo);
    }

    public function test_sin_correo_no_se_envia_ningun_correo(): void
    {
        Mail::fake();
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->post(route('admin.cotizaciones.store'), $this->datos(['correo_cliente' => '']))
            ->assertRedirect(route('admin.cotizaciones.index'));

        Mail::assertNothingQueued();
        $this->assertFalse(Cotizacion::firstOrFail()->enviado_por_correo);
    }

    public function test_telefono_sin_codigo_de_pais_muestra_un_mensaje_claro(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);

        $this->actingAs($admin)
            ->post(route('admin.cotizaciones.store'), $this->datos(['telefono_completo' => '76402042']))
            ->assertSessionHasErrors(['telefono_completo' => 'Revisa el número de WhatsApp: debe llevar el código de país, por ejemplo +591 70000000.']);

        $this->assertSame(0, Cotizacion::count());
    }

    public function test_whatsapp_abre_el_chat_con_el_mensaje_de_apple_boss_y_lo_registra(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $cotizacion = $this->cotizacion($admin);

        $respuesta = $this->actingAs($admin)
            ->get(route('admin.cotizaciones.enviar-whatsapp-libre', ['id' => $cotizacion->id]));

        $respuesta->assertRedirect();
        $destino = rawurldecode($respuesta->headers->get('Location'));
        $this->assertStringStartsWith('https://wa.me/59176402042?text=', $destino);
        $this->assertStringContainsString('Blackphone', $destino);
        $this->assertStringContainsString('COT-' . $cotizacion->id, $destino);
        $this->assertStringContainsString('Bs 2,204.00', $destino); // mismo formato que el PDF
        $this->assertStringContainsString('https://drive.google.com/file/d/abc/view', $destino);
        $this->assertStringNotContainsString('Apple Technology', $destino);
        $this->assertTrue($cotizacion->fresh()->enviado_por_whatsapp);
    }

    public function test_envio_en_lote_trae_el_mensaje_completo_y_avisa_las_que_no_tienen_numero(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $conNumero = $this->cotizacion($admin);
        $sinNumero = $this->cotizacion($admin, ['nombre_cliente' => 'Sin Número', 'telefono' => '123']);

        $this->actingAs($admin)
            ->post(route('admin.cotizaciones.enviar-lote'), ['ids' => [$conNumero->id, $sinNumero->id]])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Cotizaciones/WhatsappLote')
                ->has('links', 1)
                ->where('links.0.cotizacion_id', $conNumero->id)
                ->where('links.0.total', '2,204.00')
                ->where('links.0.mensaje', fn ($mensaje) => str_contains($mensaje, 'COT-' . $conNumero->id))
                ->where('omitidas', ['Sin Número']));
    }

    public function test_listado_de_admin_solo_trae_el_nombre_de_quien_la_creo(): void
    {
        $admin = User::factory()->create(['rol' => 'admin', 'name' => 'Administrador']);
        $this->cotizacion($admin);

        $this->actingAs($admin)
            ->get(route('admin.cotizaciones.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Cotizaciones/Index')
                ->has('cotizaciones', 1)
                ->where('cotizaciones.0.usuario', ['id' => $admin->id, 'name' => 'Administrador']));
    }
}

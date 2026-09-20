<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\MovimientoPieza;
use App\Models\Pieza;
use App\Models\Sucursal;
use App\Models\Traspaso;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Traspasos de inventario entre sucursales.
 *
 * Entre Cochabamba y Sucre hay días de por medio, así que lo importante no es que el producto
 * cambie de dueño sino que en el camino no se pueda vender en ninguna de las dos. Eso es lo que
 * se prueba acá: que salga de la venta al enviarlo, que recién cambie de sucursal cuando llega,
 * y que cancelar lo devuelva entero a donde estaba.
 */
class TraspasosTest extends TestCase
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

    private function celularEn(Sucursal $sucursal, string $imei = '350000000000001'): Celular
    {
        return Celular::withoutGlobalScope('sucursal')->create([
            'sucursal_id' => $sucursal->id, 'modelo' => 'iPhone 13', 'capacidad' => '128GB',
            'color' => 'Negro', 'estado_imei' => 'libre', 'imei_1' => $imei, 'procedencia' => 'EE. UU.',
            'precio_costo' => 4000, 'precio_venta' => 5200, 'estado' => 'disponible', 'condicion' => 'Nuevo',
        ]);
    }

    private function piezaEn(Sucursal $sucursal, int $cantidad = 6, string $nombre = 'Pantalla incell'): Pieza
    {
        return Pieza::withoutGlobalScope('sucursal')->create([
            'sucursal_id' => $sucursal->id, 'nombre' => $nombre, 'categoria' => 'Pantalla',
            'compatibilidad' => 'iPhone 11', 'cantidad' => $cantidad,
            'precio_costo' => 180, 'precio_venta' => 420,
        ]);
    }

    private function enviar(User $quien, array $items, ?Sucursal $origen = null, ?Sucursal $destino = null)
    {
        return $this->actingAs($quien)->post(route('admin.traspasos.store'), [
            'origen_sucursal_id'  => ($origen ?? $this->cochabamba)->id,
            'destino_sucursal_id' => ($destino ?? $this->sucre)->id,
            'items'               => $items,
            'nota'                => 'Va con el transporte del viernes',
        ]);
    }

    // ─── Enviar ──────────────────────────────────────────────────────────────

    public function test_lo_enviado_queda_en_transito_y_no_se_puede_vender_en_ninguna_sucursal(): void
    {
        $celular = $this->celularEn($this->cochabamba);

        $this->enviar($this->superAdmin(), [['tipo' => 'celular', 'producto_id' => $celular->id]])
            ->assertSessionHas('success');

        $celular->refresh();
        // Sigue siendo de Cochabamba: todavía no llegó a ninguna parte
        $this->assertSame($this->cochabamba->id, $celular->sucursal_id);
        $this->assertSame('en_transito', $celular->estado);

        // Y no aparece disponible para nadie
        $this->assertSame(0, Celular::withoutGlobalScope('sucursal')->where('estado', 'disponible')->count());

        $traspaso = Traspaso::firstOrFail();
        $this->assertSame(Traspaso::EN_TRANSITO, $traspaso->estado);
        $this->assertStringEndsWith('-T001', $traspaso->codigo);
        $this->assertSame('iPhone 13', $traspaso->items->first()->nombre);
    }

    public function test_las_piezas_salen_del_saldo_al_enviarse(): void
    {
        $pieza = $this->piezaEn($this->cochabamba, 6);

        $this->enviar($this->superAdmin(), [['tipo' => 'pieza', 'producto_id' => $pieza->id, 'cantidad' => 4]])
            ->assertSessionHas('success');

        // Las cuatro ya van en el paquete: no están en el cajón de Cochabamba
        $this->assertSame(2, $pieza->refresh()->cantidad);

        $movimiento = MovimientoPieza::where('tipo', MovimientoPieza::SALIDA_TRASPASO)->firstOrFail();
        $this->assertSame(-4, $movimiento->cantidad);
        $this->assertSame('Traspaso', $movimiento->referencia_tipo);
    }

    public function test_no_se_envia_mas_de_lo_que_hay_ni_nada_de_otra_sucursal(): void
    {
        $admin = $this->superAdmin();
        $pieza = $this->piezaEn($this->cochabamba, 2);
        $ajeno = $this->celularEn($this->sucre, '350000000000009');

        $this->enviar($admin, [['tipo' => 'pieza', 'producto_id' => $pieza->id, 'cantidad' => 5]])
            ->assertSessionHasErrors();
        $this->assertSame(2, $pieza->refresh()->cantidad);

        // Un equipo de Sucre no sale en un traspaso que dice salir de Cochabamba
        $this->enviar($admin, [['tipo' => 'celular', 'producto_id' => $ajeno->id]])
            ->assertSessionHasErrors();

        $this->assertSame(0, Traspaso::count());
    }

    public function test_un_equipo_vendido_no_se_puede_enviar(): void
    {
        $celular = $this->celularEn($this->cochabamba);
        $celular->update(['estado' => 'vendido']);

        $this->enviar($this->superAdmin(), [['tipo' => 'celular', 'producto_id' => $celular->id]])
            ->assertSessionHasErrors();

        $this->assertSame(0, Traspaso::count());
    }

    public function test_el_origen_y_el_destino_no_pueden_ser_la_misma_sucursal(): void
    {
        $celular = $this->celularEn($this->cochabamba);

        $this->enviar($this->superAdmin(), [['tipo' => 'celular', 'producto_id' => $celular->id]], $this->cochabamba, $this->cochabamba)
            ->assertSessionHasErrors('destino_sucursal_id');

        $this->assertSame('disponible', $celular->refresh()->estado);
    }

    // ─── Recibir ─────────────────────────────────────────────────────────────

    public function test_al_confirmar_la_llegada_el_equipo_cambia_de_sucursal(): void
    {
        $celular = $this->celularEn($this->cochabamba);
        $this->enviar($this->superAdmin(), [['tipo' => 'celular', 'producto_id' => $celular->id]]);
        $traspaso = Traspaso::firstOrFail();

        $this->actingAs($this->adminDe($this->sucre))
            ->post(route('admin.traspasos.recibir', $traspaso))
            ->assertSessionHas('success');

        $celular->refresh();
        $this->assertSame($this->sucre->id, $celular->sucursal_id);
        $this->assertSame('disponible', $celular->estado);

        $traspaso->refresh();
        $this->assertSame(Traspaso::RECIBIDO, $traspaso->estado);
        $this->assertNotNull($traspaso->recibido_en);
    }

    public function test_las_piezas_que_llegan_se_suman_a_la_misma_ficha_del_destino(): void
    {
        $origen  = $this->piezaEn($this->cochabamba, 6);
        $destino = $this->piezaEn($this->sucre, 1);

        $this->enviar($this->superAdmin(), [['tipo' => 'pieza', 'producto_id' => $origen->id, 'cantidad' => 4]]);

        $this->actingAs($this->adminDe($this->sucre))
            ->post(route('admin.traspasos.recibir', Traspaso::firstOrFail()));

        // No se abre una segunda ficha con el mismo nombre: entran en la que ya existía
        $this->assertSame(2, $origen->refresh()->cantidad);
        $this->assertSame(5, $destino->refresh()->cantidad);
        $this->assertSame(2, Pieza::withoutGlobalScope('sucursal')->count());
    }

    public function test_una_pieza_que_el_destino_no_tenia_se_crea_con_su_ficha(): void
    {
        $origen = $this->piezaEn($this->cochabamba, 6);

        $this->enviar($this->superAdmin(), [['tipo' => 'pieza', 'producto_id' => $origen->id, 'cantidad' => 2]]);
        $this->actingAs($this->adminDe($this->sucre))
            ->post(route('admin.traspasos.recibir', Traspaso::firstOrFail()));

        $nueva = Pieza::withoutGlobalScope('sucursal')->where('sucursal_id', $this->sucre->id)->firstOrFail();
        $this->assertSame('Pantalla incell', $nueva->nombre);
        $this->assertSame('iPhone 11', $nueva->compatibilidad);
        $this->assertSame(2, $nueva->cantidad);
        $this->assertSame(420.0, (float) $nueva->precio_venta);
    }

    // ─── Cancelar ────────────────────────────────────────────────────────────

    public function test_cancelar_devuelve_todo_a_la_sucursal_que_lo_envio(): void
    {
        $admin = $this->superAdmin();
        $celular = $this->celularEn($this->cochabamba);
        $pieza = $this->piezaEn($this->cochabamba, 6);

        $this->enviar($admin, [
            ['tipo' => 'celular', 'producto_id' => $celular->id],
            ['tipo' => 'pieza', 'producto_id' => $pieza->id, 'cantidad' => 3],
        ]);

        $this->actingAs($admin)
            ->post(route('admin.traspasos.cancelar', Traspaso::firstOrFail()))
            ->assertSessionHas('success');

        $this->assertSame('disponible', $celular->refresh()->estado);
        $this->assertSame($this->cochabamba->id, $celular->sucursal_id);
        $this->assertSame(6, $pieza->refresh()->cantidad);
        $this->assertSame(Traspaso::CANCELADO, Traspaso::firstOrFail()->estado);
    }

    public function test_un_traspaso_cerrado_no_se_vuelve_a_cerrar(): void
    {
        $admin = $this->superAdmin();
        $celular = $this->celularEn($this->cochabamba);
        $this->enviar($admin, [['tipo' => 'celular', 'producto_id' => $celular->id]]);
        $traspaso = Traspaso::firstOrFail();

        $this->actingAs($admin)->post(route('admin.traspasos.recibir', $traspaso));
        $this->actingAs($admin)->post(route('admin.traspasos.recibir', $traspaso))->assertSessionHasErrors();
        $this->actingAs($admin)->post(route('admin.traspasos.cancelar', $traspaso))->assertSessionHasErrors();

        $this->assertSame(Traspaso::RECIBIDO, $traspaso->fresh()->estado);
    }

    // ─── Quién puede qué ─────────────────────────────────────────────────────

    public function test_solo_el_super_administrador_reparte_inventario(): void
    {
        $celular = $this->celularEn($this->cochabamba);

        $this->enviar($this->adminDe($this->cochabamba), [['tipo' => 'celular', 'producto_id' => $celular->id]])
            ->assertForbidden();

        $this->assertSame(0, Traspaso::count());
    }

    public function test_la_sucursal_que_envia_no_confirma_la_llegada_por_la_otra(): void
    {
        $celular = $this->celularEn($this->cochabamba);
        $this->enviar($this->superAdmin(), [['tipo' => 'celular', 'producto_id' => $celular->id]]);

        $this->actingAs($this->adminDe($this->cochabamba))
            ->post(route('admin.traspasos.recibir', Traspaso::firstOrFail()))
            ->assertForbidden();

        $this->assertSame('en_transito', $celular->refresh()->estado);
    }

    public function test_cada_sucursal_ve_los_traspasos_que_le_tocan(): void
    {
        $celular = $this->celularEn($this->cochabamba);
        $this->enviar($this->superAdmin(), [['tipo' => 'celular', 'producto_id' => $celular->id]]);

        // El de Sucre ve el que está esperando, aunque no lo haya enviado él
        $this->actingAs($this->adminDe($this->sucre))
            ->get(route('admin.traspasos.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Traspasos/Index')
                ->has('traspasos', 1)
                ->where('traspasos.0.estado', 'en_transito')
                ->where('puedeEnviar', false));
    }

    // ─── Mientras viaja ──────────────────────────────────────────────────────

    public function test_un_equipo_en_transito_no_se_puede_editar_ni_habilitar(): void
    {
        $admin = $this->superAdmin();
        $celular = $this->celularEn($this->cochabamba);
        $this->enviar($admin, [['tipo' => 'celular', 'producto_id' => $celular->id]]);

        // Guardarlo lo devolvería a «disponible» y Cochabamba podría vender algo que ya salió
        $this->actingAs($admin)
            ->patch(route('admin.celulares.habilitar', $celular))
            ->assertSessionHas('error');

        $this->assertSame('en_transito', $celular->refresh()->estado);
    }
}

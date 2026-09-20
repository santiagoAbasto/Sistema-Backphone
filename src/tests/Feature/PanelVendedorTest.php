<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\Cliente;
use App\Models\Cotizacion;
use App\Models\ProductoGeneral;
use App\Models\ServicioTecnico;
use App\Models\User;
use App\Models\Venta;
use App\Models\VentaItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * Panel del vendedor: que cada quien vea lo suyo y que las cuentas den.
 */
class PanelVendedorTest extends TestCase
{
    use RefreshDatabase;

    private int $numero = 0;

    private function vendedor(array $datos = []): User
    {
        return User::factory()->create(array_merge(['rol' => 'vendedor'], $datos));
    }

    private function venta(User $user, array $items, array $datos = []): Venta
    {
        $this->numero++;

        $bruto = collect($items)->sum(fn ($i) => (float) ($i['precio_venta'] ?? 1000) - (float) ($i['descuento'] ?? 0));
        $costo = collect($items)->sum(fn ($i) => (float) ($i['precio_invertido'] ?? 600));

        $venta = Venta::create(array_merge([
            'nombre_cliente'   => 'Cliente ' . $this->numero,
            'telefono_cliente' => '7000000' . $this->numero,
            'fecha'            => now()->toDateString(),
            'codigo_nota'      => sprintf('AT-V%03d', $this->numero),
            'tipo_venta'       => 'producto',
            'cantidad'         => count($items),
            'precio_invertido' => $costo,
            'precio_venta'     => $bruto,
            'ganancia_neta'    => $bruto - $costo,
            'subtotal'         => $bruto,
            'descuento'        => 0,
            'metodo_pago'      => 'efectivo',
            'user_id'          => $user->id,
        ], $datos));

        foreach ($items as $i => $item) {
            VentaItem::create(array_merge([
                'venta_id'         => $venta->id,
                'tipo'             => 'celular',
                'producto_id'      => $i + 1,
                'cantidad'         => 1,
                'precio_venta'     => 1000,
                'precio_invertido' => 600,
                'descuento'        => 0,
                'subtotal'         => 1000,
            ], $item));
        }

        return $venta->fresh('items');
    }

    private function servicio(User $user, array $datos = []): ServicioTecnico
    {
        $this->numero++;

        return ServicioTecnico::create(array_merge([
            'codigo_nota'      => sprintf('AT-ST%03d', $this->numero),
            'cliente'          => 'Cliente ' . $this->numero,
            'telefono'         => '7100000' . $this->numero,
            'equipo'           => 'iPhone 13',
            'detalle_servicio' => json_encode([['descripcion' => 'Batería', 'costo' => 100, 'precio' => 250]]),
            'precio_costo'     => 100,
            'precio_venta'     => 250,
            'fecha'            => now()->toDateString(),
            'user_id'          => $user->id,
        ], $this->conTecnico($datos)));
    }

    /** El nombre del técnico se guarda igual que en producción: copiado de su ficha. */
    private function conTecnico(array $datos): array
    {
        $ficha = $this->tecnicoDePrueba($datos['tecnico'] ?? 'AXEL');
        unset($datos['tecnico']);

        return $datos + [
            'tecnico'             => $ficha->nombre,
            'tecnico_id'          => $ficha->id,
            'marca'               => 'apple',
            'comision_porcentaje' => $ficha->comision,
        ];
    }

    private function assertEsPdf(\Illuminate\Testing\TestResponse $r, string $que): void
    {
        $r->assertOk();
        $contenido = $r->baseResponse instanceof \Symfony\Component\HttpFoundation\StreamedResponse
            ? $r->streamedContent() : $r->getContent();
        $this->assertStringStartsWith('%PDF', $contenido, "El PDF de «{$que}» no se generó");
    }

    private function celular(array $datos = []): Celular
    {
        $this->numero++;

        return Celular::create(array_merge([
            'modelo'         => 'iPhone 15 Pro',
            'capacidad'      => '256GB',
            'color'          => 'Titanio',
            'bateria'        => '100%',
            'imei_1'         => str_pad((string) (350000000000000 + $this->numero), 15, '0'),
            'estado_imei'    => 'libre',
            'numero_serie'   => 'SER' . $this->numero,
            'procedencia'    => 'Importado de Chile',
            'condicion'      => 'Nuevo',
            'precio_costo'   => 6000,
            'precio_venta'   => 9000,
            'estado'         => 'disponible',
        ], $datos));
    }

    /* ─── Mi día ─────────────────────────────────────────────────────────── */

    public function test_el_panel_solo_muestra_lo_del_vendedor_conectado(): void
    {
        $yo   = $this->vendedor();
        $otro = $this->vendedor();

        $this->venta($yo, [[]]);
        $this->venta($otro, [[]]);
        $this->servicio($otro);

        $this->actingAs($yo)
            ->get(route('vendedor.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Dashboard')
                ->where('resumen.ventas_dia', 1)
                ->where('resumen.servicios_dia', 0)
                ->has('ultimasVentas', 1));
    }

    public function test_la_permuta_se_descuenta_una_vez_por_venta_y_no_por_producto(): void
    {
        $yo = $this->vendedor();

        // Dos productos de 1000 y una permuta de 500: se descuenta una sola vez, no una por producto
        $this->venta($yo, [[], []], ['valor_permuta' => 500]);

        $this->actingAs($yo)
            ->get(route('vendedor.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('resumen.bruto_dia', 2000)
                ->where('resumen.cobrado_dia', 1500));
    }

    public function test_el_descuento_que_hace_el_vendedor_si_se_ve(): void
    {
        $yo = $this->vendedor();

        $this->venta($yo, [
            ['precio_venta' => 1000, 'descuento' => 150],
            ['precio_venta' => 500, 'descuento' => 50],
        ]);

        $this->actingAs($yo)
            ->get(route('vendedor.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('resumen.descuentos_dia', 200)
                ->where('resumen.bruto_dia', 1300));
    }

    /* ─── El vendedor no ve el costo ni la ganancia ──────────────────────── */

    public function test_mi_dia_no_manda_costo_ni_ganancia(): void
    {
        $yo = $this->vendedor();
        $this->venta($yo, [[]]);

        $this->actingAs($yo)
            ->get(route('vendedor.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('resumen.ganancia_dia')
                ->missing('ultimasVentas.0.precio_invertido'));
    }

    public function test_mis_ventas_no_mandan_costo_ni_ganancia(): void
    {
        $yo = $this->vendedor();
        $this->venta($yo, [[]]);

        $this->actingAs($yo)
            ->get(route('vendedor.ventas.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Ventas/Index')
                ->missing('ventas.0.precio_invertido')
                ->missing('ventas.0.ganancia_neta')
                ->missing('ventas.0.items.0.precio_invertido')
                ->where('ventas.0.items.0.precio_venta', fn ($v) => (float) $v === 1000.0));
    }

    public function test_el_administrador_si_sigue_viendo_el_costo_de_sus_ventas(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $this->venta($admin, [[]]);

        $this->actingAs($admin)
            ->get(route('admin.ventas.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Ventas/Index')
                ->has('ventas.0.items.0.precio_invertido'));
    }

    public function test_la_lista_de_servicios_del_vendedor_no_lleva_costos(): void
    {
        $yo = $this->vendedor();
        $this->servicio($yo);

        $this->actingAs($yo)
            ->get(route('vendedor.servicios.index'))
            ->assertOk()
            ->assertInertia(function (Assert $page) {
                $page->missing('servicios.0.precio_costo');
                // El detalle de cada trabajo tampoco lleva su costo
                $detalle = json_decode($page->toArray()['props']['servicios'][0]['detalle_servicio'], true);
                $this->assertIsArray($detalle);
                $this->assertArrayNotHasKey('costo', $detalle[0]);
                $this->assertSame(250, $detalle[0]['precio']);
            });
    }

    public function test_la_api_de_stock_no_le_manda_el_costo_al_vendedor(): void
    {
        $this->celular();

        $this->actingAs($this->vendedor())
            ->getJson(route('api.stock.celulares'))
            ->assertOk()
            ->assertJsonMissingPath('0.precio_costo')
            ->assertJsonMissingPath('0.procedencia')
            ->assertJsonPath('0.precio_venta', fn ($v) => (float) $v === 9000.0);

        $this->actingAs(User::factory()->create(['rol' => 'admin']))
            ->getJson(route('api.stock.celulares'))
            ->assertOk()
            ->assertJsonPath('0.precio_costo', fn ($v) => (float) $v === 6000.0);
    }

    public function test_registrar_venta_no_le_manda_el_costo_ni_la_procedencia_al_vendedor(): void
    {
        $this->celular();

        $this->actingAs($this->vendedor())
            ->get(route('vendedor.ventas.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Ventas/Create')
                ->missing('celulares.0.precio_costo')
                ->missing('celulares.0.procedencia')
                ->where('celulares.0.precio_venta', fn ($v) => (float) $v === 9000.0));
    }

    public function test_editar_venta_no_le_manda_el_costo_al_vendedor(): void
    {
        $yo = $this->vendedor();
        $venta = $this->venta($yo, [[]]);

        $this->actingAs($yo)
            ->get(route('vendedor.ventas.edit', $venta->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Ventas/Edit')
                ->missing('venta.precio_invertido')
                ->missing('venta.ganancia_neta')
                ->missing('venta.items.0.precio_invertido'));
    }

    public function test_reservas_activas_no_le_mandan_el_costo_ni_la_procedencia_al_vendedor(): void
    {
        $yo = $this->vendedor();
        $cel = $this->celular();
        $reserva = \App\Models\Reserva::create([
            'nombre_cliente'   => 'Cliente Reserva',
            'telefono_cliente' => '70000123',
            'codigo_nota'      => 'AT-R001',
            'estado'           => 'activa',
            'subtotal'         => 9000,
            'monto_reserva'    => 500,
            'user_id'          => $yo->id,
        ]);
        \App\Models\ReservaItem::create([
            'reserva_id'   => $reserva->id,
            'tipo'         => 'celular',
            'producto_id'  => $cel->id,
            'cantidad'     => 1,
            'precio_venta' => 9000,
            'subtotal'     => 9000,
        ]);

        $respuesta = $this->actingAs($yo)->getJson(route('vendedor.reservas.activas'))->assertOk();
        $cuerpo = $respuesta->getContent();
        $this->assertStringNotContainsString('precio_costo', $cuerpo, 'la reserva activa filtra precio_costo al vendedor');
        $this->assertStringNotContainsString('procedencia', $cuerpo, 'la reserva activa filtra la procedencia al vendedor');
    }

    public function test_olvide_mi_contrasena_no_revela_si_el_correo_existe(): void
    {
        // Un correo que existe y otro que no deben dar exactamente la misma respuesta.
        User::factory()->create(['email' => 'existe@ejemplo.test']);

        $conCuenta = $this->from(route('password.request'))
            ->post(route('password.email'), ['email' => 'existe@ejemplo.test']);
        $sinCuenta = $this->from(route('password.request'))
            ->post(route('password.email'), ['email' => 'no-existe@ejemplo.test']);

        // Ninguna lanza error de validación (que revelaría la inexistencia) y ambas dejan el mismo status.
        $conCuenta->assertSessionHasNoErrors()->assertSessionHas('status');
        $sinCuenta->assertSessionHasNoErrors()->assertSessionHas('status');
        $this->assertSame(
            session('status'),
            'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.'
        );
    }

    public function test_la_venta_guarda_el_costo_real_aunque_el_navegador_no_lo_sepa(): void
    {
        $yo = $this->vendedor();
        $celular = $this->celular();

        $this->actingAs($yo)->post(route('vendedor.ventas.store'), [
            'nombre_cliente'   => 'Ana Rojas',
            'telefono_cliente' => '70011223',
            'tipo_venta'       => 'producto',
            'metodo_pago'      => 'efectivo',
            'es_permuta'       => false,
            'descuento'        => 0,
            'items'            => [[
                'tipo' => 'celular', 'producto_id' => $celular->id, 'cantidad' => 1,
                // El navegador del vendedor manda 0: el servidor igual guarda el costo real
                'precio_venta' => 9000, 'precio_invertido' => 0, 'descuento' => 0,
            ]],
        ])->assertSessionHasNoErrors();

        $venta = Venta::with('items')->latest('id')->first();
        $this->assertSame(6000.0, (float) $venta->items->first()->precio_invertido);
    }

    public function test_el_total_del_mes_no_suma_el_mismo_mes_de_otro_anio(): void
    {
        $yo = $this->vendedor();

        $this->venta($yo, [['precio_venta' => 1000, 'descuento' => 0]]);
        $this->venta($yo, [['precio_venta' => 7000, 'descuento' => 0]], [
            'fecha' => now()->subYear()->toDateString(),
        ]);

        $this->actingAs($yo)
            ->get(route('vendedor.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('resumen.total_mes', 1000));
    }

    public function test_la_meta_sale_de_la_cuenta_y_en_cero_el_panel_lo_dice(): void
    {
        $sinMeta = $this->vendedor(['meta_mensual' => 0]);
        $conMeta = $this->vendedor(['meta_mensual' => 12500.50]);

        $this->actingAs($sinMeta)
            ->get(route('vendedor.dashboard'))
            ->assertInertia(fn (Assert $page) => $page->where('resumen.meta_mensual', 0));

        $this->actingAs($conMeta)
            ->get(route('vendedor.dashboard'))
            ->assertInertia(fn (Assert $page) => $page->where('resumen.meta_mensual', 12500.5));
    }

    public function test_el_panel_no_manda_los_gastos_de_la_tienda(): void
    {
        $this->actingAs($this->vendedor())
            ->get(route('vendedor.dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('resumen.egresos_dia')
                ->missing('resumen.disponible_dia'));
    }

    /* ─── Meta cargada desde Usuarios y roles ────────────────────────────── */

    public function test_el_administrador_carga_la_meta_y_el_vendedor_la_ve(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $ana   = $this->vendedor(['name' => 'Ana']);

        $this->actingAs($admin)
            ->patch(route('admin.usuarios.update', $ana->id), [
                'name'         => 'Ana',
                'email'        => $ana->email,
                'rol'          => 'vendedor',
                'meta_mensual' => '9000',
            ])
            ->assertSessionHasNoErrors();

        $this->assertSame('9000.00', $ana->fresh()->meta_mensual);

        $this->actingAs($ana->fresh())
            ->get(route('vendedor.dashboard'))
            ->assertInertia(fn (Assert $page) => $page->where('resumen.meta_mensual', 9000));
    }

    public function test_una_meta_negativa_se_rechaza(): void
    {
        $admin = User::factory()->create(['rol' => 'admin']);
        $ana   = $this->vendedor(['name' => 'Ana']);

        $this->actingAs($admin)
            ->patch(route('admin.usuarios.update', $ana->id), [
                'name' => 'Ana', 'email' => $ana->email, 'rol' => 'vendedor', 'meta_mensual' => '-10',
            ])
            ->assertSessionHasErrors(['meta_mensual' => 'La meta no puede ser negativa.']);
    }

    /* ─── Productos en stock ─────────────────────────────────────────────── */

    public function test_el_stock_solo_muestra_lo_disponible(): void
    {
        $this->celular();
        $this->celular(['estado' => 'vendido']);

        $this->actingAs($this->vendedor())
            ->get(route('vendedor.productos.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Productos/Index')
                ->where('tipo', 'celulares')
                ->has('productos.data', 1));
    }

    public function test_el_stock_no_manda_el_costo_ni_la_procedencia(): void
    {
        $this->celular();

        $this->actingAs($this->vendedor())
            ->get(route('vendedor.productos.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->missing('productos.data.0.precio_costo')
                ->missing('productos.data.0.procedencia')
                ->where('productos.data.0.precio_venta', fn ($v) => (float) $v === 9000.0));
    }

    public function test_la_busqueda_del_stock_recorre_todo_el_inventario(): void
    {
        // 30 equipos: el buscado queda fuera de la primera página de 24
        foreach (range(1, 29) as $i) {
            $this->celular(['modelo' => 'iPhone 14']);
        }
        $this->celular(['modelo' => 'iPhone 15 Pro Max', 'numero_serie' => 'BUSCAME1']);

        $this->actingAs($this->vendedor())
            ->get(route('vendedor.productos.index', ['q' => 'buscame1']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('productos.data', 1)
                ->where('productos.data.0.numero_serie', 'BUSCAME1'));
    }

    public function test_cada_pestana_trae_su_propio_conteo(): void
    {
        $this->celular();
        $this->celular();
        ProductoGeneral::create([
            'codigo' => 'ACC-1', 'tipo' => 'funda', 'nombre' => 'Funda genérica',
            'procedencia' => 'Local', 'condicion' => 'Nuevo',
            'precio_costo' => 30, 'precio_venta' => 90, 'estado' => 'disponible',
        ]);

        $this->actingAs($this->vendedor())
            ->get(route('vendedor.productos.index', ['tipo' => 'generales']))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tipo', 'generales')
                ->has('productos.data', 1)
                ->where('pestanas.0.total', 2)
                ->where('pestanas.3.total', 1));
    }

    /* ─── Mis clientes ───────────────────────────────────────────────────── */

    public function test_el_vendedor_solo_ve_y_edita_sus_clientes(): void
    {
        $yo   = $this->vendedor();
        $otro = $this->vendedor();

        Cliente::create(['nombre' => 'Mío', 'telefono' => '70000001', 'user_id' => $yo->id]);
        $ajeno = Cliente::create(['nombre' => 'Ajeno', 'telefono' => '70000002', 'user_id' => $otro->id]);

        $this->actingAs($yo)
            ->get(route('vendedor.clientes.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Clientes/Index')
                ->has('clientes', 1)
                ->where('clientes.0.nombre', 'Mío'));

        $this->actingAs($yo)->get(route('vendedor.clientes.edit', $ajeno->id))->assertNotFound();
    }

    public function test_la_ficha_del_cliente_solo_trae_los_movimientos_del_vendedor(): void
    {
        $yo   = $this->vendedor();
        $otro = $this->vendedor();

        $cliente = Cliente::create(['nombre' => 'Rosa', 'telefono' => '70011223', 'user_id' => $yo->id]);

        $this->venta($yo, [[]], ['telefono_cliente' => '70011223']);
        $this->venta($otro, [[]], ['telefono_cliente' => '70011223']);

        $this->actingAs($yo)
            ->get(route('vendedor.clientes.edit', $cliente->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Clientes/Edit')
                ->where('actividad.ventas.cantidad', 1));
    }

    public function test_las_sugerencias_de_clientes_funcionan_en_cualquier_base(): void
    {
        $yo = $this->vendedor();
        Cliente::create(['nombre' => 'Rosario Quispe', 'telefono' => '70099887', 'user_id' => $yo->id]);

        $this->actingAs($yo)
            ->getJson(route('vendedor.clientes.sugerencias', ['term' => 'ROSA']))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.nombre', 'Rosario Quispe');
    }

    /* ─── Ventas, servicios y cotizaciones ───────────────────────────────── */

    public function test_buscar_nota_funciona_en_cualquier_base_y_solo_devuelve_lo_propio(): void
    {
        $yo   = $this->vendedor();
        $otro = $this->vendedor();

        $mia = $this->venta($yo, [[]], ['nombre_cliente' => 'Carla Rojas']);
        $this->venta($otro, [[]], ['nombre_cliente' => 'Carla Rojas']);

        $this->actingAs($yo)
            ->getJson(route('vendedor.ventas.buscarNota', ['codigo_nota' => 'carla']))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id_real', $mia->id);
    }

    public function test_el_vendedor_exporta_sus_ventas_en_pdf(): void
    {
        $yo = $this->vendedor();
        $this->venta($yo, [[]]);

        $r = $this->actingAs($yo)->get(route('vendedor.ventas.exportar', [
            'fecha_inicio' => now()->startOfMonth()->toDateString(),
            'fecha_fin'    => now()->endOfMonth()->toDateString(),
        ]));

        $this->assertEsPdf($r, 'mis ventas');
    }

    public function test_el_vendedor_recibe_las_fichas_de_tecnico_para_filtrar(): void
    {
        $yo = $this->vendedor();
        $this->servicio($yo, ['tecnico' => 'AXEL']);
        $this->servicio($yo, ['tecnico' => 'EDSON']);

        $this->actingAs($yo)
            ->get(route('vendedor.servicios.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Vendedor/Servicios/Index')
                ->has('tecnicos', 2)
                ->where('tecnicos.0.nombre', 'AXEL')
                ->where('tecnicos.1.nombre', 'EDSON'));
    }

    public function test_el_resumen_de_servicios_sale_sin_pasarle_fechas(): void
    {
        $yo = $this->vendedor();
        $this->servicio($yo);

        $r = $this->actingAs($yo)->get(route('vendedor.servicios.exportarResumen'));

        $this->assertEsPdf($r, 'resumen de servicios');
    }

    public function test_las_cotizaciones_del_vendedor_usan_los_mismos_nombres_de_ruta_que_el_admin(): void
    {
        $yo = $this->vendedor();

        $cotizacion = Cotizacion::create([
            'user_id' => $yo->id, 'nombre_cliente' => 'Luis', 'telefono' => '+59170000000',
            'items' => json_encode([]), 'total' => 1200, 'fecha_cotizacion' => now()->toDateString(),
        ]);

        $this->actingAs($yo)
            ->get(route('vendedor.cotizaciones.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Vendedor/Cotizaciones/Index')->has('cotizaciones', 1));

        // La misma acción que en el admin: abre WhatsApp con el mensaje listo
        $this->actingAs($yo)
            ->get(route('vendedor.cotizaciones.enviar-whatsapp-libre', ['id' => $cotizacion->id]))
            ->assertRedirect();

        $this->assertTrue((bool) $cotizacion->fresh()->enviado_por_whatsapp);
    }

    public function test_todas_las_pantallas_del_vendedor_abren(): void
    {
        $yo = $this->vendedor();

        $pantallas = [
            'vendedor.dashboard'           => 'Vendedor/Dashboard',
            'vendedor.productos.index'     => 'Vendedor/Productos/Index',
            'vendedor.ventas.index'        => 'Vendedor/Ventas/Index',
            'vendedor.ventas.create'       => 'Vendedor/Ventas/Create',
            'vendedor.reservas.index'      => 'Vendedor/Reservas/Index',
            'vendedor.reservas.create'     => 'Vendedor/Reservas/Create',
            'vendedor.cotizaciones.index'  => 'Vendedor/Cotizaciones/Index',
            'vendedor.cotizaciones.create' => 'Vendedor/Cotizaciones/Create',
            'vendedor.servicios.index'     => 'Vendedor/Servicios/Index',
            'vendedor.servicios.create'    => 'Vendedor/Servicios/Create',
            'vendedor.clientes.index'      => 'Vendedor/Clientes/Index',
        ];

        foreach ($pantallas as $ruta => $componente) {
            $this->actingAs($yo)
                ->get(route($ruta))
                ->assertOk()
                ->assertInertia(fn (Assert $page) => $page->component($componente));
        }
    }

    public function test_el_vendedor_no_entra_a_las_pantallas_del_administrador(): void
    {
        $yo = $this->vendedor();

        foreach (['admin.dashboard', 'admin.usuarios.index', 'admin.egresos.index', 'admin.celulares.index'] as $ruta) {
            $this->actingAs($yo)->get(route($ruta))->assertForbidden();
        }
    }
}

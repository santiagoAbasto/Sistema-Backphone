<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Retira la tienda pública: el sistema queda solo con el panel interno.
 *
 * Una instalación nueva nunca llegó a crear estas tablas y esta migración no hace nada. En una base que
 * ya venía del sistema anterior, se rescata lo poco que sirve al panel (el nombre del negocio y su WhatsApp,
 * que iban en `configuracion_tienda`) y después se sueltan las tablas del catálogo, el contenido del sitio,
 * el newsletter y el Trade-In.
 *
 * No tiene vuelta atrás: las tablas del ecommerce no se recrean. Si hace falta el historial anterior, está
 * en el respaldo de la base, no acá.
 */
return new class extends Migration
{
    /** De la configuración vieja a la nueva: lo único que el panel sigue necesitando. */
    private const RESCATE = [
        'tienda_nombre'      => 'negocio_nombre',
        'tienda_direccion'   => 'negocio_direccion',
        'tienda_ciudad'      => 'negocio_ciudad',
        'tienda_pais'        => 'negocio_pais',
        'tienda_horario'     => 'negocio_horario',
        'whatsapp_numero'    => 'negocio_whatsapp',
    ];

    /** En orden: primero lo que tiene llaves foráneas, después lo que apuntan. */
    private const TABLAS = [
        'newsletter_campaign_recipients',
        'newsletter_campaigns',
        'newsletter_subscribers',
        'catalogo_compatibilidades',
        'catalogo_imagenes',
        'catalogo_publicacion_collection',
        'catalogo_publicaciones',
        'compatibility_targets',
        'catalog_collections',
        'catalog_categories',
        'home_sections',
        'nav_menu_items',
        'seo_pages',
        'trade_in_solicitudes',
        'modelos_referencia',
        'novedades',
        'store_services',
        'store_locations',
        'faqs',
        'pages',
        'configuracion_tienda',
    ];

    public function up(): void
    {
        $this->rescatarLaIdentidadDelNegocio();

        Schema::disableForeignKeyConstraints();
        foreach (self::TABLAS as $tabla) {
            Schema::dropIfExists($tabla);
        }
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        // Sin vuelta atrás: la tienda pública se retiró del producto.
    }

    /**
     * Lo que el administrador ya había escrito sobre su negocio pasa a `configuracion_negocio`,
     * siempre que ahí todavía no haya nada escrito a mano.
     */
    private function rescatarLaIdentidadDelNegocio(): void
    {
        if (! Schema::hasTable('configuracion_tienda') || ! Schema::hasTable('configuracion_negocio')) {
            return;
        }

        $viejas = DB::table('configuracion_tienda')
            ->whereIn('clave', array_keys(self::RESCATE))
            ->pluck('valor', 'clave');

        foreach (self::RESCATE as $antes => $ahora) {
            $valor = trim((string) ($viejas[$antes] ?? ''));
            if ($valor === '') {
                continue;
            }

            $actual = DB::table('configuracion_negocio')->where('clave', $ahora)->value('valor');
            if ($actual !== null && trim((string) $actual) !== '' && trim((string) $actual) !== 'Blackphone') {
                continue;
            }

            DB::table('configuracion_negocio')->where('clave', $ahora)->update([
                'valor'      => $valor,
                'updated_at' => now(),
            ]);
        }
    }
};

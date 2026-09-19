<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Whitelist explícita: nunca exponer precio_costo, ganancia, IMEI, serial,
 * notas privadas ni datos financieros internos.
 */
class PublicProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $imagenPrincipal = $this->imagenes->firstWhere('es_principal', true)
            ?? $this->imagenes->first();

        return [
            'id'                => $this->id,
            'slug'              => $this->slug,
            'titulo'            => $this->titulo,
            'subtitulo'         => $this->subtitulo,
            'resumen'           => $this->resumen,
            'condicion'         => $this->condicion,
            'categoria'         => $this->categoria,
            'subcategoria'      => $this->subcategoria,
            'tags'              => $this->tags ?? [],
            'atributos'         => $this->atributosPublicos(),
            'garantia'          => $this->garantia,
            'que_incluye'       => $this->que_incluye,
            'badge'             => $this->badge,
            'disponible'        => $this->available ?? false,
            'destacado'         => $this->destacado,
            'precio'            => $this->precio,            // precio de venta público
            'precio_promocional' => $this->precio_promocional_activo,
            'imagen_principal'  => $imagenPrincipal ? [
                'url'   => $imagenPrincipal->url,
                'alt'   => $imagenPrincipal->alt_text ?? $this->titulo,
                'width' => $imagenPrincipal->width,
                'height' => $imagenPrincipal->height,
            ] : null,
            'seo' => [
                'title'       => $this->seo_title,
                'description' => $this->seo_description,
            ],
        ];
    }
}

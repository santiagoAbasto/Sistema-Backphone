<?php

namespace Tests;

use App\Models\Tecnico;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Un técnico con ficha, que es lo que ahora pide el formulario de servicio técnico.
     *
     * Se reusa por nombre para que un test pueda llamarlo varias veces sin llenar la tabla
     * de repetidos.
     */
    protected function tecnicoDePrueba(
        string $nombre = 'AXEL',
        string $especialidad = Tecnico::AMBAS,
        int $comision = 60,
    ): Tecnico {
        return Tecnico::firstOrCreate(
            ['nombre' => $nombre],
            ['especialidad' => $especialidad, 'comision' => $comision, 'activo' => true],
        );
    }
}

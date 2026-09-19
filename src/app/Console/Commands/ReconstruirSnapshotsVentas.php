<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\VentaItem;
use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoGeneral;
use App\Models\ProductoApple;

class ReconstruirSnapshotsVentas extends Command
{
    protected $signature = 'ventas:reconstruir-snapshots {--dry-run}';
    protected $description = 'Reconstruye los snapshots faltantes en ventas_items';

    public function handle()
    {
        $dryRun = $this->option('dry-run');

        $items = VentaItem::whereNull('categoria')->get();

        $this->info("Encontrados {$items->count()} items sin snapshot.");

        $actualizados = 0;

        foreach ($items as $item) {

            $snapshot = [
                'categoria' => null,
                'nombre_producto' => null,
                'modelo' => null,
                'capacidad' => null,
                'color' => null,
                'bateria' => null,
                'procesador' => null,
                'ram' => null,
                'almacenamiento' => null,
            ];

            switch ($item->tipo) {

                case 'celular':
                    $producto = Celular::find($item->producto_id);
                    if (!$producto) break;

                    $snapshot['categoria'] = 'celulares';
                    $snapshot['nombre_producto'] = $producto->modelo;
                    $snapshot['modelo'] = $producto->modelo;
                    $snapshot['capacidad'] = $producto->capacidad;
                    $snapshot['color'] = $producto->color;
                    $snapshot['bateria'] = $producto->bateria;
                    break;

                case 'computadora':
                    $producto = Computadora::find($item->producto_id);
                    if (!$producto) break;

                    $snapshot['categoria'] = 'computadoras';
                    $snapshot['nombre_producto'] = $producto->nombre;
                    $snapshot['modelo'] = $producto->nombre;
                    $snapshot['procesador'] = $producto->procesador;
                    $snapshot['ram'] = $producto->ram;
                    $snapshot['almacenamiento'] = $producto->almacenamiento;
                    break;

                case 'producto_general':
                    $producto = ProductoGeneral::find($item->producto_id);
                    if (!$producto) break;

                    $snapshot['categoria'] = $producto->tipo;
                    $snapshot['nombre_producto'] = $producto->nombre;
                    break;

                case 'producto_apple':
                    $producto = ProductoApple::find($item->producto_id);
                    if (!$producto) break;

                    $snapshot['categoria'] = 'productos_apple';
                    $snapshot['nombre_producto'] = $producto->modelo;
                    $snapshot['modelo'] = $producto->modelo;
                    $snapshot['capacidad'] = $producto->capacidad;
                    $snapshot['color'] = $producto->color;
                    $snapshot['bateria'] = $producto->bateria;
                    break;
            }

            if (!$dryRun) {
                $item->update($snapshot);
            }

            $actualizados++;
        }

        if ($dryRun) {
            $this->warn("DRY RUN: Se actualizarían {$actualizados} registros.");
        } else {
            $this->info("Actualizados {$actualizados} registros correctamente.");
        }

        return Command::SUCCESS;
    }
}

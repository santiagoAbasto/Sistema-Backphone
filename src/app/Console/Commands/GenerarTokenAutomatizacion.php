<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Genera un token seguro para el canal de automatización (n8n) o para el export financiero.
 *
 * No toca el .env ni n8n (eso rompería la integración): solo imprime el token y explica
 * cómo rotarlo sin cortar a n8n usando AUTOMATION_TOKENS_PREVIOS como ventana de gracia.
 */
class GenerarTokenAutomatizacion extends Command
{
    protected $signature = 'automation:token {--export : Genera el token del export financiero (ámbito export)}';

    protected $description = 'Genera un token seguro para la automatización (n8n) sin tocar el .env ni n8n.';

    public function handle(): int
    {
        $token = bin2hex(random_bytes(32)); // 64 hex, alta entropía
        $var   = $this->option('export') ? 'AUTOMATION_EXPORT_TOKEN' : 'AUTOMATION_TOKEN';

        $this->newLine();
        $this->info("Token nuevo para {$var}:");
        $this->line("  {$token}");
        $this->newLine();

        if ($this->option('export')) {
            $this->comment('Es el token del export financiero. n8n NO lo usa. Ponelo en el .env como:');
            $this->line("  AUTOMATION_EXPORT_TOKEN={$token}");
        } else {
            $this->comment('Para ROTAR sin cortar n8n (ventana de gracia):');
            $this->line('  1) Pasá el token viejo a AUTOMATION_TOKENS_PREVIOS (separá con coma si hay varios).');
            $this->line("  2) Poné el nuevo en AUTOMATION_TOKEN={$token}");
            $this->line('  3) `php artisan config:clear`. Ambos valen mientras actualizás n8n.');
            $this->line('  4) Cuando n8n ya use el nuevo, vaciá AUTOMATION_TOKENS_PREVIOS y limpiá config.');
        }

        $this->newLine();
        return self::SUCCESS;
    }
}

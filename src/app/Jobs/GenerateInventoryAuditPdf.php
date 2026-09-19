<?php

namespace App\Jobs;

use App\Http\Controllers\Admin\InventoryAuditController;
use App\Models\InventoryAudit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class GenerateInventoryAuditPdf implements ShouldQueue
{
    use Queueable;

    public int $timeout = 180;
    public int $tries = 2;

    public function __construct(public int $inventoryAuditId)
    {
    }

    public function handle(InventoryAuditController $controller): void
    {
        $audit = InventoryAudit::find($this->inventoryAuditId);

        if (! $audit || $audit->status !== 'closed') {
            return;
        }

        Cache::lock('inventory-audit-pdf-'.$audit->id, 240)->block(10, function () use ($controller, $audit) {
            if (! is_file(InventoryAuditController::pdfCachePath($audit))) {
                $controller->pdf(Request::create('/internal/auditoria-inventario/'.$audit->id.'/pdf'), $audit);
            }
        });
    }
}

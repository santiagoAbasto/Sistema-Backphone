<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryAuditItem extends Model
{
    protected $fillable = [
        'inventory_audit_id',
        'source_type',
        'source_id',
        'category',
        'name',
        'primary_code',
        'secondary_code',
        'tertiary_code',
        'details',
        'expected_state',
        'resolution',
        'scanned_at',
        'scanned_by',
        'scan_value',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'scanned_at' => 'datetime',
        ];
    }

    public function audit()
    {
        return $this->belongsTo(InventoryAudit::class, 'inventory_audit_id');
    }

    public function scanner()
    {
        return $this->belongsTo(User::class, 'scanned_by');
    }
}

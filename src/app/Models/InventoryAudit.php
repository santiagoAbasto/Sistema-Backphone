<?php

namespace App\Models;

use App\Models\Concerns\DeSucursal;
use Illuminate\Database\Eloquent\Model;

class InventoryAudit extends Model
{
    use DeSucursal;

    protected $fillable = [
        'sucursal_id',
        'started_by',
        'closed_by',
        'status',
        'started_at',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function items()
    {
        return $this->hasMany(InventoryAuditItem::class);
    }

    public function starter()
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    public function closer()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AutomationReport extends Model
{
    protected $fillable = [
        'period',
        'content',
        'period_start',
        'period_end',
        'engine_version',
        'prompt_version',
        'generated_at',
    ];

    protected $casts = [
        'content'       => 'array',   // 🔥 CLAVE
        'period_start'  => 'date',
        'period_end'    => 'date',
        'generated_at'  => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relaciones
    |--------------------------------------------------------------------------
    */

    public function views()
    {
        return $this->hasMany(AutomationReportView::class, 'report_id');
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers opcionales
    |--------------------------------------------------------------------------
    */

    public function isClosed(): bool
    {
        return $this->period_end <= now();
    }
}
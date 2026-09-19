<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AutomationReportView extends Model
{
    protected $fillable = [
        'report_id',
        'user_id',
        'viewed_at',
    ];

    protected $casts = [
        'viewed_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relaciones
    |--------------------------------------------------------------------------
    */

    public function report()
    {
        return $this->belongsTo(AutomationReport::class, 'report_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
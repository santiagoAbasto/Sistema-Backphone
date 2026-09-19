<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\SystemNotification;
use Illuminate\Support\Facades\Schema;

class SystemNotificationController extends Controller
{
    public function index()
    {
        if (! Schema::hasTable('system_notifications')) {
            return response()->json([
                'notifications' => [],
            ]);
        }

        return response()->json([
            'notifications' => SystemNotification::latest()->take(20)->get(),
        ]);
    }

    public function markAsRead(SystemNotification $notification)
    {
        if (! Schema::hasTable('system_notifications')) {
            return response()->json(['ok' => false], 404);
        }

        $notification->update(['read' => true]);

        return response()->json(['ok' => true]);
    }
}

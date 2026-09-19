<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Automation\TopProductsController;

Route::middleware('automation')
    ->prefix('automation')
    ->group(function () {

        // Test de conexión n8n → Laravel
        Route::get('/test', function () {
            return response()->json([
                'status' => 'ok',
                'message' => 'Automation access granted',
            ]);
        });

        // Top productos por categoría (IA / alertas)
        Route::get('/top-products', TopProductsController::class);

    });

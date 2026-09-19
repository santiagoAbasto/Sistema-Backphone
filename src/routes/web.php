<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Foundation\Application;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;

// 📦 Controladores usados
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\CelularController;
use App\Http\Controllers\ProductoGeneralController;
use App\Http\Controllers\ComputadoraController;
use App\Http\Controllers\VentaController;
use App\Http\Controllers\ReservaController;
use App\Http\Controllers\ServicioTecnicoController;
use App\Http\Controllers\ReporteController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Admin\CotizacionController;
use App\Http\Controllers\Admin\ExportController;
use App\Http\Controllers\Admin\ClienteAdminController;
use App\Http\Controllers\Api\StockController;
use App\Http\Controllers\ProductoAppleController; // 👈 Asegúrate que esté arriba
use App\Http\Controllers\Vendedor\ProductoVendedorController;
use App\Http\Controllers\Vendedor\DashboardVendedorController;
use App\Http\Controllers\Vendedor\ClienteVendedorController;
use App\Http\Controllers\EgresoController;
use App\Http\Controllers\GoogleDriveController;
use App\Http\Controllers\Automation\AutomationReportController;
use App\Http\Controllers\Admin\SystemNotificationController;
use App\Http\Controllers\Admin\InventoryAuditController;
use App\Http\Controllers\Admin\ConfiguracionNegocioController;

use Illuminate\Http\Request;


// 🏠 La raíz no tiene pantalla propia: quien entra va a su panel, y quien no ha entrado, al acceso.
Route::get('/', function () {
    return auth()->check() ? redirect()->route('dashboard') : redirect()->route('login');
})->name('inicio');

// 🚀 Redirección al dashboard según el rol autenticado
Route::middleware(['auth', 'verified'])->get('/dashboard', function () {
    $user = auth()->user();
    return redirect()->route($user->rol === 'admin' ? 'admin.dashboard' : 'vendedor.dashboard');
})->name('dashboard');

// 👤 Perfil del usuario (edición, actualización y eliminación)
Route::middleware(['auth'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    // La foto: subir y quitar. Una cuenta no se borra a sí misma; la da de baja un administrador.
    Route::post('/profile/foto', [ProfileController::class, 'foto'])->name('profile.foto')->middleware('throttle:20,1');
    Route::delete('/profile/foto', [ProfileController::class, 'quitarFoto'])->name('profile.foto.quitar');
});


// ========================
// 🛡️ RUTAS ADMINISTRADOR
// ========================
// El panel: entra quien tenga el módulo permitido en su rol (Usuarios y roles). Lo que no pertenece a ningún
// módulo queda solo para administradores; la regla vive en App\Support\Permisos y App\Http\Middleware\PermisoMiddleware.
Route::middleware(['auth', 'verified', 'permiso'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {

        // 📊 Dashboard
        Route::get('/dashboard', [DashboardController::class, 'index'])
            ->name('dashboard');

        // ========================
        // 🏢 SUCURSALES
        // ========================
        // El selector del encabezado: solo tiene efecto en quien puede elegir.
        Route::post('/sucursal-activa', [\App\Http\Controllers\Admin\SucursalActivaController::class, 'update'])
            ->name('sucursal-activa.update');

        Route::get('/sucursales', [\App\Http\Controllers\Admin\SucursalController::class, 'index'])->name('sucursales.index');
        Route::post('/sucursales', [\App\Http\Controllers\Admin\SucursalController::class, 'store'])->name('sucursales.store');
        Route::patch('/sucursales/{sucursal}', [\App\Http\Controllers\Admin\SucursalController::class, 'update'])->name('sucursales.update');
        Route::patch('/sucursales/{sucursal}/visibilidad', [\App\Http\Controllers\Admin\SucursalController::class, 'visibilidad'])->name('sucursales.visibilidad');
        Route::delete('/sucursales/{sucursal}', [\App\Http\Controllers\Admin\SucursalController::class, 'destroy'])->name('sucursales.destroy');

        // ========================
        // ⚙️ DATOS DEL NEGOCIO
        // ========================
        Route::get('/configuracion/negocio', [ConfiguracionNegocioController::class, 'edit'])->name('configuracion.negocio.edit');
        Route::post('/configuracion/negocio', [ConfiguracionNegocioController::class, 'update'])->name('configuracion.negocio.update');

        // ========================
        // 🔔 NOTIFICACIONES SISTEMA
        // ========================
        Route::get('/notifications', [SystemNotificationController::class, 'index'])
            ->name('notifications.index');

        Route::post('/notifications/{notification}/read', [SystemNotificationController::class, 'markAsRead'])
            ->name('notifications.read');

        // ========================
        // 🤖 AUTOMATION REPORTS
        // ========================
        Route::prefix('automation')
            ->name('automation.')
            ->group(function () {

                Route::get('/latest-weekly', [AutomationReportController::class, 'latestWeekly'])
                    ->name('latestWeekly');

                Route::post('/{report}/mark-viewed', [AutomationReportController::class, 'markViewed'])
                    ->name('markViewed');

                Route::get('/{report}', [AutomationReportController::class, 'show'])
                    ->name('show');
            });

        // ========================
        // 📱 CRUD Celulares
        // ========================
        // Va antes del resource: si no, "condicion" se tomaría como el id de un celular
        Route::patch('celulares/condicion', [CelularController::class, 'condicionMasiva'])
            ->name('celulares.condicion');

        Route::resource('celulares', CelularController::class)
            ->names('celulares')
            ->parameters(['celulares' => 'celular']);

        // ========================
        // 💻 CRUD Computadoras
        // ========================
        // Va antes del resource: si no, "condicion" se tomaría como el id de una computadora
        Route::patch('computadoras/condicion', [ComputadoraController::class, 'condicionMasiva'])
            ->name('computadoras.condicion');

        Route::resource('computadoras', ComputadoraController::class)
            ->names('computadoras');

        // ========================
        // 📦 Productos Generales
        // ========================
        Route::get('productos-generales/verificar-codigo', [ProductoGeneralController::class, 'verificarCodigo'])
            ->name('productos-generales.verificar-codigo');

        // Va antes del resource: si no, "condicion" se tomaría como el id de un producto
        Route::patch('productos-generales/condicion', [ProductoGeneralController::class, 'condicionMasiva'])
            ->name('productos-generales.condicion');

        Route::resource('productos-generales', ProductoGeneralController::class)
            ->names('productos-generales')
            ->parameters(['productos-generales' => 'producto']);

        // ========================
        // 🛒 Ventas
        // ========================
        Route::get('/ventas/buscar-nota', [VentaController::class, 'buscarNota'])
            ->name('ventas.buscarNota');

        Route::get('/ventas/{venta}/boleta', [VentaController::class, 'boleta'])
            ->name('ventas.boleta');

        Route::get('/ventas/{venta}/boleta-80', [VentaController::class, 'boleta80'])
            ->name('ventas.boleta80');

        // Sin «ver» ni «borrar»: VentaController no los tiene y ninguna pantalla los usa (respondían con error)
        Route::resource('ventas', VentaController::class)
            ->except(['show', 'destroy'])
            ->names('ventas')
            ->parameters(['ventas' => 'venta']);

        // ========================
        // 📌 Reservas
        // ========================
        Route::get('/reservas/activas', [ReservaController::class, 'activas'])
            ->name('reservas.activas');

        Route::patch('/reservas/{reserva}/estado', [ReservaController::class, 'updateEstado'])
            ->name('reservas.estado');

        Route::get('/reservas/{reserva}/boleta', [ReservaController::class, 'boleta'])
            ->name('reservas.boleta');

        Route::get('/reservas/{reserva}/boleta-80', [ReservaController::class, 'boleta80'])
            ->name('reservas.boleta80');

        Route::resource('reservas', ReservaController::class)
            ->only(['index', 'create', 'store'])
            ->names('reservas')
            ->parameters(['reservas' => 'reserva']);

        // ========================
        // 🧰 Servicios Técnicos
        // ========================
        Route::resource('servicios', ServicioTecnicoController::class)
            ->only(['index', 'create', 'store'])
            ->names('servicios')
            ->parameters(['servicios' => 'servicio']);

        Route::get('/servicios/{servicio}/boleta', [ServicioTecnicoController::class, 'boleta'])
            ->name('servicios.boleta');

        Route::get('/servicios/{servicio}/recibo-80mm', [ServicioTecnicoController::class, 'recibo80mm'])
            ->name('servicios.recibo80mm');

        Route::get('/servicios/exportar-filtrado', [ServicioTecnicoController::class, 'exportarFiltrado'])
            ->name('servicios.exportarFiltrado');

        Route::get('/servicios/exportar-resumen', [ServicioTecnicoController::class, 'exportarResumen'])
            ->name('servicios.exportarResumen');

        // El costo del servicio lo carga el administrador (el vendedor registra solo lo que cobra)
        Route::patch('/servicios/{servicio}/costo', [ServicioTecnicoController::class, 'cargarCosto'])
            ->name('servicios.costo');

        // ========================
        // 📊 Reportes
        // ========================
        Route::get('/reportes', [ReporteController::class, 'index'])
            ->name('reportes.index');

        Route::get('/reportes/exportar', [ReporteController::class, 'exportar'])
            ->name('reportes.exportar');

        Route::get('/reportes/exportar-dia', [ReporteController::class, 'exportDia'])
            ->name('reportes.exportar-dia');

        Route::get('/reportes/exportar-semana', [ReporteController::class, 'exportSemana'])
            ->name('reportes.exportar-semana');

        Route::get('/reportes/exportar-mes', [ReporteController::class, 'exportMes'])
            ->name('reportes.exportar-mes');

        Route::get('/reportes/exportar-anio', [ReporteController::class, 'exportAnio'])
            ->name('reportes.exportar-anio');

        // ========================
        // ✔️ Permuta habilitar
        // ========================
        Route::patch('/celulares/{celular}/habilitar', [CelularController::class, 'habilitar'])
            ->name('celulares.habilitar');

        Route::patch('/computadoras/{computadora}/habilitar', [ComputadoraController::class, 'habilitar'])
            ->name('computadoras.habilitar');

        Route::patch('/productos-generales/{producto}/habilitar', [ProductoGeneralController::class, 'habilitar'])
            ->name('productos-generales.habilitar');

        // ========================
        // 📦 Cotizaciones
        // ========================
        Route::resource('cotizaciones', CotizacionController::class)
            ->only(['index', 'create', 'store'])
            ->names('cotizaciones');

        Route::get('cotizaciones/{cotizacion}/pdf', [CotizacionController::class, 'exportarPDF'])
            ->name('cotizaciones.pdf');

        Route::post('cotizaciones/{id}/reenviar', [CotizacionController::class, 'reenviarCorreo'])
            ->name('cotizaciones.reenviar');

        Route::post('cotizaciones/enviar-lote', [CotizacionController::class, 'enviarLoteWhatsapp'])
            ->name('cotizaciones.enviar-lote');

        Route::get('cotizaciones/whatsapp-final', [CotizacionController::class, 'whatsappFinalLibre'])
            ->name('cotizaciones.enviar-whatsapp-libre');

        // ========================
        // 📤 Exportaciones
        // ========================
        // 👥 SISTEMA: USUARIOS Y ROLES
        // ========================
        Route::get('/usuarios', [\App\Http\Controllers\Admin\UsuarioController::class, 'index'])->name('usuarios.index');
        Route::post('/usuarios', [\App\Http\Controllers\Admin\UsuarioController::class, 'store'])->name('usuarios.store');
        Route::patch('/usuarios/{usuario}', [\App\Http\Controllers\Admin\UsuarioController::class, 'update'])->name('usuarios.update');
        Route::delete('/usuarios/{usuario}', [\App\Http\Controllers\Admin\UsuarioController::class, 'destroy'])->name('usuarios.destroy');

        Route::post('/roles', [\App\Http\Controllers\Admin\RolController::class, 'store'])->name('roles.store');
        Route::patch('/roles/{rol}', [\App\Http\Controllers\Admin\RolController::class, 'update'])->name('roles.update');
        Route::delete('/roles/{rol}', [\App\Http\Controllers\Admin\RolController::class, 'destroy'])->name('roles.destroy');

        Route::get('/exportar', [ExportController::class, 'index'])
            ->name('exportaciones.index');

        Route::get('/exportar/personalizado', [ExportController::class, 'personalizado'])
            ->name('exportar.personalizado');

        Route::get('/exportar/por-nombre', [ExportController::class, 'porNombre'])
            ->name('exportar.por-nombre');

        // Cuántos productos saldrían con lo escrito, para no generar un PDF vacío
        Route::get('/exportar/contar', [ExportController::class, 'contar'])
            ->name('exportar.contar');

        Route::get('/exportar/fundas-magsafe-14-pro-max', [ExportController::class, 'fundasMagsafe14ProMax'])
            ->name('exportar.fundas-magsafe-14-pro-max');

        Route::get('/exportar/celulares', [ExportController::class, 'celulares'])
            ->name('exportar.celulares');

        Route::get('/exportar/computadoras', [ExportController::class, 'computadoras'])
            ->name('exportar.computadoras');

        Route::get('/exportar/productos-generales', [ExportController::class, 'productosGenerales'])
            ->name('exportar.productos-generales');

        Route::get('/exportar/productos-generales/{tipo}', [ExportController::class, 'productosGeneralesPorTipo'])
            ->name('exportar.productos-generales.tipo');

        Route::get('/exportar/productos-apple', [ExportController::class, 'productosApple'])
            ->name('exportar.productos-apple');

        // ========================
        // 🍎 Productos Apple
        // ========================
        // Van antes del resource: si no, "condicion" se tomaría como el id de un producto
        Route::patch('productos-apple/condicion', [ProductoAppleController::class, 'condicionMasiva'])
            ->name('productos-apple.condicion');
        Route::patch('productos-apple/{productoApple}/habilitar', [ProductoAppleController::class, 'habilitar'])
            ->name('productos-apple.habilitar');

        Route::resource('productos-apple', ProductoAppleController::class)
            ->names('productos-apple')
            ->parameters(['productos-apple' => 'productoApple']);

        // ========================
        // 🔎 Auditoría física de inventario
        // ========================
        Route::get('/auditoria-inventario', [InventoryAuditController::class, 'index'])
            ->name('inventory-audits.index');
        Route::post('/auditoria-inventario', [InventoryAuditController::class, 'store'])
            ->name('inventory-audits.store');
        Route::post('/auditoria-inventario/{inventoryAudit}/escanear', [InventoryAuditController::class, 'scan'])
            ->name('inventory-audits.scan');
        Route::post('/auditoria-inventario/{inventoryAudit}/cerrar', [InventoryAuditController::class, 'close'])
            ->name('inventory-audits.close');
        Route::get('/auditoria-inventario/{inventoryAudit}/pdf', [InventoryAuditController::class, 'pdf'])
            ->name('inventory-audits.pdf');

        // ========================
        // 👥 Clientes
        // ========================
        Route::get('/clientes', [ClienteAdminController::class, 'index'])
            ->name('clientes.index');

        Route::get('/clientes/sugerencias', [ClienteAdminController::class, 'sugerencias'])
            ->name('clientes.sugerencias');

        Route::get('/clientes/{cliente}/edit', [ClienteAdminController::class, 'edit'])
            ->name('clientes.edit');

        Route::put('/clientes/{cliente}', [ClienteAdminController::class, 'update'])
            ->name('clientes.update');


        // ========================
        // 💰 Egresos
        // ========================
        Route::get('/egresos', [EgresoController::class, 'index'])
            ->name('egresos.index');

        Route::get('/egresos/create', [EgresoController::class, 'create'])
            ->name('egresos.create');

        Route::post('/egresos', [EgresoController::class, 'store'])
            ->name('egresos.store');

        Route::get('/egresos/exportar/pdf', [EgresoController::class, 'exportarPDF'])
            ->name('egresos.exportar-pdf');

    });
// ========================
// 🤖 RUTA PARA n8n
// ========================
Route::post('/automation/store', [
    AutomationReportController::class,
    'store'
])->middleware('automation')->name('automation.store');

// ========================
// 🧑‍💼 RUTAS VENDEDOR
// ========================

Route::middleware(['auth', 'verified', 'rol:vendedor'])
    ->prefix('vendedor')
    ->name('vendedor.')
    ->group(function () {

        // ========================
        // 📊 DASHBOARD
        // ========================

        Route::get('/dashboard', [DashboardVendedorController::class, 'index'])
            ->name('dashboard');

        // ========================
        // 📦 PRODUCTOS
        // ========================

        Route::get('/productos', [ProductoVendedorController::class, 'index'])
            ->name('productos.index');

        Route::get('/celulares', [CelularController::class, 'index'])
            ->name('celulares.index');

        Route::get('/computadoras', [ComputadoraController::class, 'index'])
            ->name('computadoras.index');

        Route::get('/productos-generales', [ProductoGeneralController::class, 'index'])
            ->name('productos-generales.index');

        // ========================
        // 🛒 VENTAS
        // ========================

        Route::get('/ventas', [VentaController::class, 'index'])
            ->name('ventas.index');

        Route::get('/ventas/create', [VentaController::class, 'create'])
            ->name('ventas.create');

        Route::post('/ventas', [VentaController::class, 'store'])
            ->name('ventas.store');

        Route::get('/ventas/{venta}/edit', [VentaController::class, 'edit'])
            ->name('ventas.edit');

        Route::put('/ventas/{venta}', [VentaController::class, 'update'])
            ->name('ventas.update');

        Route::get('/ventas/{venta}/boleta', [VentaController::class, 'boleta'])
            ->name('ventas.boleta');

        Route::get('/ventas/{venta}/boleta-80', [VentaController::class, 'boleta80'])
            ->name('ventas.boleta80');

        Route::get('/ventas/exportar/pdf', [VentaController::class, 'exportarVentasVendedor'])
            ->name('ventas.exportar');

        Route::get('/ventas/buscar-nota', [VentaController::class, 'buscarNota'])
            ->name('ventas.buscarNota');

        Route::get('/ventas/buscar-solo-ventas', [VentaController::class, 'buscarSoloVentas'])
            ->name('ventas.buscarSoloVentas');

        // ========================
        // 📌 RESERVAS
        // ========================

        Route::get('/reservas', [ReservaController::class, 'index'])
            ->name('reservas.index');

        Route::get('/reservas/create', [ReservaController::class, 'create'])
            ->name('reservas.create');

        Route::post('/reservas', [ReservaController::class, 'store'])
            ->name('reservas.store');

        Route::get('/reservas/activas', [ReservaController::class, 'activas'])
            ->name('reservas.activas');

        Route::patch('/reservas/{reserva}/estado', [ReservaController::class, 'updateEstado'])
            ->name('reservas.estado');

        Route::get('/reservas/{reserva}/boleta', [ReservaController::class, 'boleta'])
            ->name('reservas.boleta');

        Route::get('/reservas/{reserva}/boleta-80', [ReservaController::class, 'boleta80'])
            ->name('reservas.boleta80');

        // ========================
        // 🧰 SERVICIO TÉCNICO
        // ========================

        Route::get('/servicios', [ServicioTecnicoController::class, 'index'])
            ->name('servicios.index');

        Route::get('/servicios/create', [ServicioTecnicoController::class, 'create'])
            ->name('servicios.create');

        Route::post('/servicios', [ServicioTecnicoController::class, 'store'])
            ->name('servicios.store');

        Route::get('/servicios/{servicio}/boleta', [ServicioTecnicoController::class, 'boleta'])
            ->name('servicios.boleta'); // ✅ CORREGIDO

        Route::get('/servicios/{servicio}/recibo-80mm', [ServicioTecnicoController::class, 'recibo80mm'])
            ->name('servicios.recibo80mm');

        Route::get('/servicios/exportar-filtrado', [ServicioTecnicoController::class, 'exportarFiltrado'])
            ->name('servicios.exportarFiltrado');

        Route::get('/servicios/exportar-resumen', [ServicioTecnicoController::class, 'exportarResumen'])
            ->name('servicios.exportarResumen');

        // ========================
        // 📄 COTIZACIONES
        // ========================

        Route::get('/cotizaciones', [CotizacionController::class, 'indexVendedor'])
            ->name('cotizaciones.index');

        Route::get('/cotizaciones/crear', [CotizacionController::class, 'createVendedor'])
            ->name('cotizaciones.create');

        Route::post('/cotizaciones', [CotizacionController::class, 'storeVendedor'])
            ->name('cotizaciones.store');

        Route::get('/cotizaciones/pdf/{id}', [CotizacionController::class, 'exportarPDF'])
            ->name('cotizaciones.pdf');

        Route::post('/cotizaciones/reenviar/{id}', [CotizacionController::class, 'reenviarCorreo'])
            ->name('cotizaciones.reenviar');

        // Mismos nombres que en el panel de administración: las dos pantallas son la misma pieza
        Route::get('/cotizaciones/whatsapp-final', [CotizacionController::class, 'whatsappFinalLibre'])
            ->name('cotizaciones.enviar-whatsapp-libre');

        Route::post('/cotizaciones/enviar-lote', [CotizacionController::class, 'enviarLoteWhatsapp'])
            ->name('cotizaciones.enviar-lote');

        // ========================
        // 👥 CLIENTES
        // ========================

        Route::prefix('clientes')
            ->name('clientes.')
            ->group(function () {

                Route::get('/', [ClienteVendedorController::class, 'index'])
                    ->name('index');

                Route::get('/sugerencias', [ClienteVendedorController::class, 'sugerencias'])
                    ->name('sugerencias');

                Route::get('/{id}/edit', [ClienteVendedorController::class, 'edit'])
                    ->name('edit');

                Route::put('/{id}', [ClienteVendedorController::class, 'update'])
                    ->name('update');
            });
    });


// ========================
// 🔄 API & EXTRAS
// ========================


// API STOCK (solo el equipo: devuelve IMEI, costo y procedencia)
Route::middleware(['auth', 'verified', 'rol:admin|vendedor', 'throttle:120,1'])
    ->prefix('api/stock')
    ->name('api.stock.')
    ->group(function () {

        Route::get('celulares', [StockController::class, 'celulares'])
            ->name('celulares');

        Route::get('computadoras', [StockController::class, 'computadoras'])
            ->name('computadoras');

        Route::get('productos-generales', [StockController::class, 'productosGenerales'])
            ->name('productos_generales');

        Route::get('productos-apple', [StockController::class, 'productosApple'])
            ->name('productos_apple');

        Route::post('buscar', [StockController::class, 'buscarPorCodigo'])
            ->name('buscar_codigo');
    });


// Google Drive OAuth
Route::middleware(['auth', 'verified', 'rol:admin'])->group(function () {
    Route::get('/google-auth', [GoogleDriveController::class, 'redirectToGoogle'])
        ->name('google.auth');

    Route::get('/oauth2callback', [GoogleDriveController::class, 'handleGoogleCallback'])
        ->name('google.callback');
});


// API Permuta Store (solo el equipo)
Route::middleware(['auth', 'verified', 'rol:admin|vendedor', 'throttle:60,1'])->group(function () {
    Route::post('/api/permuta/celular', [CelularController::class, 'apiStore']);
    Route::post('/api/permuta/computadora', [ComputadoraController::class, 'apiStore']);
    Route::post('/api/permuta/producto_general', [ProductoGeneralController::class, 'apiStore']);
});

require __DIR__ . '/auth.php';

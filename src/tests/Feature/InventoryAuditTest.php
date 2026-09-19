<?php

namespace Tests\Feature;

use App\Models\Celular;
use App\Models\Computadora;
use App\Models\ProductoGeneral;
use App\Models\ProductoApple;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryAuditTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_start_audit_and_snapshot_only_available_products(): void
    {
        $admin = $this->admin();
        $availablePhone = $this->phone('111111111111111', 'disponible');
        $this->phone('222222222222222', 'vendido');
        $computer = Computadora::create([
            'numero_serie' => 'SERIE-ABC',
            'nombre' => 'MacBook Pro',
            'color' => 'Gris',
            'ram' => '16 GB',
            'almacenamiento' => '512 GB',
            'procedencia' => 'USA',
            'precio_costo' => 100,
            'precio_venta' => 120,
            'estado' => 'disponible',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.inventory-audits.store'))
            ->assertRedirect(route('admin.inventory-audits.index'));

        $this->assertDatabaseHas('inventory_audit_items', [
            'source_type' => 'celular',
            'source_id' => $availablePhone->id,
        ]);
        $this->assertDatabaseHas('inventory_audit_items', [
            'source_type' => 'computadora',
            'source_id' => $computer->id,
        ]);
        $this->assertDatabaseCount('inventory_audit_items', 2);
    }

    public function test_scan_marks_product_found_and_rejects_duplicate(): void
    {
        $admin = $this->admin();
        $this->phone('111-111-111-111-111', 'disponible');

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => '111111111111111'])
            ->assertOk()
            ->assertJsonPath('audit.scanned', 1)
            ->assertJsonPath('audit.missing', 0);

        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => '111111111111111'])
            ->assertStatus(409)
            ->assertJsonPath('duplicate', true);
    }

    public function test_closing_audit_preserves_unscanned_products_as_missing(): void
    {
        $admin = $this->admin();
        ProductoGeneral::create([
            'codigo' => 'ACC-001',
            'tipo' => 'accesorio',
            'nombre' => 'Cable USB-C',
            'procedencia' => 'USA',
            'precio_costo' => 10,
            'precio_venta' => 15,
            'estado' => 'disponible',
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        $this->actingAs($admin)
            ->post(route('admin.inventory-audits.close', $auditId))
            ->assertRedirect(route('admin.inventory-audits.index'));

        $this->assertDatabaseHas('inventory_audits', ['id' => $auditId, 'status' => 'closed']);
        $this->assertDatabaseHas('inventory_audit_items', [
            'inventory_audit_id' => $auditId,
            'primary_code' => 'ACC-001',
            'scanned_at' => null,
        ]);
    }

    public function test_scan_tolerates_leading_s_added_by_scanner(): void
    {
        $admin = $this->admin();

        // Código guardado en DB sin S inicial (como está en el sistema)
        ProductoGeneral::create([
            'codigo'      => 'HHY50635DI11PW9A4',
            'tipo'        => 'accesorio',
            'nombre'      => 'Cubo Original 20W',
            'procedencia' => 'USA',
            'precio_costo' => 10,
            'precio_venta' => 15,
            'estado'      => 'disponible',
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        // Escáner lee "SHHY50635DI11PW9A4" (S de más al inicio)
        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => 'SHHY50635DI11PW9A4'])
            ->assertOk()
            ->assertJsonPath('audit.scanned', 1);
    }

    public function test_scan_tolerates_missing_leading_s(): void
    {
        $admin = $this->admin();

        // Código guardado en DB CON S inicial
        ProductoGeneral::create([
            'codigo'      => 'SHHY50635DI11PW9A4',
            'tipo'        => 'accesorio',
            'nombre'      => 'Cubo Original 40W',
            'procedencia' => 'USA',
            'precio_costo' => 10,
            'precio_venta' => 15,
            'estado'      => 'disponible',
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        // Escáner lee "HHY50635DI11PW9A4" (le falta la S inicial)
        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => 'HHY50635DI11PW9A4'])
            ->assertOk()
            ->assertJsonPath('audit.scanned', 1);
    }

    public function test_open_audit_recognizes_imei_added_after_snapshot(): void
    {
        $admin = $this->admin();
        $phone = $this->phone('111111111111111', 'disponible');

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        $phone->update(['imei_2' => '222222222222222']);

        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => '222 222-222-222-222'])
            ->assertOk()
            ->assertJsonPath('audit.scanned', 1);
    }

    public function test_scan_recognizes_cell_phone_serial_number(): void
    {
        $admin = $this->admin();
        $phone = $this->phone('333333333333333', 'disponible');
        $phone->update(['numero_serie' => 'F2L-ABC 123']);

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => 'f2labc123'])
            ->assertOk()
            ->assertJsonPath('audit.scanned', 1);
    }

    public function test_unique_long_serial_prefix_is_recognized_safely(): void
    {
        $admin = $this->admin();
        ProductoApple::create([
            'modelo' => 'AirPods 1ra Gen.',
            'numero_serie' => 'GSFGSHTSR54',
            'capacidad' => 'N/A',
            'bateria' => 'N/A',
            'color' => 'Blanco',
            'procedencia' => 'USA',
            'precio_costo' => 50,
            'precio_venta' => 80,
            'estado' => 'disponible',
        ]);

        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => 'GSFGSHTSR5'])
            ->assertOk()
            ->assertJsonPath('audit.scanned', 1);
    }

    public function test_products_received_after_start_are_separate_from_expected_count(): void
    {
        $admin = $this->admin();
        $this->phone('444444444444444', 'disponible');
        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        ProductoGeneral::create([
            'codigo' => 'NEW-AFTER-001',
            'tipo' => 'accesorio',
            'nombre' => 'Ingreso posterior',
            'procedencia' => 'USA',
            'precio_costo' => 10,
            'precio_venta' => 15,
            'estado' => 'disponible',
        ]);

        $this->actingAs($admin)
            ->postJson(route('admin.inventory-audits.scan', $auditId), ['code' => 'NEW-AFTER-001'])
            ->assertOk()
            ->assertJsonPath('post_start', true)
            ->assertJsonPath('audit.expected', 1)
            ->assertJsonPath('audit.scanned', 0)
            ->assertJsonPath('audit.received_after_start', 1);
    }

    public function test_product_sold_during_audit_is_justified_not_missing(): void
    {
        $admin = $this->admin();
        $phone = $this->phone('555555555555555', 'disponible');
        $this->actingAs($admin)->post(route('admin.inventory-audits.store'));
        $auditId = (int) \DB::table('inventory_audits')->value('id');

        $phone->update(['estado' => 'vendido']);

        $this->actingAs($admin)->post(route('admin.inventory-audits.close', $auditId));

        $this->assertDatabaseHas('inventory_audit_items', [
            'inventory_audit_id' => $auditId,
            'source_type' => 'celular',
            'source_id' => $phone->id,
            'resolution' => 'sold_after_audit',
        ]);
    }

    private function admin(): User
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $user->forceFill(['rol' => 'admin'])->save();

        return $user;
    }

    private function phone(string $imei, string $status): Celular
    {
        return Celular::create([
            'modelo' => 'iPhone 15',
            'capacidad' => '128 GB',
            'color' => 'Negro',
            'imei_1' => $imei,
            'estado_imei' => 'libre',
            'procedencia' => 'USA',
            'precio_costo' => 100,
            'precio_venta' => 120,
            'estado' => $status,
        ]);
    }
}

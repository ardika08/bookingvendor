<?php

namespace Tests\Unit;

use App\Models\Category;
use App\Models\User;
use App\Models\Vendor;
use App\Services\VendorDocumentData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Uji penyedia data profil untuk dokumen (invoice cetak, PDF, halaman publik).
 */
class VendorDocumentDataTest extends TestCase
{
    use RefreshDatabase;

    private VendorDocumentData $documents;
    private Vendor $vendor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->documents = new VendorDocumentData();

        $category = Category::create(['name' => 'Wedding Organizer', 'slug' => 'wedding-organizer']);

        $user = User::create([
            'name' => 'Dika Pratama',
            'email' => 'dika@example.test',
            'password' => 'password',
            'avatar_url' => 'https://example.test/avatar.png',
        ]);

        $this->vendor = Vendor::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'name' => 'Lumen Wedding Story',
            'slug' => 'lumen-wedding-story',
            'description' => 'WO berbasis Jakarta.',
            'location' => 'Jakarta Selatan',
            'contact' => '0812-3456-7890',
            'contact_email' => 'hello@lumenwedding.id',
            'schedule_link_active' => true,
        ]);
    }

    public function test_profil_lengkap_untuk_dokumen(): void
    {
        $this->vendor->update([
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $data = $this->documents->for($this->vendor->fresh());

        $this->assertSame('Lumen Wedding Story', $data['name']);
        $this->assertSame('Wedding Organizer', $data['category']);
        $this->assertSame('Jakarta Selatan', $data['location']);
        $this->assertSame('0812-3456-7890', $data['contact']);
        $this->assertSame('hello@lumenwedding.id', $data['contactEmail']);
        $this->assertSame('https://wa.me/6281234567890', $data['whatsapp']);

        // Tautan jadwal publik aktif.
        $this->assertStringContainsString('/jadwal/lumen-wedding-story', $data['scheduleUrl']);

        $this->assertTrue($data['bank']['complete']);
        $this->assertSame(
            'BCA 1234567890 a.n. Lumen Wedding Story',
            $data['bank']['line'],
        );
    }

    public function test_tautan_jadwal_null_bila_nonaktif(): void
    {
        $this->vendor->update(['schedule_link_active' => false]);

        $data = $this->documents->for($this->vendor->fresh());

        $this->assertNull($data['scheduleUrl']);
    }

    public function test_tautan_whatsapp_dinormalisasi(): void
    {
        // Format 0…
        $this->assertSame(
            'https://wa.me/6281234567890',
            $this->documents->waLink('0812-3456-7890'),
        );

        // Format +62…
        $this->assertSame(
            'https://wa.me/6281234567890',
            $this->documents->waLink('+62 812 3456 7890'),
        );

        // Sudah format internasional.
        $this->assertSame(
            'https://wa.me/6281234567890',
            $this->documents->waLink('6281234567890'),
        );

        // Teks pesan ikut ter-enkode.
        $link = $this->documents->waLink('081234567890', 'Halo,Ada info?');
        $this->assertStringStartsWith('https://wa.me/6281234567890?text=', $link);
        $this->assertStringNotContainsString(' ', $link);
        $this->assertStringContainsString('%3F', $link);
    }

    public function test_nomor_tidak_valid_mengembalikan_null(): void
    {
        $this->assertNull($this->documents->waLink(null));
        $this->assertNull($this->documents->waLink('abc'));
        $this->assertNull($this->documents->waLink(''));
    }

    public function test_baris_rekening_null_bila_belum_lengkap(): void
    {
        // Belum ada rekening.
        $this->assertNull($this->documents->bankLine($this->vendor));

        // Setengah jadi.
        $this->vendor->update([
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
        ]);

        $this->assertNull($this->documents->bankLine($this->vendor->fresh()));
    }

    public function test_header_invoice_ringkas(): void
    {
        $this->vendor->update([
            'bank_name' => 'BCA',
            'bank_account_number' => '1234567890',
            'bank_account_name' => 'Lumen Wedding Story',
        ]);

        $header = $this->documents->invoiceHeader($this->vendor->fresh());

        $this->assertSame('Lumen Wedding Story', $header['name']);
        $this->assertSame('Wedding Organizer', $header['category']);
        $this->assertSame('https://wa.me/6281234567890', $header['whatsapp']);
        $this->assertSame(
            'BCA 1234567890 a.n. Lumen Wedding Story',
            $header['bankLine'],
        );

        // Header dokumen tidak membawa kolom yang tidak dicetak.
        $this->assertArrayNotHasKey('slug', $header);
        $this->assertArrayNotHasKey('contactEmail', $header);
    }
}

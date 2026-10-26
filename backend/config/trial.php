<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Batas Masa Trial
    |--------------------------------------------------------------------------
    |
    | Sesuai PRD, vendor baru mendapat jatah 2 booking + 2 invoice selama masa
    | trial. Nilai ini konstan (bukan milik paket langganan) dan tidak direset
    | ketika vendor naik ke paket berbayar.
    |
    */

    'bookings_limit' => env('TRIAL_BOOKINGS_LIMIT', 2),

    'invoices_limit' => env('TRIAL_INVOICES_LIMIT', 2),
];

<?php

namespace App\Mail;

use App\Models\Cotizacion;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\ConfiguracionNegocio;
use Barryvdh\DomPDF\Facade\Pdf;

class CotizacionMailable extends Mailable
{
    use Queueable, SerializesModels;

    public $cotizacion;

    public function __construct(Cotizacion $cotizacion)
    {
        $this->cotizacion = $cotizacion;
    }

    public function build()
    {
        // Generar PDF adjunto
        $pdf = Pdf::loadView('pdf.cotizacion', [
            'cotizacion' => $this->cotizacion,
        ]);

        // El remitente sale de MAIL_FROM_* (.env): acá no se escribe ningún correo.
        return $this->subject('Cotización N.º COT-' . $this->cotizacion->id . ' · ' . ConfiguracionNegocio::nombre())
                    ->view('emails.cotizacion')
                    ->with([
                        'cotizacion' => $this->cotizacion,
                    ])
                    ->attachData($pdf->output(), 'Cotizacion_' . $this->cotizacion->id . '.pdf', [
                        'mime' => 'application/pdf',
                    ]);
    }
}

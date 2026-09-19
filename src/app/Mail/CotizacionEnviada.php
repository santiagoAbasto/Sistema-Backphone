<?php

namespace App\Mail;

use App\Models\Cotizacion;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use App\Models\ConfiguracionNegocio;
use Barryvdh\DomPDF\Facade\Pdf;

class CotizacionEnviada extends Mailable
{
    use Queueable, SerializesModels;

    public Cotizacion $cotizacion;

    public function __construct(Cotizacion $cotizacion)
    {
        $this->cotizacion = $cotizacion;
    }

    public function build()
    {
        // Generar el PDF de la cotización
        $pdf = Pdf::loadView('pdf.cotizacion', [
            'cotizacion' => $this->cotizacion,
        ])->setPaper('letter');

        // El remitente sale de MAIL_FROM_* (.env): acá no se escribe ningún correo.
        return $this->subject('Cotización enviada · ' . ConfiguracionNegocio::nombre())
                    ->view('emails.cotizacion')
                    ->with([
                        'cotizacion' => $this->cotizacion,
                    ])
                    ->attachData($pdf->output(), 'Cotizacion_#' . $this->cotizacion->id . '.pdf', [
                        'mime' => 'application/pdf',
                    ]);
    }
}

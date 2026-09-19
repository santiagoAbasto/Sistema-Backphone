<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Guarda y borra la foto de perfil de una cuenta.
 *
 * La imagen que llega se recorta al cuadrado del centro y se reduce a 256 px: es lo más grande
 * que el panel llega a mostrar, y así una foto de 8 MB del celular no ocupa 8 MB en el disco.
 * Se guarda como JPEG, salvo que traiga transparencia, en cuyo caso queda en PNG.
 */
class FotoDePerfil
{
    private const LADO = 256;
    private const CARPETA = 'perfil';
    private const CALIDAD = 88;

    /** Guarda la foto nueva, borra la anterior y devuelve la ruta dentro del disco público. */
    public function guardar(User $usuario, UploadedFile $archivo): string
    {
        $imagen = $this->abrir($archivo);
        $cuadrada = $this->recortarAlCuadrado($imagen);

        $conTransparencia = in_array($archivo->getMimeType(), ['image/png', 'image/webp'], true);
        $extension = $conTransparencia ? 'png' : 'jpg';
        $ruta = self::CARPETA . '/' . Str::lower(Str::random(24)) . '.' . $extension;

        ob_start();
        if ($conTransparencia) {
            imagepng($cuadrada, null, 6);
        } else {
            imagejpeg($cuadrada, null, self::CALIDAD);
        }
        $binario = ob_get_clean();

        imagedestroy($imagen);
        imagedestroy($cuadrada);

        Storage::disk('public')->put($ruta, $binario);

        $this->borrarArchivo($usuario->foto);

        return $ruta;
    }

    /** Quita la foto de la cuenta y borra el archivo. */
    public function quitar(User $usuario): void
    {
        $this->borrarArchivo($usuario->foto);
    }

    private function borrarArchivo(?string $ruta): void
    {
        if ($ruta && Storage::disk('public')->exists($ruta)) {
            Storage::disk('public')->delete($ruta);
        }
    }

    /** @return \GdImage */
    private function abrir(UploadedFile $archivo)
    {
        $contenido = file_get_contents($archivo->getRealPath());
        $imagen = @imagecreatefromstring($contenido);

        if ($imagen === false) {
            throw new \RuntimeException('No se pudo leer la imagen.');
        }

        // Las fotos de celular suelen venir rotadas: se endereza con lo que diga el EXIF.
        if (function_exists('exif_read_data') && $archivo->getMimeType() === 'image/jpeg') {
            $exif = @exif_read_data($archivo->getRealPath());
            $giro = match ($exif['Orientation'] ?? 1) {
                3 => 180,
                6 => -90,
                8 => 90,
                default => 0,
            };
            if ($giro !== 0) {
                $rotada = imagerotate($imagen, $giro, 0);
                imagedestroy($imagen);
                $imagen = $rotada;
            }
        }

        return $imagen;
    }

    /** Recorta el cuadrado del centro y lo reduce al lado final. @return \GdImage */
    private function recortarAlCuadrado($imagen)
    {
        $ancho = imagesx($imagen);
        $alto = imagesy($imagen);
        $lado = min($ancho, $alto);
        $x = (int) (($ancho - $lado) / 2);
        $y = (int) (($alto - $lado) / 2);

        $destino = imagecreatetruecolor(self::LADO, self::LADO);
        imagealphablending($destino, false);
        imagesavealpha($destino, true);
        imagefill($destino, 0, 0, imagecolorallocatealpha($destino, 0, 0, 0, 127));

        imagecopyresampled($destino, $imagen, 0, 0, $x, $y, self::LADO, self::LADO, $lado, $lado);

        return $destino;
    }
}

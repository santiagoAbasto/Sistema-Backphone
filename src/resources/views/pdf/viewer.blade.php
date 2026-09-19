<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? $negocio['nombre'] . ' — PDF' }}</title>

    @php($faviconVersion = file_exists(public_path('favicon.ico')) ? filemtime(public_path('favicon.ico')) : time())
    <link rel="icon" type="image/x-icon" href="{{ asset('favicon.ico') }}?v={{ $faviconVersion }}">
    <link rel="shortcut icon" type="image/x-icon" href="{{ asset('favicon.ico') }}?v={{ $faviconVersion }}">
    <link rel="icon" type="image/svg+xml" href="{{ asset('favicon/favicon.svg') }}?v={{ $faviconVersion }}">
    <link rel="icon" type="image/png" sizes="96x96" href="{{ asset('favicon/favicon-96x96.png') }}?v={{ $faviconVersion }}">
    <link rel="apple-touch-icon" href="{{ asset('favicon/apple-touch-icon.png') }}?v={{ $faviconVersion }}">
    <link rel="manifest" href="{{ asset('favicon/site.webmanifest') }}?v={{ $faviconVersion }}">

    <style>
        html,
        body {
            height: 100%;
            margin: 0;
            background: #0f172a;
            color: #e2e8f0;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .pdf-shell {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .pdf-bar {
            align-items: center;
            background: linear-gradient(135deg, #020617, #111827);
            border-bottom: 1px solid rgba(148, 163, 184, 0.22);
            display: flex;
            gap: 16px;
            justify-content: space-between;
            padding: 14px 18px;
        }

        .pdf-title {
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.02em;
            margin: 0;
        }

        .pdf-frame {
            border: 0;
            flex: 1;
            width: 100%;
        }

        @media (max-width: 640px) {
            .pdf-bar {
                align-items: flex-start;
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <main class="pdf-shell">
        <header class="pdf-bar">
            <h1 class="pdf-title">{{ $title ?? $negocio['nombre'] . ' — PDF' }}</h1>
        </header>

        <iframe class="pdf-frame" src="{{ $pdfUrl }}" title="{{ $title ?? $negocio['nombre'] . ' — PDF' }}"></iframe>
    </main>
</body>
</html>

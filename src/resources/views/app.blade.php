<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="theme-color" content="#121214">

    {{-- El sistema es privado: ningún buscador debe indexarlo. --}}
    <meta name="robots" content="noindex, nofollow">

    <title data-inertia>{{ config('app.name', 'Blackphone') }}</title>

    @php($versionIcono = file_exists(public_path('favicon.ico')) ? filemtime(public_path('favicon.ico')) : time())
    <link rel="icon" type="image/x-icon" href="{{ asset('favicon.ico') }}?v={{ $versionIcono }}">
    <link rel="icon" type="image/svg+xml" href="{{ asset('favicon/favicon.svg') }}?v={{ $versionIcono }}">
    <link rel="icon" type="image/png" sizes="96x96" href="{{ asset('favicon/favicon-96x96.png') }}?v={{ $versionIcono }}">
    <link rel="apple-touch-icon" href="{{ asset('favicon/apple-touch-icon.png') }}?v={{ $versionIcono }}">
    <link rel="manifest" href="{{ asset('favicon/site.webmanifest') }}?v={{ $versionIcono }}">

    {{-- Tipografía: Chakra Petch para la marca y los títulos, Inter para la interfaz,
         IBM Plex Mono para códigos, IMEI y números de serie. --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap">

    @routes(['only' => null])

    @viteReactRefresh
    @vite(['resources/js/app.jsx'])

    @inertiaHead
</head>
<body class="h-full antialiased">
    @inertia
</body>
</html>

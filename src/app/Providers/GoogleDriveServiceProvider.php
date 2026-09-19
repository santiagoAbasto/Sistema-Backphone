<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Storage;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;
use Google_Client;
use Google_Service_Drive;

class GoogleDriveServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        \Storage::extend('google', function ($app, $config) {
            $client = new \Google_Client();
            $client->setAuthConfig($config['credentialsPath']);
            $client->addScope(\Google_Service_Drive::DRIVE);
            $service = new \Google_Service_Drive($client);

            $adapter = new \Masbug\Flysystem\GoogleDriveAdapter($service, $config['folder_id']);
            $filesystem = new \League\Flysystem\Filesystem($adapter);

            return new \Illuminate\Filesystem\FilesystemAdapter(
                $filesystem,
                $adapter,
                $config
            );
        });
    }
}

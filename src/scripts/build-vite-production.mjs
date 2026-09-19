import { cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const tmpRoot = '/tmp/blackphone-vite-build';

if (process.env.BLACKPHONE_VITE_IN_TMP === '1') {
  const result = spawnSync('npx', ['vite', 'build'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

rmSync(tmpRoot, { recursive: true, force: true });
mkdirSync(tmpRoot, { recursive: true });

const ignored = new Set([
  'node_modules',
  'vendor',
  'public/build',
  'storage/app',
  'storage/framework/cache',
  'storage/framework/sessions',
  'storage/framework/views',
  'storage/logs',
]);

cpSync(root, tmpRoot, {
  recursive: true,
  force: true,
  filter(source) {
    const relative = source.slice(root.length + 1);
    return !ignored.has(relative);
  },
});

const tmpNodeModules = join(tmpRoot, 'node_modules');
if (!existsSync(tmpNodeModules)) {
  symlinkSync(join(root, 'node_modules'), tmpNodeModules, 'dir');
}

const build = spawnSync('node', ['scripts/build-vite-production.mjs'], {
  cwd: tmpRoot,
  env: { ...process.env, BLACKPHONE_VITE_IN_TMP: '1' },
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

mkdirSync(join(root, 'public/build'), { recursive: true });
cpSync(join(tmpRoot, 'public/build'), join(root, 'public/build'), {
  recursive: true,
  force: true,
});

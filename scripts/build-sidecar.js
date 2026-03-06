#!/usr/bin/env node

const { execFileSync } = require('child_process');
const os = require('os');

const SIDECAR_NAME = 'sidecar-vscode-dashboard';
const OUTPUT_DIR = 'src-tauri/binaries';

// Map platform + arch to pkg target and Tauri target triple
const targetMap = {
  'darwin-arm64':  { pkg: 'node18-macos-arm64',  triple: 'aarch64-apple-darwin' },
  'darwin-x64':    { pkg: 'node18-macos-x64',    triple: 'x86_64-apple-darwin' },
  'linux-x64':     { pkg: 'node18-linux-x64',    triple: 'x86_64-unknown-linux-gnu' },
  'win32-x64':     { pkg: 'node18-win-x64',      triple: 'x86_64-pc-windows-msvc' },
};

const key = `${os.platform()}-${os.arch()}`;
const target = targetMap[key];

if (!target) {
  console.error(`Unsupported platform/arch: ${key}`);
  console.error(`Supported: ${Object.keys(targetMap).join(', ')}`);
  process.exit(1);
}

const ext = os.platform() === 'win32' ? '.exe' : '';
const output = `${OUTPUT_DIR}/${SIDECAR_NAME}-${target.triple}${ext}`;

console.log(`Building sidecar for ${key} -> ${output}`);

execFileSync('npx', [
  'pkg', 'server/index.js',
  '--config', 'pkg.config.json',
  '--targets', target.pkg,
  '--output', output,
], { stdio: 'inherit' });

console.log(`Sidecar built: ${output}`);

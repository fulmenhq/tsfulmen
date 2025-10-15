#!/usr/bin/env bun

/**
 * Bootstrap script for installing external tools from .goneat/tools.yaml
 * Supports local override via .goneat/tools.local.yaml (gitignored)
 *
 * Based on gofulmen's bootstrap implementation
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse } from 'yaml';

// Types matching the external-tools-manifest schema
interface ToolManifest {
  version: string;
  binDir: string;
  tools: Tool[];
}

interface Tool {
  id: string;
  description?: string;
  required?: boolean;
  install: InstallConfig;
}

interface InstallConfig {
  type: 'verify' | 'download' | 'link' | 'go';
  command?: string; // For verify type
  url?: string; // For download type
  binName?: string; // For download/link type
  destination?: string; // For download/link type
  checksum?: Record<string, string>; // For download type
  source?: string; // For link type
  package?: string; // For go type
}

interface Options {
  manifestPath: string;
  install: boolean;
  verify: boolean;
  force: boolean;
  verbose: boolean;
}

// Platform detection
function getPlatform(): string {
  const platform =
    process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux';
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  return `${platform}-${arch}`;
}

// Resolve manifest path (prefer .local over regular)
function resolveManifestPath(defaultPath: string): string {
  const dir = dirname(defaultPath);
  const base = basename(defaultPath);
  const ext = base.includes('.') ? `.${base.split('.').pop()}` : '';
  const nameWithoutExt = base.replace(ext, '');

  const localPath = join(dir, `${nameWithoutExt}.local${ext}`);

  if (existsSync(localPath)) {
    return localPath;
  }

  return defaultPath;
}

// Load manifest from YAML file
function loadManifest(path: string): ToolManifest {
  if (!existsSync(path)) {
    throw new Error(`Manifest not found: ${path}`);
  }

  const content = readFileSync(path, 'utf-8');
  return parse(content) as ToolManifest;
}

// Verify tool installation
async function installVerify(tool: Tool): Promise<void> {
  const command = tool.install.command || tool.id;

  try {
    execSync(`command -v ${command}`, { stdio: 'pipe' });
  } catch {
    throw new Error(`${tool.id} not found in PATH`);
  }
}

// Download and install tool
async function installDownload(tool: Tool, platform: string, opts: Options): Promise<void> {
  const { url, binName, destination, checksum } = tool.install;

  if (!url || !binName || !destination) {
    throw new Error(`Missing required fields for download: ${tool.id}`);
  }

  // Interpolate platform variables in URL
  const downloadUrl = url
    .replace(/\{\{os\}\}/g, platform.split('-')[0])
    .replace(/\{\{arch\}\}/g, platform.split('-')[1]);

  const destDir = destination.startsWith('.') ? join(process.cwd(), destination) : destination;
  const binPath = join(destDir, binName);

  // Check if already exists
  if (existsSync(binPath) && !opts.force) {
    if (opts.verbose) {
      console.log(`  Already exists: ${binPath}`);
    }
    return;
  }

  // Create destination directory
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  if (opts.verbose) {
    console.log(`  Downloading from: ${downloadUrl}`);
  }

  // Download file
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Verify checksum if provided
  if (checksum?.[platform]) {
    const hash = createHash('sha256').update(buffer).digest('hex');
    if (hash !== checksum[platform]) {
      throw new Error(
        `Checksum mismatch for ${tool.id} (expected: ${checksum[platform]}, got: ${hash})`,
      );
    }
    if (opts.verbose) {
      console.log(`  Checksum verified`);
    }
  }

  // Handle tar.gz extraction
  if (downloadUrl.endsWith('.tar.gz') || downloadUrl.endsWith('.tgz')) {
    // Extract to temp directory
    const tempDir = join(destDir, '.tmp-extract');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // Write buffer to temp file
    const tempFile = join(tempDir, 'download.tar.gz');
    Bun.write(tempFile, buffer);

    // Extract using tar
    execSync(`tar -xzf ${tempFile} -C ${tempDir}`, { stdio: 'pipe' });

    // Find the binary in extracted files (typically in the root of the archive)
    const extractedBinary = join(tempDir, binName);
    if (!existsSync(extractedBinary)) {
      throw new Error(`Binary ${binName} not found in archive`);
    }

    // Move to final location
    copyFileSync(extractedBinary, binPath);

    // Clean up temp directory
    execSync(`rm -rf ${tempDir}`, { stdio: 'pipe' });
  } else {
    // Direct binary download
    Bun.write(binPath, buffer);
  }

  // Make executable
  chmodSync(binPath, 0o755);

  if (opts.verbose) {
    console.log(`  Installed to: ${binPath}`);
  }
}

// Link local tool
async function installLink(tool: Tool, opts: Options): Promise<void> {
  const { source, binName, destination } = tool.install;

  if (!source || !binName || !destination) {
    throw new Error(`Missing required fields for link: ${tool.id}`);
  }

  if (!existsSync(source)) {
    throw new Error(`Source not found: ${source}`);
  }

  const destDir = destination.startsWith('.') ? join(process.cwd(), destination) : destination;
  const binPath = join(destDir, binName);

  // Check if already exists
  if (existsSync(binPath) && !opts.force) {
    if (opts.verbose) {
      console.log(`  Already exists: ${binPath}`);
    }
    return;
  }

  // Create destination directory
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Copy file (not symlink, to avoid issues)
  copyFileSync(source, binPath);

  // Make executable
  chmodSync(binPath, 0o755);

  if (opts.verbose) {
    console.log(`  Linked from: ${source}`);
    console.log(`  Installed to: ${binPath}`);
  }
}

// Install single tool
async function installTool(tool: Tool, platform: string, opts: Options): Promise<void> {
  switch (tool.install.type) {
    case 'verify':
      return await installVerify(tool);

    case 'download':
      return await installDownload(tool, platform, opts);

    case 'link':
      return await installLink(tool, opts);

    case 'go':
      throw new Error(`Go install type not supported in TypeScript bootstrap`);

    default:
      throw new Error(`Unsupported install type: ${tool.install.type}`);
  }
}

// Install all tools from manifest
async function installTools(opts: Options): Promise<void> {
  const manifestPath = resolveManifestPath(opts.manifestPath);
  const manifest = loadManifest(manifestPath);
  const platform = getPlatform();

  if (opts.verbose) {
    console.log(`Installing tools for ${platform}...`);
    console.log(`Manifest: ${manifestPath}`);
    console.log(`Tools: ${manifest.tools.length}\n`);
  }

  const errors: Array<{ id: string; error: Error }> = [];
  let successCount = 0;

  for (const tool of manifest.tools) {
    if (opts.verbose) {
      process.stdout.write(`📦 ${tool.id} (${tool.install.type})...`);
    }

    try {
      await installTool(tool, platform, opts);
      if (opts.verbose) {
        console.log(' ✅');
      }
      successCount++;
    } catch (error) {
      if (opts.verbose) {
        console.log(' ❌');
      }
      errors.push({ id: tool.id, error: error as Error });

      if (tool.required) {
        if (opts.verbose) {
          console.log(`\n❌ Required tool ${tool.id} failed to install`);
        }
        break;
      }
    }
  }

  if (errors.length > 0) {
    if (opts.verbose) {
      console.log('');
      for (const { id, error } of errors) {
        console.error(`Error: ${id}: ${error.message}\n`);
      }
    }
    throw new Error(`Failed to install ${errors.length} tool(s)`);
  }

  if (opts.verbose) {
    console.log(`\n✅ Successfully installed ${successCount} tool(s)`);
  }
}

// Verify all tools from manifest
async function verifyTools(opts: Options): Promise<void> {
  const manifestPath = resolveManifestPath(opts.manifestPath);
  const manifest = loadManifest(manifestPath);

  if (opts.verbose) {
    console.log('Verifying tools...');
    console.log(`Manifest: ${manifestPath}\n`);
  }

  const errors: Array<{ id: string; error: Error }> = [];

  for (const tool of manifest.tools) {
    if (opts.verbose) {
      process.stdout.write(`🔍 ${tool.id}...`);
    }

    try {
      await installVerify(tool);
      if (opts.verbose) {
        console.log(' ✅');
      }
    } catch (error) {
      if (opts.verbose) {
        console.log(' ❌');
      }
      errors.push({ id: tool.id, error: error as Error });
    }
  }

  if (errors.length > 0) {
    if (opts.verbose) {
      console.log('');
      for (const { id, error } of errors) {
        console.error(`Missing: ${id}: ${error.message}`);
      }
    }
    throw new Error(`${errors.length} tool(s) not available`);
  }

  if (opts.verbose) {
    console.log(`\n✅ All tools verified`);
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);

  const opts: Options = {
    manifestPath: '.goneat/tools.yaml',
    install: false,
    verify: false,
    force: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--install':
        opts.install = true;
        break;
      case '--verify':
        opts.verify = true;
        break;
      case '--force':
        opts.force = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--manifest':
        opts.manifestPath = args[++i];
        break;
      case '--help':
        console.log(`Usage: bun run scripts/bootstrap-tools.ts [options]

Options:
  --install           Install tools from manifest
  --verify            Verify tools are available
  --force             Force reinstall even if exists
  --verbose           Verbose output
  --manifest <path>   Path to tools manifest (default: .goneat/tools.yaml)
  --help              Show this help message

Examples:
  bun run scripts/bootstrap-tools.ts --install --verbose
  bun run scripts/bootstrap-tools.ts --verify
`);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  if (!opts.install && !opts.verify) {
    console.error('Error: must specify --install or --verify\n');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  try {
    if (opts.install) {
      await installTools(opts);
    } else if (opts.verify) {
      await verifyTools(opts);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\n❌ ${error.message}`);
    }
    process.exit(1);
  }
}

main();

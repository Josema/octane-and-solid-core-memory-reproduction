import fs, { constants } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ITERATIONS = 2000;

const require = createRequire(import.meta.url);
const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const HERMES_PATH = path.join(DIRECTORY, 'hermes');
const HERMES_FLAGS = [
  '-w',
  '-enable-hermes-internal',
  '-Xmicrotask-queue',
  '-Xes6-proxy',
  '-Xes6-block-scoping',
];

function formatBytes(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  return `${(bytes / 1e6).toFixed(2)} MB`;
}

function formatMiB(bytes) {
  return `${bytes / (1024 * 1024)} MiB`;
}

function formatDuration(milliseconds) {
  if (milliseconds >= 60000) {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
  if (milliseconds >= 1000) return `${(milliseconds / 1000).toFixed(2)} s`;
  return `${milliseconds.toFixed(2)} ms`;
}

function printTable(rows) {
  const columnWidths = rows[0].map((_, column) => {
    return Math.max(...rows.map(row => row[column].length));
  });

  for (const [rowIndex, row] of rows.entries()) {
    const cells = row.map((cell, column) => {
      const width = columnWidths[column];
      return column === 0 ? cell.padEnd(width) : cell.padStart(width);
    });
    console.log(cells.join('  '));

    if (rowIndex === 0) {
      const separator = columnWidths.map(width => '-'.repeat(width));
      console.log(separator.join('  '));
    }
  }
}

function printResultsMarkdown(results) {
  const metrics = [
    ['Cumulative JS allocation', stats => formatBytes(stats.allocatedBytes)],
    ['Sampled heap peak', stats => formatMiB(stats.peakSampledCapacity)],
    ['Heap capacity after GC', stats => formatMiB(stats.capacityAfterGC)],
    ['Live JS after GC', stats => formatBytes(stats.liveAfterGC)],
    ['Live JS after unmount', stats => formatBytes(stats.afterUnmount)],
    ['GC collections', stats => stats.collections.toLocaleString('en-US')],
    ['Time in GC', stats => formatDuration(stats.gcMs)],
    ['Elapsed time', stats => formatDuration(stats.elapsedMs)],
  ];

  const headers = ['Metric', ...results.map(r => r.label)];
  const dataRows = metrics.map(([label, format]) => [label, ...results.map(r => format(r.stats))]);
  const allRows = [headers, ...dataRows].map(row => row.map(cell => String(cell)));

  const colWidths = allRows[0].map((_, col) =>
    Math.max(...allRows.map(row => row[col].length))
  );

  const headerLine = `| ${headers.map((h, i) => (i === 0 ? h.padEnd(colWidths[i]) : h.padStart(colWidths[i]))).join(' | ')} |`;
  const separatorLine = `| ${colWidths
    .map((w, i) => {
      const dashes = '-'.repeat(Math.max(3, w));
      return i === 0 ? dashes : (dashes.slice(0, -1) + ':');
    })
    .join(' | ')} |`;

  const lines = [headerLine, separatorLine];
  for (const row of dataRows) {
    lines.push(
      `| ${row
        .map((cell, i) => (i === 0 ? String(cell).padEnd(colWidths[i]) : String(cell).padStart(colWidths[i])))
        .join(' | ')} |`
    );
  }

  const now = new Date();
  console.log('\nResults\n');
  console.log(lines.join('\n'));

  // Format date like: 10 sept 2026, 17:56:25
  const day = String(now.getDate()).padStart(2, '0');
  const monthRaw = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(now);
  const month = monthRaw.replace(/\.$/, '').toLowerCase();
  const year = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const localDate = `${day} ${month} ${year}, ${hh}:${mm}:${ss}`;

  console.log('');
  console.log(`[Date: ${localDate}]`);
}

function printProgress(label, record) {
  const completed = record.checkpoint.toLocaleString('en-US');
  const total = ITERATIONS.toLocaleString('en-US');
  const percentage = Math.round(record.checkpoint / ITERATIONS * 100);
  const progress = [
    `  ${label}: ${completed} / ${total} events (${percentage}%)`,
    `allocated ${formatBytes(record.allocated)}`,
    `heap ${formatMiB(record.capacity)}`,
  ].join(' | ');

  if (process.stdout.isTTY) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(progress);
  } else {
    console.log(progress);
  }
}

async function readRecords(stdout, label) {
  const records = [];
  const lines = createInterface({ input: stdout, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    records.push(record);
    if (record.checkpoint !== undefined) printProgress(label, record);
  }
  return records;
}

async function runHermes(filename, label) {
  const child = spawn(HERMES_PATH, [...HERMES_FLAGS, filename]);
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  // Consume output while Hermes runs, so its stdout pipe cannot fill up.
  const [exitCode, records] = await Promise.all([
    completion,
    readRecords(child.stdout, label),
  ]);

  if (process.stdout.isTTY) process.stdout.write('\n');
  if (exitCode !== 0) {
    throw new Error(`${label} exited with code ${exitCode}: ${stderr.trim()}`);
  }
  const failure = records.find(record => record.error);
  if (failure) throw new Error(failure.error);
  return records.at(-1);
}

async function readPackageVersion(directory) {
  const contents = await fs.readFile(path.join(directory, 'package.json'), 'utf8');
  return JSON.parse(contents).version;
}

async function loadFrameworks() {
  const octaneDirectory = path.dirname(require.resolve('octane/universal/native'));
  const solidDirectory = path.dirname(require.resolve('solid-js/package.json'));
  const universalDirectory = path.resolve(
    path.dirname(require.resolve('@solidjs/universal')),
    '..',
  );
  const octaneVersion = await readPackageVersion(path.resolve(octaneDirectory, '..'));
  const solidVersion = await readPackageVersion(solidDirectory);

  return {
    frameworks: [
      { name: 'octane', label: 'Octane', version: octaneVersion, variant: `published-${octaneVersion}` },
      { name: 'solid', label: 'Solid', version: solidVersion, variant: 'installed' },
    ],
    aliases: {
      'octane/universal/native': path.join(octaneDirectory, 'universal-native.js'),
      'solid-js': path.join(solidDirectory, 'dist/solid.js'),
      '@solidjs/universal': path.join(universalDirectory, 'dist/universal.js'),
    },
  };
}

async function buildBenchmark(framework, aliases, temporaryDirectory) {
  const bundle = await build({
    entryPoints: [path.join(DIRECTORY, 'entry.js')],
    absWorkingDir: DIRECTORY,
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: 'es2018',
    minify: true,
    tsconfigRaw: { compilerOptions: { alwaysStrict: true } },
    alias: {
      'repro-framework': path.join(DIRECTORY, `${framework.name}.js`),
      ...aliases,
    },
    define: {
      __OCTANE_PROFILE_ENABLED__: 'false',
      FRAMEWORK: JSON.stringify(framework.name),
      CORE_LABEL: JSON.stringify(framework.variant),
      ITERATIONS: String(ITERATIONS),
    },
  });

  const filename = path.join(temporaryDirectory, `${framework.name}.js`);
  await fs.writeFile(filename, bundle.outputFiles[0].text);
  return filename;
}

async function runBenchmark(framework, aliases, temporaryDirectory) {
  const filename = await buildBenchmark(framework, aliases, temporaryDirectory);
  console.log(`Running ${framework.label}...`);
  const stats = await runHermes(filename, framework.label);

  if (
    stats?.framework !== framework.name ||
    stats.iterations !== ITERATIONS ||
    stats.teardown?.hosts !== 0
  ) {
    throw new Error('Missing verified final result');
  }
  return { label: `${framework.label} ${framework.version}`, stats };
}

async function main() {
  try {
    await fs.access(HERMES_PATH, constants.X_OK);
  } catch {
    throw new Error(`Hermes is missing or not executable: ${HERMES_PATH}.`);
  }

  const { frameworks, aliases } = await loadFrameworks();
  const labels = frameworks.map(framework => `${framework.label} ${framework.version}`);
  console.log(`\n${labels.join(' / ')} — Hermes`);
  console.log(`${ITERATIONS.toLocaleString('en-US')} events per framework\n`);

  const temporaryDirectory = await fs.mkdtemp(path.join(tmpdir(), 'octane-vs-solid-'));
  const results = [];
  try {
    for (const framework of frameworks) {
      results.push(await runBenchmark(framework, aliases, temporaryDirectory));
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
  printResultsMarkdown(results);
}

main().catch(error => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});

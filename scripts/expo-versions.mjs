#!/usr/bin/env node
// The version check expo-doctor runs, with a newer Expo PATCH release reported as a warning instead of a failure.
// CI's test job runs expo-doctor with this one check switched off (EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK=1, the
// doctor's own setting) and runs this script as its own step instead. Every other doctor check still fails the build.
//
// Why: the doctor asks Expo's servers which version of each SDK package is expected on the day it runs. When Expo
// publishes a patch release (58.0.23 -> 58.0.26), a push that changed nothing turned red (run 44312162058). The lock
// still holds what was tested, and `npm ci` installs exactly that, so the build is the same as yesterday's: the drift is
// news, not a defect. A drift in the major or minor version, a package Expo expects that is missing, or a check that
// cannot run is still a failure.
//
// It asks Expo's own CLI, as the doctor does (`expo install --check --json`, CI=1, EXPO_DEBUG=0), and sorts each
// package the way the doctor sorts it: by the first x.y.z in the expected range and in the installed version.
//
//   node scripts/expo-versions.mjs                  runs the check (needs node_modules and the network)
//   node scripts/expo-versions.mjs --report <file>  reads a saved `expo install --check --json` report instead (tests)
//
// Exit 0: up to date, or behind by patch releases only (each one a GitHub warning annotation, and the job summary).
// Exit 1: anything else. Fix a drift with `npx expo install --fix`, never with `expo.install.exclude`.
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

function triple(text) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(String(text ?? ''));
  return m ? m.slice(1, 4).map(Number) : null;
}

/** Sorts each package `expo install --check --json` lists: "patch" when only the patch number differs, else "fail". */
export function sortReport(report) {
  if (report == null || typeof report !== 'object' || typeof report.upToDate !== 'boolean') {
    return { error: 'the check gave no report Expo writes (no "upToDate")', patch: [], fail: [] };
  }
  const deps = Array.isArray(report.dependencies) ? report.dependencies : [];
  if (!report.upToDate && deps.length === 0) {
    return { error: 'the check says the project is not up to date but names no package', patch: [], fail: [] };
  }
  const patch = [];
  const fail = [];
  for (const d of report.upToDate ? [] : deps) {
    const row = { name: String(d.packageName ?? ''), expected: String(d.expectedVersionOrRange ?? ''), found: String(d.actualVersion ?? '') };
    const e = triple(row.expected);
    const f = triple(row.found);
    if (e && f && e[0] === f[0] && e[1] === f[1] && e[2] !== f[2]) patch.push(row);
    else if (e && f && e.join('.') === f.join('.')) continue;
    else fail.push(row);
  }
  return { error: null, patch, fail };
}

function runCheck() {
  const require = createRequire(import.meta.url);
  const cli = require.resolve('expo/bin/cli');
  const r = spawnSync(process.execPath, [cli, 'install', '--check', '--json'], {
    encoding: 'utf8',
    env: { ...process.env, CI: '1', EXPO_DEBUG: '0' },
    maxBuffer: 16 * 1024 * 1024,
  });
  // 0: up to date; 1: a report of what is not. Anything else is a check that did not run.
  if (r.error || (r.status !== 0 && r.status !== 1)) {
    return { error: `expo install --check exited ${r.status ?? r.error}: ${(r.stderr || '').trim().slice(0, 2000)}` };
  }
  const json = /\{[\s\S]*\}/.exec(r.stdout ?? '');
  if (!json) return { error: `expo install --check printed no JSON: ${(r.stderr || r.stdout || '').trim().slice(0, 2000)}` };
  try {
    return { report: JSON.parse(json[0]) };
  } catch (e) {
    return { error: `expo install --check printed JSON that does not parse: ${e.message}` };
  }
}

function table(rows) {
  return ['| package | expected | found |', '| --- | --- | --- |', ...rows.map((r) => `| ${r.name} | ${r.expected} | ${r.found} |`)].join('\n');
}

function summary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function main(argv) {
  const at = argv.indexOf('--report');
  const got = at >= 0 ? { report: JSON.parse(readFileSync(argv[at + 1], 'utf8')) } : runCheck();
  const sorted = got.error ? { error: got.error, patch: [], fail: [] } : sortReport(got.report);

  if (sorted.error) {
    console.log(`::error title=Expo versions::${sorted.error}`);
    summary(`### Expo versions\n\nThe check did not run: ${sorted.error}`);
    return 1;
  }
  for (const r of sorted.patch) {
    console.log(`::warning title=Expo patch release::${r.name} ${r.found} is installed; Expo now expects ${r.expected}. Run npx expo install --fix.`);
  }
  for (const r of sorted.fail) {
    console.log(`::error title=Expo versions::${r.name} ${r.found || '(missing)'} is installed; Expo expects ${r.expected}.`);
  }
  if (sorted.patch.length === 0 && sorted.fail.length === 0) {
    console.log('Every Expo SDK package is the version Expo expects.');
    return 0;
  }
  const parts = ['### Expo versions'];
  if (sorted.fail.length) parts.push('', 'Not a patch release (fails the build):', '', table(sorted.fail));
  if (sorted.patch.length) parts.push('', 'Behind by a patch release (a warning; `npx expo install --fix` brings them up):', '', table(sorted.patch));
  summary(parts.join('\n'));
  console.log(parts.slice(1).join('\n'));
  return sorted.fail.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));

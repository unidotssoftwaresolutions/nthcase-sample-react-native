import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// scripts/expo-versions.mjs: CI's version check. A newer Expo patch release is a warning; anything else fails.
const root = join(__dirname, '..');
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'expo-versions-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function check(report: unknown): { status: number | null; out: string } {
  const file = join(dir, `report-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(report));
  const env = { ...process.env };
  delete env.GITHUB_STEP_SUMMARY;
  const r = spawnSync(process.execPath, [join(root, 'scripts/expo-versions.mjs'), '--report', file], { encoding: 'utf8', env });
  return { status: r.status, out: r.stdout + r.stderr };
}

const dep = (packageName: string, expectedVersionOrRange: string, actualVersion: string, packageType = 'dependencies') => ({
  packageName,
  packageType,
  expectedVersionOrRange,
  actualVersion,
});

describe('the Expo version check (scripts/expo-versions.mjs)', () => {
  it('passes when every package is the version Expo expects', () => {
    const r = check({ dependencies: [], upToDate: true });
    expect(r.status).toBe(0);
    expect(r.out).not.toContain('::warning');
    expect(r.out).not.toContain('::error');
  });

  it("warns, and passes, on run 44312162058's eight patch releases", () => {
    const r = check({
      dependencies: [
        dep('expo', '~58.0.26', '58.0.23'),
        dep('expo-constants', '~58.0.16', '58.0.15'),
        dep('expo-linking', '~58.0.17', '58.0.16'),
        dep('expo-notifications', '~58.1.9', '58.1.8'),
        dep('expo-router', '~58.0.32', '58.0.30'),
        dep('expo-sensors', '~58.0.5', '58.0.4'),
        dep('expo-status-bar', '~58.0.5', '58.0.4'),
        dep('jest-expo', '~58.0.15', '58.0.14', 'devDependencies'),
      ],
      upToDate: false,
    });
    expect(r.status).toBe(0);
    expect(r.out.match(/^::warning /gm)).toHaveLength(8);
    expect(r.out).toContain('expo-router 58.0.30 is installed; Expo now expects ~58.0.32');
    expect(r.out).not.toContain('::error');
  });

  it('fails on a minor or major drift, even beside a patch one', () => {
    for (const bad of [dep('expo-notifications', '~58.2.0', '58.1.9'), dep('react-native', '0.89.0', '0.88.1'), dep('expo', '~59.0.0', '58.0.26')]) {
      const r = check({ dependencies: [dep('expo-sensors', '~58.0.6', '58.0.5'), bad], upToDate: false });
      expect(r.status).toBe(1);
      expect(r.out).toContain(`::error title=Expo versions::${bad.packageName} ${bad.actualVersion}`);
      expect(r.out).toContain('::warning title=Expo patch release::expo-sensors');
    }
  });

  it('fails on a package Expo expects that is not installed, or a version it cannot read', () => {
    expect(check({ dependencies: [dep('expo-constants', '~58.0.16', '')], upToDate: false }).status).toBe(1);
    expect(check({ dependencies: [dep('expo-router', 'latest', '58.0.32')], upToDate: false }).status).toBe(1);
  });

  it('fails when the check gives no report it can read', () => {
    expect(check({}).status).toBe(1);
    expect(check({ upToDate: false, dependencies: [] }).status).toBe(1);
    expect(check(null).status).toBe(1);
  });
});

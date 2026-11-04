# Screenshots

Every screen, light and dark, as `light/NN-name.png` and `dark/NN-name.png`, with the same 24 names in all five
Mossgrove apps.

They are taken on an Android emulator in CI, never on a developer's machine: the `screenshots` job of
[`.github/workflows/build.yml`](../../.github/workflows/build.yml) installs the built `.apk`, runs
[`scripts/screenshots.mjs`](../../scripts/screenshots.mjs), and uploads the pictures as the artifact
`mossgrove-react-native-screenshots`. To update this folder, download that artifact from a green run and copy its
`light/` and `dark/` folders here.

The artifact also holds what the walk found, and is uploaded when the job fails too:
- `walk.md`: each screen taken, each segment of the walk, the keyboard checks, each time the emulator stopped
  answering adb (the walk waits for it and retries that segment once), each system error dialog of another app the
  walk closed, and the smoke start;
- `smoke.json` and `smoke.txt`: the smoke start, which starts the app once before the walk, and what was on screen
  then (if the app does not start, the walk does not run);
- `android-ids.md`: each spec id seen in UiAutomator's tree, or the reason it was not;
- `trees/`: the tree read in each state;
- `failures/`: the screen, the tree and what the device said (focused window, top activity, the app's process, the
  crash buffer) where a segment stopped, and `device-lost-*.txt`, what the runner and the
  emulator's log said when the device came back.

Only `light/` and `dark/` belong in this folder.

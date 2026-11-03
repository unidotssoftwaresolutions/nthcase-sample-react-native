# Screenshots

Every screen, light and dark, as `light/NN-name.png` and `dark/NN-name.png`, with the same 24 names in all five
Mossgrove apps.

They are taken on an Android emulator in CI, never on a developer's machine: the `screenshots` job of
[`.github/workflows/build.yml`](../../.github/workflows/build.yml) installs the built `.apk`, runs
[`scripts/screenshots.mjs`](../../scripts/screenshots.mjs), and uploads the pictures as the artifact
`mossgrove-react-native-screenshots`. To update this folder, download that artifact from a green run and copy its
`light/` and `dark/` folders here.

The artifact also holds what the walk found, and is uploaded when the job fails too:
- `walk.md`: each screen taken, each segment of the walk and the keyboard checks;
- `android-ids.md`: each spec id seen in UiAutomator's tree, or the reason it was not;
- `trees/`: the tree read in each state;
- `failures/`: the screen and the tree where a segment stopped.

Only `light/` and `dark/` belong in this folder.

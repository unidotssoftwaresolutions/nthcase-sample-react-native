# Screenshots

Every screen, light and dark, as `light/NN-name.png` and `dark/NN-name.png`, with the same 24 names in all five
Mossgrove apps.

They are taken on an Android emulator in CI, never on a developer's machine: the `screenshots` job of
[`.github/workflows/build.yml`](../../.github/workflows/build.yml) installs the built `.apk`, runs
[`scripts/screenshots.mjs`](../../scripts/screenshots.mjs), and uploads the pictures as the artifact
`mossgrove-react-native-screenshots`. To update this folder, download that artifact from a green run and copy its
`light/` and `dark/` folders here.

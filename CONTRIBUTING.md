# Contributing

Mossgrove is a sample app for testing with NthCase. It is published so you can build it, read it and test it.

- **Bugs:** open an issue. Say what you did, what you expected, and what happened, with the device, simulator or
  emulator and its OS version.
- **Pull requests** are welcome for bugs and accessibility fixes. A change to a screen, a text, an id or the data
  changes the shared spec, and so all five Mossgrove apps (Android, iOS, Flutter, React Native, Ionic). Open an issue
  first, so the spec moves before the apps do.
- Before you open a pull request, run `npm run typecheck` and `npm test`. If you changed `art/` or
  `assets/web/care-guide.html`, run `npm run derive` and commit what it writes.
- Keep the rules in [SPEC.md](SPEC.md) §2: no network, no analytics, no third-party SDKs, original art only. A new
  runtime dependency must be published by Expo or React Native, or be required by one that is, and goes in the
  README's list.

By contributing you agree that your contribution is licensed under the Apache License 2.0.

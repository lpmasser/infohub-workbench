# Development and delivery

Project context is in the maintainer's InfoHub workspace; locate it via `~/.config/infohub/config.json`. See [AGENTS.md](AGENTS.md).

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --filter @otterly/markdown-editor check
pnpm lint
pnpm test
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

GitHub Actions runs the same checks on native macOS, Windows and Linux runners. Windows additionally builds and silently installs NSIS, verifies its embedded source identity, launches the application in the background and requests safe exit. The CLI/synchronization tests run from the public work-ontology repository.

The application version has one source: root `package.json`; `tauri.conf.json` references it. The private Rust crate is not separately versioned or published.

To release, run `node scripts/update_release_version.mjs <version>`, commit the version changes, then push the commit and its `v<version>` tag. The release workflow first runs all platform checks. Official tauri-action builds and signs macOS universal `.app.tar.gz`, Windows NSIS and Linux AppImage, and writes `latest.json`. It publishes the draft only after all platforms and the manifest are complete. No DMG is produced.

The updater private key is a GitHub Actions secret named `TAURI_SIGNING_PRIVATE_KEY`; keep a separate private local copy outside this repository (0600 on Unix). Never commit the key. Updater signing is distinct from Apple notarization or Windows Authenticode.

For key rotation while the old key is available, first sign a transition release containing the new public key with the old private key; subsequent releases use the new key. If the old key is lost, installed clients cannot authenticate a replacement key: reinstall from a trusted bootstrap source. Do not disable signature verification.

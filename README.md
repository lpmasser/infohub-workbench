# InfoHub Workbench

A local-first desktop workspace for reading, navigating and maintaining InfoHub documents. Forked from [Otterly](https://github.com/ajkdrag/otterly); the original MIT license and author attribution are preserved.

Install the CLI and desktop app using [work-ontology](https://github.com/lpmasser/work-ontology), supplying your own InfoHub repository address. Workspace content and credentials are never included in this software or its release packages. Signed desktop packages are available from [GitHub Releases](https://github.com/lpmasser/infohub-workbench/releases).

Updates download in the background. They apply only when the main window is hidden, no independent document windows remain and there are no unsaved changes. A pending update also offers a restart item in the tray. The existing safe save-and-exit flow runs before installation.

See [development and release instructions](INFOHUB.md) and [architecture](docs/architecture.md). See [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [dependency licenses](licenses/) for attribution and redistribution terms.

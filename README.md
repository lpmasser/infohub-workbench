# InfoHub Workbench

The web page for reading and editing an InfoHub: file tree, rendered Markdown with editable YAML properties, links and object titles you can follow, search, the work overview and sync status. It runs against the InfoHub Web service from [work-ontology](https://github.com/lpmasser/work-ontology), which owns the files, versions, search and InfoHub queries. Forked from [Otterly](https://github.com/ajkdrag/otterly); the original MIT license and author attribution are preserved.

Each user edits a server copy of the InfoHub repository; the server's background sync commits and pushes it. `main` and other copies' drafts can be viewed read-only. Agents keep working in their local clones.

See [development and deployment](INFOHUB.md) and [architecture](docs/architecture.md). See [LICENSE](LICENSE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [dependency licenses](licenses/) for attribution and redistribution terms.

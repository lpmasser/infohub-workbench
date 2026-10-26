# Third-party notices

InfoHub Workbench is a fork of [ajkdrag/otterly](https://github.com/ajkdrag/otterly), based on ac940ee4387b04b73ff0af0d38801a70a293dd62. The original MIT license and `Copyright (c) 2026 ajkdrag` remain in LICENSE and packages/markdown_editor/LICENSE. Upstream history and author credits are retained.

- libgit2 1.8.1, linked through git2 / libgit2-sys, uses GPLv2 **with its linking exception**. The exception permits combinations with other programs without imposing this file's restrictions on that combination; it does not remove obligations for modifications or distribution of the library itself. Its complete COPYING and AUTHORS are included in licenses/. Unmodified upstream source: https://github.com/libgit2/libgit2/tree/v1.8.1 . The Rust wrapper's MIT/Apache metadata does not replace the native library's license.
- elkjs 0.9.3, included by Mermaid, is EPL-2.0. Its license is included in licenses/elkjs-EPL-2.0.md. Unmodified corresponding source: https://github.com/kieler/elkjs/tree/v0.9.3 and https://registry.npmjs.org/elkjs/-/elkjs-0.9.3.tgz . Retain this source availability notice with distributions; changes to EPL-covered code carry EPL source obligations. No elkjs modifications are made by this fork.
- yaml 2.9.1 renders generic YAML property values. Its ISC license and copyright notice are included in licenses/yaml-ISC.txt.
- Font licenses remain with their files under static/fonts/ (SIL OFL). The independent editor retains its own LICENSE. Other dependencies retain their package notices and locked source versions in pnpm-lock.yaml / src-tauri/Cargo.lock.

The macOS bundle includes this notice, the original MIT license and the libgit2/elkjs license files. This records the identified distribution considerations; it is not a claim that every platform's native dependency set has been audited.

# Knowledge

A VS Code / Cursor extension to manage local knowledge repositories in one sidebar.

## Requirements

- **VS Code** or **Cursor** ^1.85.0  
- **Git** (optional): required only for **Clone repository**; `git` must be on your `PATH`.

## Features

- **Activity bar** entry with three views:
  - **Explorer** — TreeView of repositories, folders, and files
  - **Search** — Full-text search across all repositories
  - **Help** — In-editor help and shortcuts
- **Multi-repository** management via `knowledge.repositories`
- **Repository tree**: add/remove repo, new file/folder, rename, delete (move to trash), auto refresh with file watchers
- **Full-text search** (300ms debounce): content + file name, grouped by repository
- **Git**: detect Git repos, clone into a folder, open repo in a new window

## Configuration

### `knowledge.repositories`

Array of local repositories:

```json
[
  {
    "name": "Dev Notes",
    "path": "/Users/you/Documents/dev-notes"
  }
]
```

Per-repo `excludePatterns` are supported.

### `knowledge.excludePatterns`

Global patterns excluded from explorer and search (default below):

```json
["node_modules", ".git", ".DS_Store", "*.vsix", "__pycache__"]
```

## Commands

| Command | Description |
|--------|-------------|
| Knowledge: Add Knowledge Repository | Add a local folder as a repository |
| Knowledge: Clone Repository as Knowledge | Clone a Git repo and add it |
| Knowledge: Remove Knowledge Repository | Remove from list |
| Knowledge: Open in New Window | Open repo in new window |
| Knowledge: Refresh Knowledge Explorer | Refresh tree |
| Knowledge: New File / New Folder | Create under selected node |
| Knowledge: Rename / Delete | Rename or move to trash |
| Knowledge: Open File | Open file in editor |
| Knowledge: Show Help | Open Help view |

## Install

### From VSIX (local build)

1. Build the extension: `npm run compile && npm run package`
2. Install the generated `.vsix` from the `out/` folder.  
   See [docs/install.md](docs/install.md) for CLI and UI steps (VS Code / Cursor).

### From Marketplace

*(When published)* Install via the Extensions view: search for **Knowledge** (publisher: netfere).

## Development

```bash
npm install
npm run compile
```

Press **F5** in VS Code/Cursor to launch the Extension Development Host.

```bash
npm test          # run tests
npm run watch     # compile on change
```

## Packaging & Publish

```bash
npm run package   # produces out/knowledge-<version>.vsix
npm run publish:vsce
```

Publishing needs a [VS Code Marketplace](https://marketplace.visualstudio.com/) publisher and a Personal Access Token for `vsce`.

## License

[LICENSE](LICENSE)

## Repository

[https://github.com/netferes/knowledge-extension](https://github.com/netferes/knowledge-extension)

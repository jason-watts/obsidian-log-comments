# Daily Log Comments Plugin

An Obsidian plugin for adding collaborative threaded comments to daily and weekly team logs.

## Features

- Select text and add comments with a hotkey
- Threaded discussions organized by person
- Visual gutter indicators for commented text
- All comments stored directly in markdown files
- Clean reading mode - comments invisible until needed
- Side panel for viewing and managing comment threads

## Installation

### From Release

1. Download the latest release from GitHub
2. Extract files to `{vault}/.obsidian/plugins/daily-log-comments/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Development

1. Clone this repo
2. Run `npm install`
3. Run `npm run dev` to start compilation in watch mode
4. Copy `main.js`, `manifest.json`, and `styles.css` to your test vault's plugin folder

## Usage

1. Configure your author name in Settings → Daily Log Comments
2. Select text in a daily or weekly log
3. Press `Ctrl/Cmd + Shift + C` to add a comment
4. View comments in the side panel (click gutter icons or use `Ctrl/Cmd + Shift + P`)
5. Reply, edit, or delete comments from the panel

## Settings

- **Author Name**: Your name for comments (as wikilink)
- **People Folder**: Path to folder containing person notes
- **File Patterns**: Glob patterns for daily/weekly logs
- **Panel Behavior**: Auto-open, auto-scroll preferences

## Design

See [design document](docs/design.md) for full architecture and implementation details.

## License

MIT

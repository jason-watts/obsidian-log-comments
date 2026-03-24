# Page Comments Plugin

An Obsidian plugin for adding collaborative threaded comments to any page in your vault.

## Features

- Add comments to any markdown file with a hotkey
- Comments organized by person section (if present) or General
- Side panel for viewing and managing comments
- Comments stored in sidecar JSON files (keeps markdown clean)
- Hover-only edit/delete actions
- Auto-refresh after add, edit, or delete

## Installation

### From Release

1. Download the latest release from GitHub
2. Extract files to `{vault}/.obsidian/plugins/page-comments/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

### Development

1. Clone this repo
2. Run `npm install`
3. Run `npm run dev` to start compilation in watch mode
4. Copy `main.js`, `manifest.json`, and `styles.css` to your test vault's plugin folder

## Usage

1. Configure your author name in Settings → Page Comments
2. Open any markdown file
3. Optionally place cursor in a person's section (e.g., under `## [[Person Name]]`)
4. Press `Ctrl/Cmd + Shift + C` to add a comment
5. View all comments in the side panel
6. Hover over comments to see Edit/Delete actions

## Settings

- **Author Name**: Your name for comments (as wikilink, e.g., `[[Jason Watts]]`)
- **People Folder**: Path to folder containing person notes (default: `Reference/People`)
- **Auto Open Panel**: Automatically open panel when adding a comment
- **Auto Scroll to Comment**: Scroll to comment after adding
- **Keep Panel Open**: Keep panel open on workspace load

## File Structure

Comments are stored as sidecar JSON files next to the original markdown file:
- `path/to/My Note.comments.json`

Each comment file contains JSON structured by person/section:
```json
{
  "[[Person Name]]": [
    {
      "id": "comment-abc123",
      "author": "[[Your Name]]",
      "text": "Comment text here",
      "timestamp": "2026-01-27T08:36:24.363Z",
      "replies": []
    }
  ]
}
```

## License

MIT

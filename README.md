# Daily Log Comments Plugin

An Obsidian plugin for adding collaborative comments to daily and weekly team logs.

## Features

- Add comments with a hotkey (text selection optional)
- Comments organized by person section
- Side panel for viewing and managing comments
- Comments stored in separate JSON files (keeps markdown clean)
- Hover-only edit/delete actions
- Auto-refresh after add, edit, or delete

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
2. Open a daily or weekly log file
3. Place cursor in a person's section (e.g., under `## [[Person Name]]`)
4. Press `Ctrl/Cmd + Shift + C` to add a comment
5. View all comments in the side panel
6. Hover over comments to see Edit/Delete actions

## Settings

- **Author Name**: Your name for comments (as wikilink, e.g., `[[Jason Watts]]`)
- **People Folder**: Path to folder containing person notes (default: `Reference/People`)
- **Daily Log Pattern**: Glob pattern for daily logs (default: `Logs/Daily/**/*.md`)
- **Weekly Log Pattern**: Glob pattern for weekly logs (default: `Logs/Weekly/**/*.md`)
- **Auto Open Panel**: Automatically open panel when adding a comment
- **Auto Scroll to Comment**: Scroll to comment after adding
- **Keep Panel Open**: Keep panel open on workspace load

## File Structure

Comments are stored in separate JSON files:
- Daily log comments: `Logs/Daily/Comments/YYYY/MM/YYYY-MM-DD.comments.json`
- Weekly log comments: `Logs/Weekly/Comments/YYYY/MM/YYYY-MM-DD.comments.json`

Each comment file contains JSON structured by person:
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

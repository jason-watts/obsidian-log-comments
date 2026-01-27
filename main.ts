import { Plugin, MarkdownView, Notice, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_SETTINGS, PluginSettings, VIEW_TYPE_COMMENTS } from './types';
import { SettingsTab } from './settings';
import { CommentManager } from './comment-manager';
import { CommentPanelView } from './comment-panel-view';

export default class DailyLogCommentsPlugin extends Plugin {
	settings: PluginSettings;
	commentManager: CommentManager;

	async onload() {
		await this.loadSettings();

		this.commentManager = new CommentManager(this);

		// Register view
		this.registerView(
			VIEW_TYPE_COMMENTS,
			(leaf) => new CommentPanelView(leaf, this)
		);

		// Register commands
		console.log('Registering add-comment command');
		this.addCommand({
			id: 'add-comment',
			name: 'Add comment',
			editorCallback: (editor, ctx) => {
				console.log('Add comment command triggered');
				this.handleAddComment(editor, ctx);
			}
		});

		this.addCommand({
			id: 'toggle-comments-panel',
			name: 'Toggle comments panel',
			callback: () => this.togglePanel()
		});

		// Add ribbon icon
		this.addRibbonIcon('message-square', 'Toggle comments panel', () => {
			this.togglePanel();
		});

		// Register settings tab
		this.addSettingTab(new SettingsTab(this.app, this));

		// Ensure panel is open if setting is enabled
		if (this.settings.keepPanelOpen) {
			this.app.workspace.onLayoutReady(() => {
				this.activateView();
			});
		}
	}

	async handleAddComment(editor: any, ctx: any) {
		console.log('handleAddComment called');
		// Check if author is configured
		if (!this.settings.authorName) {
			console.log('Author not configured');
			new Notice('Please configure your author name in plugin settings');
			return;
		}
		console.log('Author configured:', this.settings.authorName);

		// Check if file matches pattern
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) {
			console.log('No active view or file');
			return;
		}
		console.log('View and file found');

		const file = view.file;

		const filePath = file.path;
		console.log('File path:', filePath);
		// Convert glob pattern to regex: ** -> .* (any chars including /), * -> [^/]* (any chars except /)
		const dailyPattern = new RegExp(this.settings.dailyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));
		const weeklyPattern = new RegExp(this.settings.weeklyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));
		console.log('Patterns:', { daily: dailyPattern.source, weekly: weeklyPattern.source });

		if (!dailyPattern.test(filePath) && !weeklyPattern.test(filePath)) {
			console.log('File does not match patterns');
			new Notice('This command only works in daily/weekly log files');
			return;
		}
		console.log('File matches pattern');

		// Get cursor position (use end of selection if text is selected, otherwise current position)
		const cursor = editor.getCursor('to');
		const lineNumber = cursor.line;
		console.log('Cursor line:', lineNumber);

		// Find person section
		const person = this.commentManager.findPersonSection(editor, lineNumber);
		console.log('Person section:', person);

		// Open panel and show input form
		console.log('Activating view...');
		await this.activateView();
		console.log('View activated');
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMENTS)[0];
		console.log('Leaf:', leaf);
		if (leaf && leaf.view instanceof CommentPanelView) {
			const panel = leaf.view as CommentPanelView;
			console.log('Panel view found');

			// Wait for panel to load file and render
			setTimeout(() => {
				console.log('setTimeout callback executing');
				console.log('Panel activeInputForm before calling showNewCommentForm:', panel.activeInputForm);
				panel.showNewCommentForm(person, async (text: string) => {
					console.log('Inside onSubmit callback');
					// Generate comment ID
					const commentId = this.commentManager.generateCommentId();

					await this.commentManager.addComment(
						file,
						commentId,
						this.settings.authorName,
						text,
						person
					);

					if (this.settings.autoScrollToComment) {
						setTimeout(() => panel.scrollToComment(commentId), 100);
					}

					new Notice('Comment added');
				});
			}, 100);
		}
	}

	async togglePanel() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMENTS);
		if (existing.length > 0) {
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_COMMENTS);
		} else {
			await this.activateView();
		}
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_COMMENTS);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_COMMENTS, active: true });
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_COMMENTS);
	}
}

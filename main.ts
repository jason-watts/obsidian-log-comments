import { Plugin, MarkdownView, Notice, EditorPosition, WorkspaceLeaf } from 'obsidian';
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
		this.addCommand({
			id: 'add-comment',
			name: 'Add comment',
			editorCallback: (editor, view) => this.handleAddComment(editor, view)
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
		// Check if author is configured
		if (!this.settings.authorName) {
			new Notice('Please configure your author name in plugin settings');
			return;
		}

		// Check if file matches pattern
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view.file) return;

		const file = view.file;

		const filePath = file.path;
		// Convert glob pattern to regex: ** -> .* (any chars including /), * -> [^/]* (any chars except /)
		const dailyPattern = new RegExp(this.settings.dailyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));
		const weeklyPattern = new RegExp(this.settings.weeklyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));

		if (!dailyPattern.test(filePath) && !weeklyPattern.test(filePath)) {
			new Notice('This command only works in daily/weekly log files');
			return;
		}

		// Get cursor position (use end of selection if text is selected, otherwise current position)
		const cursor = editor.getCursor('to');
		const lineNumber = cursor.line;

		// Find person section
		const person = this.commentManager.findPersonSection(editor, lineNumber);

		// Generate comment ID
		const commentId = this.commentManager.generateCommentId();

		// Open panel and show input form
		await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMENTS)[0];
		if (leaf && leaf.view instanceof CommentPanelView) {
			const panel = leaf.view as CommentPanelView;

			// Wait for panel to load
			setTimeout(() => {
				// Find the person section
				const personSection = panel.containerEl.querySelector(
					`.daily-log-comments-section-name:contains("${person.replace(/\[\[|\]\]/g, '')}")`
				)?.parentElement?.parentElement as HTMLElement;

				if (personSection) {
					const content = personSection.querySelector('.daily-log-comments-section-content') as HTMLElement;

					// Remove any existing input forms
					const existingForms = panel.containerEl.querySelectorAll('.daily-log-comments-input-form');
					existingForms.forEach(form => form.remove());

					// Create input form
					const form = content.createDiv({ cls: 'daily-log-comments-input-form' });

					const textarea = form.createEl('textarea', { placeholder: 'Write a comment...' });
					textarea.focus();

					const actionsDiv = form.createDiv({ cls: 'daily-log-comments-input-form-actions' });

					const cancelBtn = actionsDiv.createEl('button', { text: 'Cancel' });
					cancelBtn.addEventListener('click', () => {
						form.remove();
					});

					const submitBtn = actionsDiv.createEl('button', { text: 'Submit' });
					submitBtn.addEventListener('click', async () => {
						const text = textarea.value.trim();
						if (!text) return;

						try {
							// Get the end position of the selection
							const endPos: EditorPosition = editor.getCursor('to');

							await this.commentManager.addComment(
								file,
								editor,
								commentId,
								this.settings.authorName,
								text,
								person,
								endPos
							);

							form.remove();

							if (this.settings.autoScrollToComment) {
								setTimeout(() => panel.scrollToComment(commentId), 100);
							}

							new Notice('Comment added');
						} catch (error) {
							console.error('Failed to add comment:', error);
							new Notice('Failed to add comment');
						}
					});

					// Scroll to section
					if (this.settings.autoScrollToComment) {
						personSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
					}
				}
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

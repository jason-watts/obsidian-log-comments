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

		this.registerView(VIEW_TYPE_COMMENTS, (leaf) => new CommentPanelView(leaf, this));

		this.addCommand({
			id: 'add-comment',
			name: 'Add comment',
			editorCallback: (editor, ctx) => this.handleAddComment(editor, ctx)
		});

		this.addCommand({
			id: 'toggle-comments-panel',
			name: 'Toggle comments panel',
			callback: () => this.togglePanel()
		});

		this.addRibbonIcon('message-square', 'Toggle comments panel', () => this.togglePanel());
		this.addSettingTab(new SettingsTab(this.app, this));

		if (this.settings.keepPanelOpen) {
			this.app.workspace.onLayoutReady(() => this.activateView());
		}
	}

	async handleAddComment(editor: any, ctx: any) {
		if (!this.settings.authorName) {
			new Notice('Please configure your author name in plugin settings');
			return;
		}

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view?.file) return;

		const file = view.file;
		const cursor = editor.getCursor('to');
		const person = this.commentManager.findPersonSection(editor, cursor.line);

		await this.activateView();
		const leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMENTS)[0];
		if (leaf && leaf.view instanceof CommentPanelView) {
			const panel = leaf.view as CommentPanelView;
			setTimeout(() => {
				panel.showNewCommentForm(person, async (text: string) => {
					const commentId = this.commentManager.generateCommentId();
					await this.commentManager.addComment(file, commentId, this.settings.authorName, text, person);
					await panel.loadCurrentFile();
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
		if (leaf) workspace.revealLeaf(leaf);
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

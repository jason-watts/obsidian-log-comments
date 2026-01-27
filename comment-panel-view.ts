import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { VIEW_TYPE_COMMENTS, CommentData, Comment } from './types';
import DailyLogCommentsPlugin from './main';

export class CommentPanelView extends ItemView {
	plugin: DailyLogCommentsPlugin;
	currentFile: TFile | null = null;
	comments: CommentData = {};
	private activeInputForm: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: DailyLogCommentsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_COMMENTS;
	}

	getDisplayText(): string {
		return 'Daily Log Comments';
	}

	getIcon(): string {
		return 'message-square';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('daily-log-comments-panel');

		// Listen for active file changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.loadCurrentFile();
			})
		);

		// Listen for file modifications
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file === this.currentFile) {
					this.loadCurrentFile();
				}
			})
		);

		this.loadCurrentFile();
	}

	async loadCurrentFile(): Promise<void> {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView || !activeView.file) {
			this.currentFile = null;
			this.comments = {};
			this.render();
			return;
		}

		// Check if file matches pattern
		const filePath = activeView.file.path;
		const dailyPattern = new RegExp(this.plugin.settings.dailyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));
		const weeklyPattern = new RegExp(this.plugin.settings.weeklyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));

		if (!dailyPattern.test(filePath) && !weeklyPattern.test(filePath)) {
			this.currentFile = null;
			this.comments = {};
			this.render();
			return;
		}

		this.currentFile = activeView.file;
		const content = await this.app.vault.read(this.currentFile);
		this.comments = this.plugin.commentManager.parseComments(content);
		this.render();
	}

	render(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		if (!this.currentFile) {
			container.createDiv({ text: 'No daily/weekly log open', cls: 'daily-log-comments-header' });
			return;
		}

		container.createDiv({ text: 'Daily Log Comments', cls: 'daily-log-comments-header' });

		// Group comments by person
		const groupedComments: { [person: string]: [string, Comment][] } = {};

		for (const [commentId, comment] of Object.entries(this.comments)) {
			const person = comment.person;
			if (!groupedComments[person]) {
				groupedComments[person] = [];
			}
			groupedComments[person].push([commentId, comment]);
		}

		// Sort people: General first, then alphabetically
		const sortedPeople = Object.keys(groupedComments).sort((a, b) => {
			if (a === 'General') return -1;
			if (b === 'General') return 1;
			return a.localeCompare(b);
		});

		for (const person of sortedPeople) {
			this.renderPersonSection(container, person, groupedComments[person]);
		}
	}

	renderPersonSection(container: HTMLElement, person: string, comments: [string, Comment][]): void {
		const section = container.createDiv({ cls: 'daily-log-comments-section' });

		const header = section.createDiv({ cls: 'daily-log-comments-section-header' });
		const toggle = header.createSpan({ text: '▼', cls: 'daily-log-comments-section-toggle' });
		header.createSpan({ text: person.replace(/\[\[|\]\]/g, ''), cls: 'daily-log-comments-section-name' });
		header.createSpan({ text: `(${comments.length})`, cls: 'daily-log-comments-section-count' });

		const content = section.createDiv({ cls: 'daily-log-comments-section-content' });

		// Toggle collapse
		let isCollapsed = false;
		header.addEventListener('click', () => {
			isCollapsed = !isCollapsed;
			toggle.setText(isCollapsed ? '▷' : '▼');
			content.style.display = isCollapsed ? 'none' : 'block';
		});

		for (const [commentId, comment] of comments) {
			this.renderThread(content, commentId, comment);
		}
	}

	renderThread(container: HTMLElement, commentId: string, comment: Comment): void {
		const thread = container.createDiv({ cls: 'daily-log-comments-thread' });
		thread.setAttribute('data-comment-id', commentId);

		// Render main comment
		this.renderComment(thread, commentId, comment, false);

		// Render replies
		if (comment.replies && comment.replies.length > 0) {
			for (let i = 0; i < comment.replies.length; i++) {
				const replyDiv = thread.createDiv({ cls: 'daily-log-comments-reply' });
				this.renderComment(replyDiv, commentId, comment.replies[i], true, i);
			}
		}

		// Add reply button at the end
		const actions = thread.createDiv({ cls: 'daily-log-comments-comment-actions' });
		const replyBtn = actions.createEl('button', { text: 'Reply' });
		replyBtn.addEventListener('click', () => this.showReplyForm(thread, commentId));
	}

	renderComment(
		container: HTMLElement,
		commentId: string,
		comment: Comment | any,
		isReply: boolean,
		replyIndex?: number
	): void {
		const commentDiv = container.createDiv({ cls: 'daily-log-comments-comment' });

		const header = commentDiv.createDiv({ cls: 'daily-log-comments-comment-header' });
		header.createSpan({ text: comment.author.replace(/\[\[|\]\]/g, ''), cls: 'daily-log-comments-comment-author' });
		header.createSpan({ text: this.formatTimestamp(comment.timestamp), cls: 'daily-log-comments-comment-timestamp' });

		// Check if block ID exists
		if (!isReply && this.currentFile) {
			this.app.vault.read(this.currentFile).then(content => {
				if (!this.plugin.commentManager.blockIdExists(content, commentId)) {
					header.createSpan({ text: '(anchor missing)', cls: 'daily-log-comments-comment-warning' });
				}
			});
		}

		commentDiv.createDiv({ text: comment.text, cls: 'daily-log-comments-comment-text' });

		const actions = commentDiv.createDiv({ cls: 'daily-log-comments-comment-actions' });

		const editBtn = actions.createEl('button', { text: 'Edit' });
		editBtn.addEventListener('click', () => this.showEditForm(commentDiv, commentId, comment.text, isReply, replyIndex));

		const deleteBtn = actions.createEl('button', { text: 'Delete' });
		deleteBtn.addEventListener('click', () => this.deleteComment(commentId, isReply, replyIndex));
	}

	showReplyForm(thread: HTMLElement, commentId: string): void {
		// Remove any existing input forms
		if (this.activeInputForm) {
			this.activeInputForm.remove();
		}

		const form = thread.createDiv({ cls: 'daily-log-comments-input-form' });
		this.activeInputForm = form;

		const textarea = form.createEl('textarea', { placeholder: 'Write a reply...' });
		textarea.focus();

		const actionsDiv = form.createDiv({ cls: 'daily-log-comments-input-form-actions' });

		const cancelBtn = actionsDiv.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			form.remove();
			this.activeInputForm = null;
		});

		const submitBtn = actionsDiv.createEl('button', { text: 'Submit' });
		submitBtn.addEventListener('click', async () => {
			const text = textarea.value.trim();
			if (!text || !this.currentFile) return;

			try {
				await this.plugin.commentManager.addReply(
					this.currentFile,
					commentId,
					this.plugin.settings.authorName,
					text
				);
				form.remove();
				this.activeInputForm = null;
			} catch (error) {
				console.error('Failed to add reply:', error);
			}
		});
	}

	showEditForm(commentDiv: HTMLElement, commentId: string, currentText: string, isReply: boolean, replyIndex?: number): void {
		const textDiv = commentDiv.querySelector('.daily-log-comments-comment-text') as HTMLElement;
		if (!textDiv) return;

		const textarea = textDiv.createEl('textarea', { value: currentText });
		textarea.style.width = '100%';
		textarea.style.minHeight = '60px';
		textDiv.textContent = '';
		textDiv.appendChild(textarea);
		textarea.focus();

		const actions = commentDiv.querySelector('.daily-log-comments-comment-actions') as HTMLElement;
		actions.empty();

		const cancelBtn = actions.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.render());

		const saveBtn = actions.createEl('button', { text: 'Save' });
		saveBtn.addEventListener('click', async () => {
			const newText = textarea.value.trim();
			if (!newText || !this.currentFile) return;

			try {
				await this.plugin.commentManager.updateComment(
					this.currentFile,
					commentId,
					newText,
					isReply,
					replyIndex
				);
			} catch (error) {
				console.error('Failed to update comment:', error);
			}
		});
	}

	async deleteComment(commentId: string, isReply: boolean, replyIndex?: number): Promise<void> {
		if (!this.currentFile) return;

		const message = isReply ? 'Delete this reply?' : 'Delete this comment and all replies?';
		if (!confirm(message)) return;

		try {
			await this.plugin.commentManager.deleteComment(
				this.currentFile,
				commentId,
				isReply,
				replyIndex
			);
		} catch (error) {
			console.error('Failed to delete comment:', error);
		}
	}

	formatTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString();
	}

	scrollToComment(commentId: string): void {
		const thread = this.containerEl.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;
		if (thread) {
			thread.scrollIntoView({ behavior: 'smooth', block: 'center' });
			thread.addClass('highlighted');
			setTimeout(() => thread.removeClass('highlighted'), 2000);
		}
	}

	async onClose(): Promise<void> {
		// Cleanup
	}
}

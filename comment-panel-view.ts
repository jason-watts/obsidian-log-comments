import { ItemView, WorkspaceLeaf, TFile, MarkdownView } from 'obsidian';
import { VIEW_TYPE_COMMENTS, CommentData, Comment, Reply } from './types';
import DailyLogCommentsPlugin from './main';

export class CommentPanelView extends ItemView {
	plugin: DailyLogCommentsPlugin;
	currentFile: TFile | null = null;
	comments: CommentData = {};
	persons: string[] = [];
	private activeInputForm: HTMLElement | null = null;
	private newCommentContainer: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: DailyLogCommentsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return VIEW_TYPE_COMMENTS; }
	getDisplayText(): string { return 'Page Comments'; }
	getIcon(): string { return 'message-square'; }

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('page-comments-panel');

		this.registerEvent(this.app.workspace.on('file-open', (file) => { if (file) this.loadCurrentFile(); }));
		this.registerEvent(this.app.vault.on('modify', (file) => { if (file === this.currentFile) this.loadCurrentFile(); }));
		this.loadCurrentFile();
	}

	async loadCurrentFile(): Promise<void> {
		if (this.activeInputForm) return;

		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			const leaves = this.app.workspace.getLeavesOfType('markdown');
			if (leaves.length > 0) activeView = leaves[0].view as MarkdownView;
		}

		if (!activeView?.file) {
			if (!this.currentFile) { this.comments = {}; this.render(); }
			return;
		}

		this.currentFile = activeView.file;
		const content = await this.app.vault.read(this.currentFile);
		this.comments = await this.plugin.commentManager.loadComments(this.currentFile);
		this.persons = this.plugin.commentManager.parsePersonHeaders(content);
		this.render();
	}

	render(): void {
		if (this.activeInputForm) return;
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		if (!this.currentFile) {
			container.createDiv({ text: 'No file open', cls: 'page-comments-header' });
			return;
		}

		container.createDiv({ text: `Comments: ${this.currentFile.basename}`, cls: 'page-comments-header' });

		this.newCommentContainer = container.createDiv({ cls: 'page-comments-new-comment-container' });
		this.newCommentContainer.style.display = 'none';

		for (const person of this.persons) {
			const personComments = this.comments[person] || [];
			if (personComments.length > 0) this.renderPersonSection(container, person, personComments);
		}

		if (!Object.values(this.comments).some(c => c.length > 0)) {
			container.createDiv({ text: 'No comments yet. Add a comment using the command!', cls: 'page-comments-empty-state' });
		}
	}

	renderPersonSection(container: HTMLElement, person: string, comments: Comment[]): void {
		const section = container.createDiv({ cls: 'page-comments-section' });
		const header = section.createDiv({ cls: 'page-comments-section-header' });
		const toggle = header.createSpan({ text: '▼', cls: 'page-comments-section-toggle' });
		header.createSpan({ text: person.replace(/\[\[|\]\]/g, ''), cls: 'page-comments-section-name' });
		header.createSpan({ text: `(${comments.length})`, cls: 'page-comments-section-count' });

		const content = section.createDiv({ cls: 'page-comments-section-content' });
		let isCollapsed = false;
		header.addEventListener('click', () => {
			isCollapsed = !isCollapsed;
			toggle.setText(isCollapsed ? '▷' : '▼');
			content.style.display = isCollapsed ? 'none' : 'block';
		});

		for (const comment of comments) this.renderThread(content, person, comment);
	}

	renderThread(container: HTMLElement, person: string, comment: Comment): void {
		const thread = container.createDiv({ cls: 'page-comments-thread' });
		thread.setAttribute('data-comment-id', comment.id);
		this.renderComment(thread, person, comment, false);
		if (comment.replies?.length) {
			for (let i = 0; i < comment.replies.length; i++) {
				const replyDiv = thread.createDiv({ cls: 'page-comments-reply' });
				this.renderComment(replyDiv, person, comment.replies[i], true, i, comment.id);
			}
		}
	}

	renderComment(container: HTMLElement, person: string, comment: Comment | Reply | any, isReply: boolean, replyIndex?: number, commentId?: string): void {
		const commentDiv = container.createDiv({ cls: 'page-comments-comment' });
		const header = commentDiv.createDiv({ cls: 'page-comments-comment-header' });
		header.createSpan({ text: comment.author.replace(/\[\[|\]\]/g, ''), cls: 'page-comments-comment-author' });
		header.createSpan({ text: this.formatTimestamp(comment.timestamp), cls: 'page-comments-comment-timestamp' });
		commentDiv.createDiv({ text: comment.text, cls: 'page-comments-comment-text' });

		const actions = commentDiv.createDiv({ cls: 'page-comments-comment-actions' });
		const actualCommentId = isReply ? commentId! : (comment as Comment).id;

		const editLink = actions.createEl('a', { text: 'Edit' });
		editLink.addEventListener('click', (e) => { e.preventDefault(); this.showEditForm(commentDiv, person, actualCommentId, comment.text, isReply, replyIndex); });

		const deleteLink = actions.createEl('a', { text: 'Delete' });
		deleteLink.addEventListener('click', (e) => { e.preventDefault(); this.deleteComment(person, actualCommentId, isReply, replyIndex); });
	}

	showReplyForm(thread: HTMLElement, person: string, commentId: string): void {
		if (this.activeInputForm) this.activeInputForm.remove();
		const form = thread.createDiv({ cls: 'page-comments-input-form' });
		this.activeInputForm = form;
		const textarea = form.createEl('textarea', { placeholder: 'Write a reply...' });
		textarea.focus();
		const actionsDiv = form.createDiv({ cls: 'page-comments-input-form-actions' });

		actionsDiv.createEl('button', { text: 'Cancel' }).addEventListener('click', () => { form.remove(); this.activeInputForm = null; });
		actionsDiv.createEl('button', { text: 'Submit' }).addEventListener('click', async () => {
			const text = textarea.value.trim();
			if (!text || !this.currentFile) return;
			try {
				await this.plugin.commentManager.addReply(this.currentFile, person, commentId, this.plugin.settings.authorName, text);
				form.remove();
				this.activeInputForm = null;
			} catch (error) { console.error('Failed to add reply:', error); }
		});
	}

	showEditForm(commentDiv: HTMLElement, person: string, commentId: string, currentText: string, isReply: boolean, replyIndex?: number): void {
		const textDiv = commentDiv.querySelector('.page-comments-comment-text') as HTMLElement;
		if (!textDiv) return;
		const textarea = textDiv.createEl('textarea', { value: currentText });
		textarea.style.width = '100%';
		textarea.style.minHeight = '60px';
		textDiv.textContent = '';
		textDiv.appendChild(textarea);
		textarea.focus();

		const actions = commentDiv.querySelector('.page-comments-comment-actions') as HTMLElement;
		actions.empty();
		actions.createEl('button', { text: 'Cancel' }).addEventListener('click', () => this.render());
		actions.createEl('button', { text: 'Save' }).addEventListener('click', async () => {
			const newText = textarea.value.trim();
			if (!newText || !this.currentFile) return;
			try {
				await this.plugin.commentManager.updateComment(this.currentFile, person, commentId, newText, isReply, replyIndex);
				await this.loadCurrentFile();
			} catch (error) { console.error('Failed to update comment:', error); }
		});
	}

	async deleteComment(person: string, commentId: string, isReply: boolean, replyIndex?: number): Promise<void> {
		if (!this.currentFile) return;
		if (!confirm(isReply ? 'Delete this reply?' : 'Delete this comment and all replies?')) return;
		try {
			await this.plugin.commentManager.deleteComment(this.currentFile, person, commentId, isReply, replyIndex);
			await this.loadCurrentFile();
		} catch (error) { console.error('Failed to delete comment:', error); }
	}

	formatTimestamp(timestamp: string): string {
		const diffMs = Date.now() - new Date(timestamp).getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMs / 3600000);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffMs / 86400000);
		if (diffDays < 7) return `${diffDays}d ago`;
		return new Date(timestamp).toLocaleDateString();
	}

	scrollToComment(commentId: string): void {
		const thread = this.containerEl.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement;
		if (thread) {
			thread.scrollIntoView({ behavior: 'smooth', block: 'center' });
			thread.addClass('highlighted');
			setTimeout(() => thread.removeClass('highlighted'), 2000);
		}
	}

	showNewCommentForm(person: string, onSubmit: (text: string) => Promise<void>): void {
		this.activeInputForm = document.createElement('div') as any;
		const container = this.containerEl.querySelector('.page-comments-new-comment-container') as HTMLElement;
		if (!container) { this.activeInputForm = null; return; }
		this.newCommentContainer = container;
		this.newCommentContainer.empty();
		this.newCommentContainer.setAttribute('style', 'display: block !important;');

		const label = this.newCommentContainer.createDiv({ text: `New comment on ${person.replace(/\[\[|\]\]/g, '')}'s section`, cls: 'page-comments-new-comment-label' });
		label.style.padding = '8px';
		label.style.fontWeight = '500';

		const form = this.newCommentContainer.createDiv({ cls: 'page-comments-input-form' });
		this.activeInputForm = form;
		const textarea = form.createEl('textarea', { placeholder: 'Write a comment...' });
		textarea.focus();

		const actionsDiv = form.createDiv({ cls: 'page-comments-input-form-actions' });
		actionsDiv.createEl('button', { text: 'Cancel' }).addEventListener('click', () => {
			this.newCommentContainer!.style.display = 'none';
			this.newCommentContainer!.empty();
			this.activeInputForm = null;
		});
		actionsDiv.createEl('button', { text: 'Submit' }).addEventListener('click', async () => {
			const text = textarea.value.trim();
			if (!text) return;
			try {
				this.activeInputForm = null;
				await onSubmit(text);
				this.newCommentContainer!.style.display = 'none';
				this.newCommentContainer!.empty();
			} catch (error) {
				console.error('Failed to add comment:', error);
				this.activeInputForm = null;
			}
		});

		this.newCommentContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async onClose(): Promise<void> {}
}

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

		// Listen for file open events instead of active leaf changes
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				if (file) {
					this.loadCurrentFile();
				}
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
		console.log('Panel: loadCurrentFile called');

		// Don't reload if user is actively typing a comment
		if (this.activeInputForm) {
			console.log('Panel: Active input form detected, skipping reload');
			return;
		}

		// Try to find the most recently active markdown view
		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

		// If the panel itself is active, look for other markdown views
		if (!activeView) {
			const leaves = this.app.workspace.getLeavesOfType('markdown');
			if (leaves.length > 0) {
				// Get the most recently active markdown leaf
				activeView = leaves[0].view as MarkdownView;
			}
		}

		if (!activeView || !activeView.file) {
			console.log('Panel: No markdown view found');
			// Keep showing current file if we have one
			if (!this.currentFile) {
				this.comments = {};
				this.render();
			}
			return;
		}

		// Check if file matches pattern
		const filePath = activeView.file.path;
		console.log('Panel: File path:', filePath);
		const dailyPattern = new RegExp(this.plugin.settings.dailyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));
		const weeklyPattern = new RegExp(this.plugin.settings.weeklyLogPattern.replace(/\*\*/g, '__GLOBSTAR__').replace(/\*/g, '[^/]*').replace(/__GLOBSTAR__/g, '.*'));
		console.log('Panel: Patterns:', { daily: dailyPattern.source, weekly: weeklyPattern.source });
		console.log('Panel: Daily test:', dailyPattern.test(filePath));
		console.log('Panel: Weekly test:', weeklyPattern.test(filePath));

		if (!dailyPattern.test(filePath) && !weeklyPattern.test(filePath)) {
			console.log('Panel: File does not match patterns');
			this.currentFile = null;
			this.comments = {};
			this.render();
			return;
		}
		console.log('Panel: File matches pattern');

		this.currentFile = activeView.file;
		const content = await this.app.vault.read(this.currentFile);
		this.comments = this.plugin.commentManager.parseComments(content);
		this.persons = this.plugin.commentManager.parsePersonHeaders(content);
		console.log('Panel: Persons found:', this.persons);
		this.render();
	}

	render(): void {
		console.log('Render: called, activeInputForm =', this.activeInputForm);
		// Don't render if there's an active input form (would wipe it out)
		if (this.activeInputForm) {
			console.log('Render: Skipping render because activeInputForm exists');
			return;
		}

		console.log('Render: Continuing with render');
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		console.log('Render: Container emptied');

		if (!this.currentFile) {
			container.createDiv({ text: 'No daily/weekly log open', cls: 'daily-log-comments-header' });
			return;
		}

		container.createDiv({ text: 'Daily Log Comments', cls: 'daily-log-comments-header' });

		// Create container for new comment input (initially hidden)
		this.newCommentContainer = container.createDiv({ cls: 'daily-log-comments-new-comment-container' });
		this.newCommentContainer.style.display = 'none';
		console.log('Render: Created new comment container');

		// Render all persons found in the file
		for (const person of this.persons) {
			const personComments = this.comments[person] || [];
			this.renderPersonSection(container, person, personComments);
		}
	}

	renderPersonSection(container: HTMLElement, person: string, comments: Comment[]): void {
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

		for (const comment of comments) {
			this.renderThread(content, person, comment);
		}
	}

	renderThread(container: HTMLElement, person: string, comment: Comment): void {
		const thread = container.createDiv({ cls: 'daily-log-comments-thread' });
		thread.setAttribute('data-comment-id', comment.id);

		// Render main comment
		this.renderComment(thread, person, comment, false);

		// Render replies
		if (comment.replies && comment.replies.length > 0) {
			for (let i = 0; i < comment.replies.length; i++) {
				const replyDiv = thread.createDiv({ cls: 'daily-log-comments-reply' });
				this.renderComment(replyDiv, person, comment.replies[i], true, i, comment.id);
			}
		}

		// Add reply button at the end
		const actions = thread.createDiv({ cls: 'daily-log-comments-comment-actions' });
		const replyBtn = actions.createEl('button', { text: 'Reply' });
		replyBtn.addEventListener('click', () => this.showReplyForm(thread, person, comment.id));
	}

	renderComment(
		container: HTMLElement,
		person: string,
		comment: Comment | Reply | any,
		isReply: boolean,
		replyIndex?: number,
		commentId?: string
	): void {
		const commentDiv = container.createDiv({ cls: 'daily-log-comments-comment' });

		const header = commentDiv.createDiv({ cls: 'daily-log-comments-comment-header' });
		header.createSpan({ text: comment.author.replace(/\[\[|\]\]/g, ''), cls: 'daily-log-comments-comment-author' });
		header.createSpan({ text: this.formatTimestamp(comment.timestamp), cls: 'daily-log-comments-comment-timestamp' });

		commentDiv.createDiv({ text: comment.text, cls: 'daily-log-comments-comment-text' });

		const actions = commentDiv.createDiv({ cls: 'daily-log-comments-comment-actions' });

		const editBtn = actions.createEl('button', { text: 'Edit' });
		const actualCommentId = isReply ? commentId! : (comment as Comment).id;
		editBtn.addEventListener('click', () => this.showEditForm(commentDiv, person, actualCommentId, comment.text, isReply, replyIndex));

		const deleteBtn = actions.createEl('button', { text: 'Delete' });
		deleteBtn.addEventListener('click', () => this.deleteComment(person, actualCommentId, isReply, replyIndex));
	}

	showReplyForm(thread: HTMLElement, person: string, commentId: string): void {
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
					person,
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

	showEditForm(commentDiv: HTMLElement, person: string, commentId: string, currentText: string, isReply: boolean, replyIndex?: number): void {
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
					person,
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

	async deleteComment(person: string, commentId: string, isReply: boolean, replyIndex?: number): Promise<void> {
		if (!this.currentFile) return;

		const message = isReply ? 'Delete this reply?' : 'Delete this comment and all replies?';
		if (!confirm(message)) return;

		try {
			await this.plugin.commentManager.deleteComment(
				this.currentFile,
				person,
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

	showNewCommentForm(person: string, onSubmit: (text: string) => Promise<void>): void {
		console.log('showNewCommentForm called');
		console.log('newCommentContainer:', this.newCommentContainer);
		if (!this.newCommentContainer) {
			console.log('newCommentContainer is null, returning');
			return;
		}

		// Remove any existing input forms
		if (this.activeInputForm) {
			console.log('Removing existing form');
			this.activeInputForm.remove();
			this.activeInputForm = null;
		}

		console.log('Creating form elements');
		this.newCommentContainer.empty();
		console.log('Setting display to block');
		this.newCommentContainer.style.display = 'block';
		console.log('Display is now:', this.newCommentContainer.style.display);
		console.log('Container element:', this.newCommentContainer);

		const label = this.newCommentContainer.createDiv({
			text: `New comment on ${person.replace(/\[\[|\]\]/g, '')}'s section`,
			cls: 'daily-log-comments-new-comment-label'
		});
		label.style.padding = '8px';
		label.style.fontWeight = '500';
		console.log('Label created');

		const form = this.newCommentContainer.createDiv({ cls: 'daily-log-comments-input-form' });
		this.activeInputForm = form;
		console.log('Form created');

		const textarea = form.createEl('textarea', { placeholder: 'Write a comment...' });
		textarea.focus();
		console.log('Textarea created and focused');

		const actionsDiv = form.createDiv({ cls: 'daily-log-comments-input-form-actions' });

		const cancelBtn = actionsDiv.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.newCommentContainer!.style.display = 'none';
			this.newCommentContainer!.empty();
			this.activeInputForm = null;
		});

		const submitBtn = actionsDiv.createEl('button', { text: 'Submit' });
		submitBtn.addEventListener('click', async () => {
			const text = textarea.value.trim();
			if (!text) return;

			try {
				await onSubmit(text);
				this.newCommentContainer!.style.display = 'none';
				this.newCommentContainer!.empty();
				this.activeInputForm = null;
			} catch (error) {
				console.error('Failed to add comment:', error);
			}
		});

		// Scroll to the form
		this.newCommentContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async onClose(): Promise<void> {
		// Cleanup
	}
}

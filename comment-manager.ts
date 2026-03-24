import { Editor, TFile } from 'obsidian';
import { nanoid } from 'nanoid';
import { CommentData } from './types';
import DailyLogCommentsPlugin from './main';

export class CommentManager {
	plugin: DailyLogCommentsPlugin;

	constructor(plugin: DailyLogCommentsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get the path for the comments file associated with a markdown file.
	 * Stores as a sidecar .comments.json next to the original file.
	 */
	getCommentsFilePath(mdFile: TFile): string {
		return mdFile.path.replace(/\.md$/, '.comments.json');
	}

	async loadComments(mdFile: TFile): Promise<CommentData> {
		const commentsPath = this.getCommentsFilePath(mdFile);
		try {
			const exists = await this.plugin.app.vault.adapter.exists(commentsPath);
			if (!exists) return {};
			const content = await this.plugin.app.vault.adapter.read(commentsPath);
			const parsed = JSON.parse(content) as CommentData;
			if (parsed) {
				for (const person in parsed) {
					if (!Array.isArray(parsed[person])) parsed[person] = [];
				}
			}
			return parsed || {};
		} catch (error) {
			console.error('Failed to load comments:', error);
			return {};
		}
	}

	async saveComments(mdFile: TFile, comments: CommentData): Promise<void> {
		const commentsPath = this.getCommentsFilePath(mdFile);
		try {
			const dirPath = commentsPath.substring(0, commentsPath.lastIndexOf('/'));
			await this.ensureDirectoryExists(dirPath);
			await this.plugin.app.vault.adapter.write(commentsPath, JSON.stringify(comments, null, 2));
		} catch (error) {
			console.error('Failed to save comments:', error);
			throw error;
		}
	}

	async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (await this.plugin.app.vault.adapter.exists(dirPath)) return;
		const parentPath = dirPath.substring(0, dirPath.lastIndexOf('/'));
		if (parentPath && parentPath !== dirPath) {
			await this.ensureDirectoryExists(parentPath);
		}
		await this.plugin.app.vault.adapter.mkdir(dirPath);
	}

	generateCommentId(): string {
		return `comment-${nanoid(8)}`;
	}

	parsePersonHeaders(content: string): string[] {
		const persons: string[] = [];
		for (const line of content.split('\n')) {
			const headerMatch = line.match(/^#+\s*\[\[([^\]]+)\]\]/);
			if (headerMatch) {
				const person = `[[${headerMatch[1]}]]`;
				if (!persons.includes(person)) persons.push(person);
			}
		}
		if (!persons.includes('General')) persons.unshift('General');
		return persons;
	}

	findPersonSection(editor: Editor, lineNumber: number): string {
		for (let i = lineNumber; i >= 0; i--) {
			const line = editor.getLine(i);
			const headerMatch = line.match(/^#+\s*\[\[([^\]]+)\]\]/);
			if (headerMatch) return `[[${headerMatch[1]}]]`;
			const plainHeaderMatch = line.match(/^#+\s*([A-Z][a-zA-Z\s]+)$/);
			if (plainHeaderMatch) return `[[${plainHeaderMatch[1].trim()}]]`;
		}
		return 'General';
	}

	async addComment(file: TFile, commentId: string, author: string, text: string, person: string): Promise<void> {
		const comments = await this.loadComments(file);
		if (!comments[person]) comments[person] = [];
		comments[person].push({ id: commentId, author, text, timestamp: new Date().toISOString(), replies: [] });
		await this.saveComments(file, comments);
	}

	async addReply(file: TFile, person: string, commentId: string, author: string, text: string): Promise<void> {
		const comments = await this.loadComments(file);
		if (!comments[person]) throw new Error('Person not found');
		const comment = comments[person].find(c => c.id === commentId);
		if (!comment) throw new Error('Comment not found');
		comment.replies.push({ author, text, timestamp: new Date().toISOString() });
		await this.saveComments(file, comments);
	}

	async updateComment(file: TFile, person: string, commentId: string, newText: string, isReply = false, replyIndex?: number): Promise<void> {
		const comments = await this.loadComments(file);
		if (!comments[person]) throw new Error('Person not found');
		const comment = comments[person].find(c => c.id === commentId);
		if (!comment) throw new Error('Comment not found');
		if (isReply && replyIndex !== undefined) {
			if (!comment.replies[replyIndex]) throw new Error('Reply not found');
			comment.replies[replyIndex].text = newText;
		} else {
			comment.text = newText;
		}
		await this.saveComments(file, comments);
	}

	async deleteComment(file: TFile, person: string, commentId: string, isReply = false, replyIndex?: number): Promise<void> {
		const comments = await this.loadComments(file);
		if (!comments[person]) throw new Error('Person not found');
		const idx = comments[person].findIndex(c => c.id === commentId);
		if (idx === -1) throw new Error('Comment not found');
		if (isReply && replyIndex !== undefined) {
			if (!comments[person][idx].replies[replyIndex]) throw new Error('Reply not found');
			comments[person][idx].replies.splice(replyIndex, 1);
		} else {
			comments[person].splice(idx, 1);
		}
		await this.saveComments(file, comments);
	}
}

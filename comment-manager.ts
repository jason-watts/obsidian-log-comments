import { Editor, TFile } from 'obsidian';
import { nanoid } from 'nanoid';
import { CommentData, Comment, Reply } from './types';
import DailyLogCommentsPlugin from './main';

export class CommentManager {
	plugin: DailyLogCommentsPlugin;

	constructor(plugin: DailyLogCommentsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Get the path for the comments file associated with a markdown file
	 */
	getCommentsFilePath(mdFile: TFile): string {
		// Extract filename without extension
		const filename = mdFile.basename;

		// Determine if this is a daily or weekly log based on path
		const isDaily = mdFile.path.includes('Logs/Daily/');
		const isWeekly = mdFile.path.includes('Logs/Weekly/');

		if (!isDaily && !isWeekly) {
			// Fallback to sidecar file if not in expected location
			return mdFile.path.replace(/\.md$/, '.comments.json');
		}

		// Extract YYYY/MM from the file path or filename
		// Files are typically at Logs/Daily/YYYY/MM/YYYY-MM-DD.md
		const pathMatch = mdFile.path.match(/(\d{4})\/(\d{2})\//);

		if (pathMatch) {
			const [, year, month] = pathMatch;
			// Check if file path includes tps-markdown subdirectory
			const pathPrefix = mdFile.path.includes('tps-markdown/') ? 'tps-markdown/' : '';
			if (isDaily) {
				return `${pathPrefix}Logs/Daily/Comments/${year}/${month}/${filename}.comments.json`;
			} else {
				return `${pathPrefix}Logs/Weekly/Comments/${year}/${month}/${filename}.comments.json`;
			}
		}

		// Fallback: try to extract from filename (YYYY-MM-DD format)
		const filenameMatch = filename.match(/^(\d{4})-(\d{2})-\d{2}$/);
		if (filenameMatch) {
			const [, year, month] = filenameMatch;
			// Check if file path includes tps-markdown subdirectory
			const pathPrefix = mdFile.path.includes('tps-markdown/') ? 'tps-markdown/' : '';
			if (isDaily) {
				return `${pathPrefix}Logs/Daily/Comments/${year}/${month}/${filename}.comments.json`;
			} else {
				return `${pathPrefix}Logs/Weekly/Comments/${year}/${month}/${filename}.comments.json`;
			}
		}

		// Final fallback
		return mdFile.path.replace(/\.md$/, '.comments.json');
	}

	/**
	 * Load comments from the sidecar JSON file
	 */
	async loadComments(mdFile: TFile): Promise<CommentData> {
		const commentsPath = this.getCommentsFilePath(mdFile);

		try {
			const exists = await this.plugin.app.vault.adapter.exists(commentsPath);
			if (!exists) {
				return {};
			}

			const content = await this.plugin.app.vault.adapter.read(commentsPath);
			const parsed = JSON.parse(content) as CommentData;

			// Ensure each person has an array
			if (parsed) {
				for (const person in parsed) {
					if (!Array.isArray(parsed[person])) {
						parsed[person] = [];
					}
				}
			}
			return parsed || {};
		} catch (error) {
			console.error('Failed to load comments:', error);
			return {};
		}
	}

	/**
	 * Save comments to the sidecar JSON file
	 */
	async saveComments(mdFile: TFile, comments: CommentData): Promise<void> {
		const commentsPath = this.getCommentsFilePath(mdFile);

		try {
			// Ensure directory exists - create recursively
			const dirPath = commentsPath.substring(0, commentsPath.lastIndexOf('/'));
			await this.ensureDirectoryExists(dirPath);

			const content = JSON.stringify(comments, null, 2);
			await this.plugin.app.vault.adapter.write(commentsPath, content);
			console.log('Comments saved to:', commentsPath);
		} catch (error) {
			console.error('Failed to save comments:', error);
			throw error;
		}
	}

	/**
	 * Recursively ensure a directory path exists
	 */
	async ensureDirectoryExists(dirPath: string): Promise<void> {
		const exists = await this.plugin.app.vault.adapter.exists(dirPath);
		if (exists) {
			return;
		}

		// Create parent directory first
		const parentPath = dirPath.substring(0, dirPath.lastIndexOf('/'));
		if (parentPath && parentPath !== dirPath) {
			await this.ensureDirectoryExists(parentPath);
		}

		// Now create this directory
		await this.plugin.app.vault.adapter.mkdir(dirPath);
	}

	/**
	 * Generate unique comment ID
	 */
	generateCommentId(): string {
		return `comment-${nanoid(8)}`;
	}

	/**
	 * Parse person headers from file content
	 */
	parsePersonHeaders(content: string): string[] {
		const persons: string[] = [];
		const lines = content.split('\n');

		for (const line of lines) {
			// Match patterns like: # [[Person Name]] or ## [[Person Name]]
			const headerMatch = line.match(/^#+\s*\[\[([^\]]+)\]\]/);
			if (headerMatch) {
				const person = `[[${headerMatch[1]}]]`;
				if (!persons.includes(person)) {
					persons.push(person);
				}
			}
		}

		// Add General if not present
		if (!persons.includes('General')) {
			persons.unshift('General');
		}

		return persons;
	}

	/**
	 * Find the person section for a given line
	 */
	findPersonSection(editor: Editor, lineNumber: number): string {
		// Traverse up from the current line to find nearest # [[Person Name]] header
		for (let i = lineNumber; i >= 0; i--) {
			const line = editor.getLine(i);

			// Match patterns like: # [[Person Name]] or ## [[Person Name]]
			const headerMatch = line.match(/^#+\s*\[\[([^\]]+)\]\]/);
			if (headerMatch) {
				return `[[${headerMatch[1]}]]`;
			}

			// Also match plain headers without wikilinks: # Person Name
			const plainHeaderMatch = line.match(/^#+\s*([A-Z][a-zA-Z\s]+)$/);
			if (plainHeaderMatch) {
				return `[[${plainHeaderMatch[1].trim()}]]`;
			}
		}

		return 'General';
	}

	/**
	 * Add a new comment to the file
	 */
	async addComment(
		file: TFile,
		commentId: string,
		author: string,
		text: string,
		person: string
	): Promise<void> {
		const comments = await this.loadComments(file);

		// Initialize person array if it doesn't exist
		if (!comments[person]) {
			comments[person] = [];
		}

		// Add new comment
		comments[person].push({
			id: commentId,
			author,
			text,
			timestamp: new Date().toISOString(),
			replies: []
		});

		await this.saveComments(file, comments);
	}

	/**
	 * Add a reply to an existing comment
	 */
	async addReply(
		file: TFile,
		person: string,
		commentId: string,
		author: string,
		text: string
	): Promise<void> {
		const comments = await this.loadComments(file);

		if (!comments[person]) {
			throw new Error('Person not found');
		}

		const comment = comments[person].find(c => c.id === commentId);
		if (!comment) {
			throw new Error('Comment not found');
		}

		comment.replies.push({
			author,
			text,
			timestamp: new Date().toISOString()
		});

		await this.saveComments(file, comments);
	}

	/**
	 * Update comment text
	 */
	async updateComment(
		file: TFile,
		person: string,
		commentId: string,
		newText: string,
		isReply: boolean = false,
		replyIndex?: number
	): Promise<void> {
		const comments = await this.loadComments(file);

		if (!comments[person]) {
			throw new Error('Person not found');
		}

		const comment = comments[person].find(c => c.id === commentId);
		if (!comment) {
			throw new Error('Comment not found');
		}

		if (isReply && replyIndex !== undefined) {
			if (!comment.replies[replyIndex]) {
				throw new Error('Reply not found');
			}
			comment.replies[replyIndex].text = newText;
		} else {
			comment.text = newText;
		}

		await this.saveComments(file, comments);
	}

	/**
	 * Delete a comment
	 */
	async deleteComment(
		file: TFile,
		person: string,
		commentId: string,
		isReply: boolean = false,
		replyIndex?: number
	): Promise<void> {
		const comments = await this.loadComments(file);

		if (!comments[person]) {
			throw new Error('Person not found');
		}

		const commentIndex = comments[person].findIndex(c => c.id === commentId);
		if (commentIndex === -1) {
			throw new Error('Comment not found');
		}

		if (isReply && replyIndex !== undefined) {
			if (!comments[person][commentIndex].replies[replyIndex]) {
				throw new Error('Reply not found');
			}
			comments[person][commentIndex].replies.splice(replyIndex, 1);
		} else {
			comments[person].splice(commentIndex, 1);
		}

		await this.saveComments(file, comments);
	}
}

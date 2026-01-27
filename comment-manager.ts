import { Editor, TFile } from 'obsidian';
import * as yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import { CommentData, Comment, Reply } from './types';
import DailyLogCommentsPlugin from './main';

export class CommentManager {
	plugin: DailyLogCommentsPlugin;

	constructor(plugin: DailyLogCommentsPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Parse comments section from file content
	 */
	parseComments(content: string): CommentData {
		const commentMatch = content.match(/<!-- COMMENTS\n---comments\n([\s\S]*?)\n---\n-->/);

		if (!commentMatch) {
			return {};
		}

		try {
			const yamlContent = commentMatch[1];
			const parsed = yaml.load(yamlContent) as CommentData;
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
			console.error('Failed to parse comments:', error);
			return {};
		}
	}

	/**
	 * Serialize comments to YAML wrapped in HTML comment
	 */
	serializeComments(comments: CommentData): string {
		if (Object.keys(comments).length === 0) {
			return '';
		}

		const yamlContent = yaml.dump(comments, {
			indent: 2,
			lineWidth: -1,
			noRefs: true
		});

		return `\n\n<!-- COMMENTS\n---comments\n${yamlContent}---\n-->`;
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
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

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

		// Remove old comments section if exists
		const contentWithoutComments = content.replace(/\n*<!-- COMMENTS\n---comments\n[\s\S]*?\n---\n-->/g, '');

		// Append new comments section
		const newContent = contentWithoutComments + this.serializeComments(comments);

		await this.plugin.app.vault.modify(file, newContent);
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
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

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

		const contentWithoutComments = content.replace(/\n*<!-- COMMENTS\n---comments\n[\s\S]*?\n---\n-->/g, '');
		const newContent = contentWithoutComments + this.serializeComments(comments);

		await this.plugin.app.vault.modify(file, newContent);
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
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

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

		const contentWithoutComments = content.replace(/\n*<!-- COMMENTS\n---comments\n[\s\S]*?\n---\n-->/g, '');
		const newContent = contentWithoutComments + this.serializeComments(comments);

		await this.plugin.app.vault.modify(file, newContent);
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
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

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

		const contentWithoutComments = content.replace(/\n*<!-- COMMENTS\n---comments\n[\s\S]*?\n---\n-->/g, '');
		const newContent = contentWithoutComments + this.serializeComments(comments);

		await this.plugin.app.vault.modify(file, newContent);
	}
}

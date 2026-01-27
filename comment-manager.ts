import { Editor, EditorPosition, TFile } from 'obsidian';
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
	 * Inject block ID at editor position
	 */
	injectBlockId(editor: Editor, blockId: string, position: EditorPosition): void {
		const line = editor.getLine(position.line);
		const newLine = `${line} ^${blockId}`;
		editor.setLine(position.line, newLine);
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
		editor: Editor,
		blockId: string,
		author: string,
		text: string,
		person: string,
		position: EditorPosition
	): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

		// Add new comment
		comments[blockId] = {
			author,
			text,
			timestamp: new Date().toISOString(),
			person,
			replies: []
		};

		// Remove old comments section if exists
		const contentWithoutComments = content.replace(/\n*<!-- COMMENTS\n---comments\n[\s\S]*?\n---\n-->/g, '');

		// Inject block ID
		this.injectBlockId(editor, blockId, position);

		// Append new comments section
		const newContent = contentWithoutComments + this.serializeComments(comments);

		await this.plugin.app.vault.modify(file, newContent);
	}

	/**
	 * Add a reply to an existing comment
	 */
	async addReply(
		file: TFile,
		commentId: string,
		author: string,
		text: string
	): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

		if (!comments[commentId]) {
			throw new Error('Comment not found');
		}

		comments[commentId].replies.push({
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
		commentId: string,
		newText: string,
		isReply: boolean = false,
		replyIndex?: number
	): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

		if (!comments[commentId]) {
			throw new Error('Comment not found');
		}

		if (isReply && replyIndex !== undefined) {
			if (!comments[commentId].replies[replyIndex]) {
				throw new Error('Reply not found');
			}
			comments[commentId].replies[replyIndex].text = newText;
		} else {
			comments[commentId].text = newText;
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
		commentId: string,
		isReply: boolean = false,
		replyIndex?: number
	): Promise<void> {
		const content = await this.plugin.app.vault.read(file);
		const comments = this.parseComments(content);

		if (!comments[commentId]) {
			throw new Error('Comment not found');
		}

		if (isReply && replyIndex !== undefined) {
			if (!comments[commentId].replies[replyIndex]) {
				throw new Error('Reply not found');
			}
			comments[commentId].replies.splice(replyIndex, 1);
		} else {
			delete comments[commentId];
		}

		const contentWithoutComments = content.replace(/\n*<!-- COMMENTS\n---comments\n[\s\S]*?\n---\n-->/g, '');
		const newContent = contentWithoutComments + this.serializeComments(comments);

		await this.plugin.app.vault.modify(file, newContent);
	}

	/**
	 * Check if block ID exists in content
	 */
	blockIdExists(content: string, blockId: string): boolean {
		return content.includes(`^${blockId}`);
	}
}

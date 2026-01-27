import { App, PluginSettingTab, Setting } from 'obsidian';
import DailyLogCommentsPlugin from './main';

export class SettingsTab extends PluginSettingTab {
	plugin: DailyLogCommentsPlugin;

	constructor(app: App, plugin: DailyLogCommentsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Daily Log Comments Settings' });

		new Setting(containerEl)
			.setName('Author Name')
			.setDesc('Your name for comments (will be used as [[Your Name]])')
			.addText(text => text
				.setPlaceholder('Jason Watts')
				.setValue(this.plugin.settings.authorName)
				.onChange(async (value) => {
					// Auto-format as wikilink if not already
					let formatted = value.trim();
					if (formatted && !formatted.startsWith('[[')) {
						formatted = `[[${formatted}]]`;
					}
					this.plugin.settings.authorName = formatted;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('People Folder')
			.setDesc('Path to folder containing person notes')
			.addText(text => text
				.setPlaceholder('Reference/People')
				.setValue(this.plugin.settings.peopleFolder)
				.onChange(async (value) => {
					this.plugin.settings.peopleFolder = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Panel Behavior' });

		new Setting(containerEl)
			.setName('Auto-open panel')
			.setDesc('Automatically open panel when adding a comment')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoOpenPanel)
				.onChange(async (value) => {
					this.plugin.settings.autoOpenPanel = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-scroll to comments')
			.setDesc('Automatically scroll to new comments in the panel')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoScrollToComment)
				.onChange(async (value) => {
					this.plugin.settings.autoScrollToComment = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Keep panel open')
			.setDesc('Keep panel open when switching files')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.keepPanelOpen)
				.onChange(async (value) => {
					this.plugin.settings.keepPanelOpen = value;
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'File Patterns (Advanced)' });

		new Setting(containerEl)
			.setName('Daily logs pattern')
			.setDesc('Glob pattern for daily log files')
			.addText(text => text
				.setPlaceholder('Logs/Daily/**/*.md')
				.setValue(this.plugin.settings.dailyLogPattern)
				.onChange(async (value) => {
					this.plugin.settings.dailyLogPattern = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Weekly logs pattern')
			.setDesc('Glob pattern for weekly log files')
			.addText(text => text
				.setPlaceholder('Logs/Weekly/**/*.md')
				.setValue(this.plugin.settings.weeklyLogPattern)
				.onChange(async (value) => {
					this.plugin.settings.weeklyLogPattern = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.addButton(button => button
				.setButtonText('Restore Defaults')
				.onClick(async () => {
					this.plugin.settings.dailyLogPattern = 'Logs/Daily/**/*.md';
					this.plugin.settings.weeklyLogPattern = 'Logs/Weekly/**/*.md';
					await this.plugin.saveSettings();
					this.display();
				}));
	}
}

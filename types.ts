export interface Reply {
	author: string;
	text: string;
	timestamp: string;
}

export interface Comment {
	id: string;
	author: string;
	text: string;
	timestamp: string;
	replies: Reply[];
}

export interface CommentData {
	[person: string]: Comment[];
}

export interface PluginSettings {
	authorName: string;
	peopleFolder: string;
	dailyLogPattern: string;
	weeklyLogPattern: string;
	autoOpenPanel: boolean;
	autoScrollToComment: boolean;
	keepPanelOpen: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	authorName: '',
	peopleFolder: 'Reference/People',
	dailyLogPattern: 'Logs/Daily/**/*.md',
	weeklyLogPattern: 'Logs/Weekly/**/*.md',
	autoOpenPanel: true,
	autoScrollToComment: true,
	keepPanelOpen: false
};

export const VIEW_TYPE_COMMENTS = 'daily-log-comments-view';

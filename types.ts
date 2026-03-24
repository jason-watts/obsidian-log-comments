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
	autoOpenPanel: boolean;
	autoScrollToComment: boolean;
	keepPanelOpen: boolean;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	authorName: '',
	peopleFolder: 'Reference/People',
	autoOpenPanel: true,
	autoScrollToComment: true,
	keepPanelOpen: false
};

export const VIEW_TYPE_COMMENTS = 'page-comments-view';

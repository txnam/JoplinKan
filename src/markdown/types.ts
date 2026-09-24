export const KANBAN_SETTINGS_FENCE = 'kanban-settings';
export const PLUGIN_ID = 'joplinkan';
export const DEFAULT_COLUMN_COLOR = '#64748b';
export const DEFAULT_CARD_COLOR = '#ffffff';
export const DEFAULT_ICON = '';

export type BoardSettings = {
	version: 1;
	plugin: typeof PLUGIN_ID;
	defaultColumnColor: string;
	defaultCardColor: string;
};

export type Card = {
	id: string;
	title: string;
	body: string;
	color: string;
	icon: string;
};

export type Column = {
	id: string;
	title: string;
	body: string;
	color: string;
	icon: string;
	cards: Card[];
};

export type Board = {
	version: 1;
	columns: Column[];
	settings: BoardSettings;
	extraSettingsLines?: string[];
	preamble?: string;
	epilogue?: string;
};

export type IconGroup = {
	label: string;
	items: Array<{
		icon: string;
		label: string;
	}>;
};

export { COLOR_GROUPS, COLOR_PALETTE } from './palette';

export const ICON_GROUPS: IconGroup[] = [
	{
		label: 'Status',
		items: [
			{ icon: '📥', label: 'Backlog / inbox' },
			{ icon: '🚧', label: 'In progress' },
			{ icon: '⏳', label: 'Waiting' },
			{ icon: '🔎', label: 'Needs review' },
			{ icon: '👀', label: 'Watching' },
			{ icon: '🧭', label: 'Direction' },
			{ icon: '🔁', label: 'Repeat' },
			{ icon: '🔄', label: 'Update' },
			{ icon: '🧹', label: 'Cleanup' },
			{ icon: '🧯', label: 'Needs action' },
			{ icon: '✅', label: 'Done' },
			{ icon: '☑️', label: 'Checked' },
			{ icon: '🏁', label: 'Finished' },
			{ icon: '❌', label: 'Cancelled' },
			{ icon: '⛔', label: 'Blocked' },
		],
	},
	{
		label: 'Priority',
		items: [
			{ icon: '🔥', label: 'Urgent' },
			{ icon: '⭐', label: 'Important' },
			{ icon: '🎯', label: 'Goal' },
			{ icon: '📌', label: 'Pinned' },
			{ icon: '🚀', label: 'Fast track' },
			{ icon: '⚡', label: 'Quick' },
			{ icon: '⬆', label: 'High priority' },
			{ icon: '🔼', label: 'Raise priority' },
			{ icon: '➖', label: 'Normal' },
			{ icon: '⬇', label: 'Low priority' },
			{ icon: '🔽', label: 'Lower priority' },
			{ icon: '🧊', label: 'Deferred' },
		],
	},
	{
		label: 'Work type',
		items: [
			{ icon: '🐞', label: 'Bug' },
			{ icon: '✨', label: 'Feature' },
			{ icon: '🧩', label: 'Engineering' },
			{ icon: '🛠️', label: 'Tooling' },
			{ icon: '⚙️', label: 'Configuration' },
			{ icon: '🧱', label: 'Foundation' },
			{ icon: '🔐', label: 'Security' },
			{ icon: '🔒', label: 'Locked' },
			{ icon: '🔓', label: 'Unlocked' },
			{ icon: '📚', label: 'Documentation' },
			{ icon: '📝', label: 'Notes' },
			{ icon: '📋', label: 'Checklist' },
			{ icon: '🧾', label: 'Receipt' },
			{ icon: '📎', label: 'Attachment' },
			{ icon: '🧪', label: 'Testing' },
			{ icon: '📊', label: 'Report' },
			{ icon: '📈', label: 'Growth' },
			{ icon: '📉', label: 'Decline' },
			{ icon: '💬', label: 'Discussion' },
			{ icon: '📣', label: 'Announcement' },
			{ icon: '📞', label: 'Call' },
			{ icon: '📦', label: 'Release' },
			{ icon: '🏷️', label: 'Label' },
			{ icon: '💡', label: 'Idea' },
			{ icon: '🧠', label: 'Thinking' },
			{ icon: '👤', label: 'Individual' },
			{ icon: '👥', label: 'Team' },
			{ icon: '📅', label: 'Date' },
			{ icon: '⏰', label: 'Time' },
			{ icon: '⌛', label: 'Due soon' },
		],
	},
	{
		label: 'Workflow',
		items: [
			{ icon: '🗂️', label: 'Categorize' },
			{ icon: '🗃️', label: 'Archive' },
			{ icon: '🗄️', label: 'Database' },
			{ icon: '🔍', label: 'Search' },
			{ icon: '🔬', label: 'Analyze' },
			{ icon: '🧮', label: 'Calculate' },
			{ icon: '🧰', label: 'Toolkit' },
			{ icon: '🪛', label: 'Repair' },
			{ icon: '🧲', label: 'Attract' },
			{ icon: '🧷', label: 'Link' },
			{ icon: '🔗', label: 'Dependency' },
			{ icon: '✂️', label: 'Trim' },
			{ icon: '➕', label: 'Add' },
			{ icon: '➗', label: 'Split' },
			{ icon: '🟰', label: 'Compare' },
			{ icon: '♻️', label: 'Reuse' },
			{ icon: '🔀', label: 'Branch' },
			{ icon: '🔃', label: 'Loop' },
			{ icon: '📤', label: 'Export' },
			{ icon: '📥', label: 'Import' },
		],
	},
	{
		label: 'Business',
		items: [
			{ icon: '💼', label: 'Work' },
			{ icon: '💰', label: 'Cost' },
			{ icon: '💳', label: 'Payment' },
			{ icon: '🧾', label: 'Invoice' },
			{ icon: '📑', label: 'Files' },
			{ icon: '📜', label: 'Contract' },
			{ icon: '✍️', label: 'Approval' },
			{ icon: '📮', label: 'Send' },
			{ icon: '📬', label: 'Receive' },
			{ icon: '📍', label: 'Location' },
			{ icon: '🧭', label: 'Navigate' },
			{ icon: '🏢', label: 'Organization' },
			{ icon: '🏦', label: 'Finance' },
			{ icon: '🧑‍💼', label: 'Customer' },
			{ icon: '🤝', label: 'Agreement' },
			{ icon: '🎁', label: 'Offer' },
			{ icon: '🛒', label: 'Shopping' },
			{ icon: '🚚', label: 'Delivery' },
			{ icon: '📦', label: 'Package' },
			{ icon: '📌', label: 'Marker' },
		],
	},
	{
		label: 'Digital',
		items: [
			{ icon: '💻', label: 'Computer' },
			{ icon: '🖥️', label: 'Interface' },
			{ icon: '⌨️', label: 'Input' },
			{ icon: '🖱️', label: 'Interaction' },
			{ icon: '📱', label: 'Mobile' },
			{ icon: '🌐', label: 'Web' },
			{ icon: '☁️', label: 'Cloud' },
			{ icon: '🗜️', label: 'Compress' },
			{ icon: '💾', label: 'Save' },
			{ icon: '🧬', label: 'Logic' },
			{ icon: '🧵', label: 'Thread' },
			{ icon: '🧿', label: 'Monitor' },
			{ icon: '📡', label: 'Connection' },
			{ icon: '🔌', label: 'Integration' },
			{ icon: '🪄', label: 'Automation' },
			{ icon: '🧑‍💻', label: 'Development' },
			{ icon: '📐', label: 'Design' },
			{ icon: '📏', label: 'Measure' },
			{ icon: '🧭', label: 'Navigation' },
			{ icon: '🪪', label: 'Identity' },
		],
	},
];

export const DEFAULT_SETTINGS: BoardSettings = {
	version: 1,
	plugin: PLUGIN_ID,
	defaultColumnColor: DEFAULT_COLUMN_COLOR,
	defaultCardColor: DEFAULT_CARD_COLOR,
};

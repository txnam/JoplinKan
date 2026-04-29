import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import { registerCreateKanbanBoardCommand } from './commands/createKanbanBoard';
import { registerKanbanEditor } from './editor/registerKanbanEditor';

joplin.plugins.register({
	onStart: async () => {
		const versionInfo = await joplin.versionInfo();
		const createCommandName = await registerCreateKanbanBoardCommand();
		await registerKanbanEditor();

		if (versionInfo.platform === 'desktop') {
			await joplin.views.menus.create('joplinkan-menu', 'JoplinKan', [
				{ commandName: createCommandName },
			], MenuItemLocation.Tools);
		}

		try {
			await joplin.views.toolbarButtons.create(
				'joplinkan-create-board-toolbar-button',
				createCommandName,
				versionInfo.platform === 'desktop' ? ToolbarButtonLocation.NoteToolbar : ToolbarButtonLocation.EditorToolbar,
			);
		} catch (error) {
			console.warn('Could not create the JoplinKan toolbar button:', error);
		}
	},
});


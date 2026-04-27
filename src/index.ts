import joplin from 'api';
import { MenuItemLocation, ToolbarButtonLocation } from 'api/types';
import { registerCreateKanbanBoardCommand } from './commands/createKanbanBoard';
import { registerKanbanEditor } from './editor/registerKanbanEditor';

joplin.plugins.register({
	onStart: async () => {
		const createCommandName = await registerCreateKanbanBoardCommand();
		await registerKanbanEditor();

		await joplin.views.menus.create('joplinkan-menu', 'JoplinKan', [
			{ commandName: createCommandName },
		], MenuItemLocation.Tools);

		await joplin.views.toolbarButtons.create(
			'joplinkan-create-board-toolbar-button',
			createCommandName,
			ToolbarButtonLocation.NoteToolbar,
		);
	},
});


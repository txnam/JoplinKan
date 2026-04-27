import joplin from 'api';
import { ToastType } from 'api/types';
import { createDefaultBoard } from '../markdown/defaultBoard';
import { serializeBoard } from '../markdown/serializeBoard';

const COMMAND_NAME = 'joplinkanCreateBoard';

export async function registerCreateKanbanBoardCommand(): Promise<string> {
	await joplin.commands.register({
		name: COMMAND_NAME,
		label: 'Create Kanban Board',
		iconName: 'fas fa-columns',
		execute: async () => {
			const folder = await joplin.workspace.selectedFolder();
			const board = createDefaultBoard();
			const body = serializeBoard(board);

			const noteData: Record<string, unknown> = {
				title: 'Kanban Board',
				body,
			};

			if (folder?.id) {
				noteData.parent_id = folder.id;
			}

			const note = await joplin.data.post(['notes'], null, noteData);

			try {
				await joplin.commands.execute('openNote', note.id);
				await joplin.commands.execute('showEditorPlugin');
			} catch (error) {
				console.warn('Could not open the Kanban editor automatically:', error);
			}

			await joplin.views.dialogs.showToast({
				message: 'Created a new Kanban board.',
				type: ToastType.Success,
			});
		},
	});

	return COMMAND_NAME;
}

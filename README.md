# JoplinKan

JoplinKan is a Joplin plugin for creating and editing Kanban boards directly inside Markdown notes. The board data stays in the note body, so the note remains readable even when the plugin is not active.

## Features

- Create a starter Kanban board from the Tools menu.
- Open Kanban notes in a Joplin alternative editor.
- Use H1 headings as columns and top-level list items as cards/tasks.
- Store colors with short markers such as `[[#cffafe]]` or `[[red]]`.
- Drag cards between columns or reorder them within a column.
- Drag columns to reorder the board.
- Add, edit, delete, and color columns and cards.
- Copy Unicode icons from the editor toolbar for use in card or column text.
- Save all board changes back to Markdown.

## Development

```powershell
npm install
npm test
npm run build
```

After building, point Joplin Development Mode to this plugin root directory.

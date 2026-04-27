export function editorHtml(): string {
	return '<!doctype html>\n' +
		'<html>\n' +
		'<head>\n' +
		'<meta charset="utf-8">\n' +
		'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
		'</head>\n' +
		'<body>\n' +
		'<div id="app" class="app-shell">\n' +
		'<div class="loading">Loading Kanban board...</div>\n' +
		'</div>\n' +
		'</body>\n' +
		'</html>';
}

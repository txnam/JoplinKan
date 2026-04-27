import { Board, DEFAULT_SETTINGS } from './types';

export function createDefaultBoard(): Board {
	return {
		version: 1,
		settings: { ...DEFAULT_SETTINGS },
		columns: [
			{
				id: 'backlog',
				title: 'This week',
				body: '',
				color: '#94a3b8',
				icon: '',
				cards: [
					{
						id: 'task-001',
						title: 'Prepare and send out client invoices',
						body: '',
						color: '#bfdbfe',
						icon: '',
					},
					{
						id: 'task-002',
						title: 'Research market trends',
						body: '',
						color: '#d9f99d',
						icon: '',
					},
					{
						id: 'task-003',
						title: 'Customer reported performance issue',
						body: '',
						color: '#fecdd3',
						icon: '',
					},
				],
			},
			{
				id: 'doing',
				title: 'In progress',
				body: '',
				color: '#2563eb',
				icon: '',
				cards: [
					{
						id: 'task-004',
						title: 'Organize team-building event',
						body: '',
						color: '#e9d5ff',
						icon: '',
					},
					{
						id: 'task-005',
						title: 'Review data pipelines for AI model training',
						body: '',
						color: '#fef3c7',
						icon: '',
					},
				],
			},
			{
				id: 'done',
				title: 'Done',
				body: '',
				color: '#16a34a',
				icon: '',
				cards: [
					{
						id: 'task-006',
						title: 'Share weekly update',
						body: '',
						color: '#dcfce7',
						icon: '',
					},
				],
			},
		],
	};
}

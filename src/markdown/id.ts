export function slugify(value: string): string {
	const slug = value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/đ/g, 'd')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return slug || 'item';
}

export function uniqueId(base: string, usedIds: Set<string>): string {
	let candidate = slugify(base);
	let index = 2;

	while (usedIds.has(candidate)) {
		candidate = `${slugify(base)}-${index}`;
		index += 1;
	}

	usedIds.add(candidate);
	return candidate;
}


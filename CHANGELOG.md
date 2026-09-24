# Changelog

All notable changes to JoplinKan will be documented in this file.

## Unreleased

## 0.6.2

- Removed the extra blank line between a task and ordinary text, bullets, or fenced-code detail. A hard break after the title preserves HTML line layout for text detail.
- Retained separators where Markdown needs them to preserve block structure, including indented code, tables, reference definitions, and ordered lists starting above one.
- Added compact-detail HTML rendering, color preservation, and repeated-save regression tests.

## 0.6.1

- Preserve Enter line breaks in detail paragraphs when rendered as HTML, using explicit Markdown hard breaks independently of the soft-break setting.
- Separate detail from its task title with a blank line and hide technical trailing spaces in the editable model.
- Preserve list structure, code, tables, HTML blocks, and existing explicit breaks; add render and repeated-save regression tests.

## 0.6.0

- Fixed detail indentation across Markdown/legacy H2 parsing, editing, and repeated saves; preserve unknown color markers, extra settings, and fenced code.
- Added per-note save queues, retained drafts, retry, and external-change recovery through saving a copy or explicitly reloading.
- Added 68 colors in Standard, Extra, Nature, Sea & sky, and Warm groups. Extra replaces Original and omits eight near-duplicates of Standard; existing note colors remain valid.
- Hide common detail indentation in the view and editor while restoring it when saving Markdown.
- Added a compact corner chevron to expand/collapse details beyond four lines on screens at least 768px wide. Phones show full detail without the toggle.
- Added automated Markdown, palette, detail projection, save queue, and editor integration tests.

## 0.5.0

- Fixed Kanban board scroll position resetting when opening column or task menus.
- Made task text and detail selectable without starting drag-and-drop.
- Added a task detail editor from the task menu.
- Improved task detail indentation handling when saving Markdown.

## 0.4.0

- Switched the Kanban editor registration to `joplin.views.editors.register` so Joplin can create editor views for separate note windows.
- Added mobile-safe startup handling by avoiding desktop-only menu registration on mobile.
- Set the mobile minimum app version to Android 3.0.1, the first Android release with plugin support.

## 0.3.0

- Added mobile platform support metadata to the plugin manifest.
- Added per-column task sorting in ascending and descending order.

## 0.2.1

- Added release notes for tracking upcoming changes.
- Updated build dependencies to resolve npm audit warnings.

## 0.2.0

- Added the Kanban alternative editor for Joplin notes.
- Added drag-and-drop support for cards and columns.
- Added board editing controls for columns, cards, colors, and icons.
- Added Markdown serialization for Kanban board data.

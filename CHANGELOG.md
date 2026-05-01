# Changelog

All notable changes to JoplinKan will be documented in this file.

## Unreleased

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

# Publishing JoplinKan 0.6.2

Publishing to GitHub and publishing to the Joplin plugin directory are separate steps. Joplin discovers plugins published to npm. A GitHub release provides the `.jpl` download for manual installation.

## 1. Prepare the release

Open PowerShell in the project directory:

```powershell
Set-Location C:\Project\JoplinKan
git pull --ff-only origin main
npm ci
npm test
npm run typecheck
npm run build
```

Run each command in order and stop if one fails. Build after committing the release changes so the generated plugin metadata points to the correct commit. `package.json`, `package-lock.json`, and `src/manifest.json` should all specify `0.6.2`.

## 2. Inspect what npm will upload

```powershell
npm pack --dry-run
```

Confirm the package is `joplin-plugin-joplinkan@0.6.2` and includes:

- `publish/com.github.txnam.joplinkan.jpl`
- `publish/com.github.txnam.joplinkan.json`
- `README.md`, `CHANGELOG.md`, `LICENSE`, and `package.json`

Source code, tests, local browser artifacts, and `node_modules` should not be included.

## 3. Sign in to npm

```powershell
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

Complete the browser login and any authentication prompts. Use the npm account that has publishing rights for `joplin-plugin-joplinkan`; this is separate from GitHub authentication.

## 4. Publish 0.6.2

```powershell
npm view joplin-plugin-joplinkan versions --json
```

If `0.6.2` already exists, do not try to overwrite it. Verify that published version, or choose a new version consistently in all version files for a subsequent release.

If it is not published yet:

```powershell
npm publish --access public --registry=https://registry.npmjs.org/
```

Complete any browser/OTP prompt. The successful result should identify `joplin-plugin-joplinkan@0.6.2`.

## 5. Verify npm

```powershell
npm view joplin-plugin-joplinkan@0.6.2 version
npm view joplin-plugin-joplinkan dist-tags --json
```

The version should be `0.6.2`, and the `latest` tag should point to it. Check the [npm package page](https://www.npmjs.com/package/joplin-plugin-joplinkan).

## 6. Create the GitHub release

1. Open [New release](https://github.com/txnam/JoplinKan/releases/new).
2. Select or create the tag `v0.6.2`, targeting the release commit on `main`.
3. Set the title to **JoplinKan 0.6.2**.
4. Describe the changes since 0.5.0 (the 0.6.0, 0.6.1, and 0.6.2 sections of `CHANGELOG.md`).
5. Attach `publish/com.github.txnam.joplinkan.jpl`. You may also attach its companion `.json`.
6. Publish as a normal release, not a prerelease, and mark it as the latest release where that option is available.

Suggested release summary:

- 68 colors across Standard, Extra, Nature, Sea & sky, and Warm.
- Cleaner detail indentation and compact expand/collapse controls on larger screens.
- Preserved line breaks in HTML, with compact task/detail Markdown.
- Per-note save queues, retry, and recovery for detected external changes.
- Markdown preservation and automated regression coverage.

## 7. Check the Joplin directory

Joplin's repository automation will pick up eligible npm publications; the update is not immediate. Check the [JoplinKan listing](https://joplinapp.org/plugins/plugin/com.github.txnam.joplinkan/) and Joplin's plugin settings for version `0.6.2`. If it is not listed yet, the GitHub `.jpl` remains available for manual installation.

This project meets the discovery requirements: the npm name starts with `joplin-plugin-`, the keywords include `joplin-plugin`, and `publish/` contains both the `.jpl` and `.json`.

## Official references

- [Joplin plugin publishing](https://github.com/laurent22/joplin/blob/dev/packages/generator-joplin/generators/app/templates/GENERATOR_DOC.md#publishing-the-plugin)
- [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
- [npm login](https://docs.npmjs.com/cli/v11/commands/npm-login/)

# Overwatch Highlight Archive

[简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

An unofficial Windows manager for exported Overwatch highlight videos. Organize your best plays with hero labels, game modes, dates, notes, and favorites, then create compressed copies for sharing.

![App icon](assets/app-icon.png)

## Download and install

Open **[the latest GitHub Release](https://github.com/nen725/overwatch-highlight-archive/releases/latest)** and choose:

| File | Purpose |
| --- | --- |
| `OverwatchHighlightArchive-Setup-1.2.0-x64.exe` | Recommended installer. Choose a destination, create desktop and Start menu shortcuts, and uninstall through Windows. |
| `OverwatchHighlightArchive-Portable-1.2.0-x64.exe` | Run directly without installation. |
| `SHA256SUMS.txt` | SHA-256 checksums for the downloads. |

For 64-bit Windows 10/11. Node.js and FFmpeg are included. The installer supports Simplified Chinese, English, Japanese, and Korean. The application is not code signed; verify its download source and checksum against the Release assets.

The installer uses a per-user location without administrator rights. Close the old version before upgrading. Installer and portable editions share the same archive data. Recreate shortcuts that still point to an older executable, and unpin/re-pin old taskbar entries.

## Features

- Detect the default highlight directory or watch multiple custom folders, scanning subfolders every 12 seconds.
- Extract thumbnails, duration, resolution, codec, file size, and creation time.
- Play videos; edit titles, heroes, modes, dates, notes, and favorites; search and filter your library.
- Update hero names, roles, and portraits from Settings; bundled names work offline in four languages.
- Batch-create H.264/AAC MP4 copies at up to 720p or 1080p, with progress and cancellation.
- Chinese, English, Japanese, and Korean interface. On first launch, use the preferred Windows system language; unsupported languages fall back to English. Manual changes apply immediately and persist after restart.
- Consistent icons for the launcher, application, default shortcuts, and window.

## How to use

1. **Export a video first.** Save a highlight as a video in Overwatch. The app does not read in-game replay codes or automatically record gameplay.
2. **Add its folder.** On first launch, the app looks for `Overwatch\videos\overwatch` under Windows Documents and the game's configured `VideoPath`. If needed, choose **Add video folder** and select the actual location.
3. **Review and organize.** Open a card to play the video or edit its details. Hero and mode are inferred from filenames when possible, without visual AI recognition. File creation time may differ from match time and can be edited.
4. **Save notes and favorites.** Enter notes in the details window and save. Notes appear under the video card. Your titles and notes are never translated when you change the interface language.
5. **Create share copies.** Select videos, choose **Compact · 720p** or **High quality · 1080p**, and choose an output folder. Each output receives a unique filename; originals remain untouched.
6. **Change language or update heroes.** Open **Settings** and select a display language, or choose **Update hero data**. Updates need a connection; cached data remains available if they fail.

## Storage and limitations

- Archive and preferences: `%APPDATA%\overwatch-highlights-manager\library.json`; thumbnails are in the adjacent `thumbnails` folder. Back up the entire directory to preserve notes, favorites, and language settings.
- Videos stay in their original folders. Videos and notes are not uploaded. Network requests retrieve hero data and portraits.
- Supported containers: MP4, WebM, MKV, AVI, and MOV. Some codecs cannot be played inside the app; use a system player or generate an H.264 copy.
- Compression never upscales the source. Output size depends on the source encoding and content and is not always smaller.
- Closing the app stops compression. The queue is not restored after restart; interrupted work may leave an incomplete copy.
- Videos are identified by absolute path. Moving or renaming a file leaves the old entry offline and creates a new entry; notes are not merged automatically.
- Removing a watched folder or uninstalling does not delete source videos. The installer preserves archive data by default; back it up before manually clearing the directory above.
- Hero updates depend on upstream availability and may lag behind game releases.

## Development

Use Node.js 22.12 or newer on Windows:

```powershell
npm ci
npm run check
npm start
npm run pack
```

Installer and portable builds are written to `release/`. The repository excludes personal archives, videos, dependencies, and release binaries. Interface translations live in `i18n.js`; offline hero names are in `assets/hero-names.json`.

## Sources and notices

Hero data primarily comes from the [official Overwatch China website](https://ow.blizzard.cn/heroes/), with [OverFast API](https://overfast-api.tekrop.fr/) providing fallback data and localized names. This unofficial community tool is not affiliated with Blizzard Entertainment. Overwatch names, characters, and artwork belong to their respective owners. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for bundled components and sources.

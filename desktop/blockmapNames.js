/**
 * Give the Mac zips' blockmaps the name the updater asks for.
 *
 * "Every Mac downloads the full 140 MB each time, because the file that lets
 * it fetch only the changes is uploaded under the wrong name."
 *
 * A blockmap is the list of pieces a download is made of. With the old
 * version's list and the new one's, a computer fetches only the pieces that
 * changed: about 21 MB of a 140 MB Mac zip between two releases, by the real
 * blockmaps of 1.87.27 and 1.87.28. Without either list it fetches the lot.
 *
 * electron-updater asks for the zip's own name with `.blockmap` on the end:
 *
 *   .../download/v1.87.28/Fractal-Remote-1.87.28-arm64-mac.zip.blockmap
 *
 * and every Mac release has answered 404 there, because the file was
 * uploaded as Fractal.Remote-1.87.28-arm64-mac.zip.blockmap. electron-builder
 * 25 (and 26) makes the Mac zip's blockmap in ArchiveTarget, which hands
 * createBlockmap the zip's RAW name, "Fractal Remote-1.87.28-arm64-mac.zip",
 * space and all, while the zip itself gets its safe name with a dash. The
 * GitHub publisher uploads under that raw name, and GitHub turns a space in
 * an asset name into a dot. So the zip and its blockmap end up spelled two
 * ways, and the updater, finding no list, falls back to the full download
 * ("Cannot download differentially, fallback to full download"): nothing
 * breaks, which is why nobody noticed.
 *
 * electron-builder runs this hook (artifactBuildCompleted in
 * electron-builder.yml) on every file it makes, just before it is uploaded,
 * on the same object the upload then reads its name from. So this mends the
 * name where it goes wrong: a blockmap whose upload name has a space gets a
 * dash instead, the same spelling electron-builder gives the zip itself
 * (computeSafeArtifactNameIfNeeded). Everything else is left exactly as it
 * was: the zips, the disk images and their blockmaps (already right), the
 * Windows installer's blockmap (already right), the AppImages (their
 * blockmap is inside them) and the .debs.
 *
 * Not in the app: electron-builder.yml's `files` is an allowlist and this
 * is not on it. It shapes the release, not what is installed.
 *
 * The releases made before this keep the dotted names, and a computer asks
 * for the OLD version's blockmap too; scripts/rename-blockmaps.mjs renames
 * those on GitHub.
 */
const { basename } = require('node:path')

exports.default = function blockmapNames(event) {
  if (!event || typeof event.file !== 'string' || !event.file.endsWith('.blockmap')) return
  const name = event.safeArtifactName || basename(event.file)
  if (name.includes(' ')) event.safeArtifactName = name.replace(/ /g, '-')
}

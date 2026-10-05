<div align="center">
  <div><code>obsidian-paste-image</code></div>
  <div>obsidian plugin to better-control image paste behaviour</div>
</div>

<!-- spacer -->
<img height="20px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

Copying an image can put both a URL and image data on the clipboard. Paste Image prefers the actual image, even when a text or URL representation comes first.

Run `paste-image` or tap the image ribbon button in an editable note. In the dialog, tap and hold the editable field and choose the system **Paste** action. On desktop, focus the field and paste normally. The image is then passed to Obsidian's editor paste handling so attachment settings and other image plugins can participate.

If the native clipboard contains only an HTTP(S) image URL, the command checks it with HEAD and downloads the image, with a short loading notice. Servers that reject HEAD with 405 or 501 are checked through GET instead. Downloads must return a supported image type and matching image signature; images larger than 25 MB are rejected. URLs can also come from `text/uri-list` or an HTML image source.

Both optional settings are off by default:

* **Prefer images on paste** handles image files during ordinary editor paste, without the dialog. Text-only and URL-only pastes stay unchanged. Events already handled by Obsidian or another plugin are left alone.
* **Include image source link** adds the available source URL below the image. Set **Source link text** to produce a Markdown link such as `[src](https://example.com/image.jpg)`; leave it blank for the URL itself.

### Why use a native paste dialog?

In our iOS Safari tests, `navigator.clipboard.read()` exposed only `text/uri-list`, even though the clipboard also held a JPEG. Choosing the system Paste action in an editable field exposed both the URL and the actual image file. We then confirmed this in iOS Obsidian: both the editor and our dialog received an `image/jpeg` file, and the dialog passed it to the editor without downloading the URL. Desktop testing also confirmed native image handling and the URL-download fallback.

The command therefore uses a real editable field and reads its native `paste` event rather than trying to read the clipboard programmatically. It captures text and file references synchronously, checks all available image files before considering a download, and preserves `text/uri-list` support. The extra paste gesture is intentional: in our tests it exposed image data that a direct clipboard read missed. Other apps and OS versions may expose different formats, and other plugins can choose how to handle the forwarded paste.

Temporary diagnostic panels and clipboard logging have been removed. Clipboard contents are processed only for the requested paste; the plugin keeps no diagnostic history. Network requests are made only when the command receives a URL without an image file.

MIT

<div align="center">
  <div><code>obsidian-paste-image</code></div>
  <div>paste the <i>actual image</i> into obsidian</div>
</div>
<div align="center">
  <br> <br>
  <br> <br>
</div>

After clicking **'Copy Image'** - to paste into Obsidian, it often pastes the **URL of the image**.

This is frustrating because it seems to change arbitrarily on different applications and even different websites. Obsidian seems more idiosyncratic than other applications that reliably paste an image.

This plugin provides a command to paste the actual image binary in your clipboard. This is not as simple as you'd think. Like everything else - the clipboard is more complicated than you assume.

### Usage

This plugin has three features, all optional, and all default off:

1. a **Paste Image** command, you can run whenever you want
2. a _**ribbon button**_ for mobile, so you can one-click binary paste
3. a _**paste-event interceptor**_ so this becomes the default obsidian behaviour (default off)

### Process

In all cases, it looks for an image binary in a clipboard, first. This is the easiest win.

Failing that, the plugin looks for a 'Rich Text' Image url in any html-formatted clipboard items.

Third, it looks for `"text/uri-list"` and `"text/plain"` clipboard items that resemble image urls

In either case, it fetches the url HEAD to see the url if it is `Content-Type` :`image/*`, and downloads the image to binary, so it can be pasted.

In short, you can copy `'https://example.com/image.jpg'` then the paste-image command will paste it into your obsidian note.

### Settings

The _Source Link_ stuff lets you keep the url, as well as the image, and optionally format it as a markdown link.

If you hook it up to work on every paste event, it may interfere with any downstream plugins that are also using the paste event.

<div align="center">
  <br> <br>
</div>

### Details

When you copy something to the clipboard, it can store several formats of your copied item. This way, the destination application can choose the preferred format.

You can see the different formats with a [clipboard inspector](https://tools.spencermountain.dev/web/clipboard)

Different applications and even different browsers have different output here, particularly with custom ordering and formatting decisions.

It's not as simple as cherry-picking which clipboard item either - more complexity shows-up when we're dealing with native clipboard events on mobile, and translation to browser-events. There's intentional differences between web clipboard and the native mobile clipboards, often for security reasons. Moving random binary between applications is a rightfully-spooky thing. Obsidian is a web application - and these paste-events are translated in this lossy, opaque way.

It needs to work on mobile, so it does not use the Electron native clipboard module.

Anyways, this plugin just tries its best. Please let me know if it ever screws-up.

When i click 'copy image' it should copy the darn image.

MIT - PRs welcome

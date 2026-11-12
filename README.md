<div align="center">
  <div><code>obsidian-paste-image</code></div>
  <div>paste the _actual image_ into obsidian</div>
</div>
<div align="center">
  <img width="400" height="8" alt="image" src="https://github.com/user-attachments/assets/82e03747-76c1-4ba1-bdcd-6e71f7b359da" />
  <br> <br>
  <br> <br>
</div>

I often find myself clicking **'Copy Image'** - to paste into Obsidian, and it does not paste the image, but the _URL of the image_.

This is frustrating because this behaviour seems to change arbitrarily on different applications and even websites. Obsidian even seems idiosyncratic here, more than other applications that reliably paste an image that you've explicity chosen to copy.

This plugin provides a command to paste the actual image binary in your clipboard. This is not as simple as you'd think. Like everything else - the clipboard is more complicated than you assume.

### Usage

This plugin has three features, all optional, and all default off:

- 1. a **Paste Image** command, you can run whenever you want
- 2. a _**ribbon button**_ for mobile, so you can one-click binary paste
- 3. a _**paste-event interceptor**_ so this becomes the default obsidian behaviour (default off)

In all cases, it looks for an image binary in a clipboard, first. This is the easiest win.

Failing that, the plugin looks for a 'Rich Text' Image url in any html-formatted clipboard items.

Third, it looks for `"text/uri-list"` and `"text/plain"` clipboard items that resemble image urls

In either case, it fetches the url HEAD to see the url if it is `Content-Type` :`image/*`, and downloads the image to binary, so it can be pasted.

In short, you can copy `'https://example.com/image.jpg'` then the paste-image command will paste it into your obsidian note.

### Settings

<img width="1296" height="664" alt="2026-11-12 T 10 08 13@2x" src="https://github.com/user-attachments/assets/db4cf632-2fc2-4c43-b7f3-9836b129d234" />

### Details

When you copy something to the clipboard, it can store several formats of your copied item. This way, the destination application can choose the preferred format.

You can see the different formats with a [clipboard inspector](https://tools.spencermountain.dev/web/clipboard).
<img width="1000" height="980" alt="2026-11-12 T 10 24 54@2x" src="https://github.com/user-attachments/assets/50bf6ccc-1364-4725-a66e-d0573d57f9ea" />

Different applications and even different browsers have different output here, particularly with the ordering and formatting of these items.

It's not as simple as cherry-picking which clipboard item. More complexity shows-up when we're dealing with native clipboard events on mobile, and translation to browser-events. There's intentional differences between web clipboard and the native mobile clipboards, often for security reasons. Moving random binary between applications is a rightfully-spooky thing. Obsidian is a web application - and these paste-events are translated in this lossy, opaque way.

Anyways, this plugin just tries its best. Please let me know if it ever screws-up.

When i click 'copy image' it should copy the darn image.

MIT - PRs welcome

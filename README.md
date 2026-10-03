<div align="center">
  <div><code>obsidian-paste-image</code></div>
  <div>obsidian plugin to better-control image paste behaviour</div>
</div>

<!-- spacer -->
<img height="20px" src="https://user-images.githubusercontent.com/399657/68221862-17ceb980-ffb8-11e9-87d4-7b30b6488f16.png"/>

In many contexts, but in mobile-browsers in particular, `Copy Image` doesn't seem to mean copying the image binary to clipboard anymore. So this often means pasting a url for an image, in obsidian, which may not be what you intended.

Even photos from the ios share-sheet seem to reproduce this behaviour.

This plugin tries to remedy this in a few different ways, all optional:

* a `Paste Image` command, that can be run anytime
* a matching button for the mobile ribbon, for this command
* a setting to intercept app paste events, and priortize actual images, over image urls



MIT

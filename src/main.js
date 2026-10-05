import { Plugin, MarkdownView, Notice } from 'obsidian';
import { snapshotClipboard, eventClipboard } from './clipboard_lib.js';
import { downloadImage } from './image_lib.js';
import { DEFAULT_SETTINGS, PasteImageSettings } from './settings.js';
import { captureEditor, checkEditor, pasteFiles } from './paste_lib.js';
import readClipboard from './read-clipboard.js';

class PasteImagePlugin extends Plugin {
  async onload() {
    const stored = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
    this.settings.linkText = String(this.settings.linkText || '');
    this.busy = false;
    this.stopped = false;
    this.forwardedEvents = new WeakSet();
    this.addCommand({
      id: 'paste-image',
      name: 'paste-image',
      icon: 'image',
      editorCallback: () => this.pasteFromClipboard(),
    });
    this.addRibbonIcon('image', 'Paste image', () => this.pasteFromClipboard());
    this.addSettingTab(new PasteImageSettings(this.app, this));
    this.registerEvent(this.app.workspace.on('editor-paste', (event, editor) => this.intercept(event, editor)));
  }

  onunload() {
    this.stopped = true;
  }

  intercept(event, editor) {
    if (event.defaultPrevented || this.forwardedEvents.has(event) || !event.clipboardData ||
        this.busy || (!this.settings.preferImages && !this.settings.appendSource)) {
      return;
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || view.editor !== editor || view.getMode() !== 'source' ||
        editor.listSelections().length !== 1) {
      return;
    }
    let data;
    try {
      data = eventClipboard(snapshotClipboard(event.clipboardData));
    } catch {
      // Leave ordinary paste intact if this clipboard cannot be read.
      return;
    }
    if (!data.files.length || (!this.settings.preferImages && !data.url)) {
      return;
    }
    const context = captureEditor(view);
    // Only claim the event once we have image files and a supported target.
    event.preventDefault();
    void this.run(data, context);
  }

  pasteFromClipboard() {
    if (this.busy) {
      new Notice('An image is already loading…', 2000);
      return;
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || view.getMode() !== 'source') {
      new Notice('Open a note in editing mode before pasting an image.', 3500);
      return;
    }
    if (view.editor.listSelections().length !== 1) {
      new Notice('Use a single cursor or selection to paste an image.', 3500);
      return;
    }
    void this.run(null, captureEditor(view));
  }

  async run(data, context) {
    if (this.busy || this.stopped) {
      return;
    }
    this.busy = true;
    let loading;
    try {
      checkEditor(this, context);
      if (!data) {
        const clipboard = context.view.containerEl.ownerDocument.defaultView.navigator.clipboard;
        data = await readClipboard(clipboard);
        checkEditor(this, context);
      }
      if (!data.files.length) {
        if (!data.url) {
          let message = 'Clipboard is empty or contains no readable image.';
          if (data.hasText) {
            message = 'Clipboard contains text, not an image or an image URL.';
          }
          throw new Error(message);
        }
        loading = new Notice('Loading image…', 2500);
        data.files = [await downloadImage(data.url)];
      }
      checkEditor(this, context);
      await pasteFiles(this, context, data.files, data.url);
    } catch (error) {
      if (!this.stopped) {
        new Notice(error.message || 'Could not paste the image. Check your connection and try again.', 4500);
      }
    } finally {
      loading?.hide();
      this.busy = false;
    }
  }
}

export default PasteImagePlugin;

import { Plugin, MarkdownView, Notice } from 'obsidian';
import { eventClipboard } from './clipboard_lib.js';
import { downloadImage } from './image_lib.js';
import { DEFAULT_SETTINGS, PasteImageSettings } from './settings.js';
import { captureEditor, checkEditor, pasteFiles } from './paste_lib.js';
import { PasteDiagnostics, DiagnosticsModal } from './diagnostics.js';
import NativePasteModal from './native-paste.js';

class PasteImagePlugin extends Plugin {
  async onload() {
    const stored = await this.loadData();
    this.settings = { ...DEFAULT_SETTINGS, ...stored };
    this.settings.linkText = String(this.settings.linkText || '');
    this.busy = false;
    this.stopped = false;
    this.forwardedEvents = new WeakSet();
    this.diagnostics = new PasteDiagnostics();
    this.addCommand({
      id: 'paste-image',
      name: 'paste-image',
      editorCallback: () => this.openNativePaste(),
    });
    this.addCommand({
      id: 'show-paste-diagnostics',
      name: 'Show paste diagnostics',
      callback: () => {
        if (!this.diagnosticsModal) {
          this.diagnosticsModal = new DiagnosticsModal(this);
          this.diagnosticsModal.open();
        }
      },
    });
    this.addRibbonIcon('image-plus', 'Paste image', () => this.openNativePaste());
    this.addSettingTab(new PasteImageSettings(this.app, this));
    this.registerEvent(this.app.workspace.on('editor-paste', (event, editor) => this.intercept(event, editor)));
  }

  onunload() {
    this.stopped = true;
    this.nativePasteModal?.close();
    this.diagnosticsModal?.close();
    this.diagnostics.clear();
  }

  intercept(event, editor) {
    const { record, snapshot } = this.diagnostics.capture(event, 'editor-paste');
    if (record.initialDefaultPrevented) {
      this.diagnostics.update(record, 'already-prevented');
      return;
    }
    if (this.forwardedEvents.has(event)) {
      this.diagnostics.update(record, 'forwarded-image-pass-through');
      return;
    }
    if (!snapshot) {
      return;
    }
    if (!this.settings.preferImages && !this.settings.appendSource) {
      this.diagnostics.update(record, 'logging-only');
      return;
    }
    if (this.busy) {
      this.diagnostics.update(record, 'busy-pass-through');
      return;
    }
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || view.editor !== editor || view.getMode() !== 'source' ||
        editor.listSelections().length !== 1) {
      this.diagnostics.update(record, 'unsupported-editor-pass-through');
      return;
    }
    let data;
    try {
      data = eventClipboard(snapshot);
    } catch (error) {
      this.diagnostics.update(record, 'clipboard-error-pass-through', error.message);
      return;
    }
    if (!data.files.length || (!this.settings.preferImages && !data.url)) {
      this.diagnostics.update(record, 'ordinary-paste-pass-through');
      return;
    }
    const context = captureEditor(view);
    // Only claim the event once we have image files and a supported target.
    event.preventDefault();
    this.diagnostics.update(record, 'image-paste-claimed');
    void this.run(data, context, record);
  }

  openNativePaste() {
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
    if (!this.nativePasteModal) {
      this.nativePasteModal = new NativePasteModal(this, captureEditor(view));
      this.nativePasteModal.open();
    }
  }

  async run(data, context, record) {
    if (this.busy || this.stopped) {
      this.diagnostics.update(record, 'cancelled');
      return;
    }
    this.busy = true;
    let loading;
    try {
      checkEditor(this, context);
      if (!data.files.length) {
        if (!data.url) {
          this.diagnostics.update(record, 'no-image-or-url');
          let message = 'Clipboard is empty or contains no readable image.';
          if (data.hasText) {
            message = 'Clipboard contains text, not an image or an image URL.';
          }
          throw new Error(message);
        }
        this.diagnostics.update(record, 'url-download');
        loading = new Notice('Loading image…', 2500);
        data.files = [await downloadImage(data.url)];
      } else {
        this.diagnostics.update(record, 'native-image-files');
      }
      checkEditor(this, context);
      const delivery = await pasteFiles(this, context, data.files, data.url);
      this.diagnostics.update(record, delivery);
    } catch (error) {
      this.diagnostics.update(record, 'error', error.message || String(error));
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

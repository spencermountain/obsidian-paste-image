import { Modal, Notice } from 'obsidian';
import { snapshotClipboard, eventClipboard } from './clipboard_lib.js';

class NativePasteModal extends Modal {
  constructor(plugin, context) {
    super(plugin.app);
    this.plugin = plugin;
    this.context = context;
    this.shouldRestoreSelection = true;
  }

  onOpen() {
    this.titleEl.setText('Paste image');
    this.contentEl.createEl('p', { text: 'Tap and hold in the field below, then choose the system Paste action. On desktop, focus the field and paste normally.' });
    const field = this.contentEl.createDiv({ attr: {
      contenteditable: 'true', role: 'textbox', tabindex: '0',
      'aria-label': 'Native image paste field', spellcheck: 'false',
    } });
    field.style.minHeight = '5em';
    field.style.border = '1px solid var(--background-modifier-border)';
    field.style.padding = '1em';
    field.textContent = 'Tap here, then paste';
    field.addEventListener('paste', event => this.handlePaste(event));
    field.focus();
  }

  handlePaste(event) {
    const { plugin } = this;
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    if (plugin.busy) {
      new Notice('An image is already loading…', 2000);
      return;
    }
    let data;
    try {
      // The native event exposes iOS image files that clipboard.read() can omit.
      data = eventClipboard(snapshotClipboard(event.clipboardData));
    } catch (error) {
      new Notice(error.message || 'Could not read the pasted image. Try again.', 3500);
      return;
    }
    // Closing restores the note's selection before handing off the image.
    this.close();
    void plugin.run(data, this.context);
  }

  onClose() {
    this.contentEl.empty();
    this.plugin.nativePasteModal = null;
  }
}

export default NativePasteModal;

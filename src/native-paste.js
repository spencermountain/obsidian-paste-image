import { Modal, Notice } from 'obsidian';
import { eventClipboard } from './clipboard_lib.js';
import { diagnosticsPanel } from './diagnostics.js';

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
    this.contentEl.createEl('p', { text: 'After insertion, use “Show paste diagnostics” to inspect or copy the result, including editor-paste events.' });
    this.disposePanel = diagnosticsPanel(this.contentEl, this.plugin.diagnostics);
    field.focus();
  }

  handlePaste(event) {
    const { plugin } = this;
    // Capture the original prevented state and all data within this event turn.
    const { record, snapshot } = plugin.diagnostics.capture(event, 'modal-paste');
    event.preventDefault();
    if (record.initialDefaultPrevented) {
      plugin.diagnostics.update(record, 'already-prevented');
      return;
    }
    if (!snapshot || plugin.busy) {
      if (plugin.busy) {
        plugin.diagnostics.update(record, 'busy');
        new Notice('An image is already loading…', 2000);
      }
      return;
    }
    let data;
    try {
      data = eventClipboard(snapshot);
    } catch (error) {
      plugin.diagnostics.update(record, 'clipboard-error', error.message);
      return;
    }
    // Closing restores the note's selection before handing off the image.
    this.close();
    void plugin.run(data, this.context, record);
  }

  onClose() {
    this.disposePanel?.();
    this.contentEl.empty();
    this.plugin.nativePasteModal = null;
  }
}

export default NativePasteModal;

import { Modal, Notice } from 'obsidian';
import { snapshotClipboard } from './clipboard_lib.js';

const MAX_RECORDS = 20;
const fileMetadata = file => ({ name: file.name, type: file.type, size: file.size });

class PasteDiagnostics {
  records = [];
  listeners = new Set();

  capture(event, source) {
    const record = {
      source,
      time: new Date().toISOString(),
      initialDefaultPrevented: event.defaultPrevented,
      isTrusted: event.isTrusted,
      clipboardData: null,
      branch: 'captured',
      steps: [],
      error: null,
    };
    let snapshot;
    try {
      snapshot = snapshotClipboard(event.clipboardData);
      record.clipboardData = {
        types: snapshot.types,
        items: snapshot.items.map(({ kind, type, file }) => ({
          kind, type, file: file ? fileMetadata(file) : null,
        })),
        files: snapshot.files.map(fileMetadata),
        ...snapshot.text,
      };
    } catch (error) {
      record.error = error.message;
      record.branch = 'snapshot-error';
    }
    this.records.push(record);
    this.records = this.records.slice(-MAX_RECORDS);
    this.notify();
    return { record, snapshot };
  }

  update(record, branch, error = record.error) {
    record.branch = branch;
    record.steps.push(branch);
    record.error = error;
    this.notify();
  }

  notify() {
    this.listeners.forEach(listener => listener());
  }

  clear() {
    this.records = [];
    this.notify();
  }
}

const diagnosticsPanel = (container, diagnostics) => {
  container.createEl('p', { text: 'Temporary paste diagnostics: last 20 events, kept only in memory. Includes clipboard text and URLs, never file bytes.' });
  const output = container.createEl('textarea', { attr: { rows: '14', 'aria-label': 'Paste diagnostics JSON', readonly: '' } });
  output.style.width = '100%';
  const render = () => { output.value = JSON.stringify(diagnostics.records, null, 2); };
  render();
  diagnostics.listeners.add(render);
  const copy = container.createEl('button', { text: 'Copy diagnostics' });
  copy.addEventListener('click', async () => {
    try {
      await container.ownerDocument.defaultView.navigator.clipboard.writeText(output.value);
      new Notice('Paste diagnostics copied.', 2000);
    } catch {
      output.focus();
      output.select();
      new Notice('Use the system Copy action on the selected JSON.', 3500);
    }
  });
  container.createEl('button', { text: 'Clear diagnostics' }).addEventListener('click', () => diagnostics.clear());
  return () => diagnostics.listeners.delete(render);
};

class DiagnosticsModal extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    this.titleEl.setText('Paste diagnostics');
    this.disposePanel = diagnosticsPanel(this.contentEl, this.plugin.diagnostics);
  }

  onClose() {
    this.disposePanel?.();
    this.contentEl.empty();
    this.plugin.diagnosticsModal = null;
  }
}

export { PasteDiagnostics, diagnosticsPanel, DiagnosticsModal };

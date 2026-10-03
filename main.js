'use strict';

var obsidian = require('obsidian');

const httpUrl = value => {
  const text = value.trim();
  if (!/^https?:\/\/\S+$/i.test(text)) {
    return null;
  }
  try {
    const url = new URL(text);
    if (url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
};

const clipboardSource = (text, html, uriList) => {
  // Parse inert HTML; never attach clipboard markup to the document.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const image = doc.querySelector('img[src]');
  const imageUrl = httpUrl(image?.getAttribute('src') || '');
  const uris = uriList.split(/\r?\n/).filter(line => line && !line.startsWith('#'));
  let uri = null;
  if (uris.length === 1) {
    uri = httpUrl(uris[0]);
  }
  return imageUrl || uri || httpUrl(text);
};

// Copy every live DataTransfer value before the paste handler returns.
const snapshotClipboard = data => ({
  types: Array.from(data?.types || []),
  items: Array.from(data?.items || [], item => ({
    kind: item.kind,
    type: item.type,
    file: item.kind === 'file' ? item.getAsFile() : null,
  })),
  files: Array.from(data?.files || []),
  text: Object.fromEntries(['text/plain', 'text/uri-list', 'text/html'].map(type => [type, data?.getData(type) || ''])),
});

const eventClipboard = snapshot => {
  const files = snapshot.files.filter(file => file.type.startsWith('image/'));
  snapshot.items.forEach(({ file }) => {
    if (file?.type.startsWith('image/') && !files.some(existing =>
      existing.name === file.name && existing.size === file.size && existing.type === file.type)) {
      files.push(file);
    }
  });
  const text = snapshot.text;
  return {
    files,
    url: clipboardSource(text['text/plain'], text['text/html'], text['text/uri-list']),
    hasText: Object.values(text).some(Boolean),
  };
};

const sourceLink = (url, label) => {
  const destination = url.replace(/[<>\\]/g, char => encodeURIComponent(char));
  const title = label.trim().replace(/\s+/g, ' ').replace(/[\\[\]]/g, '\\$&');
  if (title) {
    return `[${title}](<${destination}>)`;
  }
  return `<${destination}>`;
};

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT = 20000;
const IMAGE_EXTENSIONS = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp',
  'image/svg+xml': 'svg', 'image/tiff': 'tiff', 'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

const imageExtension = type => {
  const extension = IMAGE_EXTENSIONS[type.toLowerCase().split(';')[0].trim()];
  if (!extension) {
    throw new Error('This image format is not supported. Try copying a PNG or JPEG.');
  }
  return extension;
};

const imageSize = size => {
  if (size > MAX_IMAGE_BYTES) {
    throw new Error('The image is too large (maximum 25 MB).');
  }
};

const responseHeader = (response, name) => {
  const entry = Object.entries(response.headers).find(([key]) => key.toLowerCase() === name);
  return entry?.[1] || '';
};

const validImageBytes = (buffer, type) => {
  const bytes = new Uint8Array(buffer);
  const prefix = new TextDecoder('latin1').decode(bytes.subarray(0, 64));
  const starts = signature => signature.every((value, index) => bytes[index] === value);
  switch (imageExtension(type)) {
    case 'png': return starts([137, 80, 78, 71, 13, 10, 26, 10]);
    case 'jpg': return starts([255, 216, 255]);
    case 'gif': return /^GIF8[79]a/.test(prefix);
    case 'webp': return prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
    case 'bmp': return prefix.startsWith('BM');
    case 'ico': return starts([0, 0, 1, 0]);
    case 'tiff': return starts([73, 73, 42, 0]) || starts([77, 77, 0, 42]);
    case 'avif': return prefix.slice(4, 8) === 'ftyp' && /avif|avis/.test(prefix.slice(8));
    case 'svg': {
      const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'image/svg+xml');
      return !doc.querySelector('parsererror') && doc.documentElement.localName === 'svg' &&
        doc.documentElement.namespaceURI === 'http://www.w3.org/2000/svg';
    }
    default: return false;
  }
};

const imageRequest = async (url, method) => {
  let timer;
  try {
    // requestUrl bypasses CORS on mobile too, but has no cancellation API.
    return await Promise.race([
      obsidian.requestUrl({ url, method, throw: false }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('The image request timed out. Try again.')), REQUEST_TIMEOUT);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const downloadImage = async url => {
  const head = await imageRequest(url, 'HEAD');
  // Servers that reject HEAD can still provide an image via GET.
  if (![405, 501].includes(head.status)) {
    if (head.status < 200 || head.status >= 300) {
      throw new Error(`Could not check the clipboard URL (HTTP ${head.status}).`);
    }
    if (!responseHeader(head, 'content-type').toLowerCase().startsWith('image/')) {
      throw new Error('The clipboard URL is not an image.');
    }
    imageSize(Number(responseHeader(head, 'content-length')));
  }
  const response = await imageRequest(url, 'GET');
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Could not download the image (HTTP ${response.status}).`);
  }
  const type = responseHeader(response, 'content-type').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) {
    throw new Error('The clipboard URL is not an image.');
  }
  imageExtension(type);
  imageSize(response.arrayBuffer.byteLength);
  if (!response.arrayBuffer.byteLength) {
    throw new Error('The downloaded image is empty.');
  }
  if (!validImageBytes(response.arrayBuffer, type)) {
    throw new Error('The clipboard URL did not return valid image data.');
  }
  return new Blob([response.arrayBuffer], { type });
};

const DEFAULT_SETTINGS = { preferImages: false, appendSource: false, linkText: '' };

class PasteImageSettings extends obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const { settings } = this.plugin;
    containerEl.empty();
    new obsidian.Setting(containerEl)
      .setName('Prefer images on paste')
      .setDesc('Use image files before text or URLs on ordinary paste. Text-only pastes stay unchanged; use the command to download image URLs.')
      .addToggle(toggle => toggle.setValue(settings.preferImages).onChange(async value => {
        settings.preferImages = value;
        await this.plugin.saveData(settings);
      }));
    new obsidian.Setting(containerEl)
      .setName('Include image source link')
      .setDesc('Add the source URL beneath pasted images when the clipboard contains one. Also applies to ordinary image pastes.')
      .addToggle(toggle => toggle.setValue(settings.appendSource).onChange(async value => {
        settings.appendSource = value;
        await this.plugin.saveData(settings);
      }));
    new obsidian.Setting(containerEl)
      .setName('Source link text')
      .setDesc('Optional Markdown link label, such as “Image source”. Leave blank to show the URL.')
      .addText(text => text.setPlaceholder('Image source').setValue(settings.linkText).onChange(async value => {
        settings.linkText = value;
        await this.plugin.saveData(settings);
      }));
  }
}

const captureEditor = view => ({
  view,
  file: view.file,
  editor: view.editor,
  text: view.editor.getValue(),
  selections: view.editor.listSelections(),
});

const checkEditor = (plugin, context) => {
  const { view, file, editor, text, selections } = context;
  if (plugin.stopped || view.file !== file || !view.containerEl.isConnected ||
      plugin.app.workspace.activeEditor?.editor !== editor || editor.getValue() !== text ||
      JSON.stringify(editor.listSelections()) !== JSON.stringify(selections)) {
    throw new Error('The note or cursor changed. Run paste-image again where you want the image.');
  }
};

const pasteFiles = async (plugin, context, blobs, url) => {
  const { view, file, editor } = context;
  const win = view.containerEl.ownerDocument.defaultView;
  const files = blobs.map((blob, index) => {
    imageSize(blob.size);
    if (!blob.size) {
      throw new Error('The clipboard image is empty.');
    }
    const extension = imageExtension(blob.type);
    return new win.File([blob], `Pasted image ${Date.now()}-${index + 1}.${extension}`, { type: blob.type });
  });
  checkEditor(plugin, context);
  editor.focus();
  const target = view.containerEl.ownerDocument.activeElement;
  if (!view.contentEl.contains(target)) {
    throw new Error('Open a note in editing mode before pasting an image.');
  }
  const transfer = new win.DataTransfer();
  files.forEach(image => transfer.items.add(image));
  const event = new win.ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true, composed: true });
  let suffix = '';
  if (plugin.settings.appendSource && url) {
    suffix = `\n${sourceLink(url, plugin.settings.linkText)}\n`;
  }

  // Reserve the source line before native async handlers capture their paste range.
  const end = editor.getCursor('to');
  if (suffix) {
    editor.replaceRange(suffix, end);
    editor.setSelections(context.selections);
  }
  const stagedText = editor.getValue();
  plugin.forwardedEvents.add(event);
  target.dispatchEvent(event);
  if (event.defaultPrevented || editor.getValue() !== stagedText) {
    return 'paste-event-handed-off';
  }
  // Synthetic events have no browser default action. Use public vault APIs if
  // neither Obsidian nor another plugin claims the event.
  if (suffix) {
    editor.replaceRange('', end, editor.offsetToPos(editor.posToOffset(end) + suffix.length));
    editor.setSelections(context.selections);
  }
  checkEditor(plugin, context);
  const links = [];
  for (const image of files) {
    const bytes = await image.arrayBuffer();
    const path = await plugin.app.fileManager.getAvailablePathForAttachment(image.name, file.path);
    checkEditor(plugin, context);
    const attachment = await plugin.app.vault.createBinary(path, bytes);
    // Keep a successfully saved attachment if the user moved away during I/O.
    checkEditor(plugin, context);
    links.push(`!${plugin.app.fileManager.generateMarkdownLink(attachment, file.path)}`);
  }
  editor.replaceSelection(links.join('\n') + suffix);
  return 'vault-attachment-inserted';
};

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
    this.records = this.records.slice(-20);
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
      new obsidian.Notice('Paste diagnostics copied.', 2000);
    } catch {
      output.focus();
      output.select();
      new obsidian.Notice('Use the system Copy action on the selected JSON.', 3500);
    }
  });
  container.createEl('button', { text: 'Clear diagnostics' }).addEventListener('click', () => diagnostics.clear());
  return () => diagnostics.listeners.delete(render);
};

class DiagnosticsModal extends obsidian.Modal {
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

class NativePasteModal extends obsidian.Modal {
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
        new obsidian.Notice('An image is already loading…', 2000);
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

class PasteImagePlugin extends obsidian.Plugin {
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
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
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
      new obsidian.Notice('An image is already loading…', 2000);
      return;
    }
    const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
    if (!view?.file || view.getMode() !== 'source') {
      new obsidian.Notice('Open a note in editing mode before pasting an image.', 3500);
      return;
    }
    if (view.editor.listSelections().length !== 1) {
      new obsidian.Notice('Use a single cursor or selection to paste an image.', 3500);
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
        loading = new obsidian.Notice('Loading image…', 2500);
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
        new obsidian.Notice(error.message || 'Could not paste the image. Check your connection and try again.', 4500);
      }
    } finally {
      loading?.hide();
      this.busy = false;
    }
  }
}

module.exports = PasteImagePlugin;

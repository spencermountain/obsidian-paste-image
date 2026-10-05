import { sourceLink } from './clipboard_lib.js';
import { imageExtension, imageSize } from './image_lib.js';

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
    return;
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
};

export { captureEditor, checkEditor, pasteFiles };

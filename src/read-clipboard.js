import { eventClipboard } from './clipboard_lib.js';

const readClipboard = async clipboard => {
  if (!clipboard) {
    throw new Error('Clipboard access is unavailable on this device.');
  }
  const snapshot = {
    files: [], itemFiles: [],
    text: { 'text/plain': '', 'text/uri-list': '', 'text/html': '' },
  };
  let items;
  if (clipboard.read) {
    try {
      // Start the read in the button's user gesture, before any other await.
      items = await clipboard.read();
    } catch (error) {
      if (error.name !== 'NotSupportedError') {
        throw new Error('Clipboard access was denied. Allow paste access and try again.');
      }
    }
  }
  if (!items) {
    if (!clipboard.readText) {
      throw new Error('This device does not support reading the clipboard.');
    }
    try {
      snapshot.text['text/plain'] = await clipboard.readText();
    } catch {
      throw new Error('Clipboard access was denied. Allow paste access and try again.');
    }
    return eventClipboard(snapshot);
  }
  let unreadable = false;
  for (const item of items) {
    // Types are alternate representations; keep one image per item.
    for (const type of item.types.filter(mime => mime.startsWith('image/'))) {
      try {
        const image = await item.getType(type);
        if (image.size) {
          snapshot.files.push(image);
          break;
        }
      } catch {
        unreadable = true;
      }
    }
    for (const type of Object.keys(snapshot.text)) {
      if (item.types.includes(type)) {
        try {
          snapshot.text[type] += await (await item.getType(type)).text();
        } catch {
          // Missing metadata must not prevent pasting a readable image.
          unreadable = true;
        }
      }
    }
  }
  const data = eventClipboard(snapshot);
  if (unreadable && !data.files.length && !data.url) {
    throw new Error('Could not read the clipboard image or its URL. Try copying the image again.');
  }
  return data;
};

export default readClipboard;

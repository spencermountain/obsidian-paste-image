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

export { snapshotClipboard, eventClipboard, sourceLink };

import { requestUrl } from 'obsidian';

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
      requestUrl({ url, method, throw: false }),
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

export { imageExtension, imageSize, downloadImage };

// Global namespace initialized in template:
// window.ShoppingList.Config - configuration from server
// window.ShoppingList.Items - hash-to-content mapping

function simpleHash(str, counter = 0) {
  const input = counter > 0 ? str + '_' + counter : str;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'item_' + Math.abs(hash).toString(36);
}

function generateUniqueHash(content) {
  let counter = 0;
  let hash = simpleHash(content, counter);

  // Avoid collisions (never override existing items)
  while (window.ShoppingList.Items.hasOwnProperty(hash)) {
    counter++;
    hash = simpleHash(content, counter);
  }

  return hash;
}

function htmlEncode(str) {
  return str.replace(/[&<>"'|]/g, function(match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '|': '&#124;'
    }[match] || match;
  });
}

// We don't want to decode everything
function decodeForClipboard(str) {
  return str.replace(/<br\s*\/?>/gi, "\n")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#124;/g, '|');
}

function isDataUrl(content) {
  return typeof content === 'string' && content.startsWith('data:');
}

function isFileReference(content) {
  return typeof content === 'string' && content.startsWith('file://');
}

function parseFileReference(fileRef) {
  // Format: file://<fileId>::<originalName>::<mimeType>
  if (!isFileReference(fileRef)) return null;

   // Remove "file://" prefix
  const content = fileRef.substring(7);

  // Using :: separator to avoid conflicts with list separator |
  if (content.includes('::')) {
    const parts = content.split('::');
    return {
      fileId: parts[0] || '',
      originalName: parts[1] || 'download',
      mimeType: parts[2] || 'application/octet-stream'
    };
  }

  // Non-files format with | - handle HTML-encoded version
  const decoded = content.replace(/&#124;/g, '|');
  const parts = decoded.split('|');

  if (parts.length >= 1) {
    return {
      fileId: parts[0] || '',
      originalName: parts[1] || 'download',
      mimeType: parts[2] || 'application/octet-stream'
    };
  }

  // Last fallback: treat entire content as fileId
  return {
    fileId: content,
    originalName: 'download',
    mimeType: 'application/octet-stream'
  };
}

function extractMediaType(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match ? match[1] : 'application/octet-stream';
}

function truncateDataUrlForDisplay(dataUrl) {
  if (isDataUrl(dataUrl)) {
    const mediaType = extractMediaType(dataUrl);
    return `📎 File (${mediaType})`;
  }
  if (isFileReference(dataUrl)) {
    const fileInfo = parseFileReference(dataUrl);
    return `📎 ${fileInfo.originalName}`;
  }
  return dataUrl;
}

function downloadDataUrl(dataUrl, filename) {
  const config = window.ShoppingList.Config;

  if (isFileReference(dataUrl)) {
    const fileInfo = parseFileReference(dataUrl);
    // Pass original filename as query parameter so backend can set Content-Disposition header
    const downloadUrl = `${config.baseUrlPath}download-file/${encodeURIComponent(config.listName)}/${encodeURIComponent(fileInfo.fileId)}?filename=${encodeURIComponent(fileInfo.originalName)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileInfo.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function copyToClipboard(target) {
  if (navigator.clipboard && target.dataset.key) {
    const content = window.ShoppingList.Items[target.dataset.key];
    if (content) {
      if (isDataUrl(content) || isFileReference(content)) {
        // Get filename from button attribute or parse from file reference
        let filename = target.dataset.filename;
        if (!filename && isFileReference(content)) {
          const fileInfo = parseFileReference(content);
          filename = fileInfo.originalName;
        }
        downloadDataUrl(content, filename || 'download');
      } else {
        navigator.clipboard.writeText(decodeForClipboard(content));
      }
    }
  }
}

function toggleItem(e) {
  const states = ["btn-default", "btn-warning", "btn-danger", "btn-dark"];
  const actions = ["c", "h", "d", "u"];
  const state = parseInt(e.target.dataset.state, 10);
  const newState = (state+1) % 4;

  e.target.classList.add(states[newState]);
  e.target.classList.remove(states[state]);
  e.target.dataset.state = newState;

  // Copy to clipboard/download if not transitioning to removed state
  if (newState !== 3) {
    copyToClipboard(e.target);
  }

  const itemKey = e.target.dataset.key;
  const content = window.ShoppingList.Items[itemKey];

  saveItemAction(itemKey, actions[state]);

  // Remove button from DOM if it's a file reference reaching deleted state
  if (newState === 3 && content && isFileReference(content)) {
    setTimeout(() => {
      e.target.remove();
      delete window.ShoppingList.Items[itemKey];
    }, 100);
  }
}

function saveItemAction(itemHash, action) {
  const config = window.ShoppingList.Config;
  const itemName = window.ShoppingList.Items[itemHash];
  if (!itemName) {
    console.error('Item not found in data store:', itemHash);
    return;
  }

  // Replace all occurrences of separator with encoded version
  const escapedSeparator = config.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const encodedItemName = itemName.replace(new RegExp(escapedSeparator, 'g'), htmlEncode(config.separator));

  fetch(`${config.baseUrlPath}items/${encodeURIComponent(config.listName)}`, {
    body: encodeURIComponent(`${action}${config.separator}${encodedItemName}`),
    method: "POST",
    headers: {"Content-type": "application/x-www-form-urlencoded; charset=UTF-8"}
  })
  .then((response) => {
    if (!response.ok) {
      throw (new Error(`${response.status} ${response.statusText}`));
    }
  })
  .catch(error => {
    alert(`Error occurred, action might not have been not saved, please reload.\n${error}`);
  });
}

function uploadFileAsItem() {
  const config = window.ShoppingList.Config;
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) return;

  const maxSizeBytes = config.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    alert(`File too large. Maximum size: ${config.maxFileSizeMb}MB`);
    fileInput.value = '';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);
  fetch(`${config.baseUrlPath}upload-file/${encodeURIComponent(config.listName)}`, {
    method: 'POST',
    body: formData
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    // Store file reference using :: separator to avoid conflicts with list separator |
    const fileReference = `file://${data.fileId}::${data.originalName}::${data.mimeType}`;
    const itemHash = generateUniqueHash(fileReference);
    window.ShoppingList.Items[itemHash] = fileReference;

    const displayContent = truncateDataUrlForDisplay(fileReference);
    const location = config.newItemLocationAtTop ? 'afterbegin' : 'beforeend';

    document.getElementById('items-buttons').insertAdjacentHTML(
      location,
      `<button type="button" class="item btn btn-warning markdown-content" style="text-align: left;" data-state="1" data-key="${itemHash}" data-filename="${htmlEncode(data.originalName)}">${displayContent}</button>`
    );

    fileInput.value = '';
    saveItemAction(itemHash, 'c');
  })
  .catch(error => {
    alert(`File upload failed: ${error.message}`);
    fileInput.value = '';
  });
}

function addNewItemToList() {
  const config = window.ShoppingList.Config;
  const newItemNameInput = document.getElementById("newItemName");
  let newItemName = newItemNameInput.value;

  if (isDataUrl(newItemName) || isFileReference(newItemName)) {
    const itemHash = generateUniqueHash(newItemName);
    window.ShoppingList.Items[itemHash] = newItemName;

    const displayContent = truncateDataUrlForDisplay(newItemName);
    const location = config.newItemLocationAtTop ? 'afterbegin' : 'beforeend';

    document.getElementById('items-buttons').insertAdjacentHTML(
      location,
      `<button type="button" class="item btn btn-warning markdown-content" style="text-align: left;" data-state="1" data-key="${itemHash}">${displayContent}</button>`
    );

    newItemNameInput.value = '';
    saveItemAction(itemHash, 'c');
    return;
  }

  if (config.multilineMode) {
    newItemName = newItemName.replace(/\n/g, '<br>');
  } else {
    newItemName = newItemName.trim().toLowerCase();
  }
  newItemName = newItemName.replace(/['"]/g, match => {
    return match === "'" ? "&#39;" : "&quot;";
  });

  if (newItemName.length > 0 && !itemExists(newItemName)) {
    const itemHash = generateUniqueHash(newItemName);
    window.ShoppingList.Items[itemHash] = newItemName;

    const styleAttr = config.multilineMode ? ' style="text-align: left;"' : '';
    const classAttr = config.multilineMode ? ' markdown-content' : '';
    const dataRawAttr = config.multilineMode ? ` data-raw="${newItemName}"` : '';
    const displayContent = config.multilineMode ? marked.parse(decodeForClipboard(newItemName)) : newItemName;

    document.getElementById("items-buttons").insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="item btn btn-warning${classAttr}" data-state="1" data-key="${itemHash}"${styleAttr}${dataRawAttr}>${displayContent}</button>`
    );

    newItemNameInput.value = "";

    saveItemAction(itemHash, "c");
  }
}

function itemExists(itemName) {
  return Object.values(window.ShoppingList.Items).some(content => content === itemName);
}

window.addEventListener('load', () => {
  const config = window.ShoppingList.Config;

  if (config.serverItems && config.serverItems.length > 0) {
    config.serverItems.forEach((item, index) => {
      const content = item[0];
      const hash = generateUniqueHash(content);
      window.ShoppingList.Items[hash] = content;

      // We only use the data-item-index attribute when initializing from server-rendered items
      const button = document.querySelector(`button.item[data-item-index="${index}"]`);
      if (button) {
        button.dataset.key = hash;

        // Set filename attribute for file references
        if (isFileReference(content)) {
          const fileInfo = parseFileReference(content);
          button.dataset.filename = fileInfo.originalName;
        }
      }
    });
  }

  document.getElementById("items-buttons").onclick = (eventData) => {
    // Clicking on a link inside the item should not toggle the item state
    if (eventData.target.closest('a')) {
      return;
    }
    const button = eventData.target.closest('button.item.btn');
    if (button) {
      toggleItem({ target: button });
      return false;
    }
    return;
  };

  document.getElementById("addNewItemButton").onclick = addNewItemToList;

  if (config.multilineMode && config.multilineFileUpload) {
    document.getElementById('uploadFileButton').onclick = function() {
      document.getElementById('fileInput').click();
    };

    document.getElementById('fileInput').addEventListener('change', uploadFileAsItem);
  }

  if (config.multilineMode) {
    const renderer = {
      link(href, title, text) {
        const link = marked.Renderer.prototype.link.call(this, href, title, text);
        return link.replace("<a","<a target='_blank' rel='noreferrer' ");
      }
    };
    marked.use({
        renderer
    });
    document.querySelectorAll('.markdown-content').forEach(element => {
      const rawText = element.dataset.raw;
      if (rawText) {
        if (isDataUrl(rawText) || isFileReference(rawText)) {
          element.innerHTML = truncateDataUrlForDisplay(rawText);
          // Set filename attribute from file reference if not already set
          if (!element.dataset.filename && isFileReference(rawText)) {
            const fileInfo = parseFileReference(rawText);
            element.dataset.filename = fileInfo.originalName;
          }
        } else {
          element.innerHTML = marked.parse(decodeForClipboard(rawText));
        }
      }
    });
  }

  if (!config.multilineMode) {
    document.getElementById("newItemName").addEventListener("keypress", (eventData) => {
    if (eventData.keyCode === 13) {
      addNewItemToList();
    }
  }, false);
  }
});

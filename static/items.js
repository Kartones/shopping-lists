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

function copyToClipboard(target) {
  if (navigator.clipboard && target.dataset.key) {
    const content = window.ShoppingList.Items[target.dataset.key];
    if (content) {
      navigator.clipboard.writeText(content);
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

  copyToClipboard(e.target);

  saveItemAction(e.target.dataset.key, actions[state]);
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

function addNewItemToList() {
  const config = window.ShoppingList.Config;
  let newItemName = document.getElementById("newItemName").value;
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
    const displayContent = config.multilineMode ? marked.parse(newItemName.replace(/<br\s*\/?>/gi, '\n')) : newItemName;

    document.getElementById("items-buttons").insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="item btn btn-warning${classAttr}" data-state="1" data-key="${itemHash}"${styleAttr}${dataRawAttr}>${displayContent}</button>`
    );

    document.getElementById("newItemName").value = "";

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
        element.innerHTML = marked.parse(rawText.replace(/<br\s*\/?>/gi, '\n'));
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

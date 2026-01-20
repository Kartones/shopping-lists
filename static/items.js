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
    navigator.clipboard.writeText(target.dataset.key);
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

function saveItemAction(itemName, action) {
  const config = window.ShoppingListConfig;
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
  const config = window.ShoppingListConfig;
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
    const styleAttr = config.multilineMode ? ' style="text-align: left;"' : '';
    const classAttr = config.multilineMode ? ' markdown-content' : '';
    const dataRawAttr = config.multilineMode ? ` data-raw="${newItemName}"` : '';
    const displayContent = config.multilineMode ? marked.parse(newItemName.replace(/<br\s*\/?>/gi, '\n')) : newItemName;

    document.getElementById("items-buttons").insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="item btn btn-warning${classAttr}" data-state="1" data-key="${newItemName}"${styleAttr}${dataRawAttr}>${displayContent}</button>`
    );

    document.getElementById("newItemName").value = "";

    saveItemAction(newItemName, "c");
  }
}

function itemExists(itemName) {
  const buttons = Array.from(document.querySelectorAll('#items-buttons button'));
  return buttons.some(button => button.dataset.key === itemName);
}

window.addEventListener('load', () => {
  const config = window.ShoppingListConfig;

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

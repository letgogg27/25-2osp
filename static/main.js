/** main.js **/

document.addEventListener("DOMContentLoaded", () => {
  initImageUploadFeature();
  initStarRating();
  initChips();
  initFormReset();
  initChatFeature();
});

/* =========================
    IMAGE UPLOAD + PREVIEW
   ========================= */

function initImageUploadFeature() {
  const fileInput = document.getElementById("images");
  const previewContainer = document.getElementById("image-previews");

  // If this page has no image input, skip this feature
  if (!fileInput || !previewContainer) {
    return;
  }

  // DataTransfer to hold all selected files
  const dataTransfer = new DataTransfer();

  fileInput.addEventListener("change", function (event) {
    const newFiles = event.target.files;

    for (let i = 0; i < newFiles.length; i++) {
      dataTransfer.items.add(newFiles[i]);
    }

    // Update the input's FileList
    fileInput.files = dataTransfer.files;
    renderPreviews();
    event.target.value = null;
  });

  function renderPreviews() {
    previewContainer.innerHTML = "";

    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      const reader = new FileReader();

      reader.onload = function (e) {
        const previewWrapper = document.createElement("div");
        previewWrapper.className = "preview-item";
        previewWrapper.dataset.index = i;

        previewWrapper.style.cssText =
          "width:100px; height:100px; overflow:hidden; position:relative; border:none; box-shadow:1px 1px 3px rgba(0,0,0,0.1);";

        const img = document.createElement("img");
        img.src = e.target.result;
        img.alt = file.name;
        img.style.cssText = "width:100%; height:100%; object-fit:cover;";

        const removeButton = document.createElement("button");
        removeButton.innerHTML = "×";
        removeButton.className = "remove-btn";
        removeButton.style.cssText =
          "position:absolute; top:0; right:0; background:rgba(0,0,0,0.4); color:white; border:none; cursor:pointer; padding:2px 6px; line-height:1; font-size:14px; z-index:10;";

        removeButton.addEventListener("click", (event) => {
          event.preventDefault();
          removeFile(i);
        });

        previewWrapper.appendChild(img);
        previewWrapper.appendChild(removeButton);
        previewContainer.appendChild(previewWrapper);
      };

      reader.readAsDataURL(file);
    }
  }

  function removeFile(index) {
    dataTransfer.items.remove(index);

    // Update the input
    fileInput.files = dataTransfer.files;

    // Re-render previews
    renderPreviews();

    // If no files left, make input required again
    fileInput.required = dataTransfer.files.length === 0;
  }

  if (fileInput.files && fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      dataTransfer.items.add(fileInput.files[i]);
    }
    fileInput.files = dataTransfer.files;
    renderPreviews();
  }
}
/* =========================
    STAR RATING INTERACTION
   ========================= */

function initStarRating() {
  const starContainer = document.getElementById("stars");
  const hiddenInput = document.getElementById("rating");
  const starButtons = starContainer
    ? starContainer.querySelectorAll(".star-btn")
    : [];

  if (!starContainer || !hiddenInput || starButtons.length === 0) {
    return;
  }

  // Function to handle the actual selection logic
  function handleStarClick(clickedValue) {
    hiddenInput.value = clickedValue;

    starButtons.forEach((button) => {
      const buttonValue = parseInt(button.dataset.value);

      if (buttonValue <= clickedValue) {
        button.setAttribute("aria-pressed", "true");
      } else {
        button.setAttribute("aria-pressed", "false");
      }
    });
  }

  // Attach click listeners to all star buttons
  starButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = parseInt(button.dataset.value);
      handleStarClick(value);
    });
  });

  // starContainer.addEventListener("mouseout", () => {
  // });
}
/* =========================
    Chip RATING INTERACTION
   ========================= */
function initChips() {
  const chipGroup = document.getElementById("chipGroup");
  const chips = chipGroup ? chipGroup.querySelectorAll(".chip") : [];
  const hiddenInput = document.getElementById("pros");

  if (!chipGroup || !hiddenInput || chips.length === 0) return;

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const isSelected = chip.getAttribute("aria-checked") === "true";
      // toggle selection
      chip.setAttribute("aria-checked", !isSelected);
      updateHiddenInput();
    });

    // keyboard support (Enter/Space)
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        chip.click();
      }
    });
  });

  function updateHiddenInput() {
    const selected = Array.from(chips)
      .filter((chip) => chip.getAttribute("aria-checked") === "true")
      .map((chip) => chip.textContent.trim());
    hiddenInput.value = selected.join(", ");
  }
}
//* ==============
//   FORM RESET
//============== *//
function initFormReset() {
  const form = document.querySelector("form");
  if (!form) return;

  form.addEventListener("reset", () => {
    // Reset stars
    const starButtons = document.querySelectorAll(".star-btn");
    starButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
    const ratingInput = document.getElementById("rating");
    if (ratingInput) ratingInput.value = "0";

    // Reset chips
    const chips = document.querySelectorAll(".chip");
    chips.forEach((chip) => chip.setAttribute("aria-checked", "false"));
    const prosInput = document.getElementById("pros");
    if (prosInput) prosInput.value = "";

    // Reset image upload
    const imageInput = document.getElementById("images");
    const previewContainer = document.getElementById("image-previews");
    if (imageInput) imageInput.value = "";
    if (previewContainer) previewContainer.innerHTML = "";
  });
}

//* ==============
//   CHAT MODAL
//============== *//

function initChatFeature() {
  let currentFileToSend = null;

  // --- Element Selection ---
  const openChatButton = document.getElementById("open-chat-btn");
  const chatModal = document.getElementById("chat-modal");
  const closeChatButton = document.getElementById("close-chat-btn");
  const bodyElement = document.body;

  const messagesContainer = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-btn");

  // Photo/Emoji Elements
  const photoBtn = document.getElementById("photo-btn");
  const fileInput = document.getElementById("file-input");
  const emojiBtn = document.getElementById("emoji-btn");
  const chatPreviewContainer = document.getElementById("chat-image-preview");

  // If this page has no chat, skip
  if (!openChatButton || !chatModal) {
    return;
  }

  // --- Helper Functions ---
  function openChat() {
    chatModal.style.display = "flex";
    bodyElement.classList.add("no-scroll");
    scrollToBottom();
  }

  function closeChat() {
    chatModal.style.display = "none";
    bodyElement.classList.remove("no-scroll");
    currentFileToSend = null;
    renderChatPreview(null); // Clear preview on close
    if (chatInput) chatInput.value = "";
  }

  function scrollToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function renderChatPreview(file) {
    if (!chatPreviewContainer || !chatInput) return;
    chatPreviewContainer.innerHTML = ""; // Clear existing preview

    // Update the file variable
    currentFileToSend = file;

    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const previewWrapper = document.createElement("div");
        previewWrapper.style.cssText =
          "width: 40px; height: 40px; overflow: hidden; border-radius: 4px; margin-right: 8px; position: relative;";

        const img = document.createElement("img");
        img.src = e.target.result;
        img.alt = file.name;
        img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";

        // Delete Button for the preview
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "&times;";
        deleteBtn.classList.add("chat-preview-delete-btn");
        deleteBtn.style.cssText = `
                    position: absolute;
                    top: -1px;
                    right: -1px; 
                    background: rgba(0,0,0,0.6);
                    color: white;
                    border: none;
                    border-top-right-radius: 6px;
                    width: 16px;
                    height: 16px;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0;
                `;
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          currentFileToSend = null;
          renderChatPreview(null);
          if (fileInput) fileInput.value = null;
        });

        previewWrapper.appendChild(img);
        previewWrapper.appendChild(deleteBtn); //delete btn for selected img

        chatPreviewContainer.appendChild(previewWrapper);
      };
      reader.readAsDataURL(file);
    } else {
      chatInput.style.display = "block";
    }
  }

  /**
   * Creates and appends a text or image message bubble.
   */

  function addMessage(content, role) {
    if (!messagesContainer) return;

    const { text, imageURL } = content;
    const hasImage = !!imageURL;
    const hasText = !!text && text.trim().length > 0;

    if (!hasImage && !hasText) return;

    const row = document.createElement("div");
    row.classList.add("message-row", role);

    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar");
    avatar.textContent = role === "receiver" ? "E" : "K";
    avatar.classList.add(role);

    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble", role);

    // 1. Render Image (if present)
    if (hasImage) {
      const img = document.createElement("img");
      img.src = imageURL;
      img.classList.add("message-image-content");
      img.style.cssText =
        "max-width: 100%; border-radius: 8px; margin-bottom: 5px;";
      bubble.appendChild(img);
    }

    // 2. Render Text (if present)
    if (hasText) {
      const textElement = document.createElement("p");
      textElement.textContent = text;
      textElement.style.margin = "0";

      bubble.appendChild(textElement);
    }

    if (role === "receiver") {
      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      row.appendChild(bubble);
      row.appendChild(avatar);
    }

    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  function handleSend() {
    const text = chatInput.value;
    const file = currentFileToSend;

    if (!text.trim() && !file) return;

    let fileURL = null;
    if (file) {
      fileURL = URL.createObjectURL(file);
    }

    addMessage({ text: text, imageURL: fileURL }, "sender");

    chatInput.value = "";
    if (fileInput) fileInput.value = null;
    renderChatPreview(null);

    // Demo Auto-reply
    setTimeout(() => {
      addMessage({ text: "네, 확인했습니다!", imageURL: null }, "receiver");
    }, 800);
  }

  // --- Event Listeners ---

  // Open / close modal
  openChatButton.addEventListener("click", openChat);
  if (closeChatButton) closeChatButton.addEventListener("click", closeChat);
  chatModal.addEventListener("click", (event) => {
    if (event.target === chatModal) closeChat();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && chatModal.style.display === "flex")
      closeChat();
  });

  // Send message via button
  if (sendButton) {
    sendButton.addEventListener("click", (event) => {
      event.preventDefault();
      handleSend();
    });
  }

  // Send message via Enter key
  if (chatInput) {
    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSend();
      }
    });
  }

  // Photo Upload Trigger
  if (photoBtn && fileInput) {
    photoBtn.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      renderChatPreview(file || null);
    });
  }

  // Emoji Button Placeholder
  if (emojiBtn) {
    emojiBtn.addEventListener("click", () => {
      console.log("Emoji picker toggle");
      chatInput.focus();
    });
  }
}

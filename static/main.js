/** main.js **/

document.addEventListener("DOMContentLoaded", () => {
  initImageUploadFeature();
  initStarRating();
  initChips();
  initFormReset();
  initChatFeature();
  initAutoResizeTextarea();
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
//  Real-time CHAT MODAL
//============== *//

function initChatFeature() {
  let currentFileToSend = null;
  let currentConversationRef = null; // To store the database reference
  let currentMessageListener = null; // To store the listener so we can turn it off

  // Element Selection
  const openChatButton = document.getElementById("open-chat-btn");
  const chatModal = document.getElementById("chat-modal");
  const closeChatButton = document.getElementById("close-chat-btn");
  const bodyElement = document.body;

  const messagesContainer = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-btn");

  const photoBtn = document.getElementById("photo-btn");
  const fileInput = document.getElementById("file-input");
  const emojiBtn = document.getElementById("emoji-btn");
  const chatPreviewContainer = document.getElementById("chat-image-preview");

  // If this page has no chat, skip
  if (!openChatButton || !chatModal) {
    return;
  }

  const ITEM_NAME = chatModal.dataset.itemName;
  const SELLER_ID = chatModal.dataset.sellerId;
  const CURRENT_USER_ID = chatModal.dataset.currentUserId;

  // Create the Conversation ID
  let conversationId;
  if (CURRENT_USER_ID && SELLER_ID) {
    const userIds = [CURRENT_USER_ID, SELLER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  } else {
    // User is not logged in-> can't start a chat
    return;
  }

  function openChat() {
    chatModal.style.display = "flex";
    bodyElement.classList.add("no-scroll");
    if (messagesContainer) messagesContainer.innerHTML = "Loading chat...";

    // Get the database reference for this specific chat
    currentConversationRef = database.ref("conversations/" + conversationId);

    if (currentMessageListener) {
      currentConversationRef.off("value", currentMessageListener);
    }
    currentMessageListener = currentConversationRef.on(
      "value",
      (snapshot) => {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = ""; // Clear "Loading..."

        const messages = snapshot.val(); // Get all messages as an object

        if (messages) {
          // Loop through all messages
          Object.keys(messages).forEach((key) => {
            const msg = messages[key];
            addMessage(
              { text: msg.text, imageURL: msg.image || null },
              msg.sender
            );
          });
        } else {
          // No messages yet
          messagesContainer.innerHTML =
            "<div class='chat-system-message'>This is the beginning of your conversation.</div>";
        }

        scrollToBottom();
      },
      (error) => {
        // Handle errors
        console.error("Firebase read error:", error);
        if (messagesContainer)
          messagesContainer.innerHTML = "Error loading chat.";
      }
    );

    scrollToBottom();
  }

  function closeChat() {
    // Turn off the real-time listener
    if (currentConversationRef && currentMessageListener) {
      currentConversationRef.off("value", currentMessageListener);
      currentConversationRef = null;
      currentMessageListener = null;
    }

    // Reset everything else
    chatModal.style.display = "none";
    bodyElement.classList.remove("no-scroll");
    currentFileToSend = null;
    renderChatPreview(null);
    if (chatInput) chatInput.value = "";
    if (messagesContainer) messagesContainer.innerHTML = "";
  }

  function scrollToBottom() {
    if (!messagesContainer) return;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function renderChatPreview(file) {
    if (!chatPreviewContainer || !chatInput) return;
    chatPreviewContainer.innerHTML = "";
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
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "&times;";
        deleteBtn.classList.add("chat-preview-delete-btn");
        deleteBtn.style.cssText = `position: absolute; top: -1px; right: -1px; background: rgba(0,0,0,0.6); color: white; border: none; border-top-right-radius: 6px; width: 16px; height: 16px; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 1; padding: 0;`;
        deleteBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          currentFileToSend = null;
          renderChatPreview(null);
          if (fileInput) fileInput.value = null;
        });
        previewWrapper.appendChild(img);
        previewWrapper.appendChild(deleteBtn);
        chatPreviewContainer.appendChild(previewWrapper);
      };
      reader.readAsDataURL(file);
    } else {
      chatInput.style.display = "block";
    }
  }

  function addMessage(content, senderId) {
    if (!messagesContainer) return;

    // --- [NEW DEBUG CODE] ---
    // Let's print the variables to the console to see what's happening
    console.log("--- New Message ---");
    console.log(`Message Sender ID (senderId): ${senderId}`);
    console.log(`My Browser's ID (CURRENT_USER_ID): ${CURRENT_USER_ID}`);
    // --- [END DEBUG CODE] ---

    const role = senderId === CURRENT_USER_ID ? "sender" : "receiver";

    // --- [NEW DEBUG CODE] ---
    console.log(`Resulting Role (left/right): ${role}`);
    console.log("-------------------");
    // --- [END DEBUG CODE] ---

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
    if (hasImage) {
      const img = document.createElement("img");
      img.src = imageURL;
      img.classList.add("message-image-content");
      img.style.cssText =
        "max-width: 100%; border-radius: 8px; margin-bottom: 5px;";
      bubble.appendChild(img);
    }
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
  async function handleSend() {
    const text = chatInput.value;
    const file = currentFileToSend; // 나중에 넣을 예정

    if (!text.trim() && !file) return;

    // 1. Create the message data object
    const messageData = {
      sender: CURRENT_USER_ID,
      text: text,
      image: "", // 나중에 넣을 예정
      timestamp: firebase.database.ServerValue.TIMESTAMP, // Firebase will set the time
    };

    // 2. Clear the input *before* sending
    chatInput.value = "";
    if (fileInput) fileInput.value = null;
    renderChatPreview(null);

    // 3.  Send to Firebase using push()
    try {
      const convoRef = database.ref("conversations/" + conversationId);
      await convoRef.push(messageData);

      await fetch(`/api/chat/link_inbox/${ITEM_NAME}`, { method: "POST" });
    } catch (error) {
      console.error("Error sending message:", error);
      // If it fails, maybe add the text back?
      chatInput.value = text;
    }
  }

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

/* =========================
    TEXTAREA AUTO-RESIZE
   ========================= */

function initAutoResizeTextarea() {
  const textareas = document.querySelectorAll(".textarea");
  if (!textareas.length) return;

  textareas.forEach((textarea) => {
    textarea.style.overflow = "hidden";

    textarea.style.height = textarea.scrollHeight + "px";

    textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
  });
}

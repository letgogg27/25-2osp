/** main.js **/
let statusListener = null;
let statusCheckInterval = null;
let lastKnownActiveTime = null;
let presencePingInterval = null;

// Pings the Flask server periodically to update the user's last_active time
function startPresencePing(currentUserId) {
  if (!currentUserId) return;

  const sendActivity = () => {
    console.log("presence ping for:", currentUserId);
    fetch("/api/user/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUserId }),
    }).catch((error) => {
      console.error("Presence ping failed:", error);
    });
  };

  sendActivity();

  const PING_INTERVAL_MS = 30000; // 30 seconds

  // clear old presence ping
  if (presencePingInterval) {
    clearInterval(presencePingInterval);
  }
  // start new dedicated presence interval
  presencePingInterval = setInterval(sendActivity, PING_INTERVAL_MS);
}

// Real-time listener to check if the other user is online and display the status
function startStatusListener(otherUserId) {
  if (!otherUserId) return;

  if (statusListener) {
    statusListener.off();
    statusListener = null;
  }
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
  }

  // Listen to the other user's status node in Firebase
  statusListener = database.ref(`user_status/${otherUserId}`);

  const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  // Function that checks stored lastKnownActiveTime and updates UI
  const checkAndDisplayStatus = () => {
    const statusElement = document.getElementById("chat-header-status");
    if (!statusElement) return;

    if (lastKnownActiveTime == null) {
      statusElement.textContent = "Offline";
      statusElement.style.color = "#666";
      return;
    }

    const now = Date.now(); // ms
    let ts = lastKnownActiveTime;

    // If it's a string, convert to int
    if (typeof ts === "string") {
      const numeric = Number(ts);
      if (!isNaN(numeric)) {
        ts = numeric;
      } else {
        const parsedDate = Date.parse(ts);
        if (!isNaN(parsedDate)) {
          ts = parsedDate; // already ms
        } else {
          statusElement.textContent = "Offline";
          statusElement.style.color = "#666";
          return;
        }
      }
    }

    // if s ,  convert to ms
    if (ts < 1e12) {
      ts = ts * 1000;
    }

    const diff = now - ts;
    console.log("Presence check:", {
      otherUserId,
      now,
      lastActive: ts,
      diff,
    });

    if (diff < ACTIVE_THRESHOLD_MS) {
      statusElement.textContent = "Active Now";
      statusElement.style.color = "#36AE92";
    } else {
      statusElement.textContent = "Offline";
      statusElement.style.color = "#666";
    }
  };

  // Firebase listener – update lastKnownActiveTime when DB changes
  statusListener.on("value", (snapshot) => {
    const statusData = snapshot.val();
    if (statusData && statusData.last_active) {
      lastKnownActiveTime = statusData.last_active;
    } else {
      lastKnownActiveTime = null;
    }
    checkAndDisplayStatus();
  });
  statusCheckInterval = setInterval(checkAndDisplayStatus, 10000);
}

/* =========================
    IMAGE UPLOAD + PREVIEW
   ========================= */

function initImageUploadFeature() {
  const fileInput = document.getElementById("images");
  const previewContainer = document.getElementById("image-previews");

  if (!fileInput || !previewContainer) {
    return;
  }

  const dataTransfer = new DataTransfer();

  fileInput.addEventListener("change", function (event) {
    const newFiles = event.target.files;

    for (let i = 0; i < newFiles.length; i++) {
      dataTransfer.items.add(newFiles[i]);
    }

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
    fileInput.files = dataTransfer.files;
    renderPreviews();
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

  function handleStarClick(clickedValue) {
    hiddenInput.value = clickedValue;

    starButtons.forEach((button) => {
      const buttonValue = parseInt(button.dataset.value, 10);

      if (buttonValue <= clickedValue) {
        button.setAttribute("aria-pressed", "true");
      } else {
        button.setAttribute("aria-pressed", "false");
      }
    });
  }

  starButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const value = parseInt(button.dataset.value, 10);
      handleStarClick(value);
    });
  });
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
      chip.setAttribute("aria-checked", !isSelected);
      updateHiddenInput();
    });

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

/* =========================
          FORM RESET
   ========================= */

function initFormReset() {
  const form = document.querySelector("form");
  if (!form) return;

  form.addEventListener("reset", () => {
    const starButtons = document.querySelectorAll(".star-btn");
    starButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
    const ratingInput = document.getElementById("rating");
    if (ratingInput) ratingInput.value = "0";

    const chips = document.querySelectorAll(".chip");
    chips.forEach((chip) => chip.setAttribute("aria-checked", "false"));
    const prosInput = document.getElementById("pros");
    if (prosInput) prosInput.value = "";

    const imageInput = document.getElementById("images");
    const previewContainer = document.getElementById("image-previews");
    if (imageInput) imageInput.value = "";
    if (previewContainer) previewContainer.innerHTML = "";
  });
}

/* =========================
        Real-time CHAT MODAL
   ========================= */

function initChatFeature() {
  let currentFileToSend = null;
  let currentConversationRef = null; // Firebase ref for this conversation
  let currentMessageListener = null;

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

  const scrollContainer =
    document.querySelector(".chat-body") || messagesContainer;

  if (!openChatButton || !chatModal) {
    return;
  }

  const ITEM_NAME = chatModal.dataset.itemName;
  const SELLER_ID = chatModal.dataset.sellerId;
  const CURRENT_USER_ID = chatModal.dataset.currentUserId;

  const urlParams = new URLSearchParams(window.location.search);
  const OTHER_USER_ID = urlParams.get("with");

  if (!ITEM_NAME || !SELLER_ID || !CURRENT_USER_ID) {
    return;
  }

  let conversationId;
  if (OTHER_USER_ID) {
    const userIds = [CURRENT_USER_ID, OTHER_USER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  } else {
    const userIds = [CURRENT_USER_ID, SELLER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  }

  const typingIndicatorElement = document.getElementById("typing-indicator");
  const RECEIVER_ID = CURRENT_USER_ID === SELLER_ID ? OTHER_USER_ID : SELLER_ID;

  // Initials for avatars
  const currentUserInitial =
    CURRENT_USER_ID && CURRENT_USER_ID.length > 0
      ? CURRENT_USER_ID.charAt(0).toUpperCase()
      : "?";

  const receiverInitial =
    RECEIVER_ID && RECEIVER_ID.length > 0
      ? RECEIVER_ID.charAt(0).toUpperCase()
      : "?";

  function checkTransactionStatus() {
    // Call the API
    $.ajax({
      url: `/api/item/status/${ITEM_NAME}`,
      type: "GET",
      success: function (response) {
        console.log("Status Response:", response); // Debugging

        const status = response.status; // "active", "reserved", "sold"
        const chosenBuyer = response.buyer_id; // The user ID selected by seller
        const seller = response.seller;

        // Determine who I am
        const isMeSeller = CURRENT_USER_ID === seller;
        const isMeBuyer = CURRENT_USER_ID === chosenBuyer;

        const actionsDiv = document.getElementById("chat-actions");
        const inputArea = document.querySelector(".chat-footer");

        console.log("My ID:", CURRENT_USER_ID);
        console.log("Chosen Buyer ID:", chosenBuyer);
        console.log("Is Me Buyer?", CURRENT_USER_ID === chosenBuyer);

        if (!actionsDiv) return;
        actionsDiv.innerHTML = "";
        inputArea.style.display = "flex"; // Default show

        // --- CASE 1: Item is Active (Anyone can chat) ---
        // We check for 'active' or legacy 'available' or 'used'/'new'
        if (
          status === "active" ||
          status === "new" ||
          status === "used" ||
          status === "almost_new"
        ) {
          // Only Seller sees the "Request Deal" button, and only if chatting with a specific buyer
          if (isMeSeller && RECEIVER_ID) {
            const btn = document.createElement("button");
            btn.innerText = "거래 완료 요청"; // Request Transaction
            btn.className = "item-detail-btn";
            btn.style.cssText =
              "padding: 5px 10px; font-size: 12px; background: #00462A; color: white; border:none; border-radius:4px; cursor:pointer;";
            btn.onclick = function () {
              if (confirm(`@${RECEIVER_ID} 님과 거래를 진행하시겠습니까?`)) {
                startTransaction(RECEIVER_ID);
              }
            };
            actionsDiv.appendChild(btn);
          }
        }

        // --- CASE 2: Reserved (Waiting for Buyer Confirmation) ---
        else if (status === "reserved") {
          if (isMeBuyer) {
            // I am the chosen buyer -> Show "Confirm" button
            const btn = document.createElement("button");
            btn.innerText = "거래 확정 하기"; // Confirm Deal
            btn.className = "item-detail-btn";
            btn.style.cssText =
              "padding: 5px 10px; font-size: 12px; background: #d32f2f; color: white; border:none; border-radius:4px; cursor:pointer;";
            btn.onclick = confirmTransaction;
            actionsDiv.appendChild(btn);
          } else if (isMeSeller) {
            // Seller sees waiting text
            actionsDiv.innerHTML =
              "<span style='font-size:12px; color:orange; font-weight:bold;'>거래 확정 대기중...</span>";
          } else {
            // Other random buyers -> Locked out
            inputArea.style.display = "none";
            actionsDiv.innerHTML =
              "<span style='font-size:12px; color:gray;'>다른 사용자와 거래중입니다.</span>";
          }
        }

        // --- CASE 3: Sold (Done) ---
        else if (status === "sold") {
          inputArea.style.display = "none"; // Chat locked
          actionsDiv.innerHTML =
            "<span style='font-size:12px; color:#00462A; font-weight:bold;'>거래 완료됨 (Sold)</span>";
        }
      },
      error: function (err) {
        console.error("Status check failed", err);
      },
    });
  }

  function startTransaction(buyerId) {
    $.ajax({
      url: "/api/transaction/start",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        item_name: ITEM_NAME,
        buyer_id: buyerId,
      }),
      success: function () {
        alert("거래 완료 처리됨");
        checkTransactionStatus();
      },
    });
  }

  function confirmTransaction() {
    $.ajax({
      url: "/api/transaction/confirm",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ item_name: ITEM_NAME }),
      success: function () {
        alert("거래 확정되었습니다");
        checkTransactionStatus();
      },
    });
  }

  let typingTimeout = null;
  const TYPING_DELAY = 3000;
  let isTyping = false;
  let typingListener = null;

  function openChat() {
    const headerAvatarEl = document.querySelector(".chat-header-avatar");
    const headerNameEl = document.querySelector(".chat-header-name.user-id");

    if (headerAvatarEl) {
      headerAvatarEl.textContent = receiverInitial;
    }
    if (headerNameEl) {
      headerNameEl.textContent = RECEIVER_ID ? `@${RECEIVER_ID}` : "@Unknown";
    }

    chatModal.style.display = "flex";
    bodyElement.classList.add("no-scroll");

    checkTransactionStatus();
    if (messagesContainer) messagesContainer.innerHTML = "Loading chat...";

    if (CURRENT_USER_ID) {
      startPresencePing(CURRENT_USER_ID);
    }

    currentConversationRef = database.ref("conversations/" + conversationId);

    if (currentMessageListener) {
      currentConversationRef.off("value", currentMessageListener);
      currentMessageListener = null;
    }

    // Attach new listener
    currentMessageListener = currentConversationRef.on(
      "value",
      (snapshot) => {
        if (!messagesContainer) return;

        messagesContainer.innerHTML = "";

        const messages = snapshot.val();

        if (messages) {
          Object.keys(messages).forEach((key) => {
            const msg = messages[key];

            addMessage(
              { text: msg.text, imageURL: msg.image || null },
              msg.sender
            );
          });
        } else {
          messagesContainer.innerHTML =
            "<div class='chat-system-message'>This is the beginning of your conversation.</div>";
        }

        scrollToBottom(scrollContainer);
      },
      (error) => {
        console.error("Firebase read error:", error);
        if (messagesContainer)
          messagesContainer.innerHTML = "Error loading chat.";
      }
    );

    scrollToBottom(scrollContainer);
    startTypingListener();
    startStatusListener(RECEIVER_ID);
  }

  function closeChat() {
    // typing listener off
    if (typingListener) {
      typingListener.off();
      typingListener = null;
    }
    sendTypingStatus(false);

    // presence / status off
    if (statusListener) {
      statusListener.off();
      statusListener = null;
    }
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }

    // Firebase chat listener off
    if (currentConversationRef && currentMessageListener) {
      currentConversationRef.off("value", currentMessageListener);
      currentConversationRef = null;
      currentMessageListener = null;
    }

    chatModal.style.display = "none";
    bodyElement.classList.remove("no-scroll");
    currentFileToSend = null;
    renderChatPreview(null);
    if (chatInput) chatInput.value = "";
    if (messagesContainer) messagesContainer.innerHTML = "";
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
        deleteBtn.style.cssText =
          "position: absolute; top: -1px; right: -1px; background: rgba(0,0,0,0.6); color: white; border: none; border-top-right-radius: 6px; width: 16px; height: 16px; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 1; padding: 0;";

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

    const role = senderId === CURRENT_USER_ID ? "sender" : "receiver";
    const { text, imageURL } = content;

    const hasImage = !!imageURL;
    const hasText = !!text && text.trim().length > 0;
    if (!hasImage && !hasText) return;

    const row = document.createElement("div");
    row.classList.add("message-row", role);

    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar", role);
    avatar.textContent =
      role === "receiver" ? receiverInitial : currentUserInitial;

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
    scrollToBottom(scrollContainer);
  }

  async function handleSend() {
    if (!chatInput) return;

    const text = chatInput.value.trim();
    const hasImage = !!currentFileToSend;

    if (!text && !hasImage) return;

    const originalText = text;
    chatInput.value = "";

    let url;
    let options;

    try {
      if (hasImage) {
        url = `/api/chat/send_with_image/${ITEM_NAME}`;

        const formData = new FormData();
        formData.append("text", originalText);
        formData.append("other_user_id", OTHER_USER_ID || "");
        formData.append("image", currentFileToSend);

        options = {
          method: "POST",
          body: formData,
        };
      } else {
        url = `/api/chat/send/${ITEM_NAME}`;

        options = {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: originalText,
            other_user_id: OTHER_USER_ID || null,
          }),
        };
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (result.error) {
        console.error("Server failed:", result.error);
        chatInput.value = originalText;
        alert("Failed to send message: " + result.error);
        return;
      }

      currentFileToSend = null;
      if (fileInput) fileInput.value = null;
      renderChatPreview(null);
    } catch (error) {
      console.error("Network error:", error);
      chatInput.value = originalText;
      alert("Network error. Please try again.");
    }
  }

  async function sendTypingStatus(status) {
    if (status === isTyping) return;
    isTyping = status;

    const endpoint = `/api/chat/typing/${ITEM_NAME}`;

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_typing: status,
          other_user_id: OTHER_USER_ID || null,
        }),
      });
    } catch (error) {
      console.error("Failed to send typing status:", error);
    }
  }

  function handleTyping() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    if (!isTyping) {
      sendTypingStatus(true);
    }

    typingTimeout = setTimeout(() => {
      sendTypingStatus(false);
    }, TYPING_DELAY);
  }

  function startTypingListener() {
    if (typingListener) {
      typingListener.off();
    }

    typingListener = database.ref("typing_status/" + conversationId);

    typingListener.on("value", (snapshot) => {
      if (!typingIndicatorElement) return;

      const statuses = snapshot.val();
      const receiverIsTyping = statuses && statuses[RECEIVER_ID] === true;

      if (receiverIsTyping) {
        typingIndicatorElement.style.display = "block";
        const nameSpan = typingIndicatorElement.querySelector(".user-id");
        if (nameSpan) {
          nameSpan.textContent = `@${RECEIVER_ID}`;
        }
        scrollToBottom(scrollContainer);
      } else {
        typingIndicatorElement.style.display = "none";
        scrollToBottom(scrollContainer);
      }
    });
  }

  // Open / close modal
  openChatButton.addEventListener("click", openChat);
  if (closeChatButton) closeChatButton.addEventListener("click", closeChat);

  chatModal.addEventListener("click", (event) => {
    if (event.target === chatModal) closeChat();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && chatModal.style.display === "flex") {
      closeChat();
    }
  });

  if (sendButton) {
    sendButton.addEventListener("click", (event) => {
      event.preventDefault();
      handleSend();
    });
  }

  if (chatInput) {
    chatInput.addEventListener("input", handleTyping);
    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSend();
      }
    });
  }

  if (photoBtn && fileInput) {
    photoBtn.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      renderChatPreview(file || null);
    });
  }

  // if (emojiBtn) {
  //   emojiBtn.addEventListener("click", () => {
  //     console.log("Emoji picker toggle");
  //     chatInput.focus();
  //   });
  // }

  if (urlParams.get("chat") === "true") {
    setTimeout(() => {
      if (openChatButton) {
        openChatButton.click();
      }
    }, 300);
  }
}

function scrollToBottom(containerElement) {
  if (!containerElement) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      containerElement.scrollTop = containerElement.scrollHeight;
    });
  });
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

document.addEventListener("DOMContentLoaded", () => {
  initImageUploadFeature();
  initStarRating();
  initChips();
  initFormReset();
  initChatFeature();
  initAutoResizeTextarea();

  const currentUserIdMeta = document.querySelector(
    'meta[name="current-user-id"]'
  );
  console.log("Meta Tag Element:", currentUserIdMeta);
  console.log(
    "User ID Read:",
    currentUserIdMeta ? currentUserIdMeta.content : "NOT FOUND"
  );
  if (currentUserIdMeta && currentUserIdMeta.content) {
    startPresencePing(currentUserIdMeta.content);
  }
});

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

  // send once immediately
  sendActivity();

  const PING_INTERVAL_MS = 30000; // 30 seconds

  // clear old presence ping if any
  if (presencePingInterval) {
    clearInterval(presencePingInterval);
  }
  // start new dedicated presence interval
  presencePingInterval = setInterval(sendActivity, PING_INTERVAL_MS);
}

// Real-time listener to check if the other user is online and display the status
function startStatusListener(otherUserId) {
  if (!otherUserId) return;

  // Clear any existing listener
  if (statusListener) {
    statusListener.off();
    statusListener = null;
  }
  // Clear the periodic check timer
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
      statusElement.textContent = "⚫ Offline";
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
          statusElement.textContent = "⚫ Offline";
          statusElement.style.color = "#666";
          return;
        }
      }
    }

    if (ts < 1e12) {
      ts = ts * 1000; // seconds → ms
    }

    const diff = now - ts;
    console.log("Presence check:", {
      otherUserId,
      now,
      lastActive: ts,
      diff,
    });

    if (diff < ACTIVE_THRESHOLD_MS) {
      statusElement.textContent = "🟢 Active Now";
      statusElement.style.color = "#36AE92";
    } else {
      statusElement.textContent = "⚫ Offline";
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

    // Run immediately after each DB update
    checkAndDisplayStatus();
  });

  // Also run periodic checks
  statusCheckInterval = setInterval(checkAndDisplayStatus, 10000);
}

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

  const scrollContainer =
    document.querySelector(".chat-body") || messagesContainer;
  // If this page has no chat, skip
  if (!openChatButton || !chatModal) {
    return;
  }

  const ITEM_NAME = chatModal.dataset.itemName;
  const SELLER_ID = chatModal.dataset.sellerId;
  const CURRENT_USER_ID = chatModal.dataset.currentUserId;

  // URL 파라미터: ?chat=true&with=어떤유저
  const urlParams = new URLSearchParams(window.location.search);
  const OTHER_USER_ID = urlParams.get("with"); // my_messages 에서 넘어오는 상대 ID

  if (!ITEM_NAME || !SELLER_ID || !CURRENT_USER_ID) {
    // 필수 데이터 없으면 채팅 기능 끔
    return;
  }

  // 방 ID: 항상 (두 유저 + 아이템) 조합
  // - buyer가 상품 상세에서 시작: 상대는 SELLER_ID
  // - seller가 My Messages에서 들어올 때: 상대는 OTHER_USER_ID (buyer)
  let conversationId;
  if (OTHER_USER_ID) {
    const userIds = [CURRENT_USER_ID, OTHER_USER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  } else {
    const userIds = [CURRENT_USER_ID, SELLER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  }

  let typingTimeout = null;
  const TYPING_DELAY = 3000; // 3 seconds after last keypress
  let isTyping = false;
  const typingIndicatorElement = document.getElementById("typing-indicator");
  // Determine who the receiver is
  const RECEIVER_ID = CURRENT_USER_ID === SELLER_ID ? OTHER_USER_ID : SELLER_ID;

  function openChat() {
    chatModal.style.display = "flex";
    bodyElement.classList.add("no-scroll");
    if (messagesContainer) messagesContainer.innerHTML = "Loading chat...";

    if (CURRENT_USER_ID) {
      startPresencePing(CURRENT_USER_ID);
    }
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

        scrollToBottom(scrollContainer);
      },
      (error) => {
        // Handle errors
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
    if (typingListener) {
      typingListener.off();
      typingListener = null;
    }
    sendTypingStatus(false);

    if (statusListener) {
      statusListener.off();
      statusListener = null;
    }
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
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

  // function scrollToBottom() {
  //   if (!messagesContainer) return;
  //   messagesContainer.scrollTop = messagesContainer.scrollHeight;
  // }

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

    const role = senderId === CURRENT_USER_ID ? "sender" : "receiver";

    const { text, imageURL } = content;
    const hasImage = !!imageURL;
    const hasText = !!text && text.trim().length > 0;
    if (!hasImage && !hasText) return;

    const row = document.createElement("div");
    row.classList.add("message-row", role);

    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar");
    avatar.textContent = role === "receiver" ? "R" : "S";
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
    scrollToBottom(scrollContainer);
  }

  // 메시지 보내기
  async function handleSend() {
    const text = chatInput.value;

    if (!text.trim()) return;

    // 입력 비우기
    chatInput.value = "";
    if (fileInput) fileInput.value = null;
    renderChatPreview(null);
    console.log("ITEM_NAME:", ITEM_NAME);
    console.log("CURRENT_USER_ID:", CURRENT_USER_ID);
    console.log("OTHER_USER_ID sent:", OTHER_USER_ID);
    console.log("OTHER_USER_ID (from URL 'with'):", OTHER_USER_ID);
    try {
      const response = await fetch(`/api/chat/send/${ITEM_NAME}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text,
          // seller가 My Messages에서 들어온 경우: with=buyer_id 가 넘어옴
          other_user_id: OTHER_USER_ID || null,
        }),
      });

      const result = await response.json();

      if (result.error) {
        console.error("Server failed:", result.error);
        chatInput.value = text; // Put back on error
        alert("Failed to send message: " + result.error);
      }
    } catch (error) {
      console.error("Network error:", error);
      chatInput.value = text;
      alert("Network error. Please try again.");
    }
  }
  //  Sends typing status to the Flask server
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

  //for keypresses
  function handleTyping() {
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Send START typing signal
    if (!isTyping) {
      sendTypingStatus(true);
    }

    // Set timeout to send STOP typing signal
    typingTimeout = setTimeout(() => {
      sendTypingStatus(false);
    }, TYPING_DELAY);
  }

  // Real-time listener for the OTHER user's typing status
  let typingListener = null;

  function startTypingListener() {
    if (typingListener) {
      typingListener.off();
    }

    const otherUserId =
      CURRENT_USER_ID === SELLER_ID ? OTHER_USER_ID : SELLER_ID;

    typingListener = database.ref("typing_status/" + conversationId);

    typingListener.on("value", (snapshot) => {
      if (!typingIndicatorElement) return;

      const statuses = snapshot.val();
      const receiverIsTyping = statuses && statuses[RECEIVER_ID] === true;

      if (receiverIsTyping) {
        typingIndicatorElement.style.display = "block";
        // update the displayed name:
        typingIndicatorElement.querySelector(
          ".user-id"
        ).textContent = `@${RECEIVER_ID}`;
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
    chatInput.addEventListener("input", handleTyping); // Fires on every keypress
    chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSend();
      }
    });
  }
  // if (chatInput) {
  // chatInput.addEventListener("input", handleTyping); // Fires on every keypress
  // }

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

  // // Emoji Button Placeholder
  // if (emojiBtn) {
  //   emojiBtn.addEventListener("click", () => {
  //     console.log("Emoji picker toggle");
  //     chatInput.focus();
  //   });
  // }

  // URL ?chat=true 이면 자동으로 열기 (상품 상세 / My Messages 둘 다 공통)
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

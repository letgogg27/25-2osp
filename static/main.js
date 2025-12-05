/** main.js **/
let statusListener = null;
let statusCheckInterval = null;
let lastKnownActiveTime = null;
let presencePingInterval = null;

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
    ITEM DELETE / COMPLETE
   ========================= */

// 삭제
window.deleteItem = function (name) {
  if (!confirm("정말 이 상품을 삭제하시겠습니까?")) return;

  fetch(`/item/delete/${encodeURIComponent(name)}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => {
      if (!res.ok) throw new Error("삭제 실패");
      return res.json();
    })
    .then((data) => {
      alert(data.msg || "상품이 삭제되었습니다.");
      // 목록 페이지로 이동
      window.location.href = "/list";
    })
    .catch((err) => {
      console.error(err);
      alert("삭제 중 오류가 발생했습니다.");
    });
};

// 거래완료 (원하면 나중에 구현)
window.completeItem = function (name) {
  if (!confirm("이 상품을 거래완료로 표시할까요?")) return;

  fetch(`/item/complete/${encodeURIComponent(name)}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
    .then((res) => {
      if (!res.ok) throw new Error("거래완료 처리 실패");
      return res.json();
    })
    .then((data) => {
      alert(data.msg || "거래완료로 표시되었습니다.");
      // 새로고침해서 상태 뱃지 업데이트
      window.location.reload();
    })
    .catch((err) => {
      console.error(err);
      alert("거래완료 처리 중 오류가 발생했습니다.");
    });
};

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
  const chatModal = document.getElementById("chat-modal");
  const openChatButton = document.getElementById("open-chat-btn");

  // 1. Modal is mandatory.
  if (!chatModal) {
    console.error("❌ Chat Modal missing. Cannot initialize chat.");
    return;
  }

  const ITEM_NAME = chatModal.dataset.itemName;
  const SELLER_ID = chatModal.dataset.sellerId;
  const CURRENT_USER_ID = chatModal.dataset.currentUserId || "";

  // 2. Data Check
  if (!ITEM_NAME || !SELLER_ID || !CURRENT_USER_ID) {
    if (openChatButton) {
      openChatButton.addEventListener("click", (e) => {
        e.preventDefault();
        if (!CURRENT_USER_ID) {
          if (
            confirm("로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?")
          ) {
            window.location.href = "/login";
          }
        } else {
          alert("채팅 데이터가 부족합니다.");
        }
      });
    }
    return;
  }

  // 3. Setup IDs
  const urlParams = new URLSearchParams(window.location.search);
  const OTHER_USER_ID = urlParams.get("with");

  let conversationId;
  if (OTHER_USER_ID) {
    const userIds = [CURRENT_USER_ID, OTHER_USER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  } else {
    const userIds = [CURRENT_USER_ID, SELLER_ID].sort();
    conversationId = `${userIds[0]}_${userIds[1]}_${ITEM_NAME}`;
  }

  const RECEIVER_ID = CURRENT_USER_ID === SELLER_ID ? OTHER_USER_ID : SELLER_ID;
  const currentUserInitial = CURRENT_USER_ID.charAt(0).toUpperCase();
  const receiverInitial = RECEIVER_ID
    ? RECEIVER_ID.charAt(0).toUpperCase()
    : "?";

  // Elements
  const messagesContainer = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-btn");
  const fileInput = document.getElementById("file-input");
  const photoBtn = document.getElementById("photo-btn");
  const chatPreviewContainer = document.getElementById("chat-image-preview"); // 🔥 Added this back
  const bodyElement = document.body;

  let currentFileToSend = null;
  let currentConversationRef = null;
  let currentMessageListener = null;

  // --- TRANSACTION LOGIC ---
  function checkTransactionStatus() {
    $.ajax({
      url: `/api/item/status/${ITEM_NAME}`,
      type: "GET",
      success: function (response) {
        let status = response.status;
        const chosenBuyer = response.buyer_id;
        const seller = response.seller;

        // Check HTML override for Sold items
        const legacyStatus = chatModal.dataset.itemStatus;
        if (status === "active" && legacyStatus === "sold") {
          status = "sold";
        }

        const isMeSeller = CURRENT_USER_ID === seller;
        const isMeBuyer = CURRENT_USER_ID === chosenBuyer;

        const actionsDiv = document.getElementById("chat-actions");
        const inputArea = document.querySelector(".chat-footer");

        if (!actionsDiv) return;
        actionsDiv.innerHTML = "";
        if (inputArea) inputArea.style.display = "flex";

        if (
          status === "active" ||
          status === "new" ||
          status === "used" ||
          status === "almost_new"
        ) {
          if (isMeSeller && RECEIVER_ID) {
            const btn = document.createElement("button");
            btn.innerText = "거래 완료 요청";
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
        } else if (status === "reserved") {
          if (isMeBuyer) {
            const btn = document.createElement("button");
            btn.innerText = "거래 확정 하기";
            btn.className = "item-detail-btn";
            btn.style.cssText =
              "padding: 5px 10px; font-size: 12px; background: #d32f2f; color: white; border:none; border-radius:4px; cursor:pointer;";
            btn.onclick = confirmTransaction;
            actionsDiv.appendChild(btn);
          } else if (isMeSeller) {
            actionsDiv.innerHTML =
              "<span style='font-size:12px; color:orange; font-weight:bold;'>거래 확정 대기중...</span>";
          } else {
            if (inputArea) inputArea.style.display = "none";
            actionsDiv.innerHTML =
              "<span style='font-size:12px; color:gray;'>다른 사용자와 거래중입니다.</span>";
          }
        } else if (status === "sold") {
          if (inputArea) inputArea.style.display = "none";
          actionsDiv.innerHTML =
            "<span style='font-size:12px; color:#00462A; font-weight:bold;'>거래 완료됨 (Sold)</span>";
        }
      },
      error: function (e) {
        console.error("Status check failed", e);
      },
    });
  }

  function startTransaction(buyerId) {
    $.ajax({
      url: "/api/transaction/start",
      type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ item_name: ITEM_NAME, buyer_id: buyerId }),
      success: function () {
        alert("거래 완료 요청을 보냈습니다.");
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
        alert("거래가 확정되었습니다!");
        checkTransactionStatus();
      },
    });
  }

  // --- IMAGE PREVIEW LOGIC (Restored) ---
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
        img.style.cssText = "width: 100%; height: 100%; object-fit: cover;";

        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = "&times;";
        deleteBtn.classList.add("chat-preview-delete-btn");
        deleteBtn.style.cssText =
          "position: absolute; top: -1px; right: -1px; background: rgba(0,0,0,0.6); color: white; border: none; width: 16px; height: 16px; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 1; padding: 0;";

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

  // --- MESSAGE LOGIC ---
  function addMessage(content, senderId) {
    if (!messagesContainer) return;
    const role = senderId === CURRENT_USER_ID ? "sender" : "receiver";
    const { text, imageURL } = content;
    const row = document.createElement("div");
    row.classList.add("message-row", role);
    const bubble = document.createElement("div");
    bubble.classList.add("message-bubble", role);

    if (imageURL) {
      const img = document.createElement("img");
      img.src = imageURL;
      img.style.cssText =
        "max-width: 100%; border-radius: 8px; margin-bottom: 5px;";
      bubble.appendChild(img);
    }
    if (text) {
      const p = document.createElement("p");
      p.textContent = text;
      p.style.margin = "0";
      bubble.appendChild(p);
    }

    const avatar = document.createElement("div");
    avatar.classList.add("message-avatar", role);
    avatar.textContent =
      role === "receiver" ? receiverInitial : currentUserInitial;

    if (role === "receiver") {
      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      row.appendChild(bubble);
      row.appendChild(avatar);
    }
    messagesContainer.appendChild(row);
    scrollToBottom(document.querySelector(".chat-body"));
  }

  function scrollToBottom(containerElement) {
    if (!containerElement) return;
    requestAnimationFrame(() => {
      containerElement.scrollTop = containerElement.scrollHeight;
    });
  }

  // --- OPEN CHAT ---
  function openChat() {
    const headerAvatarEl = document.querySelector(".chat-header-avatar");
    const headerNameEl = document.querySelector(".chat-header-name.user-id");

    if (!RECEIVER_ID) {
      alert("대화 상대 정보가 없습니다.");
      return;
    }

    if (headerAvatarEl) headerAvatarEl.textContent = receiverInitial;
    if (headerNameEl) headerNameEl.textContent = `@${RECEIVER_ID}`;

    chatModal.style.display = "flex";
    bodyElement.classList.add("no-scroll");

    checkTransactionStatus();

    // PING & STATUS
    if (typeof startPresencePing === "function" && CURRENT_USER_ID) {
      startPresencePing(CURRENT_USER_ID);
    }
    if (typeof startStatusListener === "function" && RECEIVER_ID) {
      startStatusListener(RECEIVER_ID);
    }

    currentConversationRef = database.ref("conversations/" + conversationId);
    if (currentMessageListener) {
      currentConversationRef.off("value", currentMessageListener);
    }
    if (messagesContainer) messagesContainer.innerHTML = "Loading...";

    currentMessageListener = currentConversationRef.on("value", (snapshot) => {
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
          "<div class='chat-system-message'>대화가 시작되었습니다.</div>";
      }
      scrollToBottom(document.querySelector(".chat-body"));
    });
  }

  function closeChat() {
    if (currentConversationRef && currentMessageListener) {
      currentConversationRef.off("value", currentMessageListener);
      currentMessageListener = null;
    }
    chatModal.style.display = "none";
    bodyElement.classList.remove("no-scroll");
  }

  // --- SEND LOGIC (Includes Image) ---
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
        options = { method: "POST", body: formData };
      } else {
        url = `/api/chat/send/${ITEM_NAME}`;
        options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: originalText,
            other_user_id: OTHER_USER_ID || null,
          }),
        };
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (result.error) {
        alert("Failed to send: " + result.error);
        chatInput.value = originalText;
        return;
      }

      if (hasImage) {
        currentFileToSend = null;
        if (fileInput) fileInput.value = null;
        renderChatPreview(null);
      }
    } catch (e) {
      console.error("Send failed", e);
      chatInput.value = originalText;
    }
  }

  // --- BIND EVENTS ---
  if (openChatButton) {
    openChatButton.addEventListener("click", (e) => {
      e.preventDefault();
      openChat();
    });
  }
  const closeBtn = document.getElementById("close-chat-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeChat);
  }
  if (sendButton) {
    sendButton.addEventListener("click", (e) => {
      e.preventDefault();
      handleSend();
    });
  }
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    });
  }
  //  for Image Sending
  if (photoBtn && fileInput) {
    photoBtn.addEventListener("click", () => {
      fileInput.click();
    });
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      renderChatPreview(file || null);
    });
  }

  // --- AUTO-OPEN ---
  if (urlParams.get("chat") === "true") {
    setTimeout(() => {
      openChat();
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
  // 공통 초기화
  initImageUploadFeature();
  initStarRating();
  initChips();
  initFormReset();
  initChatFeature();
  initAutoResizeTextarea();

  // item 페이지에서만 쓰는 함수 있으면 여기서 호출
  if (typeof initItemMoreMenu === "function") {
    initItemMoreMenu();
  }

  // presence ping
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

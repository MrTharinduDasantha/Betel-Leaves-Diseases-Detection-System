document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const usersList = document.getElementById("users-list");
  const chatMessages = document.getElementById("chat-messages");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");
  const tabs = document.querySelectorAll(".tab");
  const imageUpload = document.getElementById("image-upload");
  const imagePreview = document.getElementById("image-preview");
  const deletePopup = document.getElementById("delete-popup");
  const deletePopupMessage = document.getElementById("delete-popup-message");
  const cancelDeleteBtn = document.getElementById("cancel-delete-btn");
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

  // Variables
  let selectedUserId = null;
  let activeTab = "farmers"; // Default tab
  let conversations = {}; // Store conversations by user ID
  let unreadCounts = {}; // Store unread message counts by user ID
  let selectedImage = null; // Store the selected image
  let selectedImageData = null; // Store the selected image data (base64)
  let lastScrollPosition = 0; // Store last scroll position
  let isInitialLoad = true; // Flag for initial load
  let editingMessageId = null; // Track which message is being edited
  let deletingMessageId = null; // Track which message is being deleted
  let isEditMode = false; // Track if we're in edit mode
  let socket = null; // Socket.IO connection
  let onlineUsers = new Set(); // Track online users
  let typingUsers = {}; // Track users who are typing
  let typingTimeout = null; // Timeout for typing indicator

  // Initialize Socket.IO
  initializeSocket();

  // Initialize text animation
  initTextAnimation();

  // Function to create loading spinner
  function createLoadingSpinner(message) {
    const spinner = document.createElement("div");
    spinner.className = "loading-spinner";
    spinner.innerHTML = `
      <div class="spinner"></div>
      <p>${message}</p>
    `;
    return spinner;
  }

  // Function to initialize Socket.IO
  function initializeSocket() {
    socket = io();

    // Join user's room on connection
    socket.on("connect", function () {
      console.log("Connected to Socket.IO");
      socket.emit("join", { user_id: currentUserId });
    });

    // Listen for online status updates
    socket.on("user_online", function (data) {
      console.log("User online:", data.user_id);
      onlineUsers.add(data.user_id);
      updateOnlineStatus(data.user_id, true);
    });

    // Listen for offline status updates
    socket.on("user_offline", function (data) {
      console.log("User offline:", data.user_id);
      onlineUsers.delete(data.user_id);
      updateOnlineStatus(data.user_id, false);
    });

    // Listen for user list updates
    socket.on("update_user_list", function (data) {
      updateUserInList(data.user_id, data.last_message, data.last_message_time);
    });

    // Listen for new messages
    socket.on("message", function (data) {
      // Check if this message is for the current conversation
      if (
        (data.sender_id === currentUserId &&
          data.receiver_id === selectedUserId) ||
        (data.sender_id === selectedUserId &&
          data.receiver_id === currentUserId)
      ) {
        // Add message to conversation
        if (!conversations[selectedUserId]) {
          conversations[selectedUserId] = [];
        }

        conversations[selectedUserId].push({
          _id: data.message_id,
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          content: data.content,
          timestamp: data.timestamp,
          read: data.read || false,
          delivered: data.delivered || false,
        });

        // Display updated conversation
        displayMessages(conversations[selectedUserId]);

        // Scroll to bottom if the sender is the current user
        if (data.sender_id === currentUserId) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        // Mark message as read if it's from the selected user
        if (data.sender_id === selectedUserId) {
          socket.emit("mark_read", {
            user_id: currentUserId,
            sender_id: selectedUserId,
          });
        }

        // Update user list with new message details
        updateUserInList(
          data.sender_id === currentUserId ? data.receiver_id : data.sender_id,
          data.content,
          data.timestamp
        );
      } else if (data.sender_id !== currentUserId) {
        // Message is from someone else, update their unread count
        if (!unreadCounts[data.sender_id]) {
          unreadCounts[data.sender_id] = 0;
        }
        unreadCounts[data.sender_id]++;

        // Update user list to show new unread count
        updateUnreadCount(data.sender_id, unreadCounts[data.sender_id]);

        // Update user list with new message details
        updateUserInList(data.sender_id, data.content, data.timestamp);
      }
    });

    // Listen for message updates
    socket.on("message_updated", function (data) {
      console.log("Message updated received:", data);

      // Find the message in all conversations
      for (const userId in conversations) {
        const messageIndex = conversations[userId].findIndex(
          (msg) => msg._id === data.message_id
        );

        if (messageIndex !== -1) {
          // Update the message content and is_image flag
          conversations[userId][messageIndex].content = data.content;
          conversations[userId][messageIndex].is_image = data.is_image;

          // If this is the current conversation, update the display
          if (userId === selectedUserId) {
            displayMessages(conversations[userId]);

            // Show success message
            const successIndicator = document.createElement("div");
            successIndicator.className = "sending-indicator";
            successIndicator.style.backgroundColor = "rgba(76, 175, 80, 0.2)";
            successIndicator.style.color = "#4CAF50";
            successIndicator.textContent = "Message updated successfully";
            chatMessages.appendChild(successIndicator);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            setTimeout(() => {
              if (successIndicator.parentNode) {
                successIndicator.parentNode.removeChild(successIndicator);
              }
            }, 2000);
          }

          // Update user list with updated message details
          if (conversations[userId][messageIndex].sender_id === currentUserId) {
            updateUserInList(
              userId,
              data.content,
              conversations[userId][messageIndex].timestamp
            );
          }
          break;
        }
      }
    });

    // Listen for message deletions
    socket.on("message_deleted", function (data) {
      // Find and remove the message from all conversations
      for (const userId in conversations) {
        const messageIndex = conversations[userId].findIndex(
          (msg) => msg._id === data.message_id
        );

        if (messageIndex !== -1) {
          // Remove the message
          conversations[userId].splice(messageIndex, 1);

          // If this is the current conversation, update the display
          if (userId === selectedUserId) {
            displayMessages(conversations[userId]);
          }

          // Update user list with previous message details if available
          const lastMessage =
            conversations[userId][conversations[userId].length - 1];
          if (lastMessage) {
            updateUserInList(
              userId,
              lastMessage.content,
              lastMessage.timestamp
            );
          } else {
            updateUserInList(userId, "", "");
          }
          break;
        }
      }
    });

    // Listen for messages being marked as read
    socket.on("messages_read", function (data) {
      // Update unread count for this sender
      unreadCounts[data.sender_id] = 0;
      updateUnreadCount(data.sender_id, 0);

      // Update message delivery status to "read"
      if (conversations[data.sender_id]) {
        conversations[data.sender_id].forEach((message) => {
          if (message.sender_id === currentUserId) {
            message.read = true;
          }
        });

        // If this is the current conversation, update the display
        if (data.sender_id === selectedUserId) {
          displayMessages(conversations[data.sender_id]);
        }
      }
    });

    // Listen for message delivery status
    socket.on("message_delivered", function (data) {
      // Update message delivery status
      if (conversations[data.receiver_id]) {
        const messageIndex = conversations[data.receiver_id].findIndex(
          (msg) => msg._id === data.message_id
        );

        if (messageIndex !== -1) {
          conversations[data.receiver_id][messageIndex].delivered = true;

          // If this is the current conversation, update the display
          if (data.receiver_id === selectedUserId) {
            displayMessages(conversations[data.receiver_id]);
          }
        }
      }
    });

    // Listen for online status updates
    socket.on("user_online", function (data) {
      onlineUsers.add(data.user_id);
      updateOnlineStatus(data.user_id, true);
    });

    // Listen for offline status updates
    socket.on("user_offline", function (data) {
      onlineUsers.delete(data.user_id);
      updateOnlineStatus(data.user_id, false);
    });

    // Listen for typing indicators
    socket.on("typing", function (data) {
      if (data.sender_id === selectedUserId) {
        // Show typing indicator in the current conversation
        showTypingIndicator(data.sender_id);
      } else {
        // Show typing indicator in the user list
        updateTypingStatus(data.sender_id, true);
      }
    });

    // Listen for stopped typing
    socket.on("stop_typing", function (data) {
      if (data.sender_id === selectedUserId) {
        // Hide typing indicator in the current conversation
        hideTypingIndicator();
      } else {
        // Hide typing indicator in the user list
        updateTypingStatus(data.sender_id, false);
      }
    });

    // Handle disconnection
    socket.on("disconnect", function () {
      // Emit offline status when disconnecting
      socket.emit("user_offline", { user_id: currentUserId });
    });
  }

  // Function to update online status in the UI
  function updateOnlineStatus(userId, isOnline) {
    const userItem = document.querySelector(
      `.user-item[data-user-id="${userId}"]`
    );

    if (userItem) {
      let statusDot = userItem.querySelector(".online-status");

      if (!statusDot) {
        statusDot = document.createElement("div");
        statusDot.className = "online-status";
        userItem.appendChild(statusDot);
      }

      if (isOnline) {
        statusDot.classList.add("online");
      } else {
        statusDot.classList.remove("online");
      }
    }
  }

  // Function to show typing indicator in the conversation
  function showTypingIndicator() {
    // Clear any existing typing indicator
    hideTypingIndicator();

    // Create new typing indicator
    const typingIndicator = document.createElement("div");
    typingIndicator.className = "message received";
    typingIndicator.id = "typing-indicator";
    typingIndicator.innerHTML = `
      <div class="message-content">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Function to hide typing indicator in the conversation
  function hideTypingIndicator() {
    const typingIndicator = document.getElementById("typing-indicator");
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  // Function to update typing status in the user list
  function updateTypingStatus(userId, isTyping) {
    const userItem = document.querySelector(
      `.user-item[data-user-id="${userId}"]`
    );

    if (userItem) {
      let lastMessage = userItem.querySelector(".last-message");

      if (lastMessage) {
        if (isTyping) {
          typingUsers[userId] = true;
          lastMessage.innerHTML =
            '<span class="typing-indicator">Typing Reply...</span>';
        } else {
          delete typingUsers[userId];

          // Restore the original last message
          const user = userItem.dataset.userId;
          const lastMessageContent =
            conversations[user] && conversations[user].length > 0
              ? conversations[user][conversations[user].length - 1].content
              : "No conversation";

          const isImage =
            typeof lastMessageContent === "string" &&
            (lastMessageContent.startsWith("data:image") ||
              lastMessageContent === "[Image]");

          if (isImage) {
            lastMessage.innerHTML =
              '<i class="fa fa-picture-o message-image-indicator"></i>Image';
          } else {
            lastMessage.textContent = lastMessageContent || "No conversation";
          }
        }
      }
    }
  }

  // Function to animate the "Start Your Conversation" text with proper spacing
  function initTextAnimation() {
    const animationContainer = document.getElementById("start-chat-animation");
    if (!animationContainer) return;

    const text = animationContainer.textContent.trim();
    animationContainer.textContent = "";

    // Create spans for each character with special handling for spaces
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement("span");

      if (text[i] === " ") {
        span.textContent = " ";
        span.className = "space";
      } else {
        span.textContent = text[i];
      }

      span.style.animationDelay = `${i * 0.1}s`;
      animationContainer.appendChild(span);
    }
  }

  // Load users based on active tab
  function loadUsers(userType) {
    // Show loading spinner
    usersList.innerHTML = "";
    usersList.appendChild(
      createLoadingSpinner(
        userType === "farmers" ? "Loading Farmers..." : "Loading Officers..."
      )
    );

    fetch(`/get-users?type=${userType}`)
      .then((response) => response.json())
      .then((users) => {
        // Clear loading spinner
        usersList.innerHTML = "";

        if (users.length === 0) {
          // Show no users message
          const noUsersMessage = document.createElement("div");
          noUsersMessage.className = "no-users-message";
          noUsersMessage.textContent =
            userType === "farmers"
              ? "No farmers available."
              : "No officers available.";
          usersList.appendChild(noUsersMessage);
        } else {
          // Save current selection
          const previouslySelectedId = selectedUserId;

          users.forEach((user, index) => {
            // Create user item with message preview and unread count
            const userItem = document.createElement("div");
            userItem.className = "user-item";
            userItem.dataset.userId = user._id;

            // Check if this was the previously selected user
            if (user._id === previouslySelectedId) {
              userItem.classList.add("active");
            }

            // Get last message and unread count
            const lastMessage = user.last_message || "";
            const unreadCount = user.unread_count || 0;
            const lastMessageTime = user.last_message_time || "";

            // Store unread count
            unreadCounts[user._id] = unreadCount;

            // Determine if last message is an image
            const isImage =
              lastMessage.includes("data:image") ||
              lastMessage.includes("[Image]");

            // Set message preview text
            let messagePreview = "No conversation";
            if (lastMessage) {
              messagePreview = isImage
                ? '<i class="fa fa-picture-o message-image-indicator"></i>Image'
                : lastMessage;
            }

            // Check if user is typing
            if (typingUsers[user._id]) {
              messagePreview =
                '<span class="typing-indicator">Typing Reply...</span>';
            }

            userItem.innerHTML = `
              <img src="${user.profile_pic}" alt="${user.name}" />
              <div class="user-info">
                <div class="user-header">
                  <div class="user-name">${user.name}</div>
                  ${
                    lastMessageTime
                      ? `<div class="message-time">${formatTimeShort(
                          lastMessageTime
                        )}</div>`
                      : ""
                  }
                </div>
                <div class="message-preview">
                  <div class="last-message">${messagePreview}</div>
                  ${
                    unreadCount > 0
                      ? `<div class="unread-count">${unreadCount}</div>`
                      : ""
                  }
                </div>
              </div>
              <div class="online-status ${
                onlineUsers.has(user._id) ? "online" : ""
              }"></div>
            `;

            userItem.addEventListener("click", () => selectUser(user._id));
            usersList.appendChild(userItem);
          });
        }
      })
      .catch((error) => {
        console.error("Error loading users:", error);
        usersList.innerHTML =
          '<div class="error-message">Error loading users</div>';
      });
  }

  // Update a specific user in the list
  function updateUserInList(userId, lastMessage, lastMessageTime) {
    const userItem = document.querySelector(
      `.user-item[data-user-id="${userId}"]`
    );

    if (userItem) {
      // User exists in current list - update it
      const lastMessageElem = userItem.querySelector(".last-message");
      const messageTimeElem = userItem.querySelector(".message-time");

      if (lastMessageElem) {
        // Check if user is typing
        if (typingUsers[userId]) {
          lastMessageElem.innerHTML =
            '<span class="typing-indicator">Typing Reply...</span>';
        } else {
          const isImage =
            typeof lastMessage === "string" &&
            (lastMessage.startsWith("data:image") ||
              lastMessage.includes("res.cloudinary.com") ||
              lastMessage === "[Image]");

          // Handle image preview
          if (isImage) {
            lastMessageElem.innerHTML =
              '<i class="fa fa-picture-o message-image-indicator"></i>Image';
          } else {
            // Handle text preview with truncation
            const truncatedMessage =
              lastMessage.length > 30
                ? lastMessage.substring(0, 30) + "..."
                : lastMessage;
            lastMessageElem.textContent = truncatedMessage || "No conversation";
          }
        }
      }

      if (messageTimeElem) {
        messageTimeElem.textContent = formatTimeShort(lastMessageTime);
      }

      // Move this user to the top of the list
      const parent = userItem.parentNode;
      if (parent && parent.firstChild !== userItem) {
        parent.insertBefore(userItem, parent.firstChild);
      }
    } else {
      // User is not in the current list - need to check if they belong here
      // Fetch user info to determine their role
      fetch(`/get-user-info?user_id=${userId}`)
        .then((response) => response.json())
        .then((user) => {
          // Check if this user belongs in the currently active tab
          const userBelongsInCurrentTab =
            (activeTab === "farmers" && user.role === "user") ||
            (activeTab === "officers" && user.role === "admin");

          if (userBelongsInCurrentTab) {
            // Reload the entire user list to include this user
            loadUsers(activeTab);
          }
          // If user doesn't belong in current tab, silently ignore
          // (the message will still appear when user switches tabs)
        })
        .catch((error) => {
          console.error("Error fetching user info:", error);
        });
    }
  }

  // Add CSS for sending indicator
  document.head.insertAdjacentHTML(
    "beforeend",
    `
  <style>
    .sending-indicator {
      align-self: center;
      background-color: rgba(91, 145, 32, 0.2);
      color: #5b9120;
      padding: 5px 10px;
      border-radius: 10px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    
    .typing-dots {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .typing-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #5b9120;
      animation: typingAnimation 1.4s infinite ease-in-out;
    }
    
    .typing-dots span:nth-child(1) {
      animation-delay: 0s;
    }
    
    .typing-dots span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-dots span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typingAnimation {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.6;
      }
      30% {
        transform: translateY(-5px);
        opacity: 1;
      }
    }
  </style>
  `
  );

  // Update unread count for a specific user
  function updateUnreadCount(userId, count) {
    const userItem = document.querySelector(
      `.user-item[data-user-id="${userId}"]`
    );
    if (userItem) {
      let unreadCountElem = userItem.querySelector(".unread-count");

      if (count > 0) {
        if (unreadCountElem) {
          unreadCountElem.textContent = count;
        } else {
          const messagePreviewElem = userItem.querySelector(".message-preview");
          if (messagePreviewElem) {
            unreadCountElem = document.createElement("div");
            unreadCountElem.className = "unread-count";
            unreadCountElem.textContent = count;
            messagePreviewElem.appendChild(unreadCountElem);
          }
        }
      } else if (unreadCountElem) {
        unreadCountElem.remove();
      }
    }
  }

  // Format time for message list (short format) with Sri Lanka timezone
  function formatTimeShort(timestamp) {
    if (!timestamp) return "";

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";

      // Convert to Sri Lanka time (UTC+5:30)
      const sriLankaTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);

      const now = new Date();
      const sriLankaNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
      const isToday =
        sriLankaTime.toDateString() === sriLankaNow.toDateString();

      if (isToday) {
        return sriLankaTime.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
      } else {
        return sriLankaTime.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
      }
    } catch (e) {
      console.error("Error formatting time:", e);
      return "";
    }
  }

  // Select a user to chat with
  function selectUser(userId) {
    // Reset edit mode when changing users
    resetEditMode();

    selectedUserId = userId;
    isInitialLoad = true; // Reset scroll position on new user selection

    // Update UI to show selected user
    document.querySelectorAll(".user-item").forEach((item) => {
      item.classList.remove("active");
    });

    const userItem = document.querySelector(
      `.user-item[data-user-id="${userId}"]`
    );
    if (userItem) {
      userItem.classList.add("active");

      // Remove unread count when chat is opened
      const unreadCountElement = userItem.querySelector(".unread-count");
      if (unreadCountElement) {
        unreadCountElement.remove();
      }
    }

    // Load conversation with this user
    loadConversation(userId);

    // Mark messages as read
    markMessagesAsRead(userId);
  }

  // Reset edit mode
  function resetEditMode() {
    isEditMode = false;
    editingMessageId = null;
    messageInput.value = "";
    clearImagePreview();
    selectedImageData = null;
  }

  // Mark messages as read
  function markMessagesAsRead(userId) {
    // Use Socket.IO to mark messages as read
    socket.emit("mark_read", {
      user_id: currentUserId,
      sender_id: userId,
    });

    // Update local unread counts
    unreadCounts[userId] = 0;
    updateUnreadCount(userId, 0);
  }

  // Load conversation with a specific user
  function loadConversation(userId) {
    return new Promise((resolve, reject) => {
      // Show loading spinner
      chatMessages.innerHTML = "";
      chatMessages.appendChild(createLoadingSpinner("Loading Messages..."));

      fetch(`/get-messages?user_id=${userId}`)
        .then((response) => response.json())
        .then((messages) => {
          // Save current scroll position if not initial load
          if (!isInitialLoad) {
            lastScrollPosition = chatMessages.scrollTop;
          }

          // Store conversation
          conversations[userId] = messages;

          // Display messages (this will replace the loading spinner)
          displayMessages(messages);

          // If this is the initial load, scroll to bottom
          if (isInitialLoad) {
            chatMessages.scrollTop = chatMessages.scrollHeight;
            isInitialLoad = false;
          } else {
            // Otherwise restore previous scroll position
            chatMessages.scrollTop = lastScrollPosition;
          }

          resolve();
        })
        .catch((error) => {
          console.error("Error loading conversation:", error);
          chatMessages.innerHTML =
            '<div class="error-message">Error loading messages</div>';
          reject(error);
        });
    });
  }

  // Display messages in the chat area
  function displayMessages(messages) {
    chatMessages.innerHTML = "";

    if (messages.length === 0) {
      chatMessages.innerHTML = `
        <div class="start-chat-message">
          <div class="text-animation" id="start-chat-animation">Start Your Conversation</div>
        </div>
      `;
      initTextAnimation();
      return;
    }

    let lastDate = null;

    messages.forEach((message) => {
      // Get message date in Sri Lanka timezone
      const messageDate = new Date(message.timestamp);
      const sriLankaDate = new Date(
        messageDate.getTime() + 5.5 * 60 * 60 * 1000
      );
      const messageDateString = sriLankaDate.toDateString();

      // Check if we need to add a date separator
      if (messageDateString !== lastDate) {
        const dateSeparator = document.createElement("div");
        dateSeparator.className = "date-separator";
        dateSeparator.innerHTML = `<span>${formatDateSeparator(
          sriLankaDate
        )}</span>`;
        chatMessages.appendChild(dateSeparator);
        lastDate = messageDateString;
      }

      const messageElement = document.createElement("div");
      messageElement.className = `message ${
        message.sender_id === currentUserId ? "sent" : "received"
      }`;
      messageElement.dataset.messageId = message._id;

      // Check if message content is an image (Cloudinary URL or base64)
      let messageContent = message.content;
      const isImage =
        message.is_image ||
        message.content.startsWith("data:image") ||
        message.content.includes("res.cloudinary.com");

      if (isImage) {
        messageContent = `<img src="${message.content}" alt="Image" class="message-image">`;
      }

      // Only add message options to sent messages
      const messageOptions =
        message.sender_id === currentUserId
          ? `<div class="message-options" data-message-id="${message._id}">
          <i class="fa fa-ellipsis-v"></i>
        </div>
        <div class="message-actions" data-message-id="${message._id}">
          <i class="fa fa-pencil-square edit-message" data-message-id="${message._id}" data-is-image="${isImage}"></i>
          <i class="fa fa-minus-square delete-message" data-message-id="${message._id}" data-is-image="${isImage}"></i>
          <i class="fa fa-window-close close-actions" data-message-id="${message._id}"></i>
        </div>`
          : "";

      // Add delivery status for sent messages
      const deliveryStatus =
        message.sender_id === currentUserId
          ? `<div class="delivery-status ${
              message.read ? "read" : message.delivered ? "delivered" : ""
            }">
            ${
              message.read
                ? '<i class="fa fa-check"></i><i class="fa fa-check"></i>'
                : message.delivered
                ? '<i class="fa fa-check"></i><i class="fa fa-check"></i>'
                : '<i class="fa fa-check"></i>'
            }
          </div>`
          : "";

      messageElement.innerHTML = `
        <div class="message-content">${messageContent}</div>
        <div class="time">
          ${formatTime(message.timestamp)}
          ${deliveryStatus}
        </div>
        ${messageOptions}
      `;

      chatMessages.appendChild(messageElement);
    });

    // Add event listeners to message options
    addMessageOptionListeners();
  }

  // Add event listeners to message options
  function addMessageOptionListeners() {
    // Show actions when clicking ellipsis
    document.querySelectorAll(".message-options").forEach((option) => {
      option.addEventListener("click", function () {
        const messageId = this.dataset.messageId;
        this.style.display = "none";
        document.querySelector(
          `.message-actions[data-message-id="${messageId}"]`
        ).style.display = "block";
      });
    });

    // Hide actions when clicking close
    document.querySelectorAll(".close-actions").forEach((close) => {
      close.addEventListener("click", function () {
        const messageId = this.dataset.messageId;
        document.querySelector(
          `.message-actions[data-message-id="${messageId}"]`
        ).style.display = "none";
        document.querySelector(
          `.message-options[data-message-id="${messageId}"]`
        ).style.display = "block";
      });
    });

    // Edit message
    document.querySelectorAll(".edit-message").forEach((edit) => {
      edit.addEventListener("click", function () {
        const messageId = this.dataset.messageId;
        const isImage = this.dataset.isImage === "true";
        handleEditMessage(messageId, isImage);
      });
    });

    // Delete message
    document.querySelectorAll(".delete-message").forEach((del) => {
      del.addEventListener("click", function () {
        const messageId = this.dataset.messageId;
        const isImage = this.dataset.isImage === "true";
        handleDeleteMessage(messageId, isImage);
      });
    });
  }

  // Handle edit message
  function handleEditMessage(messageId, isImage) {
    // If already in edit mode for this message, cancel edit
    if (isEditMode && editingMessageId === messageId) {
      resetEditMode();
      return;
    }

    // Find the message in conversations
    const message = findMessageById(messageId);
    if (!message) return;

    // Set edit mode
    isEditMode = true;
    editingMessageId = messageId;

    // Load content into input field
    if (isImage) {
      // For images, show preview
      selectedImage = null; // Clear any existing image
      selectedImageData = message.content; // Store the image data

      // Create preview from existing image
      imagePreview.innerHTML = `
        <img src="${message.content}" style="margin-left: 10px;" alt="Preview">
        <span class="remove-image"><i class="fa fa-times"></i></span>
      `;

      // Add event listener to remove image
      imagePreview
        .querySelector(".remove-image")
        .addEventListener("click", clearImagePreview);
    } else {
      // For text, set input value
      messageInput.value = message.content;
      messageInput.focus();
    }
  }

  // Find message by ID in current conversation
  function findMessageById(messageId) {
    if (!selectedUserId || !conversations[selectedUserId]) return null;

    return conversations[selectedUserId].find((msg) => msg._id === messageId);
  }

  // Handle delete message
  function handleDeleteMessage(messageId, isImage) {
    deletingMessageId = messageId;

    // Update popup message based on content type
    deletePopupMessage.textContent = `Are you sure you want to delete this ${
      isImage ? "photo" : "message"
    }?`;

    // Show delete confirmation popup
    deletePopup.style.display = "flex";
  }

  // Format timestamp to readable time with Sri Lanka timezone
  function formatTime(timestamp) {
    if (!timestamp) return "";

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";

      // Convert to Sri Lanka time (UTC+5:30)
      const sriLankaTime = new Date(date.getTime() + 5.5 * 60 * 60 * 1000);

      // Use toLocaleString to format the time
      return sriLankaTime.toLocaleString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      console.error("Error formatting time:", e);
      return "";
    }
  }

  // Format date separator (Today, Yesterday, or date)
  function formatDateSeparator(date) {
    const now = new Date();
    const sriLankaNow = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);

    const today = new Date(
      Date.UTC(
        sriLankaNow.getUTCFullYear(),
        sriLankaNow.getUTCMonth(),
        sriLankaNow.getUTCDate()
      )
    );
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const messageDay = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );

    if (messageDay.getTime() === today.getTime()) {
      return "Today";
    } else if (messageDay.getTime() === yesterday.getTime()) {
      return "Yesterday";
    } else {
      // Format as MM/DD/YYYY
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  }

  // Send a message
  // Replace the sendMessage function with this updated version
  function sendMessage() {
    const content = messageInput.value.trim();

    // Don't send if no content and no image
    if ((!content && !selectedImage && !selectedImageData) || !selectedUserId)
      return;

    // Disable send button to prevent multiple clicks
    sendButton.disabled = true;

    // Show sending indicator
    const sendingIndicator = document.createElement("div");
    sendingIndicator.className = "sending-indicator";
    sendingIndicator.textContent = "Sending...";
    chatMessages.appendChild(sendingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // If in edit mode, update message instead of sending new one
    if (isEditMode && editingMessageId) {
      // Use Socket.IO to update message
      if (selectedImage) {
        // For NEW image updates, convert to base64 first
        const reader = new FileReader();
        reader.onload = function (e) {
          // Compress image before sending
          compressImage(e.target.result, function (compressedImage) {
            socket.emit("update_message", {
              message_id: editingMessageId,
              sender_id: currentUserId,
              receiver_id: selectedUserId,
              content: compressedImage,
            });

            // Remove sending indicator and enable button
            if (sendingIndicator.parentNode) {
              sendingIndicator.parentNode.removeChild(sendingIndicator);
            }
            sendButton.disabled = false;

            // Reset edit mode and clear preview
            resetEditMode();
            clearImagePreview();
          });
        };
        reader.readAsDataURL(selectedImage);
      } else if (
        selectedImageData &&
        selectedImageData.startsWith("data:image")
      ) {
        // If we have NEW image data (base64) from file selection
        // Compress image before sending
        compressImage(selectedImageData, function (compressedImage) {
          socket.emit("update_message", {
            message_id: editingMessageId,
            sender_id: currentUserId,
            receiver_id: selectedUserId,
            content: compressedImage,
          });

          // Remove sending indicator and enable button
          if (sendingIndicator.parentNode) {
            sendingIndicator.parentNode.removeChild(sendingIndicator);
          }
          sendButton.disabled = false;

          // Reset edit mode and clear preview
          resetEditMode();
          clearImagePreview();
        });
      } else if (content && !selectedImage && !selectedImageData) {
        // For text updates (changing image to text)
        socket.emit("update_message", {
          message_id: editingMessageId,
          sender_id: currentUserId,
          receiver_id: selectedUserId,
          content: content,
        });

        // Remove sending indicator and enable button
        if (sendingIndicator.parentNode) {
          sendingIndicator.parentNode.removeChild(sendingIndicator);
        }
        sendButton.disabled = false;

        // Reset edit mode
        resetEditMode();
      } else {
        // No changes or invalid state - just reset
        if (sendingIndicator.parentNode) {
          sendingIndicator.parentNode.removeChild(sendingIndicator);
        }
        sendButton.disabled = false;
        resetEditMode();
      }
    } else {
      // Send new message via Socket.IO
      if (selectedImage) {
        // For image messages, convert to base64 first
        const reader = new FileReader();
        reader.onload = function (e) {
          // Compress image before sending
          compressImage(e.target.result, function (compressedImage) {
            socket.emit("send_message", {
              sender_id: currentUserId,
              receiver_id: selectedUserId,
              content: compressedImage,
            });

            // Remove sending indicator and enable button
            if (sendingIndicator.parentNode) {
              sendingIndicator.parentNode.removeChild(sendingIndicator);
            }
            sendButton.disabled = false;
          });
        };
        reader.readAsDataURL(selectedImage);
      } else {
        // For text messages
        socket.emit("send_message", {
          sender_id: currentUserId,
          receiver_id: selectedUserId,
          content: content,
        });

        // Remove sending indicator and enable button
        if (sendingIndicator.parentNode) {
          sendingIndicator.parentNode.removeChild(sendingIndicator);
        }
        sendButton.disabled = false;
      }

      // Clear input and image preview
      messageInput.value = "";
      clearImagePreview();
    }
  }

  // Update the handleEditMessage function to properly handle image selection
  function handleEditMessage(messageId, isImage) {
    // If already in edit mode for this message, cancel edit
    if (isEditMode && editingMessageId === messageId) {
      resetEditMode();
      return;
    }

    // Find the message in conversations
    const message = findMessageById(messageId);
    if (!message) return;

    clearImagePreview();

    // Set edit mode
    isEditMode = true;
    editingMessageId = messageId;

    // Load content into input field
    if (isImage) {
      // For images, show preview but allow new image selection
      selectedImage = null; // Clear any existing new image file
      selectedImageData = null; // Clear any new image data

      // Create preview from existing image
      imagePreview.innerHTML = `
        <img src="${message.content}" style="margin-left: 10px;" alt="Preview">
        <span class="remove-image"><i class="fa fa-times"></i></span>
      `;

      document.querySelector(".image-upload-label").style.display = "none";

      // Add event listener to remove image (which will switch to text)
      imagePreview
        .querySelector(".remove-image")
        .addEventListener("click", function () {
          clearImagePreview();
          messageInput.placeholder = "Enter text message...";
          messageInput.focus();
        });

      // Set placeholder to indicate we're editing an image
      messageInput.placeholder = "Add caption or leave empty to keep image...";
    } else {
      // For text, set input value
      messageInput.value = message.content;
      messageInput.focus();
      messageInput.placeholder = "Edit your message...";
    }
  }

  // Update the image upload handler to handle edit mode properly
  imageUpload.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    selectedImage = file;
    selectedImageData = null; // Clear any previous image data

    // Create preview
    const reader = new FileReader();
    reader.onload = function (e) {
      if (isEditMode) {
        // In edit mode, show that this is a replacement image
        imagePreview.innerHTML = `
        <img src="${e.target.result}" style="margin-left: 10px;" alt="New Image Preview">
        <span class="remove-image"><i class="fa fa-times"></i></span>
      `;
      } else {
        // Normal mode
        imagePreview.innerHTML = `
        <img src="${e.target.result}" style="margin-left: 10px;" alt="Preview">
        <span class="remove-image"><i class="fa fa-times"></i></span>
      `;
      }

      document.querySelector(".image-upload-label").style.display = "none";
      // Add event listener to remove image
      imagePreview
        .querySelector(".remove-image")
        .addEventListener("click", clearImagePreview);
    };
    reader.readAsDataURL(file);
  });

  // Add CSS for image preview info
  document.head.insertAdjacentHTML(
    "beforeend",
    `
  <style>
    .image-preview-info {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
      text-align: center;
    }
    
    .current-image {
      cursor: pointer;
      transition: opacity 0.3s;
    }
    
    .current-image:hover {
      opacity: 0.8;
    }
  </style>
  `
  );

  // Compress image before sending (reduce size)
  function compressImage(base64Image, callback) {
    // Create an image element
    const img = new Image();
    img.onload = function () {
      // Create a canvas element
      const canvas = document.createElement("canvas");

      // Calculate new dimensions (max 800px width/height)
      let width = img.width;
      let height = img.height;
      const maxSize = 800;

      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw image on canvas with new dimensions
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Get compressed image as base64 string
      // Adjust quality (0.7 = 70% quality)
      const compressedImage = canvas.toDataURL("image/jpeg", 0.7);

      // Return the compressed image
      callback(compressedImage);
    };

    // Set image source to the base64 string
    img.src = base64Image;
  }

  // Clear image preview
  function clearImagePreview() {
    imagePreview.innerHTML = "";
    imageUpload.value = "";
    selectedImage = null;
    selectedImageData = null;
    document.querySelector(".image-upload-label").style.display = "";
  }

  // Delete message confirmation
  confirmDeleteBtn.addEventListener("click", function () {
    if (!deletingMessageId) return;

    // Find the message to get receiver ID
    const message = findMessageById(deletingMessageId);
    if (!message) return;

    // Use Socket.IO to delete message
    socket.emit("delete_message", {
      message_id: deletingMessageId,
      sender_id: currentUserId,
      receiver_id: message.receiver_id,
    });

    // Hide popup
    deletePopup.style.display = "none";
    deletingMessageId = null;
  });

  // Cancel delete
  cancelDeleteBtn.addEventListener("click", function () {
    deletePopup.style.display = "none";
    deletingMessageId = null;
  });

  // Handle typing events
  messageInput.addEventListener("input", function () {
    if (selectedUserId) {
      // Clear any existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Emit typing event
      socket.emit("typing", {
        sender_id: currentUserId,
        receiver_id: selectedUserId,
      });

      // Set timeout to emit stop typing after 3 seconds of inactivity
      typingTimeout = setTimeout(() => {
        socket.emit("stop_typing", {
          sender_id: currentUserId,
          receiver_id: selectedUserId,
        });
      }, 3000);
    }
  });

  // Event Listeners

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      tabs.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");

      activeTab = this.dataset.tab;
      loadUsers(activeTab);

      // Reset chat when switching tabs
      selectedUserId = null;
      isInitialLoad = true;
      resetEditMode();
      chatMessages.innerHTML = `
        <div class="start-chat-message">
          <div class="text-animation" id="start-chat-animation">Start Your Conversation</div>
        </div>
      `;
      initTextAnimation();
    });
  });

  // Send message on button click
  sendButton.addEventListener("click", sendMessage);

  // Send message on Enter key
  messageInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Initial load
  loadUsers(activeTab);

  // Check URL parameters for direct chat
  const urlParams = new URLSearchParams(window.location.search);
  const directChatUserId = urlParams.get("user");
  if (directChatUserId) {
    // Need to wait for users to load first
    setTimeout(() => {
      selectUser(directChatUserId);
    }, 500);
  }

  // Emit online status periodically to keep it updated
  setInterval(() => {
    if (socket && socket.connected) {
      socket.emit("user_online", { user_id: currentUserId });
    }
  }, 30000); // Every 30 seconds
});

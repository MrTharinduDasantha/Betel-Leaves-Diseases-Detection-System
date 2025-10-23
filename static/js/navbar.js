document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const dropdownIcon = document.getElementById("dropdown-icon");
  const dropdownContent = document.getElementById("dropdown-content");
  const editProfileBtn = document.getElementById("edit-profile-btn");
  const editProfileModal = document.getElementById("edit-profile-modal");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const editProfileForm = document.getElementById("edit-profile-form");
  const editProfilePicInput = document.getElementById("edit-profile-pic-input");
  const editProfilePic = document.getElementById("edit-profile-pic");
  const editNameInput = document.getElementById("edit-name");
  const editEmailInput = document.getElementById("edit-email");
  const editPasswordInput = document.getElementById("edit-password");
  const toggleEditPassword = document.getElementById("toggle-edit-password");
  const updateBtn = document.getElementById("update-btn");
  const notificationIcon = document.getElementById("notification-icon");
  const notificationCount = document.getElementById("notification-count");
  const notificationDropdown = document.getElementById("notification-dropdown");
  const mobileNotificationDropdown = document.getElementById(
    "mobile-notification-dropdown"
  );
  const notificationList = document.getElementById("notification-list");
  const mobileNotificationList = document.getElementById(
    "mobile-notification-list"
  );
  const clearNotificationsBtn = document.getElementById("clear-notifications");
  const mobileClearNotificationsBtn = document.getElementById(
    "mobile-clear-notifications"
  );
  const mobileMenuIcon = document.getElementById("mobile-menu-icon");
  const mobileNavMenu = document.getElementById("mobile-nav-menu");
  const mobileNavLinks = document.querySelectorAll("#mobile-nav-menu a");

  // Variables
  let notifications = [];
  let notificationVisible = false;
  let mobileMenuVisible = false;
  let isMobile = window.innerWidth <= 992;

  // Check if device is mobile or desktop
  function checkDevice() {
    isMobile = window.innerWidth <= 992;
  }

  // Listen for window resize events
  window.addEventListener("resize", checkDevice);

  // Toggle dropdown menu
  dropdownIcon.addEventListener("click", function () {
    // Hide mobile menu and notification dropdown if open
    if (mobileMenuVisible) {
      toggleMobileMenu();
    }
    if (notificationVisible) {
      toggleNotificationDropdown();
    }

    // Toggle profile dropdown
    dropdownContent.classList.toggle("show-dropdown");
    dropdownIcon.classList.toggle("fa-chevron-circle-up");
    dropdownIcon.classList.toggle("fa-chevron-circle-down");
  });

  // Close dropdown when clicking outside
  window.addEventListener("click", function (event) {
    if (
      !event.target.matches(".dropdown-icon") &&
      !event.target.matches(".profile-pic")
    ) {
      if (dropdownContent.classList.contains("show-dropdown")) {
        dropdownContent.classList.remove("show-dropdown");
        dropdownIcon.classList.add("fa-chevron-circle-up");
        dropdownIcon.classList.remove("fa-chevron-circle-down");
      }
    }
  });

  // Toggle notification dropdown
  notificationIcon.addEventListener("click", function () {
    // Hide mobile menu and profile dropdown if open
    if (mobileMenuVisible) {
      toggleMobileMenu();
    }
    if (dropdownContent.classList.contains("show-dropdown")) {
      dropdownContent.classList.remove("show-dropdown");
      dropdownIcon.classList.add("fa-chevron-circle-up");
      dropdownIcon.classList.remove("fa-chevron-circle-down");
    }

    toggleNotificationDropdown();
  });

  // Toggle notification dropdown function
  function toggleNotificationDropdown() {
    notificationVisible = !notificationVisible;

    if (isMobile) {
      // For mobile devices
      if (notificationVisible) {
        mobileNotificationDropdown.classList.add("show");
        // Mark all notifications as read when opened
        markNotificationsAsRead();
      } else {
        mobileNotificationDropdown.classList.remove("show");
      }
    } else {
      // For desktop
      if (notificationVisible) {
        notificationDropdown.style.display = "block";
        // Mark all notifications as read when opened
        markNotificationsAsRead();
      } else {
        notificationDropdown.style.display = "none";
      }
    }
  }

  // Function to mark notifications as read
  function markNotificationsAsRead() {
    fetch("/mark-notifications-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          // Update local notifications to reflect read status
          notifications = notifications.map((n) => ({ ...n, read: true }));
          notificationCount.style.display = "none";
          updateNotificationUI();
        }
      })
      .catch((error) => {
        console.error("Error marking notifications as read:", error);
      });
  }

  // Close notification dropdown when clicking outside
  window.addEventListener("click", function (event) {
    if (
      !event.target.matches("#notification-icon") &&
      !event.target.closest(".notification-dropdown") &&
      !event.target.closest(".mobile-notification-dropdown")
    ) {
      notificationDropdown.style.display = "none";
      mobileNotificationDropdown.classList.remove("show");
      notificationVisible = false;
    }
  });

  // Open Edit Profile Modal
  editProfileBtn.addEventListener("click", (e) => {
    e.preventDefault();

    // Close dropdown
    dropdownContent.classList.remove("show-dropdown");
    dropdownIcon.classList.add("fa-chevron-circle-up");
    dropdownIcon.classList.remove("fa-chevron-circle-down");

    // Load current user data
    loadUserData();

    // Show modal
    editProfileModal.classList.add("show");
    document.body.style.overflow = "hidden";
  });

  // Close Edit Profile Modal
  cancelEditBtn.addEventListener("click", () => {
    editProfileModal.classList.remove("show");
    document.body.style.overflow = "auto";
  });

  // Close modal when clicking outside
  editProfileModal.addEventListener("click", (e) => {
    if (e.target === editProfileModal) {
      editProfileModal.classList.remove("show");
      document.body.style.overflow = "auto";
    }
  });

  // Load current user data
  function loadUserData() {
    fetch("/get-user-profile")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          editNameInput.value = data.name;
          editEmailInput.value = data.email;
          // Don't load password - leave it empty for security
          editPasswordInput.value = "";
          if (data.profile_pic) {
            if (data.profile_pic.startsWith("http")) {
              editProfilePic.src = data.profile_pic;
            } else {
              editProfilePic.src = `/uploads/${data.profile_pic}`;
            }
          } else {
            editProfilePic.src =
              typeof defaultProfilePic !== "undefined"
                ? defaultProfilePic
                : "/static/images/default_profile.png";
          }

          // Add has-content class to inputs with values (except password)
          editNameInput.classList.add("has-content");
          editEmailInput.classList.add("has-content");

          // Hide eye icon initially since password is empty
          toggleEditPassword.style.display = "none";
        }
      })
      .catch((error) => {
        console.error("Error loading user data:", error);
      });
  }

  // Add this event listener for password input to show/hide eye icon
  editPasswordInput.addEventListener("input", function () {
    if (this.value.length > 0) {
      toggleEditPassword.style.display = "block";
    } else {
      toggleEditPassword.style.display = "none";
    }
  });

  // Handle profile picture change
  editProfilePicInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        editProfilePic.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Toggle password visibility
  toggleEditPassword.addEventListener("click", () => {
    if (editPasswordInput.type === "password") {
      editPasswordInput.type = "text";
      toggleEditPassword.classList.replace("fa-eye", "fa-eye-slash");
    } else {
      editPasswordInput.type = "password";
      toggleEditPassword.classList.replace("fa-eye-slash", "fa-eye");
    }
  });

  // Handle input field focus/blur for label animation
  const editInputs = document.querySelectorAll(".edit-input-field input");
  editInputs.forEach((input) => {
    input.addEventListener("focus", function () {
      this.parentElement.classList.add("focused");
    });

    input.addEventListener("blur", function () {
      if (this.value.trim() === "") {
        this.classList.remove("has-content");
        this.parentElement.classList.remove("focused");
      } else {
        this.classList.add("has-content");
      }
    });

    input.addEventListener("input", function () {
      if (this.value.trim() !== "") {
        this.classList.add("has-content");
      } else {
        this.classList.remove("has-content");
      }
    });
  });

  // Handle form submission
  editProfileForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", editNameInput.value);
    formData.append("email", editEmailInput.value);
    formData.append("password", editPasswordInput.value);

    // Add profile picture if changed
    if (editProfilePicInput.files.length > 0) {
      formData.append("profile_pic", editProfilePicInput.files[0]);
    }

    // Show loading state
    updateBtn.disabled = true;
    updateBtn.textContent = "Updating...";

    fetch("/update-user-profile", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Show success message
          showMessage("Profile updated successfully!", "success");

          // Update session profile pic if changed (supports Cloudinary full URLs)
          if (data.profile_pic) {
            const profilePics = document.querySelectorAll(".profile-pic");
            const newPicUrl = data.profile_pic.startsWith("http")
              ? data.profile_pic
              : `/uploads/${data.profile_pic}`;
            profilePics.forEach((pic) => {
              pic.src = newPicUrl;
            });

            // Also update edit modal preview if open
            if (editProfilePic) {
              editProfilePic.src = newPicUrl;
            }
          }

          // Close modal after 1.5 seconds
          setTimeout(() => {
            editProfileModal.classList.remove("show");
            document.body.style.overflow = "auto";
            updateBtn.disabled = false;
            updateBtn.textContent = "Update";
          }, 1500);
        } else {
          showMessage(data.message || "Error updating profile", "error");
          updateBtn.disabled = false;
          updateBtn.textContent = "Update";
        }
      })
      .catch((error) => {
        console.error("Error updating profile:", error);
        showMessage("Error updating profile", "error");
        updateBtn.disabled = false;
        updateBtn.textContent = "Update";
      });
  });

  // Show message function
  function showMessage(message, type) {
    const messageContainer = document.getElementById("message-container");
    if (!messageContainer) return;

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messageContainer.appendChild(messageDiv);

    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }

  // Toggle mobile menu
  mobileMenuIcon.addEventListener("click", function () {
    // Hide notification dropdown and profile dropdown if open
    if (notificationVisible) {
      toggleNotificationDropdown();
    }
    if (dropdownContent.classList.contains("show-dropdown")) {
      dropdownContent.classList.remove("show-dropdown");
      dropdownIcon.classList.add("fa-chevron-circle-up");
      dropdownIcon.classList.remove("fa-chevron-circle-down");
    }

    toggleMobileMenu();
  });

  // Toggle mobile menu function
  function toggleMobileMenu() {
    mobileMenuVisible = !mobileMenuVisible;
    mobileNavMenu.classList.toggle("show");

    // Toggle between hamburger and X icon
    const menuIconElement = mobileMenuIcon.querySelector("i");
    if (mobileMenuVisible) {
      menuIconElement.classList.remove("fa-bars");
      menuIconElement.classList.add("fa-times");
    } else {
      menuIconElement.classList.remove("fa-times");
      menuIconElement.classList.add("fa-bars");
    }
  }

  // Close mobile menu when a link is clicked
  mobileNavLinks.forEach(function (link) {
    link.addEventListener("click", function () {
      if (mobileMenuVisible) {
        toggleMobileMenu();
      }
    });
  });

  // Clear all notifications (desktop)
  clearNotificationsBtn.addEventListener("click", function () {
    clearAllNotifications();
  });

  // Clear all notifications (mobile)
  mobileClearNotificationsBtn.addEventListener("click", function () {
    clearAllNotifications();
  });

  // Function to clear all notifications
  function clearAllNotifications() {
    fetch("/clear-notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          notifications = [];
          updateNotificationUI();
        }
      })
      .catch((error) => {
        console.error("Error clearing notifications:", error);
      });
  }

  // Format time for notifications
  function formatTime(timestamp) {
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

  // Update notification UI
  function updateNotificationUI() {
    // count only notifications that are still unread
    const unreadCount = notifications.filter((n) => !n.read).length;

    // Update notification count
    if (unreadCount > 0) {
      notificationCount.textContent = unreadCount > 9 ? "9+" : unreadCount;
      notificationCount.style.display = "flex";
    } else {
      notificationCount.style.display = "none";
    }

    // Update notification lists (both desktop and mobile)
    updateNotificationList(notificationList);
    updateNotificationList(mobileNotificationList);
  }

  // Update a specific notification list
  function updateNotificationList(listElement) {
    listElement.innerHTML = "";

    if (notifications.length === 0) {
      listElement.innerHTML = `
      <div class="notification-empty">
        No new notifications
      </div>
    `;
      return;
    }

    // Sort notifications by timestamp (newest first)
    notifications
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .forEach((notification) => {
        const notificationItem = document.createElement("div");
        notificationItem.className = "notification-item";
        notificationItem.dataset.messageId = notification.message_id;

        notificationItem.innerHTML = `
        <div class="notification-content">
          <div class="notification-sender">${notification.sender_name}</div>
          <div class="notification-message">${notification.content}</div>
          <div class="notification-time">${formatTime(
            notification.timestamp
          )}</div>
        </div>
      `;

        // Check if message content is an image
        const isImage =
          notification.content === "[Image]" || notification.is_image === true;
        const messagePreview = isImage
          ? '<i class="fa fa-picture-o message-image-indicator"></i> Photo'
          : notification.content;

        notificationItem.innerHTML = `
        <div class="notification-content">
          <div class="notification-sender">${notification.sender_name}</div>
          <div class="notification-message">${messagePreview}</div>
          <div class="notification-time">${formatTime(
            notification.timestamp
          )}</div>
        </div>
      `;

        listElement.appendChild(notificationItem);
      });
  }

  // Fetch initial notifications
  function fetchNotifications() {
    fetch("/get-notifications")
      .then((response) => response.json())
      .then((data) => {
        notifications = data;
        updateNotificationUI();
      })
      .catch((error) => {
        console.error("Error fetching notifications:", error);
      });
  }

  // Initialize Socket.IO connection if user is logged in
  if (typeof currentUserId !== "undefined" && currentUserId) {
    // Load the Socket.IO client library
    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.6.0/socket.io.min.js";
    script.integrity =
      "sha384-c79GN5VsunZvi+Q/WObgk2in0CbZsHnjEqvFxC5DxHn9lTfNce2WW6h2pH6u/kF+";
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);

    script.onload = function () {
      // Initialize Socket.IO
      const socket = io();

      // Join user's room on connection
      socket.on("connect", function () {
        socket.emit("join", { user_id: currentUserId });

        // Fetch initial notifications
        fetchNotifications();
      });

      // Listen for new notifications
      socket.on("notification", function (data) {
        // Fetch sender info
        fetch(`/get-user-info?user_id=${data.sender_id}`)
          .then((response) => response.json())
          .then((userInfo) => {
            // Add notification
            notifications.push({
              message_id: data.message_id,
              sender_id: data.sender_id,
              sender_name: userInfo.name,
              content: data.content,
              timestamp: data.timestamp,
              is_image: data.is_image || data.content === "[Image]",
              read: false,
            });

            // Update UI
            updateNotificationUI();
          })
          .catch((error) => {
            console.error("Error fetching user info:", error);
          });
      });
    };
  }

  // Check device on initial load
  checkDevice();
});

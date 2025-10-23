document.addEventListener("DOMContentLoaded", function () {
  // Declare variables for search and filter functionality
  let allGuides = [];
  let filteredGuides = [];
  let isSearchActive = false;
  let isFavouriteFilterActive = false;

  // Initialize Quill editor if we're in admin view
  let quill;
  let currentGuideId = null;

  if (currentUserRole === "admin") {
    // Initialize Quill with toolbar options
    quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
      },
      placeholder: "Write cultivation instructions here...",
    });

    // Handle image upload in Quill
    const toolbar = quill.getModule("toolbar");
    toolbar.addHandler("image", handleImageUpload);

    // Form submission
    const guideForm = document.getElementById("guide-form");
    const saveBtn = document.getElementById("save-btn");
    const cancelBtn = document.getElementById("cancel-btn");
    const guideTitleInput = document.getElementById("guide-title");
    const guideIdInput = document.getElementById("guide-id");

    guideForm.addEventListener("submit", function (e) {
      e.preventDefault();

      // Get form data
      const title = guideTitleInput.value.trim();
      const content = quill.root.innerHTML;
      const guideId = guideIdInput.value;

      if (!title) {
        showMessage("Please enter a title for the guide.", "error");
        return;
      }

      // Prepare form data
      const formData = new FormData();
      formData.append("title", title);
      formData.append("content", content);

      let url = "/cultivation-guide/save";

      // If editing an existing guide, include the ID
      if (guideId) {
        formData.append("guide_id", guideId);
        url = "/cultivation-guide/update";
      }

      // Disable save button and show loading state
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      // Send data to server
      fetch(url, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showMessage(data.message, "success");
            resetForm();
            // Reload guides list
            loadGuides();
          } else {
            showMessage(data.message || "An error occurred.", "error");
          }
        })
        .catch((error) => {
          console.error("Error saving guide:", error);
          showMessage("An error occurred while saving the guide.", "error");
        })
        .finally(() => {
          // Re-enable save button
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Guide";
        });
    });

    // Cancel button handler
    cancelBtn.addEventListener("click", function () {
      resetForm();
    });

    // Edit guide button handler (delegated event)
    document.addEventListener("click", function (e) {
      if (
        e.target.classList.contains("edit-guide-btn") ||
        e.target.parentElement.classList.contains("edit-guide-btn")
      ) {
        const button = e.target.classList.contains("edit-guide-btn")
          ? e.target
          : e.target.parentElement;
        const guideId = button.getAttribute("data-id");

        // Fetch guide data for editing
        fetch(`/cultivation-guide/get/${guideId}`)
          .then((response) => response.json())
          .then((data) => {
            if (data.guide) {
              // Check if user can edit this guide
              if (!data.guide.can_edit) {
                showMessage("You can only edit guides you created.", "error");
                return;
              }

              // Populate form with guide data
              guideTitleInput.value = data.guide.title;
              quill.root.innerHTML = data.guide.content;
              guideIdInput.value = data.guide._id;

              // Show cancel button and update save button text
              cancelBtn.style.display = "block";
              saveBtn.textContent = "Update Guide";

              // Scroll to editor
              document
                .querySelector(".guide-editor")
                .scrollIntoView({ behavior: "smooth" });
            }
          })
          .catch((error) => {
            console.error("Error fetching guide:", error);
            showMessage("An error occurred while loading the guide.", "error");
          });
      }
    });

    // Delete guide button handler (delegated event)
    document.addEventListener("click", function (e) {
      if (
        e.target.classList.contains("delete-guide-btn") ||
        e.target.parentElement.classList.contains("delete-guide-btn")
      ) {
        const button = e.target.classList.contains("delete-guide-btn")
          ? e.target
          : e.target.parentElement;
        const guideId = button.getAttribute("data-id");

        // Show confirmation modal
        const deleteModal = document.getElementById("delete-modal");
        deleteModal.style.display = "flex";

        // Set current guide ID for deletion
        currentGuideId = guideId;
      }
    });

    // Delete confirmation handlers
    document
      .getElementById("cancel-delete")
      .addEventListener("click", function () {
        document.getElementById("delete-modal").style.display = "none";
        currentGuideId = null;
      });

    document
      .getElementById("confirm-delete")
      .addEventListener("click", function () {
        if (!currentGuideId) return;

        // Send delete request
        fetch(`/cultivation-guide/delete/${currentGuideId}`, {
          method: "DELETE",
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              showMessage(data.message, "success");
              // Reload guides list
              loadGuides();
            } else {
              showMessage(data.message || "An error occurred.", "error");
            }
          })
          .catch((error) => {
            console.error("Error deleting guide:", error);
            showMessage("An error occurred while deleting the guide.", "error");
          })
          .finally(() => {
            // Hide modal
            document.getElementById("delete-modal").style.display = "none";
            currentGuideId = null;
          });
      });
  }

  // Load guides on page load for BOTH admin and farmer views
  loadGuides();

  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  searchBtn.addEventListener("click", () => {
    const searchTerm = searchInput.value.trim().toLowerCase();

    if (searchTerm === "") {
      isSearchActive = false;
      applyFilters();
    } else {
      isSearchActive = true;
      applyFilters();
    }
  });

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchBtn.click();
    }
  });

  searchInput.addEventListener("input", function () {
    if (this.value.trim() === "") {
      isSearchActive = false;
      applyFilters();
    }
  });

  const favouriteFilterBtn = document.getElementById("favourite-filter-btn");

  favouriteFilterBtn.addEventListener("click", () => {
    isFavouriteFilterActive = !isFavouriteFilterActive;
    const icon = favouriteFilterBtn.querySelector("i");

    if (isFavouriteFilterActive) {
      icon.classList.remove("fa-heart-o");
      icon.classList.add("fa-heart");
      favouriteFilterBtn.classList.add("active");
    } else {
      icon.classList.remove("fa-heart");
      icon.classList.add("fa-heart-o");
      favouriteFilterBtn.classList.remove("active");
    }

    applyFilters();
  });

  function applyFilters() {
    let result = [...allGuides];

    // Apply search filter
    if (isSearchActive) {
      const searchTerm = searchInput.value.trim().toLowerCase();
      result = result.filter((guide) =>
        guide.title.toLowerCase().includes(searchTerm)
      );
    }

    // Apply favourite filter
    if (isFavouriteFilterActive) {
      result.sort((a, b) => b.reaction_count - a.reaction_count);
    }

    filteredGuides = result;
    renderGuides(filteredGuides);
  }

  function renderGuides(guides) {
    const guidesList = document.getElementById("guides-list");
    const guidesContainer = document.querySelector(".guides-container");

    if (!guidesList && !guidesContainer) return;

    const container = guidesList || guidesContainer;

    if (guides && guides.length > 0) {
      let html = "";

      guides.forEach((guide) => {
        html += `
          <div class="guide-item" data-id="${guide._id}">
            <h${currentUserRole === "admin" ? "4" : "3"} class="${
          currentUserRole === "admin" ? "" : "guide-title"
        }">${guide.title}</h${currentUserRole === "admin" ? "4" : "3"}>
            <div class="guide-content">${guide.content}</div>
            <div class="guide-meta">
              <div class="guide-author">Published by: ${guide.admin_name}</div>
              <div class="guide-reactions">
                <button class="reaction-btn" data-id="${
                  guide._id
                }" data-reacted="${guide.user_reacted ? "true" : "false"}">
                  <i class="fa ${
                    guide.user_reacted ? "fa-heart" : "fa-heart-o"
                  }"></i>
                  <span class="reaction-count">${
                    guide.reaction_count > 0 ? guide.reaction_count : ""
                  }</span>
                </button>
              </div>
            </div>`;

        // Only show edit/delete buttons if the current user created this guide (admin only)
        if (currentUserRole === "admin" && guide.can_edit) {
          html += `
            <div class="guide-actions">
              <button class="edit-guide-btn" data-id="${guide._id}">
                <i class="fa fa-edit"></i> Edit
              </button>
              <button class="delete-guide-btn" data-id="${guide._id}">
                <i class="fa fa-trash"></i> Delete
              </button>
            </div>`;
        }

        html += `</div>`;
      });

      container.innerHTML = html;
    } else {
      container.innerHTML = `
        <div class="no-guides">
          <p>No cultivation guide${
            isSearchActive ? "s found." : "s have been added yet."
          }</p>
        </div>
      `;
    }
  }

  // Handle reaction button clicks (for both admin and farmer views)
  document.addEventListener("click", function (e) {
    if (
      e.target.classList.contains("reaction-btn") ||
      e.target.parentElement.classList.contains("reaction-btn")
    ) {
      const button = e.target.classList.contains("reaction-btn")
        ? e.target
        : e.target.parentElement;
      const guideId = button.getAttribute("data-id");

      // Toggle reaction
      fetch(`/cultivation-guide/toggle-reaction/${guideId}`, {
        method: "POST",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            // Update UI
            const icon = button.querySelector("i");
            const countSpan = button.querySelector(".reaction-count");

            if (data.user_reacted) {
              icon.classList.remove("fa-heart-o");
              icon.classList.add("fa-heart");
              button.setAttribute("data-reacted", "true");
            } else {
              icon.classList.remove("fa-heart");
              icon.classList.add("fa-heart-o");
              button.setAttribute("data-reacted", "false");
            }

            // Update reaction count
            countSpan.textContent = data.reaction_count;
          }
        })
        .catch((error) => {
          console.error("Error toggling reaction:", error);
          showMessage(
            "An error occurred while reacting to the guide.",
            "error"
          );
        });
    }
  });

  // Function to handle image upload in Quill
  function handleImageUpload() {
    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");
    input.click();

    input.onchange = function () {
      const file = input.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("image", file);

      // Show temporary loading text
      const range = quill.getSelection(true);
      const loadingText = "Uploading image...";
      quill.insertText(range.index, loadingText, { bold: true });

      fetch("/cultivation-guide/upload-image", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          // Remove loading text
          const currentIndex = range.index;
          quill.deleteText(currentIndex, loadingText.length);

          if (data.success && data.imageUrl) {
            const imageUrl = data.imageUrl;
            const publicId = data.public_id || "";

            // Insert image into Quill
            quill.insertEmbed(currentIndex, "image", imageUrl);

            // Quill inserts the <img> element — set data-public-id attribute on it
            // Use a small timeout to ensure DOM updated
            setTimeout(() => {
              const editor = document.querySelector("#editor");
              // find the image inserted at or near currentIndex
              // We choose the last image in the editor — it's the one we just inserted
              const imgs = editor.querySelectorAll("img");
              if (imgs && imgs.length > 0) {
                const lastImg = imgs[imgs.length - 1];
                if (publicId) lastImg.setAttribute("data-public-id", publicId);
              }
            }, 50);
          } else {
            showMessage(data.message || "Failed to upload image.", "error");
          }
        })
        .catch((error) => {
          // Remove loading text
          quill.deleteText(range.index, loadingText.length);
          console.error("Error uploading image:", error);
          showMessage("An error occurred while uploading the image.", "error");
        });
    };
  }

  // Function to load guides
  function loadGuides() {
    fetch("/cultivation-guide/list")
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.guides) {
          // Populate allGuides array for search/filter functionality
          allGuides = data.guides;
          filteredGuides = [...allGuides];

          // Render the guides
          renderGuides(filteredGuides);
        }
      })
      .catch((error) => {
        console.error("Error loading guides:", error);
        showMessage("An error occurred while loading guides.", "error");
      });
  }

  // Function to reset the form
  function resetForm() {
    if (!quill) return;

    document.getElementById("guide-title").value = "";
    quill.root.innerHTML = "";
    document.getElementById("guide-id").value = "";
    document.getElementById("cancel-btn").style.display = "none";
    document.getElementById("save-btn").textContent = "Save Guide";
  }

  // Function to show messages
  function showMessage(message, type) {
    const messageContainer = document.getElementById("message-container");

    if (!messageContainer) return;

    const messageElement = document.createElement("div");
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;

    messageContainer.appendChild(messageElement);

    // Auto-remove message after 5 seconds
    setTimeout(() => {
      messageElement.remove();
    }, 5000);
  }
});

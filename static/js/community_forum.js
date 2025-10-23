document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("post-image");
  const imagePreview = document.getElementById("image-preview");
  const postsContainer = document.getElementById("posts-container");
  const createPostForm = document.getElementById("create-post-form");
  let socket = null;

  // Create modal elements
  const modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML = `
    <div class="modal-content">
      <h3>Confirm Deletion</h3>
      <p id="modal-message">Are you sure you want to delete this item?</p>
      <div class="modal-buttons">
        <button class="cancel-btn">Cancel</button>
        <button class="delete-btn">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(modalOverlay);

  // Create loading spinner elements
  const loadingSpinner = document.createElement("div");
  loadingSpinner.className = "loading-spinner";
  loadingSpinner.innerHTML = `
    <div class="spinner"></div>
    <p>Loading Posts...</p>
  `;

  const commentsLoadingSpinner = document.createElement("div");
  commentsLoadingSpinner.className = "loading-spinner";
  commentsLoadingSpinner.innerHTML = `
    <div class="spinner"></div>
    <p>Loading Comments and Reply Comments...</p>
  `;

  // Initialize Socket.IO
  function initializeSocket() {
    // Load the Socket.IO client library if not already loaded
    if (typeof io === "undefined") {
      const script = document.createElement("script");
      script.src = "https://cdn.socket.io/4.6.0/socket.io.min.js";
      script.integrity =
        "sha384-c79GN5VsunZvi+Q/WObgk2in0CbZsHnjEqvFxC5DxHn9lTfNce2WW6h2pH6u/kF+";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);

      script.onload = function () {
        connectSocket();
      };
    } else {
      connectSocket();
    }
  }

  // Connect to Socket.IO server
  function connectSocket() {
    socket = io();

    // Join user's room on connection
    socket.on("connect", function () {
      console.log("Connected to Socket.IO");
      socket.emit("join_forum", { user_id: currentUserId });
    });

    // Listen for new posts
    socket.on("new_post", function (post) {
      // Only add the post if it's not from the current user (to avoid duplicates)
      if (post.user_id !== currentUserId) {
        addPostToDOM(post);
      }
    });

    // Listen for post updates
    socket.on("update_post", function (post) {
      // Find and update the post in the DOM
      const postCard = document.querySelector(
        `.post-card[data-post-id="${post._id}"]`
      );
      if (postCard) {
        // Update title, description, and image
        postCard.querySelector("h3").textContent = post.title;
        postCard.querySelector("p").textContent = post.description;

        // Update image if it exists
        const postImage = postCard.querySelector(".post-image");
        if (post.image) {
          if (postImage) {
            postImage.src = post.image;
          } else {
            // Add image if it doesn't exist
            const newImage = document.createElement("img");
            newImage.src = post.image;
            newImage.alt = post.title;
            newImage.className = "post-image";
            postCard.insertBefore(newImage, postCard.querySelector("p"));
          }
        } else if (postImage) {
          // Remove image if it no longer exists
          postImage.remove();
        }

        // Update time ago
        postCard.querySelector(".time-ago").textContent = post.time_ago;
      }
    });

    // Listen for post deletions
    socket.on("delete_post", function (data) {
      const postCard = document.querySelector(
        `.post-card[data-post-id="${data.post_id}"]`
      );
      if (postCard) {
        postCard.remove();
      }

      // Add check for empty posts container
      if (postsContainer.children.length === 0) {
        const noPosts = document.createElement("div");
        noPosts.className = "no-posts-message";
        noPosts.textContent = "No posts found. Be the first to create a post.";
        postsContainer.appendChild(noPosts);
      }
    });

    // Listen for post like updates
    socket.on("update_post_likes", function (data) {
      const postCard = document.querySelector(
        `.post-card[data-post-id="${data.post_id}"]`
      );
      if (postCard) {
        const likeIcon = postCard.querySelector(".fa-thumbs-up");
        let likeCount = postCard.querySelector(".post-actions .like-count");

        // Update like count
        if (data.likes > 0) {
          if (likeCount) {
            likeCount.textContent = `Likes ${data.likes}`;
          } else {
            // Create like count element if it doesn't exist
            likeCount = document.createElement("span");
            likeCount.className = "count like-count";
            likeCount.textContent = `Likes ${data.likes}`;
            likeIcon.after(likeCount);
          }
        } else if (likeCount) {
          likeCount.remove();
        }

        // Update like icon
        if (data.liked_by.includes(currentUserId)) {
          likeIcon.classList.replace("far", "fas");
        } else {
          likeIcon.classList.replace("fas", "far");
        }
      }
    });

    // Listen for new comments
    socket.on("new_comment", function (data) {
      const postCard = document.querySelector(
        `.post-card[data-post-id="${data.post_id}"]`
      );
      if (postCard) {
        // Update comment count
        const commentIcon = postCard.querySelector(
          ".fa-commenting, .fa-commenting-o"
        );
        let commentCount = postCard.querySelector(
          ".post-actions .comment-count"
        );

        if (commentIcon) {
          commentIcon.classList.remove("fa-commenting-o");
          commentIcon.classList.add("fa-commenting");
        }

        if (commentCount) {
          commentCount.textContent = `Comments ${data.comments_count}`;
        } else {
          commentCount = document.createElement("span");
          commentCount.className = "count comment-count";
          commentCount.textContent = `Comments ${data.comments_count}`;
          commentIcon.after(commentCount);
        }

        // If comment container is active, add the new comment
        const commentContainer = postCard.querySelector(
          ".comment-container.active"
        );
        if (commentContainer) {
          const commentList = commentContainer.querySelector(".comment-list");
          const newCommentItem = document.createElement("div");
          newCommentItem.className = "comment-item";
          newCommentItem.dataset.commentId = data.comment._id;

          const commentWithCorrectTime = {
            ...data.comment,
            date: new Date(),
          };

          newCommentItem.innerHTML = renderCommentItem(commentWithCorrectTime);
          if (data.comment.replies?.length > 0) {
            newCommentItem.innerHTML += `<div class="reply-list">${renderReplies(
              data.comment.replies
            )}</div>`;
          }
          commentList.appendChild(newCommentItem);

          // Update scrollbar based on total comments
          if (data.comments_count > 5) {
            commentList.style.overflowY = "scroll";
            commentList.style.maxHeight = "300px";
          } else {
            commentList.style.overflowY = "hidden";
            commentList.style.maxHeight = "none";
          }
        }
      }
    });

    // Listen for comment updates
    socket.on("update_comment", function (data) {
      const commentItem = document.querySelector(
        `.comment-item[data-comment-id="${data.comment_id}"]`
      );
      if (commentItem) {
        const commentText = commentItem.querySelector(".comment-text");
        if (commentText) {
          commentText.textContent = data.text;
        }
      }
    });

    // Listen for comment deletions
    socket.on("delete_comment", function (data) {
      const postCard = document.querySelector(
        `.post-card[data-post-id="${data.post_id}"]`
      );
      if (postCard) {
        // Update comment count display
        const commentIcon = postCard.querySelector(
          ".fa-commenting, .fa-commenting-o"
        );
        let commentCount = postCard.querySelector(".comment-count");

        // Update icon state
        if (data.comments_count === 0) {
          commentIcon.classList.remove("fa-commenting");
          commentIcon.classList.add("fa-commenting-o");
          if (commentCount) commentCount.remove();
        } else {
          commentIcon.classList.remove("fa-commenting-o");
          commentIcon.classList.add("fa-commenting");
          if (commentCount) {
            commentCount.textContent = `Comments ${data.comments_count}`;
          } else {
            commentCount = document.createElement("span");
            commentCount.className = "count comment-count";
            commentCount.textContent = `Comments ${data.comments_count}`;
            commentIcon.after(commentCount);
          }
        }

        // Close comments section if open
        const commentContainer = postCard.querySelector(
          ".comment-container.active"
        );
        if (data.comments_count === 0 && commentContainer) {
          commentContainer.classList.remove("active");
          const postImage = postCard.querySelector(".post-image");
          if (postImage) postImage.style.display = "block";
        }
      }
    });

    // Listen for comment like updates
    socket.on("update_comment_likes", function (data) {
      const commentItem = document.querySelector(
        `.comment-item[data-comment-id="${data.comment_id}"]`
      );
      if (commentItem) {
        const likeCountElem = commentItem.querySelector(".like-count");
        if (likeCountElem) {
          if (data.likes === 0) {
            likeCountElem.classList.add("zero");
            likeCountElem.textContent = data.likes;
          } else {
            likeCountElem.classList.remove("zero");
            likeCountElem.textContent = data.likes;
          }
        }

        // Update like text color
        const commentLike = commentItem.querySelector(".comment-like");
        if (commentLike) {
          if (data.liked_by.includes(currentUserId)) {
            commentLike.style.color = "#5b9120";
          } else {
            commentLike.style.color = "";
          }
        }
      }
    });

    // Listen for new replies
    socket.on("new_reply", function (data) {
      const commentItem = document.querySelector(
        `.comment-item[data-comment-id="${data.comment_id}"]`
      );
      if (commentItem) {
        // Get the original commenter's name
        const originalCommenterName = commentItem
          .querySelector(".comment-details h5")
          .childNodes[0].textContent.trim();

        // Create or use existing reply list
        let replyList = commentItem.querySelector(".reply-list");
        if (!replyList) {
          replyList = document.createElement("div");
          replyList.className = "reply-list";
          commentItem.appendChild(replyList);
        }

        // Add the new reply
        const newReplyItem = document.createElement("div");
        newReplyItem.className = "comment-item reply-item";
        newReplyItem.dataset.commentId = data.reply._id;

        const replyWithCorrectTime = {
          ...data.reply,
          date: new Date(),
        };

        newReplyItem.innerHTML = renderCommentItem(
          replyWithCorrectTime,
          true,
          originalCommenterName
        );
        replyList.appendChild(newReplyItem);

        // Update comment count
        const postCard = commentItem.closest(".post-card");
        const commentIcon = postCard.querySelector(
          ".fa-commenting, .fa-commenting-o"
        );
        let commentCount = postCard.querySelector(
          ".post-actions .comment-count"
        );

        if (commentIcon) {
          commentIcon.classList.remove("fa-commenting-o");
          commentIcon.classList.add("fa-commenting");
        }

        if (commentCount) {
          commentCount.textContent = `Comments ${data.total_comments}`;
        } else {
          commentCount = document.createElement("span");
          commentCount.className = "count comment-count";
          commentCount.textContent = `Comments ${data.total_comments}`;
          commentIcon.after(commentCount);
        }

        // Update scrollbar based on total comments
        const commentContainer = postCard.querySelector(
          ".comment-container.active"
        );
        if (commentContainer) {
          const commentList = commentContainer.querySelector(".comment-list");
          if (data.total_comments > 5) {
            commentList.style.overflowY = "scroll";
            commentList.style.maxHeight = "300px";
          } else {
            commentList.style.overflowY = "hidden";
            commentList.style.maxHeight = "none";
          }
        }
      }
    });

    // Listen for reply updates
    socket.on("update_reply", function (data) {
      const replyItem = document.querySelector(
        `.reply-item[data-comment-id="${data.reply_id}"]`
      );
      if (replyItem) {
        const replyText = replyItem.querySelector(".comment-text");
        if (replyText) {
          replyText.textContent = data.text;
        }
      }
    });

    // Listen for reply deletions
    socket.on("delete_reply", function (data) {
      const replyItem = document.querySelectorAll(
        `.reply-item[data-comment-id="${data.reply_id}"]`
      );
      replyItem.forEach((el) => el.remove());

      // Update comment count
      const postCard = document.querySelector(
        `.post-card[data-post-id="${data.post_id}"]`
      );
      if (postCard) {
        const commentIcon = postCard.querySelector(
          ".fa-commenting, .fa-commenting-o"
        );
        let commentCount = postCard.querySelector(
          ".post-actions .comment-count"
        );

        if (commentCount) {
          commentCount.textContent = `Comments ${data.comments_count}`;
        } else {
          commentCount = document.createElement("span");
          commentCount.className = "count comment-count";
          commentCount.textContent = `Comments ${data.comments_count}`;
          commentIcon.after(commentCount);
        }

        // Update scrollbar if comment container is active
        const commentContainer = postCard.querySelector(
          ".comment-container.active"
        );
        if (commentContainer) {
          const commentList = commentContainer.querySelector(".comment-list");
          if (data.comments_count > 5) {
            commentList.style.overflowY = "scroll";
            commentList.style.maxHeight = "300px";
          } else {
            commentList.style.overflowY = "hidden";
            commentList.style.maxHeight = "none";
          }
        }
      }
    });

    // Listen for reply like updates
    socket.on("update_reply_likes", function (data) {
      const replyItem = document.querySelector(
        `.reply-item[data-comment-id="${data.reply_id}"]`
      );
      if (replyItem) {
        const likeCountElem = replyItem.querySelector(".like-count");
        if (likeCountElem) {
          if (data.likes === 0) {
            likeCountElem.classList.add("zero");
            likeCountElem.textContent = data.likes;
          } else {
            likeCountElem.classList.remove("zero");
            likeCountElem.textContent = data.likes;
          }
        }

        // Update like text color
        const commentLike = replyItem.querySelector(".comment-like");
        if (commentLike) {
          if (data.liked_by.includes(currentUserId)) {
            commentLike.style.color = "#5b9120";
          } else {
            commentLike.style.color = "";
          }
        }
      }
    });

    // Listen for new nested replies
    socket.on("new_nested_reply", function (data) {
      const replyItem = document.querySelector(
        `.reply-item[data-comment-id="${data.reply_id}"]`
      );
      if (replyItem) {
        // Get the immediate parent reply author's name
        const immediateParentName = replyItem
          .querySelector(".comment-details h5")
          .childNodes[0].textContent.trim();

        // Create or use existing nested reply list
        let nestedReplyList = replyItem.querySelector(".reply-list");
        if (!nestedReplyList) {
          nestedReplyList = document.createElement("div");
          nestedReplyList.className = "reply-list";
          replyItem.appendChild(nestedReplyList);
        }

        // Add the new nested reply
        const newNestedReplyItem = document.createElement("div");
        newNestedReplyItem.className = "comment-item reply-item";
        newNestedReplyItem.dataset.commentId = data.nested_reply._id;

        const nestedReplyWithCorrectTime = {
          ...data.nested_reply,
          date: new Date(),
        };

        newNestedReplyItem.innerHTML = renderCommentItem(
          nestedReplyWithCorrectTime,
          true,
          immediateParentName
        );
        nestedReplyList.appendChild(newNestedReplyItem);

        // Update comment count
        const postCard = replyItem.closest(".post-card");
        const commentIcon = postCard.querySelector(
          ".fa-commenting, .fa-commenting-o"
        );
        let commentCount = postCard.querySelector(
          ".post-actions .comment-count"
        );

        if (commentIcon) {
          commentIcon.classList.remove("fa-commenting-o");
          commentIcon.classList.add("fa-commenting");
        }

        if (commentCount) {
          commentCount.textContent = `Comments ${data.total_comments}`;
        } else {
          commentCount = document.createElement("span");
          commentCount.className = "count comment-count";
          commentCount.textContent = `Comments ${data.total_comments}`;
          commentIcon.after(commentCount);
        }

        // Update scrollbar based on total comments
        const commentContainer = postCard.querySelector(
          ".comment-container.active"
        );
        if (commentContainer) {
          const commentList = commentContainer.querySelector(".comment-list");
          if (data.total_comments > 5) {
            commentList.style.overflowY = "scroll";
            commentList.style.maxHeight = "300px";
          } else {
            commentList.style.overflowY = "hidden";
            commentList.style.maxHeight = "none";
          }
        }
      }
    });
  }

  // === Helper functions ===

  // Render a comment or reply item with options icons
  function renderCommentItem(
    comment,
    isReply = false,
    originalCommenterName = null
  ) {
    const likes = comment.likes || 0; // Default to 0 if likes is undefined
    return `
      <div class="comment-background">
        <div class="comment-content">
          <img src="${comment.user.profile_pic}" alt="${
      comment.user.name
    }" class="comment-profile-pic" />
          <div class="comment-details">
            <h5>
              ${comment.user.name}
              <span class="comment-options">
                <i class="fa fa-ellipsis-v comment-options-toggle" 
                   data-comment-id="${comment._id}" 
                   data-can-edit="${comment.can_edit}" 
                   data-type="${isReply ? "reply" : "comment"}"></i>
                <span class="edit-delete-icons" style="display:none;">
                  <i class="fa fa-pencil-square edit-icon" data-comment-id="${
                    comment._id
                  }" data-type="${isReply ? "reply" : "comment"}"></i>
                  <i class="fa fa-minus-square delete-icon" data-comment-id="${
                    comment._id
                  }" data-type="${isReply ? "reply" : "comment"}"></i>
                  <i class="fa fa-window-close cancel-icon" data-comment-id="${
                    comment._id
                  }" data-type="${isReply ? "reply" : "comment"}"></i>
                </span>
              </span>
            </h5>
            <p>
              ${
                isReply && originalCommenterName
                  ? `<span class="reply-username">${originalCommenterName}</span>`
                  : ""
              }
              <span class="comment-text">${comment.text}</span>
            </p>
            <div class="comment-meta">
              <span>${timeAgoShort(comment.date)}</span>
              <span class="comment-like">
                Like
                <span class="like-count ${likes === 0 ? "zero" : ""}">
                  ${likes > 0 ? likes : ""}
                </span>
              </span>
              <span class="reply-text">Reply</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Helper to recursively render replies
  function renderReplies(replies, originalCommenterName = null) {
    let repliesHTML = "";
    replies.forEach((reply) => {
      repliesHTML += `
        <div class="comment-item reply-item" data-comment-id="${reply._id}">
          ${renderCommentItem(reply, true, originalCommenterName)}
          ${
            reply.replies && reply.replies.length > 0
              ? `<div class="reply-list">${renderReplies(
                  reply.replies,
                  reply.user.name
                )}</div>`
              : ""
          }
        </div>
      `;
    });
    return repliesHTML;
  }

  // Helper to count total comments + replies recursively
  function countTotalCommentsAndReplies(comment) {
    let count = 1; // Count the comment itself
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach((reply) => {
        count += countTotalCommentsAndReplies(reply);
      });
    }
    return count;
  }

  // Helper to calculate total for all comments
  function calculateTotalComments(comments) {
    let total = 0;
    comments.forEach((comment) => {
      total += countTotalCommentsAndReplies(comment);
    });
    return total;
  }

  // Reload comments for a post
  function reloadComments(postId, postCard) {
    // Show loading spinner
    const commentContainer = postCard.querySelector(".comment-container");
    commentContainer.innerHTML = "";
    commentContainer.appendChild(commentsLoadingSpinner.cloneNode(true));

    fetch(`/get-comments/${postId}`)
      .then((response) => response.json())
      .then((comments) => {
        // Remove loading spinner
        commentContainer.innerHTML = "";

        // Add close button
        const closeIcon = document.createElement("i");
        closeIcon.className = "fas fa-times close-comments";
        commentContainer.appendChild(closeIcon);

        // Add comment list container
        const commentList = document.createElement("div");
        commentList.className = "comment-list";
        commentContainer.appendChild(commentList);

        // Render comments
        comments.forEach((comment) => {
          const commentItem = document.createElement("div");
          commentItem.className = "comment-item";
          commentItem.dataset.commentId = comment._id;
          commentItem.innerHTML = `
            ${renderCommentItem(comment)}
            ${
              comment.replies && comment.replies.length > 0
                ? `<div class="reply-list">${renderReplies(
                    comment.replies,
                    comment.user.name
                  )}</div>`
                : ""
            }
          `;
          commentList.appendChild(commentItem);
        });

        // Style the close icon
        closeIcon.style.position = "relative";
        closeIcon.style.top = "0";
        closeIcon.style.left = "50%";
        closeIcon.style.transform = "translateX(-50%)";
        closeIcon.style.marginBottom = "15px";

        // Add scrollbar only if there are more than three comments and replies
        const totalComments = calculateTotalComments(comments);
        if (totalComments > 5) {
          commentList.style.overflowY = "scroll";
          commentList.style.maxHeight = "300px";
        } else {
          commentList.style.overflowY = "hidden";
          commentList.style.maxHeight = "none";
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        showMessage("An error occurred while reloading comments.", "error");

        // Remove loading spinner and add error message
        commentContainer.innerHTML = "";
        const errorMessage = document.createElement("div");
        errorMessage.className = "error-message";
        errorMessage.textContent = "Failed to load comments. Please try again.";
        commentContainer.appendChild(errorMessage);
      });
  }

  // Function to display messages
  function showMessage(message, type) {
    const messageContainer = document.getElementById("message-container");
    if (!messageContainer) return;
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
      <i class="fas ${type === "success" ? "fa-check" : "fa-times"}"></i>
      <span>${message}</span>
    `;
    messageContainer.appendChild(messageDiv);

    // Remove the message after 5 seconds
    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  // Show confirmation modal
  function showConfirmModal(message, confirmCallback) {
    document.getElementById("modal-message").textContent = message;
    modalOverlay.classList.add("active");
    document.body.style.overflow = "hidden";

    const cancelBtn = modalOverlay.querySelector(".cancel-btn");
    const deleteBtn = modalOverlay.querySelector(".delete-btn");

    // Remove any existing event listeners
    const newCancelBtn = cancelBtn.cloneNode(true);
    const newDeleteBtn = deleteBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);

    // Add new event listeners
    newCancelBtn.addEventListener("click", closeModal);
    newDeleteBtn.addEventListener("click", () => {
      confirmCallback();
      closeModal();
    });
  }

  // Close confirmation modal
  function closeModal() {
    modalOverlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Handle image upload
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.innerHTML = `
          <div class="image-preview">
            <img src="${e.target.result}" alt="Preview" />
            <i class="fas fa-trash remove-image" onclick="removeImage()"></i>
          </div>
        `;
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle image removal
  window.removeImage = () => {
    imagePreview.innerHTML = "";
    imageInput.value = "";
  };

  // Function to load posts
  function loadPosts(filter = "latest") {
    // Show loading spinner
    postsContainer.innerHTML = "";
    postsContainer.appendChild(loadingSpinner.cloneNode(true));

    fetch(`/community-forum/posts?filter=${filter}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((posts) => {
        // Clear the posts container before appending new posts
        postsContainer.innerHTML = "";

        if (posts.length === 0) {
          const noPosts = document.createElement("div");
          noPosts.className = "no-posts-message";
          noPosts.textContent =
            "No posts found. Be the first to create a post.";
          postsContainer.appendChild(noPosts);
          return;
        }

        // Append new posts
        posts.forEach((post) => {
          const postCard = document.createElement("div");
          postCard.className = "post-card";
          postCard.dataset.postId = post._id;
          postCard.innerHTML = `
            <div class="post-header" data-user-id="${post.user_id}">
              <img src="${post.user.profile_pic}" alt="${
            post.user.name
          }" class="profile-pic" />
              <h4>${post.user.name}</h4>
              <span class="time-ago">${post.time_ago}</span>
              <span class="post-options">
                <i class="fa fa-ellipsis-v post-options-toggle" data-post-id="${
                  post._id
                }" data-user-id="${post.user_id}"></i>
                <span class="post-edit-delete-icons" style="display:none;">
                  <i class="fa fa-pencil-square post-edit-icon" data-post-id="${
                    post._id
                  }" data-user-id="${post.user_id}"></i>
                  <i class="fa fa-minus-square post-delete-icon" data-post-id="${
                    post._id
                  }" data-user-id="${post.user_id}"></i>
                  <i class="fa fa-window-close post-cancel-icon" data-post-id="${
                    post._id
                  }" data-user-id="${post.user_id}"></i>
                </span>
              </span>
            </div>

            <h3>${post.title}</h3>
            ${
              post.image
                ? `<img src="${post.image}" alt="${post.title}" class="post-image" />`
                : ""
            }
            <p>${post.description}</p>
            <div class="post-actions">
              <i class="${
                post.liked ? "fas" : "far"
              } fa-thumbs-up" data-post-id="${post._id}"></i>
              ${
                post.likes > 0
                  ? `<span class="count like-count">Likes ${post.likes}</span>`
                  : ""
              }
              <i class="${
                post.total_comments > 0
                  ? "fa fa-commenting"
                  : "fa fa-commenting-o"
              }" data-post-id="${post._id}"></i>
              ${
                post.total_comments > 0
                  ? `<span class="count comment-count">Comments ${post.total_comments}</span>`
                  : ""
              }
            </div>
            <div class="comment-container">
              <i class="fas fa-times close-comments"></i>
              <div class="comment-list">
                <!-- Comments will be dynamically added here -->
              </div>
            </div>
            <div class="comment-input-container">
              <input type="text" placeholder="Write a comment" />
              <i class="fas fa-paper-plane"></i>
            </div>
          `;
          postsContainer.appendChild(postCard);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
        showMessage("An error occurred while loading posts.", "error");

        // Show error message in posts container
        postsContainer.innerHTML = "";
        const errorMessage = document.createElement("div");
        errorMessage.className = "error-message";
        errorMessage.textContent = "Failed to load posts. Please try again.";
        postsContainer.appendChild(errorMessage);
      });
  }

  // Function to add a new post to the DOM
  function addPostToDOM(post) {
    const noPostsMessage = postsContainer.querySelector(".no-posts-message");
    if (noPostsMessage) {
      noPostsMessage.remove();
    }

    const postCard = document.createElement("div");
    postCard.className = "post-card";
    postCard.dataset.postId = post._id;
    postCard.innerHTML = `
      <div class="post-header" data-user-id="${post.user_id}">
        <img src="${post.user.profile_pic}" alt="${
      post.user.name
    }" class="profile-pic" />
        <h4>${post.user.name}</h4>
        <span class="time-ago">${post.time_ago}</span>
        <span class="post-options">
          <i class="fa fa-ellipsis-v post-options-toggle" data-post-id="${
            post._id
          }" data-user-id="${post.user_id}"></i>
          <span class="post-edit-delete-icons" style="display:none;">
            <i class="fa fa-pencil-square post-edit-icon" data-post-id="${
              post._id
            }" data-user-id="${post.user_id}"></i>
            <i class="fa fa-minus-square post-delete-icon" data-post-id="${
              post._id
            }" data-user-id="${post.user_id}"></i>
            <i class="fa fa-window-close post-cancel-icon" data-post-id="${
              post._id
            }" data-user-id="${post.user_id}"></i>
          </span>
        </span>
      </div>

      <h3>${post.title}</h3>
      ${
        post.image
          ? `<img src="${post.image}" alt="${post.title}" class="post-image" />`
          : ""
      }
      <p>${post.description}</p>
      <div class="post-actions">
        <i class="far fa-thumbs-up" data-post-id="${post._id}"></i>
        ${
          post.likes > 0
            ? `<span class="count like-count">Likes ${post.likes}</span>`
            : ""
        }
        <i class="fa fa-commenting-o" data-post-id="${post._id}"></i>
        ${
          post.comments && post.total_comments > 0
            ? `<span class="count">Comments ${post.total_comments}</span>`
            : ""
        }
      </div>
      <div class="comment-container">
        <i class="fas fa-times close-comments"></i>
        <div class="comment-list">
          <!-- Comments will be dynamically added here -->
        </div>
      </div>
      <div class="comment-input-container">
        <input type="text" placeholder="Write a comment" />
        <i class="fas fa-paper-plane"></i>
      </div>
    `;
    // Add the new post at the top
    postsContainer.prepend(postCard);
  }

  // Handle post creation or update
  createPostForm.addEventListener("submit", (e) => {
    e.preventDefault();

    // Check if editing an existing post
    if (createPostForm.dataset.editingPostId) {
      const postId = createPostForm.dataset.editingPostId;
      const formData = new FormData();
      formData.append("title", document.getElementById("post-title").value);
      formData.append(
        "description",
        document.getElementById("post-description").value
      );
      // Append the image only if a new one is provided
      const file = document.getElementById("post-image").files[0];
      if (file) {
        formData.append("image", file);
      }
      fetch(`/update-post/${postId}`, {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.message) {
            showMessage(data.message, "success");
            // Optionally update the post on the page:
            // For simplicity, you might call loadPosts() to refresh all posts.
            loadPosts();
            // Reset form fields and button text
            createPostForm.reset();
            imagePreview.innerHTML = "";
            document.getElementById("post-submit").textContent = "Add Post";
            delete createPostForm.dataset.editingPostId;
          } else if (data.error) {
            showMessage(data.error, "error");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          showMessage("An error occurred while updating the post.", "error");
        });
      return; // Stop further processing
    }

    // Otherwise, proceed with creating a new post
    const formData = new FormData();
    formData.append("title", document.getElementById("post-title").value);
    formData.append(
      "description",
      document.getElementById("post-description").value
    );
    formData.append("image", document.getElementById("post-image").files[0]);

    fetch("/create-post", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.message) {
          showMessage(data.message, "success");
          // Add the new post to the DOM
          addPostToDOM(data.post);

          // Clear input fields
          document.getElementById("post-title").value = "";
          document.getElementById("post-description").value = "";
          document.getElementById("post-image").value = "";
          imagePreview.innerHTML = "";
        } else if (data.error) {
          showMessage(data.error, "error");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        showMessage("An error occurred while creating the post.", "error");
      });
  });

  // Handle post likes
  postsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("fa-thumbs-up")) {
      const postId = e.target.getAttribute("data-post-id");

      fetch(`/like-post/${postId}`, { method: "POST" })
        .then((response) => response.json())
        .then((data) => {
          if (data.message) {
            // Update the like count and icon
            const likeIcon = e.target;
            let likeCount = likeIcon.nextElementSibling;

            // Check if the span with class 'count' exists; if not, create it
            if (!likeCount || !likeCount.classList.contains("like-count")) {
              likeCount = document.createElement("span");
              likeCount.className = "count like-count";
              likeIcon.after(likeCount); // Insert the span right after the like icon
            }

            // Update the like count text or remove if zero
            if (data.likes > 0) {
              likeCount.textContent = `Likes ${data.likes}`;
            } else {
              likeCount.remove(); // Remove the span if there are no likes
            }

            if (data.liked) {
              likeIcon.classList.replace("far", "fas"); // Solid icon for liked
            } else {
              likeIcon.classList.replace("fas", "far"); // Regular icon for unliked
            }
          }
        });
    }
  });

  // Handle clicking the comment icon
  postsContainer.addEventListener("click", (e) => {
    if (
      e.target.classList.contains("fa-commenting") ||
      e.target.classList.contains("fa-commenting-o")
    ) {
      const postCard = e.target.closest(".post-card");
      const commentContainer = postCard.querySelector(".comment-container");
      const postImage = postCard.querySelector(".post-image");
      const postId = e.target.getAttribute("data-post-id");

      // Fetch the current comment count from the DOM
      const commentCountSpan = postCard.querySelector(".comment-count");
      const commentCount = commentCountSpan
        ? parseInt(commentCountSpan.textContent.replace("Comments ", ""))
        : 0;

      // Only toggle if there are comments or the container is already active
      if (commentCount > 0 || commentContainer.classList.contains("active")) {
        const postActions = postCard.querySelector(".post-actions");
        postCard.insertBefore(commentContainer, postActions);
        commentContainer.classList.toggle("active");

        if (commentContainer.classList.contains("active")) {
          if (postImage) {
            postImage.style.display = "none";
          }

          // Show loading spinner
          commentContainer.innerHTML = "";
          commentContainer.appendChild(commentsLoadingSpinner.cloneNode(true));

          // Load comments if the section is active
          fetch(`/get-comments/${postId}`)
            .then((response) => response.json())
            .then((comments) => {
              // Remove loading spinner
              commentContainer.innerHTML = "";

              // Add close button
              const closeIcon = document.createElement("i");
              closeIcon.className = "fas fa-times close-comments";
              commentContainer.appendChild(closeIcon);

              // Add comment list
              const commentList = document.createElement("div");
              commentList.className = "comment-list";
              commentContainer.appendChild(commentList);

              // Render top-level comments and their replies
              comments.forEach((comment) => {
                const commentItem = document.createElement("div");
                commentItem.className = "comment-item";
                commentItem.dataset.commentId = comment._id;
                commentItem.innerHTML = `
                ${renderCommentItem(comment)}
                ${
                  comment.replies && comment.replies.length > 0
                    ? `<div class="reply-list">${renderReplies(
                        comment.replies,
                        comment.user.name
                      )}</div>`
                    : ""
                }
              `;
                commentList.appendChild(commentItem);
              });

              // Always position the close icon in the middle
              closeIcon.style.position = "relative";
              closeIcon.style.top = "0";
              closeIcon.style.left = "50%";
              closeIcon.style.transform = "translateX(-50%)";
              closeIcon.style.marginBottom = "15px";

              // Add scrollbar only if there are more than three comments and replies
              const totalComments = calculateTotalComments(comments);
              if (totalComments > 5) {
                commentList.style.overflowY = "scroll";
                commentList.style.maxHeight = "300px";
              } else {
                commentList.style.overflowY = "hidden";
                commentList.style.maxHeight = "none";
              }
            })
            .catch((error) => {
              console.error("Error:", error);
              showMessage("An error occurred while loading comments.", "error");

              // Remove loading spinner and show error message
              commentContainer.innerHTML = "";
              const errorMessage = document.createElement("div");
              errorMessage.className = "error-message";
              errorMessage.textContent =
                "Failed to load comments. Please try again.";
              commentContainer.appendChild(errorMessage);
            });
        } else {
          // Show the image when the comment section is inactive
          if (postImage) {
            postImage.style.display = "block";
          }
        }
      }
    }
  });

  // Handle clicking the reply text
  postsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("reply-text")) {
      const commentItem = e.target.closest(".comment-item");
      const postCard = commentItem.closest(".post-card");
      const commentInput = postCard.querySelector(
        ".comment-input-container input"
      );
      const commentUser = commentItem
        .querySelector(".comment-details h5")
        .childNodes[0].textContent.trim();

      // Check if already replying to this comment
      if (commentInput.dataset.replyTo === commentItem.dataset.commentId) {
        // Reset to default state
        commentInput.placeholder = "Write a comment";
        delete commentInput.dataset.replyTo;
        delete commentInput.dataset.replyType;
        e.target.style.color = "";
        e.target.style.fontWeight = "";

        // Remove stored reference
        if (commentInput.dataset.clickedReplyTextSelector) {
          const prevElement = postCard.querySelector(
            commentInput.dataset.clickedReplyTextSelector
          );
          if (prevElement) {
            prevElement.style.color = "";
            prevElement.style.fontWeight = "";
          }
          delete commentInput.dataset.clickedReplyTextSelector;
        }
      } else {
        // Set new reply state
        commentInput.placeholder = `Reply to ${commentUser}`;
        commentInput.focus();
        commentInput.dataset.replyTo = commentItem.dataset.commentId;
        commentInput.dataset.replyType = commentItem.classList.contains(
          "reply-item"
        )
          ? "reply"
          : "comment";
        e.target.style.color = "#5b9120";
        e.target.style.fontWeight = "bold";

        // Reset previous reply text style
        if (commentInput.dataset.clickedReplyTextSelector) {
          const prevElement = postCard.querySelector(
            commentInput.dataset.clickedReplyTextSelector
          );
          if (prevElement) {
            prevElement.style.color = "";
            prevElement.style.fontWeight = "";
          }
        }
        commentInput.dataset.clickedReplyTextSelector = `.comment-item[data-comment-id="${commentItem.dataset.commentId}"] .reply-text`;
      }
    }
  });

  // Event delegation for handling comment/reply like toggling
  postsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("comment-like")) {
      // Locate the comment container
      const commentItem = e.target.closest(".comment-item");
      const commentId = commentItem.dataset.commentId;
      const postCard = commentItem.closest(".post-card");
      const postIdElem = postCard.querySelector(
        ".fa-commenting, .fa-commenting-o"
      );
      const postId = postIdElem
        ? postIdElem.getAttribute("data-post-id")
        : null;

      // Determine whether this is a top-level comment or a reply
      const isReply = commentItem.classList.contains("reply-item");
      let endpoint = "";
      if (!isReply) {
        endpoint = `/like-comment/${postId}/${commentId}`;
      } else {
        endpoint = `/like-reply/${postId}/${commentId}`;
      }

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.message) {
            // Update the like count badge with the new logic:
            const likeCountElem = commentItem.querySelector(".like-count");
            if (data.likes === 0) {
              likeCountElem.classList.add("zero");
              likeCountElem.textContent = data.likes;
            } else {
              likeCountElem.classList.remove("zero");
              likeCountElem.textContent = data.likes;
            }

            // Toggle the color of the "Like" text based on whether it's liked
            if (data.liked) {
              e.target.style.color = "#5b9120";
            } else {
              e.target.style.color = "";
            }
          } else if (data.error) {
            showMessage(data.error, "error");
          }
        })
        .catch((error) => {
          console.error("Error:", error);
          showMessage("An error occurred while toggling like.", "error");
        });
    }
  });

  // Event delegation for handling post delete/cancel icons clicks
  postsContainer.addEventListener("click", (e) => {
    // Handle post delete icon
    if (e.target.classList.contains("post-delete-icon")) {
      const postId = e.target.dataset.postId;

      showConfirmModal("Are you sure you want to delete this post?", () => {
        fetch(`/delete-post/${postId}`, { method: "DELETE" })
          .then((response) => response.json())
          .then((data) => {
            if (data.message) {
              showMessage(data.message, "success");
              e.target.closest(".post-card").remove();
            } else if (data.error) {
              showMessage(data.error, "error");
            }
          });
      });
    }

    // Handle post cancel icon
    if (e.target.classList.contains("post-cancel-icon")) {
      const parentSpan = e.target.parentElement;
      parentSpan.style.display = "none";
      parentSpan.parentElement.querySelector(
        ".post-options-toggle"
      ).style.display = "inline-block";
    }
  });

  // Event delegation for handling options icons clicks
  postsContainer.addEventListener("click", (e) => {
    // Handle the post edit icon click: load post data into the create post form
    if (e.target.classList.contains("post-edit-icon")) {
      const postId = e.target.dataset.postId;
      const postCard = e.target.closest(".post-card");

      // If already editing this post, reset the form
      if (createPostForm.dataset.editingPostId === postId) {
        document.getElementById("post-title").value = "";
        document.getElementById("post-description").value = "";
        imagePreview.innerHTML = "";
        document.getElementById("post-submit").textContent = "Add Post";
        delete createPostForm.dataset.editingPostId;
        e.target.classList.remove("active"); // Remove active state
        return;
      }

      // Load post data into the form
      const postTitle = postCard.querySelector("h3").textContent;
      const postDescription = postCard.querySelector("p").textContent;
      const postImageSrc = postCard.querySelector(".post-image")?.src || "";

      document.getElementById("post-title").value = postTitle;
      document.getElementById("post-description").value = postDescription;
      imagePreview.innerHTML = postImageSrc
        ? `<div class="image-preview"><img src="${postImageSrc}" alt="Preview"/><i class="fas fa-trash remove-image" onclick="removeImage()"></i></div>`
        : "";

      document.getElementById("post-submit").textContent = "Update Post";
      createPostForm.dataset.editingPostId = postId;
      e.target.classList.add("active"); // Mark as active
    }

    // Handle the ellipsis icon click
    if (e.target.classList.contains("comment-options-toggle")) {
      const canEdit = e.target.dataset.canEdit === "true";
      if (!canEdit) {
        showMessage(
          `You don't have access to delete or edit this ${e.target.dataset.type}`,
          "error"
        );
        return;
      }
      // Hide ellipsis icon and show edit/delete icons
      const parentSpan = e.target.parentElement;
      e.target.style.display = "none";
      parentSpan.querySelector(".edit-delete-icons").style.display =
        "inline-block";
    }

    // Handle the post ellipsis icon click
    if (e.target.classList.contains("post-options-toggle")) {
      const postUserId = e.target.dataset.userId;
      // Check if current user is the creator of the post
      if (postUserId !== currentUserId) {
        showMessage(
          "You don't have access to edit or delete this post",
          "error"
        );
        return;
      }
      // Hide the ellipsis icon and show the edit/delete icons
      const parentSpan = e.target.parentElement;
      e.target.style.display = "none";
      parentSpan.querySelector(".post-edit-delete-icons").style.display =
        "inline-block";
    }

    // Handle the cancel (window-close) icon click
    if (e.target.classList.contains("cancel-icon")) {
      const parentSpan = e.target.parentElement;
      // Hide edit/delete icons and show ellipsis again
      parentSpan.style.display = "none";
      const optionsToggle = parentSpan.parentElement.querySelector(
        ".comment-options-toggle"
      );
      optionsToggle.style.display = "inline-block";
    }

    // Handle the edit (pencil-square) icon click
    if (e.target.classList.contains("edit-icon")) {
      const commentId = e.target.dataset.commentId;
      const commentType = e.target.dataset.type;
      // Find the comment text element in the same comment item
      const commentItem = e.target.closest(".comment-item");
      const commentTextElem = commentItem.querySelector(".comment-text");
      // Locate the input field for the post
      const commentInput = commentItem
        .closest(".post-card")
        .querySelector(".comment-input-container input");

      // Toggle: if already editing this comment, cancel edit; otherwise, load text
      if (commentInput.dataset.editingCommentId === commentId) {
        // Cancel edit
        commentInput.value = "";
        delete commentInput.dataset.editingCommentId;
        delete commentInput.dataset.editingCommentType;
        e.target.classList.remove("active");
      } else {
        // Start edit
        commentInput.value = commentTextElem.textContent;
        commentInput.focus();
        commentInput.dataset.editingCommentId = commentId;
        commentInput.dataset.editingCommentType = commentType;
        e.target.classList.add("active");
      }
    }

    // Handle the delete (minus-square) icon click
    if (e.target.classList.contains("delete-icon")) {
      const commentId = e.target.dataset.commentId;
      const commentType = e.target.dataset.type;
      // Determine the postId from the closest post-card
      const postCard = e.target.closest(".post-card");
      const postIdElem = postCard.querySelector(
        ".fa-commenting, .fa-commenting-o"
      );
      const postId = postIdElem
        ? postIdElem.getAttribute("data-post-id")
        : null;

      showConfirmModal(
        `Are you sure you want to delete this ${commentType}?`,
        () => {
          let endpoint = "";
          if (commentType === "comment") {
            endpoint = `/delete-comment/${postId}/${commentId}`;
          } else {
            endpoint = `/delete-reply/${postId}/${commentId}`;
          }

          fetch(endpoint, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.message) {
                showMessage(data.message, "success");
                // Reload the comments section for this post
                reloadComments(postId, postCard);
              } else if (data.error) {
                showMessage(data.error, "error");
              }
            })
            .catch((error) => {
              console.error("Error:", error);
              showMessage("An error occurred while deleting.", "error");
            });
        }
      );
    }
  });

  // Unified handler for adding a comment or a reply
  postsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("fa-paper-plane")) {
      const postCard = e.target.closest(".post-card");
      const commentInput = postCard.querySelector(
        ".comment-input-container input"
      );
      const commentText = commentInput.value;
      const postIdElem = postCard.querySelector(
        ".fa-commenting, .fa-commenting-o"
      );
      const postId = postIdElem
        ? postIdElem.getAttribute("data-post-id")
        : null;
      const replyToId = commentInput.dataset.replyTo;
      const replyType = commentInput.dataset.replyType || "comment";

      if (!commentText) {
        showMessage("Comment text is required", "error");
        return;
      }

      // If editing an existing comment or reply, call the update endpoint
      const editingCommentId = commentInput.dataset.editingCommentId;
      if (editingCommentId) {
        const commentType =
          commentInput.dataset.editingCommentType || "comment";
        let endpoint =
          // This is a reply update endpoint
          commentType === "reply"
            ? `/update-reply/${postId}/${editingCommentId}`
            : `/update-comment/${postId}/${editingCommentId}`;
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: commentText }),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.message) {
              showMessage(data.message, "success");
              commentInput.value = "";
              delete commentInput.dataset.editingCommentId;
              delete commentInput.dataset.editingCommentType;
            } else if (data.error) {
              showMessage(data.error, "error");
            }
          })
          .catch((error) => {
            console.error("Error:", error);
            showMessage("An error occurred while updating.", "error");
          });
      } else {
        let endpoint = "";
        let body = {};

        if (replyToId) {
          if (replyType === "reply") {
            endpoint = `/add-nested-reply/${postId}/${replyToId}`;
            body = { reply: commentText };
          } else {
            endpoint = `/add-reply/${replyToId}`;
            body = { reply: commentText };
          }
        } else {
          endpoint = `/add-comment/${postId}`;
          body = { comment: commentText };
        }

        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.message) {
              showMessage(data.message, "success");
              commentInput.value = "";
              commentInput.placeholder = "Write a comment";
              delete commentInput.dataset.replyTo;
              delete commentInput.dataset.replyType;
              if (commentInput.dataset.clickedReplyTextSelector) {
                const clickedReplyTextElem = postCard.querySelector(
                  commentInput.dataset.clickedReplyTextSelector
                );
                if (clickedReplyTextElem) {
                  clickedReplyTextElem.style.color = "";
                  clickedReplyTextElem.style.fontWeight = "";
                }
                delete commentInput.dataset.clickedReplyTextSelector;
              }
              // Do not update DOM here; Socket.IO will handle it
            } else if (data.error) {
              showMessage(data.error, "error");
            }
          })
          .catch((error) => {
            console.error("Error:", error);
            showMessage("An error occurred while adding the comment.", "error");
          });
      }
    }
  });

  // Handle closing the comment section
  postsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("close-comments")) {
      const commentContainer = e.target.closest(".comment-container");
      const postCard = commentContainer.closest(".post-card");
      const postImage = postCard.querySelector(".post-image");

      commentContainer.classList.remove("active");

      // Show the image when the comment section is closed
      if (postImage) {
        postImage.style.display = "block";
      }
    }
  });

  // Global variables to store the current filter selections
  let currentSortFilter = "";
  let currentScopeFilter = "";

  // Handle clicks on the sort filters
  document.querySelectorAll("#sort-filters ul li a").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      // Toggle active state for sort links
      if (this.classList.contains("active")) {
        this.classList.remove("active");
        this.querySelector("i").className = "fa fa-check-circle-o";
        currentSortFilter = "";
      } else {
        // Remove active state from all sort links
        document.querySelectorAll("#sort-filters ul li a").forEach((l) => {
          l.classList.remove("active");
          l.querySelector("i").className = "fa fa-check-circle-o";
        });
        this.classList.add("active");
        this.querySelector("i").className = "fa fa-check-circle";
        currentSortFilter = this.dataset.sort;
      }
      loadPostsCombined();
    });
  });

  // Handle clicks on the scope filters
  document.querySelectorAll("#scope-filters ul li a").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      // Toggle active state for scope links
      if (this.classList.contains("active")) {
        this.classList.remove("active");
        this.querySelector("i").className = "fa fa-check-circle-o";
        currentScopeFilter = "";
      } else {
        // Remove active state from all scope links
        document.querySelectorAll("#scope-filters ul li a").forEach((l) => {
          l.classList.remove("active");
          l.querySelector("i").className = "fa fa-check-circle-o";
        });
        this.classList.add("active");
        this.querySelector("i").className = "fa fa-check-circle";
        currentScopeFilter = this.dataset.scope;
      }
      loadPostsCombined();
    });
  });

  // Function to load posts with combined filters
  function loadPostsCombined() {
    // Show loading spinner
    postsContainer.innerHTML = "";
    postsContainer.appendChild(loadingSpinner.cloneNode(true));

    // Build the query string. For example, the backend should expect ?sort=...&scope=...
    // If a filter is not set, you can define a default.
    const sortParam = currentSortFilter || "latest";
    const scopeParam = currentScopeFilter || "all";

    fetch(`/community-forum/posts?sort=${sortParam}&scope=${scopeParam}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    })
      .then((response) => response.json())
      .then((posts) => {
        // Clear the posts container before appending new posts
        postsContainer.innerHTML = "";

        if (posts.length === 0) {
          const noPosts = document.createElement("div");
          noPosts.className = "no-posts-message";
          noPosts.textContent =
            "No posts found. Be the first to create a post!";
          postsContainer.appendChild(noPosts);
          return;
        }

        // Render the posts as usual.
        posts.forEach((post) => {
          const postCard = document.createElement("div");
          postCard.className = "post-card";
          postCard.dataset.postId = post._id;
          // Use your existing post rendering logic (the same as in loadPosts())
          postCard.innerHTML = `
          <div class="post-header" data-user-id="${post.user_id}">
            <img src="${post.user.profile_pic}" alt="${
            post.user.name
          }" class="profile-pic" />
            <h4>${post.user.name}</h4>
            <span class="time-ago">${post.time_ago}</span>
            <span class="post-options">
              <i class="fa fa-ellipsis-v post-options-toggle" data-post-id="${
                post._id
              }" data-user-id="${post.user_id}"></i>
              <span class="post-edit-delete-icons" style="display:none;">
                <i class="fa fa-pencil-square post-edit-icon" data-post-id="${
                  post._id
                }" data-user-id="${post.user_id}"></i>
                <i class="fa fa-minus-square post-delete-icon" data-post-id="${
                  post._id
                }" data-user-id="${post.user_id}"></i>
                <i class="fa fa-window-close post-cancel-icon" data-post-id="${
                  post._id
                }" data-user-id="${post.user_id}"></i>
              </span>
            </span>
          </div>
          <h3>${post.title}</h3>
          ${
            post.image
              ? `<img src="${post.image}" alt="${post.title}" class="post-image" />`
              : ""
          }
          <p>${post.description}</p>
          <div class="post-actions">
            <i class="${
              post.liked ? "fas" : "far"
            } fa-thumbs-up" data-post-id="${post._id}"></i>
            ${
              post.likes > 0
                ? `<span class="count">Likes ${post.likes}</span>`
                : ""
            }
            <i class="${
              post.total_comments > 0
                ? "fa fa-commenting"
                : "fa fa-commenting-o"
            }" data-post-id="${post._id}"></i>
            ${
              post.total_comments > 0
                ? `<span class="count comment-count">Comments ${post.total_comments}</span>`
                : ""
            }
          </div>
          <div class="comment-container">
            <i class="fas fa-times close-comments"></i>
            <div class="comment-list">
              <!-- Comments will be dynamically added here -->
            </div>
          </div>
          <div class="comment-input-container">
            <input type="text" placeholder="Write a comment" />
            <i class="fas fa-paper-plane"></i>
          </div>
        `;
          postsContainer.appendChild(postCard);
        });
      })
      .catch((error) => {
        console.error("Error:", error);
        showMessage("An error occurred while loading posts.", "error");

        // Show error message in posts container
        postsContainer.innerHTML = "";
        const errorMessage = document.createElement("div");
        errorMessage.className = "error-message";
        errorMessage.textContent = "Failed to load posts. Please try again.";
        postsContainer.appendChild(errorMessage);
      });
  }

  // Function to format time ago in short form
  function timeAgoShort(date) {
    const now = new Date();
    const diff = now - new Date(date);

    if (diff < 60000) {
      return "Just now";
    } else if (diff < 3600000) {
      return `${Math.floor(diff / 60000)} minute ago`;
    } else if (diff < 86400000) {
      return `${Math.floor(diff / 3600000)} hour ago`;
    } else if (diff < 2592000000) {
      return `${Math.floor(diff / 86400000)} day ago`;
    } else if (diff < 31536000000) {
      return `${Math.floor(diff / 2592000000)} month ago`;
    } else {
      return `${Math.floor(diff / 31536000000)} year ago`;
    }
  }

  // Initialize Socket.IO and load posts
  initializeSocket();
  loadPosts();
});

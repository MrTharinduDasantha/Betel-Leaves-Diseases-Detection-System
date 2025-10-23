document.addEventListener("DOMContentLoaded", function () {
  // Get current user ID
  const currentUserId = document.body.getAttribute("data-user-id");

  // Hero Slider Functionality
  const slides = document.querySelectorAll(".slide");
  const prevBtn = document.querySelector(".slider-prev");
  const nextBtn = document.querySelector(".slider-next");
  const prevBtnMobile = document.querySelector(".slider-prev-mobile");
  const nextBtnMobile = document.querySelector(".slider-next-mobile");
  let currentSlide = 0;
  let slideInterval;

  // Hero Slider Functions
  function showSlide(index) {
    slides.forEach((slide) => {
      slide.classList.remove("active");
    });
    slides[index].classList.add("active");
    currentSlide = index;
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }

  function prevSlide() {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(currentSlide);
  }

  // Set up event listeners for hero navigation buttons
  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      prevSlide();
      resetHeroInterval();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      nextSlide();
      resetHeroInterval();
    });
  }

  // Mobile hero navigation
  if (prevBtnMobile) {
    prevBtnMobile.addEventListener("click", function () {
      prevSlide();
      resetHeroInterval();
    });
  }

  if (nextBtnMobile) {
    nextBtnMobile.addEventListener("click", function () {
      nextSlide();
      resetHeroInterval();
    });
  }

  // Function to reset the hero interval timer
  function resetHeroInterval() {
    clearInterval(slideInterval);
    startHeroInterval();
  }

  // Function to start the hero interval timer
  function startHeroInterval() {
    slideInterval = setInterval(nextSlide, 30000);
  }

  // Services Slider
  const servicesSlider = document.querySelector(".services-slider");
  const servicesTrack = document.querySelector(".services-track");
  const serviceItems = document.querySelectorAll(".service-item");
  const servicesPrev = document.querySelector(".services-prev");
  const servicesNext = document.querySelector(".services-next");

  if (servicesSlider && servicesTrack && serviceItems.length > 0) {
    const itemWidth = serviceItems[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(serviceItems[0]).marginRight);
    const totalTrackWidth =
      itemWidth * serviceItems.length + gap * (serviceItems.length - 1);
    const sliderWidth = servicesSlider.offsetWidth;
    const slideAmount = itemWidth + gap;
    let currentServiceIndex = 0;

    function updateServicesTransform() {
      const maxTranslate = totalTrackWidth - sliderWidth;
      const translateX = Math.min(
        currentServiceIndex * slideAmount,
        maxTranslate
      );
      servicesTrack.style.transform = `translateX(-${translateX}px)`;
      updateServicesButtons();
    }

    function updateServicesButtons() {
      if (servicesPrev) servicesPrev.disabled = currentServiceIndex === 0;
      if (servicesNext) {
        servicesNext.disabled =
          currentServiceIndex * slideAmount >= totalTrackWidth - sliderWidth;
      }
    }

    if (servicesNext) {
      servicesNext.addEventListener("click", function () {
        if (currentServiceIndex * slideAmount < totalTrackWidth - sliderWidth) {
          currentServiceIndex++;
          updateServicesTransform();
        }
      });
    }

    if (servicesPrev) {
      servicesPrev.addEventListener("click", function () {
        if (currentServiceIndex > 0) {
          currentServiceIndex--;
          updateServicesTransform();
        }
      });
    }

    // Initial update
    updateServicesTransform();

    // Update on window resize
    window.addEventListener("resize", function () {
      // Recalculate dimensions
      const newSliderWidth = servicesSlider.offsetWidth;

      // Update slider width
      if (newSliderWidth !== sliderWidth) {
        // Force a re-render of the slider
        setTimeout(updateServicesTransform, 100);
      }
    });
  }

  // Testimonials Functionality
  const testimonialsTrack = document.getElementById("testimonials-track");
  const testimonialsPrev = document.querySelector(".testimonials-prev");
  const testimonialsNext = document.querySelector(".testimonials-next");
  const addTestimonialBtn = document.querySelector(".add-testimonial");
  const testimonialModal = document.getElementById("testimonial-modal");
  const testimonialForm = document.getElementById("testimonial-form");
  const cancelTestimonialBtn = document.getElementById("cancel-testimonial");
  const saveTestimonialBtn = document.getElementById("save-testimonial");
  const deleteModal = document.getElementById("delete-modal");
  const cancelDeleteBtn = document.getElementById("cancel-delete");
  const confirmDeleteBtn = document.getElementById("confirm-delete");
  const starRating = document.querySelectorAll(".star-rating i");
  const ratingInput = document.getElementById("rating");
  const messageInput = document.getElementById("message");
  const testimonialModalTitle = document.getElementById(
    "testimonial-modal-title"
  );
  const testimonialIdInput = document.getElementById("testimonial-id");

  let testimonials = [];
  let currentTestimonialIndex = 0;
  let currentTestimonialId = null;
  let isEditMode = false;

  // Fetch testimonials from server
  function fetchTestimonials() {
    fetch("/get-testimonials")
      .then((response) => response.json())
      .then((data) => {
        testimonials = data;
        renderTestimonials();
      })
      .catch((error) => {
        console.error("Error fetching testimonials:", error);
      });
  }

  // Render testimonials in the slider
  function renderTestimonials() {
    if (!testimonialsTrack) return;

    testimonialsTrack.innerHTML = "";

    if (testimonials.length === 0) {
      testimonialsTrack.innerHTML = `
        <div class="no-testimonials">
          <h3>No Testimonials Yet</h3>
          <p>Be the first to share your experience!</p>
        </div>
      `;
      // Hide navigation arrows
      if (testimonialsPrev) testimonialsPrev.style.display = "none";
      if (testimonialsNext) testimonialsNext.style.display = "none";
    } else {
      testimonials.forEach((testimonial) => {
        const testimonialItem = document.createElement("div");
        testimonialItem.className = "testimonial-item";
        testimonialItem.dataset.id = testimonial._id;

        // Create stars based on rating
        let starsHtml = "";
        for (let i = 1; i <= 5; i++) {
          if (i <= testimonial.rating) {
            starsHtml += '<i class="fa fa-star"></i>';
          } else {
            starsHtml += '<i class="fa fa-star-o"></i>';
          }
        }

        // determine profile pic URL (supports Cloudinary full URLs and legacy local uploads)
        const profilePicUrl = testimonial.profile_pic
          ? testimonial.profile_pic.startsWith("http")
            ? testimonial.profile_pic
            : `/uploads/${testimonial.profile_pic}`
          : typeof defaultProfilePic !== "undefined"
          ? defaultProfilePic
          : "/static/images/default_profile.png";

        testimonialItem.innerHTML = `
          <h3>${testimonial.user_name}</h3>
          <div class="testimonial-img">
            <img src="${profilePicUrl}" alt="${testimonial.user_name}">
          </div>
          <div class="rating">
            ${starsHtml}
          </div>
          <p>"${testimonial.message}"</p>
        `;

        // Always add the actions div with the menu icon
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "testimonial-actions";

        let menuHtml = "";
        if (testimonial.user_id === currentUserId) {
          menuHtml = `
            <div class="testimonial-menu" id="menu-${testimonial._id}">
              <button class="edit-testimonial" data-id="${testimonial._id}">
                <i class="fa fa-pencil-square"></i>
              </button>
              <button class="delete-testimonial" data-id="${testimonial._id}">
                <i class="fa fa-minus-square"></i>
              </button>
              <button class="close-menu" data-id="${testimonial._id}">
                <i class="fa fa-window-close"></i>
              </button>
            </div>
          `;
        }

        actionsDiv.innerHTML = `
          <button class="testimonial-menu-icon" data-id="${testimonial._id}">
            <i class="fa fa-ellipsis-v"></i>
          </button>
          ${menuHtml}
        `;

        testimonialItem.appendChild(actionsDiv);
        testimonialsTrack.appendChild(testimonialItem);
      });

      // Show navigation arrows
      if (testimonialsPrev) testimonialsPrev.style.display = "";
      if (testimonialsNext) testimonialsNext.style.display = "";

      // Set up testimonial slider after rendering
      setupTestimonialsSlider();

      // Add event listeners for testimonial actions
      setupTestimonialActions();
    }
  }

  // Set up testimonial slider
  function setupTestimonialsSlider() {
    const testimonialsSlider = document.querySelector(".testimonials-slider");
    const testimonialItems = document.querySelectorAll(".testimonial-item");

    if (testimonialsSlider && testimonialItems.length > 0) {
      const itemWidth = testimonialItems[0].offsetWidth;
      const gap = parseFloat(getComputedStyle(testimonialItems[0]).marginRight);
      const totalTrackWidth =
        itemWidth * testimonialItems.length +
        gap * (testimonialItems.length - 1);
      const sliderWidth = testimonialsSlider.offsetWidth;
      const slideAmount = itemWidth + gap;

      function updateTestimonialsTransform() {
        const maxTranslate = totalTrackWidth - sliderWidth;
        const translateX = Math.min(
          currentTestimonialIndex * slideAmount,
          maxTranslate
        );
        testimonialsTrack.style.transform = `translateX(-${translateX}px)`;
        updateTestimonialsButtons();
      }

      function updateTestimonialsButtons() {
        if (testimonialsPrev)
          testimonialsPrev.disabled = currentTestimonialIndex === 0;

        if (testimonialsNext) {
          testimonialsNext.disabled =
            currentTestimonialIndex * slideAmount >=
            totalTrackWidth - sliderWidth;
        }
      }

      if (testimonialsNext) {
        testimonialsNext.addEventListener("click", function () {
          if (
            currentTestimonialIndex * slideAmount <
            totalTrackWidth - sliderWidth
          ) {
            currentTestimonialIndex++;
            updateTestimonialsTransform();
          }
        });
      }

      if (testimonialsPrev) {
        testimonialsPrev.addEventListener("click", function () {
          if (currentTestimonialIndex > 0) {
            currentTestimonialIndex--;
            updateTestimonialsTransform();
          }
        });
      }

      // Initial update
      updateTestimonialsTransform();

      // Update on window resize
      window.addEventListener("resize", function () {
        // Recalculate dimensions
        const newSliderWidth = testimonialsSlider.offsetWidth;

        // Update slider width
        if (newSliderWidth !== sliderWidth) {
          // Force a re-render of the slider
          setTimeout(updateTestimonialsTransform, 100);
        }
      });
    }
  }

  // Set up testimonial action buttons
  function setupTestimonialActions() {
    // Menu toggle buttons
    const menuButtons = document.querySelectorAll(".testimonial-menu-icon");
    menuButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const testimonialId = this.getAttribute("data-id");
        const menu = document.getElementById(`menu-${testimonialId}`);
        if (menu) {
          // Close all other menus first
          document.querySelectorAll(".testimonial-menu").forEach((m) => {
            if (m.id !== `menu-${testimonialId}`) {
              m.classList.remove("show");
            }
          });
          // Toggle this menu
          menu.classList.toggle("show");
        } else {
          // Show error message
          showMessage(
            "You don't have access to edit or delete this testimonial",
            "error"
          );
        }
      });
    });

    // Edit buttons
    const editButtons = document.querySelectorAll(".edit-testimonial");
    editButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const testimonialId = this.getAttribute("data-id");
        editTestimonial(testimonialId);
      });
    });

    // Delete buttons
    const deleteButtons = document.querySelectorAll(".delete-testimonial");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const testimonialId = this.getAttribute("data-id");
        showDeleteConfirmation(testimonialId);
      });
    });

    // Close menu buttons
    const closeButtons = document.querySelectorAll(".close-menu");
    closeButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const testimonialId = this.getAttribute("data-id");
        const menu = document.getElementById(`menu-${testimonialId}`);
        menu.classList.remove("show");
      });
    });

    // Close menus when clicking outside
    document.addEventListener("click", function (event) {
      if (
        !event.target.closest(".testimonial-menu") &&
        !event.target.closest(".testimonial-menu-icon")
      ) {
        document.querySelectorAll(".testimonial-menu").forEach((menu) => {
          menu.classList.remove("show");
        });
      }
    });
  }

  // Edit testimonial
  function editTestimonial(testimonialId) {
    const testimonial = testimonials.find((t) => t._id === testimonialId);
    if (!testimonial) return;

    // Set form to edit mode
    isEditMode = true;
    currentTestimonialId = testimonialId;
    testimonialIdInput.value = testimonialId;
    testimonialModalTitle.textContent = "Edit Your Testimonial";
    saveTestimonialBtn.textContent = "Update";

    // Set form values
    setRating(testimonial.rating);
    messageInput.value = testimonial.message;

    // Show modal
    showTestimonialModal();
  }

  // Show delete confirmation
  function showDeleteConfirmation(testimonialId) {
    currentTestimonialId = testimonialId;
    deleteModal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  // Show testimonial modal
  function showTestimonialModal() {
    testimonialModal.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  // Hide testimonial modal
  function hideTestimonialModal() {
    testimonialModal.classList.remove("show");
    document.body.style.overflow = "";
    resetTestimonialForm();
  }

  // Hide delete modal
  function hideDeleteModal() {
    deleteModal.classList.remove("show");
    document.body.style.overflow = "";
    currentTestimonialId = null;
  }

  // Reset testimonial form
  function resetTestimonialForm() {
    isEditMode = false;
    currentTestimonialId = null;
    testimonialIdInput.value = "";
    testimonialModalTitle.textContent = "Add Your Testimonial";
    saveTestimonialBtn.textContent = "Save";
    setRating(0);
    messageInput.value = "";
  }

  // Set rating stars
  function setRating(rating) {
    ratingInput.value = rating;
    starRating.forEach((star, index) => {
      if (index < rating) {
        star.classList.remove("fa-star-o");
        star.classList.add("fa-star");
      } else {
        star.classList.remove("fa-star");
        star.classList.add("fa-star-o");
      }
    });
  }

  // Add event listeners for testimonial functionality
  if (addTestimonialBtn) {
    addTestimonialBtn.addEventListener("click", function () {
      resetTestimonialForm();
      showTestimonialModal();
    });
  }

  if (cancelTestimonialBtn) {
    cancelTestimonialBtn.addEventListener("click", hideTestimonialModal);
  }

  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  }

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", function () {
      if (currentTestimonialId) {
        deleteTestimonial(currentTestimonialId);
      }
    });
  }

  // Star rating functionality
  if (starRating) {
    starRating.forEach((star) => {
      star.addEventListener("click", function () {
        const rating = parseInt(this.getAttribute("data-rating"));
        setRating(rating);
      });

      // Hover effect
      star.addEventListener("mouseover", function () {
        const rating = parseInt(this.getAttribute("data-rating"));

        starRating.forEach((s, index) => {
          if (index < rating) {
            s.classList.remove("fa-star-o");
            s.classList.add("fa-star");
          } else {
            s.classList.remove("fa-star");
            s.classList.add("fa-star-o");
          }
        });
      });

      // Reset on mouseout if not clicked
      star.addEventListener("mouseout", function () {
        const currentRating = parseInt(ratingInput.value);

        starRating.forEach((s, index) => {
          if (index < currentRating) {
            s.classList.remove("fa-star-o");
            s.classList.add("fa-star");
          } else {
            s.classList.remove("fa-star");
            s.classList.add("fa-star-o");
          }
        });
      });
    });
  }

  // Form submission
  if (testimonialForm) {
    testimonialForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const rating = parseInt(ratingInput.value);
      const message = messageInput.value.trim();

      if (rating === 0) {
        showMessage("Please select a rating", "error");
        return;
      }

      if (message === "") {
        showMessage("Please enter a message", "error");
        return;
      }

      if (isEditMode) {
        updateTestimonial(currentTestimonialId, rating, message);
      } else {
        addTestimonial(rating, message);
      }
    });
  }

  // Add a new testimonial
  function addTestimonial(rating, message) {
    const testimonialData = {
      rating: rating,
      message: message,
    };

    fetch("/add-testimonial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testimonialData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          hideTestimonialModal();
          showMessage("Testimonial added successfully", "success");
          fetchTestimonials();
        } else {
          showMessage(data.message || "Failed to add testimonial", "error");
        }
      })
      .catch((error) => {
        console.error("Error adding testimonial:", error);
        showMessage("An error occurred. Please try again.", "error");
      });
  }

  // Update an existing testimonial
  function updateTestimonial(testimonialId, rating, message) {
    const testimonialData = {
      id: testimonialId,
      rating: rating,
      message: message,
    };

    fetch("/update-testimonial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testimonialData),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          hideTestimonialModal();
          showMessage("Testimonial updated successfully", "success");
          fetchTestimonials();
        } else {
          showMessage(data.message || "Failed to update testimonial", "error");
        }
      })
      .catch((error) => {
        console.error("Error updating testimonial:", error);
        showMessage("An error occurred. Please try again.", "error");
      });
  }

  // Delete a testimonial
  function deleteTestimonial(testimonialId) {
    fetch("/delete-testimonial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: testimonialId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          hideDeleteModal();
          showMessage("Testimonial deleted successfully", "success");
          fetchTestimonials();
        } else {
          hideDeleteModal();
          showMessage(data.message || "Failed to delete testimonial", "error");
        }
      })
      .catch((error) => {
        console.error("Error deleting testimonial:", error);
        hideDeleteModal();
        showMessage("An error occurred. Please try again.", "error");
      });
  }

  // Show message
  function showMessage(message, type) {
    const messageContainer = document.getElementById("message-container");
    if (!messageContainer) return;

    const messageElement = document.createElement("div");
    messageElement.className = `message ${type}`;
    messageElement.textContent = message;

    messageContainer.appendChild(messageElement);

    // Auto remove after 5 seconds
    setTimeout(() => {
      messageElement.classList.add("fade-out");
      setTimeout(() => {
        messageContainer.removeChild(messageElement);
      }, 500);
    }, 5000);
  }

  // Initialize the hero slider
  showSlide(0);
  startHeroInterval();

  // Fetch testimonials on page load
  fetchTestimonials();

  // Clean up hero interval when page is hidden/closed
  window.addEventListener("beforeunload", function () {
    clearInterval(slideInterval);
  });
});

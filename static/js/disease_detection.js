document.addEventListener("DOMContentLoaded", function () {
  // Initialize Quill editor (only if editor element exists - for admin users)
  const editorElement = document.getElementById("editor");
  let quill = null;

  if (editorElement) {
    quill = new Quill("#editor", {
      theme: "snow",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }], // Header formatting (H1, H2, H3, or none)
          ["bold", "italic", "underline"], // Basic text styles
          [{ list: "ordered" }, { list: "bullet" }], // Ordered and unordered lists
        ],
      },
      placeholder: "Add or edit disease solution here...",
    });
  }

  // Function to update the submit button text based on the loaded solution (admin only)
  function updateSubmitButton(solutionContent) {
    const btn = document.getElementById("solutionSubmitBtn");
    if (btn) {
      if (solutionContent && solutionContent.trim() !== "") {
        btn.textContent = "Edit Solution";
      } else {
        btn.textContent = "Save Solution";
      }
    }
  }

  // Handle admin solution form submission (only if form exists)
  const adminForm = document.getElementById("adminSolutionForm");
  if (adminForm) {
    adminForm.addEventListener("submit", function (e) {
      // Get HTML content from Quill
      const content = document.querySelector("#editor .ql-editor").innerHTML;
      // Set it in the hidden input field
      document.getElementById("solution").value = content;
    });
  }

  // Handle image upload and preview (for both admin and regular users)
  const fileInput = document.getElementById("fileInput");
  if (fileInput) {
    fileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const imagePreview = document.getElementById("imagePreview");
          const removeImageBtn = document.getElementById("removeImage");

          if (imagePreview && removeImageBtn) {
            imagePreview.src = e.target.result;
            imagePreview.hidden = false;
            removeImageBtn.style.display = "block";
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Remove image function (for both admin and regular users)
  window.removeImage = function () {
    const fileInput = document.getElementById("fileInput");
    const imagePreview = document.getElementById("imagePreview");
    const removeImageBtn = document.getElementById("removeImage");

    if (fileInput) fileInput.value = "";
    if (imagePreview) {
      imagePreview.src = "#";
      imagePreview.hidden = true;
    }
    if (removeImageBtn) {
      removeImageBtn.style.display = "none";
    }
  };

  // Handle category icon clicks (admin only)
  const categoryIcons = document.querySelectorAll(".category-icon");
  if (categoryIcons.length > 0 && quill) {
    categoryIcons.forEach((icon) => {
      icon.addEventListener("click", function () {
        const iconElement = this.querySelector("i");
        // If the clicked icon is already selected, deselect it and clear the editor.
        if (iconElement.classList.contains("fa-check-circle")) {
          iconElement.classList.remove("fa-check-circle");
          iconElement.classList.add("fa-check-circle-o");
          quill.root.innerHTML = "";
          updateSubmitButton("");
          // Clear the hidden disease input
          const diseaseInput = document.getElementById("diseaseInput");
          if (diseaseInput) diseaseInput.value = "";
          return;
        }

        // Deselect all icons first
        categoryIcons.forEach((ic) => {
          const icElement = ic.querySelector("i");
          icElement.classList.remove("fa-check-circle");
          icElement.classList.add("fa-check-circle-o");
        });

        // Mark the clicked icon as selected
        iconElement.classList.remove("fa-check-circle-o");
        iconElement.classList.add("fa-check-circle");

        // Get the category from the clicked icon
        const category = this.getAttribute("data-category");
        // Update the hidden input with the selected category
        const diseaseInput = document.getElementById("diseaseInput");
        if (diseaseInput) diseaseInput.value = category;

        // Fetch and load solution for the selected category
        if (typeof getSolutionUrl !== "undefined") {
          fetch(getSolutionUrl + category)
            .then((response) => response.json())
            .then((data) => {
              quill.root.innerHTML = data.solution || "";
              updateSubmitButton(data.solution);
            })
            .catch((error) => {
              console.error("Error fetching solution:", error);
            });
        }
      });
    });
  }

  // Handle form submission and show loading animation (for both admin and regular users)
  const form = document.querySelector("form[enctype='multipart/form-data']");
  const uploadBtn = document.getElementById("uploadPredictBtn");
  const loadingAnim = document.getElementById("loadingAnimation");

  if (form && uploadBtn && loadingAnim) {
    form.addEventListener("submit", function () {
      // Hide the upload button
      uploadBtn.style.display = "none";
      // Show the loading animation
      loadingAnim.style.display = "block";
    });
  }
});

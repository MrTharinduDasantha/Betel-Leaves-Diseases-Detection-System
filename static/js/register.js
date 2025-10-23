// Function to add or remove the 'has-content' class to input fields on page load and on input
document.addEventListener("DOMContentLoaded", () => {
  const inputFields = document.querySelectorAll(".input-field input");

  inputFields.forEach((input) => {
    if (input.value.trim() !== "") {
      input.classList.add("has-content");
    }
    input.addEventListener("input", () => {
      if (input.value.trim() !== "") {
        input.classList.add("has-content");
      } else {
        input.classList.remove("has-content");
      }
    });
  });

  // Check if password field has content on page load
  if (registerPassword.value !== "") {
    toggleRegisterPassword.style.display = "block";
  } else {
    toggleRegisterPassword.style.display = "none";
  }
});

// Function to preview the uploaded profile picture
function previewImage(event) {
  const reader = new FileReader();
  const profilePreview = document.getElementById("profile-preview");
  const profileIcon = document.getElementById("profile-icon");
  const removeIcon = document.getElementById("remove-icon");

  reader.onload = function () {
    profilePreview.src = reader.result;
    profilePreview.style.display = "block";
    profileIcon.style.display = "none";
    removeIcon.style.display = "block";
  };

  if (event.target.files[0]) {
    reader.readAsDataURL(event.target.files[0]);
  }
}

// Function to remove the uploaded profile picture
function removeImage() {
  const profilePreview = document.getElementById("profile-preview");
  const profileIcon = document.getElementById("profile-icon");
  const removeIcon = document.getElementById("remove-icon");
  const profileInput = document.getElementById("profile_pic");

  profilePreview.src = "#";
  profilePreview.style.display = "none";
  profileIcon.style.display = "block";
  removeIcon.style.display = "none";
  profileInput.value = "";
}

// Function to handle role selection
const adminIcon = document.getElementById("admin-icon");
const userIcon = document.getElementById("user-icon");
const roleInput = document.getElementById("role");

adminIcon.addEventListener("click", () => {
  adminIcon.classList.replace("far", "fas");
  userIcon.classList.replace("fas", "far");
  roleInput.value = "admin";
});

userIcon.addEventListener("click", () => {
  userIcon.classList.replace("far", "fas");
  adminIcon.classList.replace("fas", "far");
  roleInput.value = "user";
});

// Toggle password visibility for register form
const toggleRegisterPassword = document.getElementById(
  "toggle-register-password"
);
const registerPassword = document.getElementById("register-password");

// Show the eye icon only when the password field has content
registerPassword.addEventListener("input", () => {
  if (registerPassword.value !== "") {
    toggleRegisterPassword.style.display = "block";
  } else {
    toggleRegisterPassword.style.display = "none";
  }
});

toggleRegisterPassword.addEventListener("click", () => {
  if (registerPassword.type === "password") {
    registerPassword.type = "text";
    toggleRegisterPassword.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    registerPassword.type = "password";
    toggleRegisterPassword.classList.replace("fa-eye-slash", "fa-eye");
  }
});

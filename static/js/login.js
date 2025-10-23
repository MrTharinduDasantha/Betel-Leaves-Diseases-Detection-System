document.addEventListener("DOMContentLoaded", () => {
  const inputFields = document.querySelectorAll(".input-field input");
  const toggleLoginPassword = document.getElementById("toggle-login-password");
  const loginPassword = document.getElementById("login-password");

  // Handle 'has-content' class for all input fields
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

  // Initial check for password field content
  if (loginPassword.value !== "") {
    toggleLoginPassword.style.display = "block";
  } else {
    toggleLoginPassword.style.display = "none";
  }

  // Update toggle icon visibility based on password field content
  loginPassword.addEventListener("input", () => {
    if (loginPassword.value !== "") {
      toggleLoginPassword.style.display = "block";
    } else {
      toggleLoginPassword.style.display = "none";
    }
  });

  // Toggle password visibility on icon click
  toggleLoginPassword.addEventListener("click", () => {
    if (loginPassword.type === "password") {
      loginPassword.type = "text";
      toggleLoginPassword.classList.replace("fa-eye", "fa-eye-slash");
    } else {
      loginPassword.type = "password";
      toggleLoginPassword.classList.replace("fa-eye-slash", "fa-eye");
    }
  });
});

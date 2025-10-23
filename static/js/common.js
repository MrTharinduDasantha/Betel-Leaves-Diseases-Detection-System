document.addEventListener("DOMContentLoaded", function () {
  const cursorInner = document.createElement("div");
  const cursorOuter = document.createElement("div");
  const successMessage = document.body
    .getAttribute("data-success-message")
    ?.replace(/[\[\]'"]/g, "");
  const errorMessage = document.body
    .getAttribute("data-error-message")
    ?.replace(/[\[\]'"]/g, "");

  cursorInner.classList.add("cursor", "cursor-inner");
  cursorOuter.classList.add("cursor", "cursor-outer");
  document.body.appendChild(cursorInner);
  document.body.appendChild(cursorOuter);

  let endX = 0,
    endY = 0;
  let _x = 0,
    _y = 0;

  const followCursor = () => {
    _x += (endX - _x) / 8;
    _y += (endY - _y) / 8;
    cursorOuter.style.top = _y + "px";
    cursorOuter.style.left = _x + "px";
    requestAnimationFrame(followCursor);
  };

  document.addEventListener("mousemove", (e) => {
    const { clientX, clientY } = e;
    cursorInner.style.top = clientY + "px";
    cursorInner.style.left = clientX + "px";
    endX = clientX;
    endY = clientY;
  });

  document.addEventListener("mousedown", () => {
    cursorInner.style.transform = "scale(0.7)";
    cursorOuter.style.transform = "scale(5)";
  });

  document.addEventListener("mouseup", () => {
    cursorInner.style.transform = "scale(1)";
    cursorOuter.style.transform = "scale(1)";
  });

  document.addEventListener("mouseenter", () => {
    cursorInner.style.opacity = 1;
    cursorOuter.style.opacity = 1;
  });

  document.addEventListener("mouseleave", () => {
    cursorInner.style.opacity = 0;
    cursorOuter.style.opacity = 0;
  });

  const clickableElements = document.querySelectorAll(
    'a, input[type="submit"], input[type="image"], label[for], select, button, .link'
  );

  clickableElements.forEach((el) => {
    el.style.cursor = "none";
    el.addEventListener("mouseover", () => {
      cursorInner.style.transform = "scale(0.7)";
      cursorOuter.style.transform = "scale(5)";
    });
    el.addEventListener("mousedown", () => {
      cursorInner.style.transform = "scale(0.5)";
      cursorOuter.style.transform = "scale(3)";
    });
    el.addEventListener("mouseup", () => {
      cursorInner.style.transform = "scale(0.7)";
      cursorOuter.style.transform = "scale(5)";
    });
    el.addEventListener("mouseout", () => {
      cursorInner.style.transform = "scale(1)";
      cursorOuter.style.transform = "scale(1)";
    });
  });

  followCursor();

  if (successMessage) {
    showMessage(successMessage, "success");
  }
  if (errorMessage) {
    showMessage(errorMessage, "error");
  }
});

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

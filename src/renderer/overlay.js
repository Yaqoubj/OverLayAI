const hide = document.getElementById("hide");
const pin = document.getElementById("pin");

hide.addEventListener("click", () => window.quickAI.hideOverlay());

pin.addEventListener("click", async () => {
  const pinned = pin.dataset.pinned !== "true";
  pin.dataset.pinned = String(pinned);
  pin.textContent = pinned ? "Unpin" : "Pin";
  await window.quickAI.pinOverlay(pinned);
});

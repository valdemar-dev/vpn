const input = document.getElementById("pw");
const ok = document.getElementById("ok");
const cancel = document.getElementById("cancel");

function submit() {
  window.authAPI.submit(input.value);
}

ok.addEventListener("click", submit);

cancel.addEventListener("click", () => window.authAPI.cancel());

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submit();
  else if (e.key === "Escape") window.authAPI.cancel();
});

input.focus();
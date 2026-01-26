const API_URL = "https://nest-chat-backend.onrender.com/auth/signup";

let inFlight = 0;
const MAX_IN_FLIGHT = 20;

function randomString(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

function signup(): void {
  if (inFlight >= MAX_IN_FLIGHT) return;

  inFlight++;

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `${randomString(6)}@testmail.com`,
      username: `user_${randomString(5)}`,
      password: randomString(12) + "A1!"
    })
  })
    .then(r => r.json())
    .then(data => {
      console.log("✅", data);
    })
    .catch(err => {
      console.error("❌", err.message);
    })
    .finally(() => {
      inFlight--;
    });
}

setInterval(() => {
  signup();
}, 10);

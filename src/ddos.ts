const API_URL = "https://nest-chat-backend.onrender.com/auth/signup";

interface SignupPayload {
  email: string;
  username: string;
  password: string;
}

function randomString(length = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

function randomEmail(): string {
  return `${randomString(6)}@testmail.com`;
}

function randomUser(): string {
  return `user_${randomString(5)}`;
}

function randomPassword(): string {
  return randomString(12) + "A1!";
}

function signup(): void {
  const body: SignupPayload = {
    email: randomEmail(),
    username: randomUser(),
    password: randomPassword()
  };

  fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  })
    .then(res => res.json())
    .then(data => {
      console.log("✅ Signup:", data);
    })
    .catch(err => {
      console.error("❌ Error:", err);
    });
}

// 🚀 blast requests — no waiting
setInterval(() => {
  signup();
}, 10); // every 10ms (careful)

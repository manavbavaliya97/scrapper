const API_URL = "https://nest-chat-backend.onrender.com/auth/signup";

const delay = ms => new Promise(r => setTimeout(r, ms));

function randomString(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}

function randomEmail() {
  return `${randomString(6)}@testmail.com`;
}

function randomUser() {
  return `user_${randomString(5)}`;
}

function randomPassword() {
  return randomString(12) + "A1!";
}

async function signup() {
  const body = {
    email: randomEmail(),
    username: randomUser(),
    password: randomPassword()
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    console.log("Signup response:", data);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

function run() {
  while (true) {
     signup();
     delay(30);
  }
}

run();

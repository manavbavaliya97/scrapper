
const API_URL = "https://nest-chat-backend.onrender.com/users";

setInterval(async () => {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    console.log(data);
  } catch (err) {
    console.error(err);
  }
}, 3000);

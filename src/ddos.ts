
const API_URL = "https://nest-chat-backend.onrender.com/users";

async function repeatCall() {
  while (true) {
    try {
      const res = await axios.get(API_URL);
      console.log("Response:", res.data);
    } catch (err) {
      console.error("Error:", err.message);
    }

    // wait 5 seconds before next call
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

repeatCall();

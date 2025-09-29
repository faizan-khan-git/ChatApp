const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mysql = require("mysql2/promise");
const path = require("path");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
  },
});

app.use(cors());

// MySQL Database Connection
const dbConfig = {
  host: "localhost", 
  user: "root", 
  password: "", 
  database: "alignbox_chat",
};

let dbConnection;

async function connectToDatabase() {
  try {
    dbConnection = await mysql.createPool(dbConfig);
    console.log(" Successfully connected to the database.");
  } catch (error) {
    console.error(" Database connection failed:", error);
    process.exit(1); 
  }
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/messages", async (req, res) => {
  try {
    const [rows] = await dbConnection.query(
      "SELECT * FROM messages ORDER BY timestamp ASC",
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).send("Error fetching messages");
  }
});

io.on("connection", (socket) => {
  console.log(`A user connected: ${socket.id}`);

  socket.on("sendMessage", async (data) => {
    try {
      const { userId, userName, content, isAnonymous } = data;

      const senderName = isAnonymous ? "Anonymous" : userName;

      // Sql query
      const sql =
        "INSERT INTO messages (user_id, sender_name, content, is_anonymous) VALUES (?, ?, ?, ?)";
      const values = [userId, senderName, content, isAnonymous];

      // Execute query
      const [result] = await dbConnection.execute(sql, values);
      const insertedId = result.insertId;

      const [rows] = await dbConnection.query(
        "SELECT * FROM messages WHERE id = ?",
        [insertedId],
      );
      const newMessage = rows[0];

      io.emit("newMessage", newMessage);
      console.log(" Message broadcasted:", newMessage.content);
    } catch (error) {
      console.error("Error saving or broadcasting message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`A user disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  await connectToDatabase();
  console.log(`Server is running on http://localhost:${PORT}`);
});

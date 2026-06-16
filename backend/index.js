import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv'
dotenv.config();
import { GoogleGenerativeAI } from "@google/generative-ai" ;
const app = express();

const url = `https://ai-assisted-realtime-ide.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

const server = http.createServer(app);

const rooms = new Map();
const roomData = new Map();

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const apiKey = "AIzaSyCyEe0nVsBl4g7awZKSKsjCSIwfCfiLbGE";
const genAI = new GoogleGenerativeAI(apiKey);

const defaultVersions = {
  cpp: "10.2.0",              // alias for "c++"
  python3: "3.10.0",          // sent as "python" or "python3"
  javascript: "18.15.0",      // for Node.js 
  java: "15.0.2"
};

function detectLang(code) {
    if (code.includes("#include")) return "C++";
    if (code.includes("def ") || code.includes("print(")) return "Python";
    if (code.includes("function") || code.includes("console.")) return "JavaScript";
    if (code.includes("public class") || code.includes("System.out")) return "Java";
    return "code";
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let currentRoom = null;
    let currentUser = null;

    socket.on("join", ({ roomId, userName }) => {
        // Leave previous room if any
        if (currentRoom) {
            socket.leave(currentRoom);
            rooms.get(currentRoom).delete(currentUser);
            io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
        }

        currentRoom = roomId;
        currentUser = userName;

        socket.join(roomId);

        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(userName);
        io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));

        const roomInfo = roomData.get(roomId);
        if (roomInfo?.code) {
            socket.emit("codeUpdate", roomInfo.code);
        }
        if (roomInfo?.language) {
            socket.emit("languageUpdate", roomInfo.language);
        }
    });

    socket.on("codeChange", ({ roomId, code }) => {
        socket.to(roomId).emit("codeUpdate", code);

        if (!roomData.has(roomId)) roomData.set(roomId, {});
        roomData.get(roomId).code = code;
    });

    socket.on("leaveRoom", () => {
         if(currentRoom && currentUser){
            rooms.get(currentRoom).delete(currentUser);
            io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
            socket.leave(currentRoom);
            currentRoom = null;
            currentUser = null;
        }
        console.log('A user disconnected');
    })

    socket.on("typing", (roomId, userName) => {
        socket.to(roomId).emit("userTyping", userName);
    })

    socket.on("languageChange", ({ roomId, language }) => {
        io.to(roomId).emit("languageUpdate", language);

        if (!roomData.has(roomId)) roomData.set(roomId, {});
        roomData.get(roomId).language = language;
    });

    socket.on("compileCode", async ({ code, roomId, language, version, stdin }) => {
    if (rooms.has(roomId)) {
        console.log("CHECK2");
        const room = rooms.get(roomId);

        // Convert aliases if needed
        const actualLang = (language === "cpp") ? "c++" :
                        (language === "python3") ? "python" :
                        language;

        const actualVersion = (version === "*") ? defaultVersions[language] : version;

        try {
            const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
                language: actualLang,
                version: actualVersion,
                files: [{ content: code }],
                stdin: stdin || ""
            });
            socket.emit("codeResponse", response.data);  // ✅ Only send to executor
        } catch (error) {
            socket.emit("codeResponse", {
                    run: {
                    output: `Error: ${error.response?.data?.message || error.message}`
                    }
                });
            }
        }
    });

    socket.on("getAIReview", async ({roomId, code}) => {
        try {

            const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });
            const prompt = `
            You're an expert code reviewer of the language "${detectLang(code)}" and love to give code suggestions. 
            Generate a brief review of the code "${code}".
            Format clearly with headings.
            Give the response in proper format so that it comes in bulets
            `;
            // console.log("STARTING TO FETCH THE RESULT FROM THE AI");
            const result = await model.generateContent(prompt);
            // console.log("RESULT FETCHED");
            const response = result.response;
            const text = response.text();

            io.to(roomId).emit("AIReview", text);
        }
        catch{
            io.to(roomId).emit("AIReview", "Unable to review currently please try later");
        }
    })

    socket.on("disconnect" , () => {
        if(currentRoom && currentUser){
            rooms.get(currentRoom).delete(currentUser);
            io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
        }
        console.log('A user disconnected');
    })
});
const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

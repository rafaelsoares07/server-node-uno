import express from "express";
import http from "http"
import {Server} from "socket.io"

import "./config/dbConnect.js"

const app = express();
const porta = process.env.porta || 3001;
app.use(express.json())


const servidorHttp = http.createServer(app)

servidorHttp.listen(porta, () => console.log(`Servidor escutando na porta ${porta}`))

export const io = new Server(servidorHttp,{
    cors: {
        origin: "*"
    }
})


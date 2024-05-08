import { MongoClient } from "mongodb";
import dotenv from "dotenv"

dotenv.config()

const client = new MongoClient(process.env.MONGODB_CONNECT_URI);

let databaseUsers;
let databaseRooms;


try {
    await client.connect();

    const db = client.db("uno-db");

    databaseUsers = db.collection("users");
    databaseRooms = db.collection("rooms")

    console.log("Conectado ao DB")

} catch (err) {
    console.log(err);
}


export { databaseUsers, databaseRooms }
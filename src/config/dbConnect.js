import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb+srv://rafaelsoares017:adminmongo@unocluster.p6ca4mw.mongodb.net/?retryWrites=true&w=majority&appName=UnoCluster");

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
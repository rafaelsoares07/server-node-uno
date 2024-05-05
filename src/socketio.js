import { databaseUsers, databaseRooms} from "./config/dbConnect.js";
import { io } from "./index.js"
import { DeckGame } from "./utils/DeckGame.js";




io.on("connection", (socket) => {

    printRooms()

    socket.on('create_room', async(codeRoom, userName,imgAvatar, callback) => {
        socket.join(codeRoom);
        callback({ status: "OK", room: codeRoom, owner: true, socketId: socket.id })

        const resultado = await databaseUsers.insertOne({
            socket_id:socket.id,
            name:userName,
            room:codeRoom,
            img_avatar:imgAvatar
        });
        // console.log(resultado)

        const deckGame = new DeckGame;

        const result = await databaseRooms.insertOne({
            owner:socket.id,
            players:[{socket_id: socket.id, name:userName,img_avatar:imgAvatar,owner:true}],
            code:codeRoom,
            deck:deckGame.getDeck()
        });
        // console.log(result)
        printRooms()
        setupGame(codeRoom)

    });

    socket.on('join_room', async (codeRoom, userName, imgAvatar, callback) => {
        const roomExists = io.sockets.adapter.rooms.has(codeRoom);

        if (!roomExists) {
            callback({ status: "ERRO", room: codeRoom, message: "Nao Existe sala com esse ID" })
        } else {
            socket.join(codeRoom);
            callback({ status: "OK", room: codeRoom, owner: false, socketId: socket.id})

            const resultado = await databaseUsers.insertOne({
                socket_id:socket.id,
                name:userName,
                room:codeRoom,
                img_avatar:imgAvatar
            });
            // console.log(resultado)
            

            const result = await databaseRooms.updateOne(
                { code: codeRoom },
                { $addToSet: { players: {socket_id:socket.id, name:userName,img_avatar:imgAvatar,owner:false} } }
            );
            // console.log(result)
            printRooms()
            setupGame(codeRoom)
        }
    });



    async function setupGame(codeRoom) {
        const result = await databaseRooms.findOne({ code: codeRoom });
        io.to(codeRoom).emit("setup_game", result);
    }


    socket.on("disconnect", async(motivo) => {

        //PEGAR USUARIO 
        const userDiconect = await databaseUsers.findOne({
            socket_id:socket.id
        })

        //DELETAR USURAIO DA TABELA DE USERS
        const res = await databaseUsers.deleteOne({
            socket_id:socket.id
        })
        console.log(res)

        //REMOVER O USURIO DO ARRAY DE PLAYRES DA TABELA ROOM
        const result = await databaseRooms.updateOne(
            { "players.socket_id": socket.id }, // Filtro para encontrar o documento que contém o usuário no array
            { $pull: { players: {socket_id:socket.id} } } // Operador $pull para remover o usuário do array
        );
        
        //REMOVER AS SALAS QUE NAO TEM MAIS NENHUM PLAYER
        const resultA = await databaseRooms.deleteMany(
            { players: { $size: 0 } } // Filtro para encontrar os documentos com o array players vazio
        );

        printRooms()

        if(userDiconect){
            setupGame(userDiconect.room)
        }
        
        
        console.log("=======")
        console.log(userDiconect)
        console.log("=======")

    });


    

    function printRooms() {
        const rooms = io.sockets.adapter.rooms;
        console.log('Salas existentes:');
        console.log("-------------------")
        console.log(rooms)
        console.log("-------------------")
    }
})












// async function setupUpdate(codeRoom) {
    //     const result = await databaseRooms.findOne({
    //         code:codeRoom
    //     })

    //     io.to(codeRoom).emit("setup_update",result);
    // }
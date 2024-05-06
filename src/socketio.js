import { databaseUsers, databaseRooms } from "./config/dbConnect.js";
import { io } from "./index.js"
import { DeckGame } from "./utils/DeckGame.js";




io.on("connection", (socket) => {

    printRooms()

    socket.on('create_room', async (codeRoom, userName, imgAvatar, callback) => {
        socket.join(codeRoom);
        callback({ status: "OK", room: codeRoom, owner: true, socketId: socket.id })

        const resultado = await databaseUsers.insertOne({
            socket_id: socket.id,
            name: userName,
            room: codeRoom,
            img_avatar: imgAvatar,
        });
        // console.log(resultado)

        const deckGame = new DeckGame;

        const result = await databaseRooms.insertOne({
            owner: socket.id,
            players: [{ socket_id: socket.id, name: userName, img_avatar: imgAvatar, owner: true, deck: null }],
            code: codeRoom,
            deck: deckGame.getDeck(),
            order:[socket.id],
            current_turn:socket.id,
            last_card_played:null
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
            callback({ status: "OK", room: codeRoom, owner: false, socketId: socket.id })

            const resultado = await databaseUsers.insertOne({
                socket_id: socket.id,
                name: userName,
                room: codeRoom,
                img_avatar: imgAvatar
            });
            // console.log(resultado)


            const result = await databaseRooms.updateOne(
                { code: codeRoom },
                { 
                    $addToSet: { 
                        players: { 
                            socket_id: socket.id, 
                            name: userName, 
                            img_avatar: imgAvatar, 
                            owner: false, 
                            deck: null 
                        },
                        order: socket.id // Adicionando socket.id ao array order 
                    }
                }
            );
                    
            printRooms()
            setupGame(codeRoom)
        }
    });

    async function setupGame(codeRoom) {
        const result = await databaseRooms.findOne({ code: codeRoom });
        io.to(codeRoom).emit("setup_game", result);
    }


    socket.on("start_game", async (data, callback) => {
        // Busque a sala pelo código
        const room = await databaseRooms.findOne({ code: data.code });
    
        // Verifique se a sala foi encontrada
        if (room) {
            // Obtenha a lista de jogadores
            const players = room.players;

            let deckRemaned = data.deck
    
            let currentIndex = 0; // Variável para rastrear a posição atual no array data.deck
    
            // Atualize o deck de cada jogador
            const updatedPlayers = players.map(player => {
                // Pegue as próximas 7 cartas do array data.deck
                const newDeck = data.deck.slice(currentIndex, currentIndex + 15);
                deckRemaned = deckRemaned.slice(15)
                // Atualize o deck do jogador e atualize a variável currentIndex
                currentIndex += 15;
    
                return {
                    ...player,
                    deck: newDeck // Substitua "novoDeck" pelo novo deck que você deseja atribuir ao jogador
                };
            });
    
            // Atualize o documento com a lista de jogadores atualizada
            const result = await databaseRooms.updateOne(
                { code: data.code },
                { $set: { players: updatedPlayers } }
            );

            const removeCardsResult = await databaseRooms.updateOne(
                { code: data.code },
                { $set: { deck: deckRemaned } }
            );
    
            const roomAtualizada = await databaseRooms.findOne({ code: data.code });

            io.to(data.code).emit("start_game", roomAtualizada);
            
        } else {
            // Sala não encontrada
        }
    });
    

    socket.on("play_card", async(data, card, callback )=>{
        const lastCardPlayed = await getLastCardPlayed(data.code)
        if(!lastCardPlayed){
            console.log("E a primeira carta da partida")
            registerLastCardPlayed(data.code, card)
        }else{
            if(isSpecialCard(card)){
                console.log("E um carta especial")
                registerLastCardPlayed(data.code, card)
            }
            else if(verifySameColor(lastCardPlayed,card)){
                console.log("Sao da mesma cor")
                registerLastCardPlayed(data.code,card)
            }
            else if(verifySameValue(lastCardPlayed,card)){
                console.log("As cartas tem o mesmo valor, entao pode ser jogada")
                registerLastCardPlayed(data.code,card)
            }
            else{
                callback({type:"ERRO",message:"Essa carta nao pode ser jogada, lembre-se: As cartas devem ser do mesmo numero ou cor para poder jogar, ou se for uma crta especial"})
            }
        }
    })

    socket.on("disconnect", async (motivo) => {

        //PEGAR USUARIO 
        const userDiconect = await databaseUsers.findOne({
            socket_id: socket.id
        })

        //DELETAR USURAIO DA TABELA DE USERS
        const res = await databaseUsers.deleteOne({
            socket_id: socket.id
        })
        // console.log(res)

        //REMOVER O USURIO DO ARRAY DE PLAYRES DA TABELA ROOM
        const result = await databaseRooms.updateOne(
            { "players.socket_id": socket.id }, // Filtro para encontrar o documento que contém o usuário no array
            { $pull: { players: { socket_id: socket.id } } } // Operador $pull para remover o usuário do array
        );

        //REMOVER AS SALAS QUE NAO TEM MAIS NENHUM PLAYER
        const resultA = await databaseRooms.deleteMany(
            { players: { $size: 0 } } // Filtro para encontrar os documentos com o array players vazio
        );

        printRooms()

        if (userDiconect) {
            setupGame(userDiconect.room)
        }


        // console.log("=======")
        // console.log(userDiconect)
        // console.log("=======")

    });


    function printRooms() {
        const rooms = io.sockets.adapter.rooms;
        // console.log('Salas existentes:');
        // console.log("-------------------")
        // console.log(rooms)
        // console.log("-------------------")
    }




    // FUNCOES DE REUTILIZAVEIS PARA IMPLEMENTAR NA REFATORACAO
    async function getLastCardPlayed(codeRoom){
        const result = await databaseRooms.findOne({ code: codeRoom });
        const lastCardPlayed = result.last_card_played;
        return lastCardPlayed;
    }

    async function registerLastCardPlayed(codeRoom, card){
        const updateLastCard = await databaseRooms.updateOne(
            { code: codeRoom },
            { $set: { last_card_played: card } } 
        );

        const updatedRoom = await databaseRooms.findOne(
            {code:codeRoom}
        )

        io.to(codeRoom).emit("play_card", updatedRoom);
    }
    function isSpecialCard(card){
        if(card.type =="Wild Card"){
            return true;
        }
        return false;    
    }
    function verifySameColor(lastCardPlayed, card){
        if(lastCardPlayed.color==card.color){
            return true;
        }
        return false;
    }
    function verifySameValue(last_card_played, card){
        if(last_card_played.value==card.value){
            return true;
        }
        return false;
    }
})





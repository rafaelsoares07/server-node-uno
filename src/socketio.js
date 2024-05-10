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
            order: [socket.id],
            current_turn: socket.id,
            last_card_played: null,
            deck_discard: []
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
                const newDeck = data.deck.slice(currentIndex, currentIndex + 5);
                deckRemaned = deckRemaned.slice(5)
                // Atualize o deck do jogador e atualize a variável currentIndex
                currentIndex += 5;

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

    socket.on("initial_game_setup", async (roomId, callback) => {
        const room = await databaseRooms.findOne({ code: roomId });
        callback(room)
    })

    socket.on("play_card", async (data, card, callback) => {
        const lastCardPlayed = await getLastCardPlayed(data.code)
        if (!lastCardPlayed) {
            // console.log("E a primeira carta da partida")
            registerLastCardPlayed(data.code, card)
        }
        else if (isSpecialCard(card)) {
            // console.log("E um carta especial")
            registerLastCardPlayed(data.code, card)
        }
        else if (verifySameColor(lastCardPlayed, card)) {
            // console.log("Sao da mesma cor")
            registerLastCardPlayed(data.code, card)
        }
        else if (verifySameValue(lastCardPlayed, card)) {
            // console.log("As cartas tem o mesmo valor, entao pode ser jogada")
            registerLastCardPlayed(data.code, card)
        }
        else {
            callback({ type: "ERRO", message: "Essa carta nao pode ser jogada, lembre-se: As cartas devem ser do mesmo numero ou cor para poder jogar, ou se for uma crta especial" })
        }
    }
    )

    socket.on("pick_card", async (data, callback) => {
        const { updatedRoom, deckAfterPick } = await pickCard(data)
        // console.log(deckAfterPick)
        callback(deckAfterPick)
        socket.broadcast.emit("action_game_drag_card", updatedRoom)
    })

    socket.on("pass_turn", async (data, callback) => {
        callback({ message: "Voce passou o turno" })
        const updatedRoom = await databaseRooms.findOne(
            { code: data.code }
        )
        let nextPlayerIndex = updatedRoom.order.indexOf(updatedRoom.current_turn) + 1;

        console.log(nextPlayerIndex)

        if (nextPlayerIndex === updatedRoom.order.length) {
            const updateLastCard = await databaseRooms.updateOne(
                { code: data.code },
                { $set: { current_turn: updatedRoom.order[0] } }
            );
        }
        else {
            const updateLastCard = await databaseRooms.updateOne(
                { code: data.code },
                { $set: { current_turn: updatedRoom.order[nextPlayerIndex] } }
            );
        }

        const updatedRoomFinaly = await databaseRooms.findOne(
            { code: data.code }
        )

        io.to(data.code).emit("action_game_play_card", updatedRoomFinaly);
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
    async function getLastCardPlayed(codeRoom) {
        const result = await databaseRooms.findOne({ code: codeRoom });
        const lastCardPlayed = result.last_card_played;
        return lastCardPlayed;
    }

    async function registerLastCardPlayed(codeRoom, card) {

        const updateLastCard = await databaseRooms.updateOne(
            { code: codeRoom },
            { $set: { last_card_played: card } }
        );

        const updatedRoom = await databaseRooms.findOne(
            { code: codeRoom }
        )

        console.log(updatedRoom)

        let currentPlayer = updatedRoom.players.filter(player => player.socket_id === updatedRoom.current_turn)
        console.log(currentPlayer)
        let refreshDeckPlayer = currentPlayer[0].deck;
        removeCardFromDeck(refreshDeckPlayer, card);


        const updateResult = await databaseRooms.updateOne(
            {
                code: codeRoom, // Código da sala
                "players.socket_id": currentPlayer[0].socket_id // Procurar pelo jogador pelo socket_id
            },
            {
                $set: {
                    "players.$[player].deck": currentPlayer[0].deck // Atualizar o array de cartas do jogador específico
                },
                $addToSet: {
                    deck_discard: { $each: [card] }
                }
            },
            {
                arrayFilters: [{ "player.socket_id": currentPlayer[0].socket_id }]
            }
        );

        console.log(card)

        if (card.value == "skip") {
            let nextPlayerIndex = updatedRoom.order.indexOf(updatedRoom.current_turn) + 2;

            if (nextPlayerIndex === updatedRoom.order.length) {
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: updatedRoom.order[0] } }
                );
            }
            else if(nextPlayerIndex>updatedRoom.order.length){
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: updatedRoom.order[1] } }
                );
            }
            else {
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: updatedRoom.order[nextPlayerIndex] } }
                );
            }

        }
        else if (card.value == "Reverse") {
            const array = [...updatedRoom.order]
            console.log(updatedRoom.order)
            const orderreverse = array.reverse()
            console.log(orderreverse)

            let nextPlayerIndex = orderreverse.indexOf(updatedRoom.current_turn) + 1;

            console.log(nextPlayerIndex)

            if (nextPlayerIndex === updatedRoom.order.length) {
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: orderreverse[0] } }
                );
            }
            else {
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: orderreverse[nextPlayerIndex] } }
                );
            }
            await databaseRooms.updateOne(
                { code: codeRoom },
                { $set: { order: orderreverse } }
            )

        }
        else {
            let nextPlayerIndex = updatedRoom.order.indexOf(updatedRoom.current_turn) + 1;

            console.log(nextPlayerIndex)

            if (nextPlayerIndex === updatedRoom.order.length) {
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: updatedRoom.order[0] } }
                );
            }
            else {
                const updateLastCard = await databaseRooms.updateOne(
                    { code: codeRoom },
                    { $set: { current_turn: updatedRoom.order[nextPlayerIndex] } }
                );
            }
        }

        const updatedRoomFinaly = await databaseRooms.findOne(
            { code: codeRoom }
        )

        io.to(codeRoom).emit("action_game_play_card", { ...updatedRoomFinaly, action: "play_card" });
    }
    function isSpecialCard(card) {
        if (card.type == "Wild Card") {
            return true;
        }
        return false;
    }
    function verifySameColor(lastCardPlayed, card) {
        if (lastCardPlayed.color == card.color) {
            return true;
        }
        return false;
    }
    function verifySameValue(last_card_played, card) {
        if (last_card_played.value == card.value) {
            return true;
        }
        return false;
    }
    function removeCardFromDeck(deck, cardToRemove) {
        const index = deck.findIndex(card => card.name === cardToRemove.name);
        if (index !== -1) {
            deck.splice(index, 1);
        }
    }

    async function pickCard(data) {
        const room = await databaseRooms.findOne(
            { code: data.code }
        )
        const pikedCard = room.deck[0]
        room.deck.shift();

        await databaseRooms.updateOne({ code: data.code }, { $set: { deck: room.deck } });

        let currentPlayer = room.players.filter(player => player.socket_id === data.current_turn)
        let deckAfterPick = [...currentPlayer[0].deck, pikedCard]

        await databaseRooms.updateOne(
            {
                code: data.code, // Código da sala
                "players.socket_id": currentPlayer[0].socket_id // Procurar pelo jogador pelo socket_id
            },
            {
                $set: {
                    "players.$[player].deck": deckAfterPick// Atualizar o array de cartas do jogador específico
                }
            },
            {
                arrayFilters: [{ "player.socket_id": currentPlayer[0].socket_id }]
            }
        );

        const updatedRoom = await databaseRooms.findOne(
            { code: data.code }
        )

        return { updatedRoom, deckAfterPick }

    }


})





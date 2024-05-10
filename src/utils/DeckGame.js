export class DeckGame {
    
    constructor() {
        this.deck = [];
        this.buildDeck();
    }

    buildDeck() {
        const colors = ["R", "B", "G", "Y"];
        const specialCards = ["skip", "Reverse"];
        const wildCards = ["W"];

        // Adiciona cartas numeradas
        for (let color of colors) {
            for (let i = 0; i <= 9; i++) {
                this.deck.push({name:`${color}${i}`,value:i, color:color, type:"Basic Card",action:false});
            }
        }

        // Adiciona cartas especiais
        for (let color of colors) {
            for (let special of specialCards) {
                this.deck.push({name:`${special}${color}`,value:special, color:color, type:"Especial Card",action:true})
            }
        }

        // Adiciona cartas Wild
        for (let wild of wildCards) {
            for (let i = 0; i < 4; i++) {
                this.deck.push({name:wild,value:wild, color:null, type:"Wild Card",action:true});
            }
        }

        // Embaralha o baralho
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    getDeck() {
        return this.deck;
    }
}



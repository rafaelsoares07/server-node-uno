export class DeckGame {
    
    constructor() {
        this.deck = [];
        this.buildDeck();
    }

    buildDeck() {
        const colors = ["R", "B", "G", "Y"];
        const specialCards = ["skip", "Reverse", "D2"];
        const wildCards = ["W", "D4W"];

        // Adiciona cartas numeradas
        for (let color of colors) {
            for (let i = 0; i <= 9; i++) {
                this.deck.push(`${color}${i}`);
            }
        }

        // Adiciona cartas especiais
        for (let color of colors) {
            for (let special of specialCards) {
                this.deck.push(`${special}${color}`);
            }
        }

        // Adiciona cartas Wild
        for (let wild of wildCards) {
            for (let i = 0; i < 4; i++) {
                this.deck.push(wild);
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



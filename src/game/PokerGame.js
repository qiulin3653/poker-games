// 德州扑克游戏核心类
// 负责游戏流程控制和状态管理

const { addMessage } = require('../ui/MessageManager');
const { evaluateHand, compareHands } = require('./HandEvaluator');
const BotAI = require('./BotAI');
const PotManager = require('./PotManager');

let activeTimers = []; // 跟踪所有定时器

class PokerGame {
    constructor(updateStatusBarCallback) {
        this.suits = ['♠', '♥', '♦', '♣'];
        this.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

        this.players = [
            { id: 0, name: '你', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: false, hasActedThisRound: false, isAllIn: false },
            { id: 1, name: '机器人1', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: true, hasActedThisRound: false, isAllIn: false },
            { id: 2, name: '机器人2', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: true, hasActedThisRound: false, isAllIn: false },
            { id: 3, name: '机器人3', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: true, hasActedThisRound: false, isAllIn: false },
            { id: 4, name: '机器人4', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: true, hasActedThisRound: false, isAllIn: false },
            { id: 5, name: '机器人5', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: true, hasActedThisRound: false, isAllIn: false },
            { id: 6, name: '机器人6', chips: 1000, cards: [], bet: 0, totalBet: 0, folded: false, isBot: true, hasActedThisRound: false, isAllIn: false }
        ];

        this.deck = [];
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = 0;
        this.dealerPosition = 0;
        this.currentPlayer = 0;
        this.gamePhase = 'preflop'; // 初始状态
        this.smallBlind = 50; // 小盲注
        this.bigBlind = 100; // 2倍小盲注
        this.bettingUnit = 10; // 下注单位
        this.gameEnded = false; // 游戏结束标志
        this.activePlayersThisRound = []; // 本轮活跃玩家

        // 初始化AI和边池管理器
        this.botAI = new BotAI();
        this.potManager = new PotManager();

        // 保存状态栏更新回调
        this.updateStatusBarCallback = updateStatusBarCallback;
    }

    getPhaseText() {
        const phaseMap = {
            'preflop': '翻牌前',
            'flop': '翻牌',
            'turn': '转牌',
            'river': '河牌'
        };
        return phaseMap[this.gamePhase] || this.gamePhase;
    }

    createDeck() {
        this.deck = [];
        for (let suit of this.suits) {
            for (let rank of this.ranks) {
                this.deck.push({ rank, suit });
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCards() {
        this.players.forEach(player => {
            if (!player.folded && player.chips > 0) {
                player.cards = [this.deck.pop(), this.deck.pop()];
            }
        });
    }

    startNewHand() {
        // 检查破产玩家
        const bankruptPlayers = this.players.filter(p => p.chips < 0);
        if (bankruptPlayers.length > 0) {
            addMessage(`❌ 检测到破产玩家: ${bankruptPlayers.map(p => p.name).join(', ')}，筹码为负数`);
            bankruptPlayers.forEach(p => {
                p.chips = 0;
                addMessage(`⚠️ ${p.name} 筹码已重置为 $0`);
            });
        }

        if (this.players[0].chips < this.bigBlind) {
            addMessage('❌ 你的筹码不足，无法开始新一局');
            this.gameEnded = true;
            return;
        }

        const eligiblePlayers = this.players.filter(p => p.chips >= this.bigBlind);
        if (eligiblePlayers.length < 2) {
            addMessage(`❌ 参与玩家不足！需要至少2位玩家有$${this.bigBlind}以上筹码`);
            this.gameEnded = true;

            if (this.players[0].chips >= this.bigBlind) {
                addMessage('💡 其他玩家都已破产，建议点击"重新开始"重置游戏');
            }
            return;
        }

        const chipStatus = this.players.map(p => `${p.name}: $${p.chips}`).join(' | ');
        console.log('🎲 [游戏开始] 筹码状况:', chipStatus);
        // addMessage(`💰 当前筹码: ${chipStatus}`);

        this.createDeck();
        this.communityCards = [];
        this.pot = 0;
        this.currentBet = this.bigBlind;
        this.gamePhase = 'preflop';
        this.gameEnded = false;
        this.activePlayersThisRound = [];
        this.potManager.reset();

        this.players.forEach(player => {
            player.cards = [];
            player.bet = 0;
            player.totalBet = 0;  // 重置本局总投入

            if (player.chips < 0) {
                console.log('🎲 [筹码修复] 重置', player.name, '的负数筹码从', player.chips, '到0');
                player.chips = 0;
            }

            player.folded = player.chips <= 0;
            player.hasActedThisRound = false;
            player.isAllIn = false;
        });

        // 设置盲注
        let sbPos = this.dealerPosition;
        let sbFound = false;
        let attempts = 0;

        while (!sbFound && attempts < this.players.length * 2) {
            sbPos = (sbPos + 1) % this.players.length;
            if (this.players[sbPos].chips >= this.smallBlind) {
                sbFound = true;
            }
            attempts++;
        }

        let bbPos = sbPos;
        let bbFound = false;
        attempts = 0;

        while (!bbFound && attempts < this.players.length * 2) {
            bbPos = (bbPos + 1) % this.players.length;
            if (this.players[bbPos].chips >= this.bigBlind) {
                bbFound = true;
            }
            attempts++;
        }

        if (!sbFound || !bbFound) {
            addMessage('❌ 无法找到足够的玩家设置大小盲，游戏结束');
            this.gameEnded = true;
            return;
        }

        console.log('🎲 [盲注设置] 庄家:', this.players[this.dealerPosition].name,
            '| 小盲:', this.players[sbPos].name,
            '| 大盲:', this.players[bbPos].name);

        // 小盲下注
        this.players[sbPos].bet = Math.min(this.smallBlind, this.players[sbPos].chips);
        this.players[sbPos].chips -= this.players[sbPos].bet;
        this.players[sbPos].totalBet += this.players[sbPos].bet;  // 累计总投入
        this.players[sbPos].hasActedThisRound = false;
        if (this.players[sbPos].chips === 0) {
            this.players[sbPos].isAllIn = true;
            this.potManager.createSidePot(this.players[sbPos]);
        }

        // 大盲下注
        this.players[bbPos].bet = Math.min(this.bigBlind, this.players[bbPos].chips);
        this.players[bbPos].chips -= this.players[bbPos].bet;
        this.players[bbPos].totalBet += this.players[bbPos].bet;  // 累计总投入
        this.players[bbPos].hasActedThisRound = false;
        if (this.players[bbPos].chips === 0) {
            this.players[bbPos].isAllIn = true;
            this.potManager.createSidePot(this.players[bbPos]);
        }

        this.pot = this.players[sbPos].bet + this.players[bbPos].bet;

        this.activePlayersThisRound = this.players
            .filter(p => !p.folded && !p.isAllIn && p.chips > 0)
            .map(p => p.id);

        this.dealCards();

        // 找第一个行动玩家
        let firstPlayer = bbPos;
        let firstPlayerFound = false;
        attempts = 0;

        while (!firstPlayerFound && attempts < this.players.length * 2) {
            firstPlayer = (firstPlayer + 1) % this.players.length;
            if (this.players[firstPlayer].chips > 0 && !this.players[firstPlayer].folded) {
                firstPlayerFound = true;
            }
            attempts++;
        }

        this.currentPlayer = firstPlayerFound ? firstPlayer : this.dealerPosition;

        addMessage('🎮 新一局开始！小盲$' + this.smallBlind + '，大盲$' + this.bigBlind);
        console.log('🎲 [游戏状态] 当前玩家:', this.players[this.currentPlayer].name, '| 阶段:', this.gamePhase, '| 底池:', this.pot);

        if (this.players[this.currentPlayer].isBot) {
            const timer = setTimeout(() => {
                this.botAction();
                if (this.updateStatusBarCallback) this.updateStatusBarCallback();
            }, 1000);
            activeTimers.push(timer);
        }
    }

    isPlayerTurn() {
        return this.currentPlayer === 0 && !this.players[0].folded && !this.gameEnded;
    }

    playerAction(action, amount = 0) {
        const player = this.players[this.currentPlayer];
        player.hasActedThisRound = true;

        console.log('🎲 [玩家操作]', player.name, '执行:', action,
            '| 筹码:', player.chips, '| 当前下注:', player.bet, '| 当前赌注:', this.currentBet);

        const wasAllIn = player.isAllIn;

        if (action === 'fold') {
            player.folded = true;
            addMessage('❌ ' + player.name + ' 弃牌');
        } else if (action === 'call') {
            const callAmount = this.currentBet - player.bet;
            const actualCall = Math.min(callAmount, player.chips);
            player.chips -= actualCall;
            player.bet += actualCall;
            player.totalBet += actualCall;  // 累计总投入
            this.pot += actualCall;

            console.log('🎲 [跟注详情] 需要跟注:', callAmount, '| 实际跟注:', actualCall,
                '| 剩余筹码:', player.chips, '| 底池:', this.pot);

            if (player.chips === 0) {
                player.isAllIn = true;
                addMessage('💥 ' + player.name + ' All-In $' + player.totalBet);
            } else if (actualCall === 0) {
                addMessage('✓ ' + player.name + ' 过牌');
            } else {
                addMessage('✓ ' + player.name + ' 跟注 $' + actualCall);
            }
        } else if (action === 'raise') {
            const normalizedAmount = this.normalizeBetAmount(Math.min(amount, player.chips));
            const actualRaise = Math.max(normalizedAmount, this.bettingUnit);

            player.chips -= actualRaise;
            player.bet += actualRaise;
            player.totalBet += actualRaise;  // 累计总投入
            this.pot += actualRaise;
            this.currentBet = player.bet;

            console.log('🎲 [加注详情] 加注金额:', actualRaise, '| 总下注:', player.bet,
                '| 剩余筹码:', player.chips, '| 底池:', this.pot);

            if (player.chips === 0) {
                player.isAllIn = true;
                addMessage('💥 ' + player.name + ' All-In $' + player.totalBet);
            } else {
                addMessage('⬆ ' + player.name + ' 加注至 $' + player.bet);
            }

            this.players.forEach((p, idx) => {
                if (idx !== this.currentPlayer && !p.folded && !p.isAllIn) {
                    p.hasActedThisRound = false;
                }
            });

            this.activePlayersThisRound = this.players
                .filter(p => !p.folded && !p.isAllIn && p.chips > 0)
                .map(p => p.id);
        }

        if (!wasAllIn && player.isAllIn) {
            this.potManager.createSidePot(player);
        }

        this.nextPlayer();
    }

    botAction() {
        const player = this.players[this.currentPlayer];
        this.botAI.makeDecision(this, player, (action, amount) => {
            this.playerAction(action, amount);
        });
    }

    nextPlayer() {
        const activePlayers = this.players.filter(p => !p.folded);

        if (activePlayers.length === 1) {
            console.log('🎲 [提前结束] 只剩一位玩家:', activePlayers[0].name);
            const currentPotAmount = this.pot;
            const winnerObj = { player: activePlayers[0], handRank: { name: '其他玩家弃牌', rank: -1 } };
            this.endHand([winnerObj], currentPotAmount);
            return;
        }

        let allBetsEqual = true;
        let allActed = true;
        const maxBet = Math.max(...this.players.map(p => p.bet));

        for (let player of this.players) {
            if (!player.folded && !player.isAllIn) {
                if (player.bet < maxBet) {
                    allBetsEqual = false;
                }
                if (!player.hasActedThisRound) {
                    allActed = false;
                }
            }
        }

        if (allBetsEqual && allActed) {
            console.log('🎲 [下注轮结束] 所有玩家已操作完成，进入下一阶段');
            this.nextPhase();
            return;
        }

        const playersNeedingAction = this.players.filter(p =>
            !p.folded && !p.isAllIn && !p.hasActedThisRound && p.chips > 0
        );

        if (playersNeedingAction.length === 0 && allBetsEqual) {
            console.log('🎲 [轮次结束] 没有玩家需要操作，进入下一阶段');
            this.nextPhase();
            return;
        }

        let attempts = 0;
        let eligiblePlayerFound = false;

        do {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
            attempts++;

            const currentPlayerObj = this.players[this.currentPlayer];

            const isEligible = !currentPlayerObj.folded &&
                !currentPlayerObj.isAllIn &&
                currentPlayerObj.chips > 0 &&
                !currentPlayerObj.hasActedThisRound;

            if (isEligible) {
                eligiblePlayerFound = true;
                break;
            }

            if (attempts > this.players.length * 3) {
                console.log('🎲 [异常] 轮次检测异常，强制进入下一阶段');
                const activePlayers = this.players.filter(p => !p.folded);
                if (activePlayers.length === 0) {
                    this.gameEnded = true;
                    if (this.updateStatusBarCallback) this.updateStatusBarCallback();
                    return;
                } else if (activePlayers.length === 1) {
                    const currentPotAmount = this.pot;
                    const winnerObj = { player: activePlayers[0], handRank: { name: '其他玩家弃牌', rank: -1 } };
                    this.endHand([winnerObj], currentPotAmount);
                    return;
                } else {
                    this.showdown();
                    return;
                }
            }
        } while (attempts <= this.players.length * 3);

        if (!eligiblePlayerFound) {
            console.log('🎲 [最终检查] 未找到合格玩家，强制进入下一阶段');
            this.nextPhase();
            return;
        }

        console.log('🎲 [轮次] 轮到:', this.players[this.currentPlayer].name);

        if (this.players[this.currentPlayer].isBot) {
            const timer = setTimeout(() => {
                this.botAction();
                if (this.updateStatusBarCallback) this.updateStatusBarCallback();
            }, 1500);
            activeTimers.push(timer);
        } else {
            // 轮到人类玩家，立即更新UI显示操作按钮
            if (this.updateStatusBarCallback) this.updateStatusBarCallback();
        }
    }

    nextPhase() {
        this.players.forEach(p => {
            p.bet = 0;
            p.hasActedThisRound = false;
        });
        this.currentBet = 0;

        this.activePlayersThisRound = this.players
            .filter(p => !p.folded && !p.isAllIn && p.chips > 0)
            .map(p => p.id);

        const playersCanAct = this.players.filter(p => !p.folded && !p.isAllIn);

        if (playersCanAct.length <= 1) {
            console.log('🎲 [快速结算] 所有玩家已 All-In，直接发完剩余公共牌');

            if (this.gamePhase === 'preflop') {
                this.gamePhase = 'flop';
                this.communityCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
                addMessage('📄 翻牌: ' + this.communityCards.map(c => c.rank + c.suit).join(' '));

                this.gamePhase = 'turn';
                this.communityCards.push(this.deck.pop());
                addMessage('🎴 转牌: ' + this.communityCards[3].rank + this.communityCards[3].suit);

                this.gamePhase = 'river';
                this.communityCards.push(this.deck.pop());
                addMessage('🃏 河牌: ' + this.communityCards[4].rank + this.communityCards[4].suit);
            } else if (this.gamePhase === 'flop') {
                this.gamePhase = 'turn';
                this.communityCards.push(this.deck.pop());
                addMessage('🎴 转牌: ' + this.communityCards[3].rank + this.communityCards[3].suit);

                this.gamePhase = 'river';
                this.communityCards.push(this.deck.pop());
                addMessage('🃏 河牌: ' + this.communityCards[4].rank + this.communityCards[4].suit);
            } else if (this.gamePhase === 'turn') {
                this.gamePhase = 'river';
                this.communityCards.push(this.deck.pop());
                addMessage('🃏 河牌: ' + this.communityCards[4].rank + this.communityCards[4].suit);
            }

            this.showdown();
            return;
        }

        if (this.gamePhase === 'preflop') {
            this.gamePhase = 'flop';
            this.communityCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
            addMessage('📄 翻牌: ' + this.communityCards.map(c => c.rank + c.suit).join(' '));
        } else if (this.gamePhase === 'flop') {
            this.gamePhase = 'turn';
            this.communityCards.push(this.deck.pop());
            addMessage('🎴 转牌: ' + this.communityCards[3].rank + this.communityCards[3].suit);
        } else if (this.gamePhase === 'turn') {
            this.gamePhase = 'river';
            this.communityCards.push(this.deck.pop());
            addMessage('🃏 河牌: ' + this.communityCards[4].rank + this.communityCards[4].suit);
        } else if (this.gamePhase === 'river') {
            this.showdown();
            return;
        }

        let nextPlayer = this.dealerPosition;
        let eligiblePlayerFound = false;
        let attempts = 0;

        while (!eligiblePlayerFound && attempts < this.players.length * 2) {
            nextPlayer = (nextPlayer + 1) % this.players.length;
            const player = this.players[nextPlayer];

            if (!player.folded && !player.isAllIn && player.chips > 0) {
                eligiblePlayerFound = true;
                this.currentPlayer = nextPlayer;
                break;
            }
            attempts++;
        }

        if (!eligiblePlayerFound) {
            console.log('🎲 [新阶段异常] 没有找到合格玩家，直接进入摊牌');
            this.showdown();
            return;
        }

        console.log('🎲 [新阶段] 轮到:', this.players[this.currentPlayer].name);

        if (this.players[this.currentPlayer].isBot) {
            const timer = setTimeout(() => {
                this.botAction();
                if (this.updateStatusBarCallback) this.updateStatusBarCallback();
            }, 1500);
            activeTimers.push(timer);
        }
    }

    showdown() {
        const activePlayers = this.players.filter(p => !p.folded);
        const finalPotAmount = this.pot;

        console.log('🎲 [摊牌阶段] 进入最终摊牌，剩余玩家数:', activePlayers.length);

        const playerHands = activePlayers.map(player => {
            const allCards = [...player.cards, ...this.communityCards];
            const handRank = evaluateHand(allCards);
            return { player, handRank };
        });

        let winners = [playerHands[0]];
        for (let i = 1; i < playerHands.length; i++) {
            const comparison = compareHands(playerHands[i].handRank, winners[0].handRank);

            if (comparison > 0) {
                winners = [playerHands[i]];
            } else if (comparison === 0) {
                winners.push(playerHands[i]);
            }
        }

        console.log('🎲 [最终结果]', winners.length, '位赢家:', winners.map(w => w.player.name).join(', '));
        this.endHand(winners, finalPotAmount);
    }

    endHand(winners, potAmount = null) {
        this.gameEnded = true;
        const finalPotAmount = potAmount !== null ? potAmount : this.pot;

        // 🎯 调试日志：显示每个玩家的本局总投入
        console.log('🎲 [本局投入] 玩家投入明细:', this.players.map(p =>
            `${p.name}:$${p.totalBet}${p.folded ? '(弃牌)' : ''}`
        ).join(', '), '| 总计:', this.players.reduce((sum, p) => sum + p.totalBet, 0));

        const distribution = this.potManager.distributePots(this.players, winners, finalPotAmount);

        let resultMessages = [];
        distribution.forEach(dist => {
            if (dist.winners.length === 1) {
                resultMessages.push(`🎉 ${dist.winners[0]} 从${dist.pot}获得 $${dist.amount}`);
            } else {
                const winnerNames = dist.winners.join(', ');
                const eachAmount = Math.floor(dist.amount / dist.winners.length);
                resultMessages.push(`🎉 ${winnerNames} 平分${dist.pot}！各获得 $${eachAmount}`);
            }
        });

        if (resultMessages.length > 0) {
            addMessage(resultMessages.join('\n'));
        }

        addMessage('═══ 摊牌 ═══');

        if (this.communityCards.length > 0) {
            const communityText = this.communityCards.map(c => c.rank + c.suit).join(' ');
            addMessage('公共牌: ' + communityText);
        } else {
            addMessage('公共牌: 无（提前结束）');
        }

        this.players.forEach(player => {
            if (player.cards.length > 0) {
                const cardsText = player.cards.map(c => c.rank + c.suit).join(' ');
                const status = player.folded ? '(已弃牌)' : '';
                addMessage(`${player.name}: ${cardsText} ${status}`);
            }
        });

        // 显示所有玩家的剩余筹码（用于验证奖池分配合理性）
        // addMessage('═══ 筹码统计 ═══');
        // const chipsStatus = this.players.map(p => `${p.name}: $${p.chips}`).join(' | ');
        // const totalChips = this.players.reduce((sum, p) => sum + p.chips, 0);
        // addMessage(chipsStatus);
        // console.log('🎲 [筹码统计]', chipsStatus, '| 合计: $' + totalChips);

        const timer = setTimeout(() => {
            let newDealerPos = this.dealerPosition;
            let dealerFound = false;
            let attempts = 0;

            while (!dealerFound && attempts < this.players.length * 2) {
                newDealerPos = (newDealerPos + 1) % this.players.length;
                if (this.players[newDealerPos].chips >= this.smallBlind) {
                    dealerFound = true;
                    this.dealerPosition = newDealerPos;
                    break;
                }
                attempts++;
            }

            if (this.updateStatusBarCallback) this.updateStatusBarCallback();
        }, 1000);
        activeTimers.push(timer);
    }

    normalizeBetAmount(amount) {
        return Math.floor(amount / this.bettingUnit) * this.bettingUnit;
    }
}

// 导出清理定时器函数
function clearAllTimers() {
    activeTimers.forEach(timer => {
        if (timer) {
            clearTimeout(timer);
        }
    });
    activeTimers = [];
}

module.exports = { PokerGame, clearAllTimers };

// 机器人AI模块
// 负责机器人决策逻辑和手牌强度评估

const { getCardValue, evaluateHand } = require('./HandEvaluator');

class BotAI {
    constructor() {
        this.bettingUnit = 10; // 下注单位
    }

    /**
     * 机器人做出决策
     * @param {Object} game - 游戏实例
     * @param {Object} player - 当前玩家
     * @param {Function} actionCallback - 执行动作的回调函数
     */
    makeDecision(game, player, actionCallback) {
        const callAmount = game.currentBet - player.bet;
        const chipRatio = callAmount / player.chips; // 跟注金额占筹码的比例

        // 评估手牌强度（0-1）
        const handStrength = this.getHandStrength(player.cards, game.communityCards, game.gamePhase);

        // 检查是否有对手刚刚all-in（激进行为）
        const hasAggressiveAction = game.players.some(p =>
            p.id !== player.id && !p.folded && p.isAllIn
        );

        // 计算底池赔率和隐含赔率
        const potOdds = callAmount > 0 ? callAmount / (game.pot + callAmount) : 0;

        // 估算隐含赔率（后续可能赢得更多）
        const impliedOdds = game.pot > 0 ? Math.min(0.3, player.chips / (game.pot * 2)) : 0;
        const adjustedPotOdds = potOdds - impliedOdds; // 调整后的底池赔率

        // ===== 新增：虚张声势机制 =====
        const bluffRandom = Math.random();
        const bluffChance = 0.12; // 12%的虚张声势概率
        const isBluffing = bluffRandom < bluffChance && !hasAggressiveAction && chipRatio < 0.3;

        // 🎯 新增：评估金花和顺子潜力
        const flushPotential = this.evaluateFlushPotential(player.cards, game.communityCards);
        const straightPotential = this.evaluateStraightPotential(player.cards, game.communityCards);
        const hasDrawPotential = flushPotential > 0.1 || straightPotential > 0.08;

        console.log('🎲 [机器人思考]', player.name,
            '| 需要跟注:', callAmount,
            '| 筹码:', player.chips,
            '| 筹码比例:', (chipRatio * 100).toFixed(1) + '%',
            '| 牌力:', handStrength.toFixed(2),
            '| 金花潜力:', flushPotential.toFixed(3),
            '| 顺子潜力:', straightPotential.toFixed(3),
            '| 底池赔率:', potOdds.toFixed(2),
            '| 调整赔率:', adjustedPotOdds.toFixed(2),
            '| 激进对手:', hasAggressiveAction,
            '| 虚张声势:', isBluffing,
            '| 有听牌:', hasDrawPotential);

        // 如果可以过牌（不需要花钱）
        if (callAmount === 0) {
            const random = Math.random();

            // 根据游戏阶段调整加注频率
            let phaseBonus = 0;
            if (game.gamePhase === 'flop') phaseBonus = 0.1;    // 翻牌后更积极
            if (game.gamePhase === 'turn') phaseBonus = 0.15;    // 转牌后更积极
            if (game.gamePhase === 'river') phaseBonus = 0.2;    // 河牌后最积极

            // 根据位置调整：后手位置更积极
            const positionBonus = this.getCurrentPositionBonus(player.id, game.dealerPosition, game.players.length);

            // 强牌或虚张声势时更倾向于加注
            const raiseChance = handStrength > 0.6 ? 0.6 :
                               (isBluffing ? 0.45 : 0.25) + phaseBonus + positionBonus;

            if (random < raiseChance) {
                const raiseAmount = this.normalizeBetAmount(Math.floor(game.pot * (0.4 + handStrength * 0.5)));
                const action = isBluffing && handStrength < 0.4 ? '虚张声势加注' : '免费加注';
                console.log('🎲 [机器人决策]', action, raiseAmount, '牌力:', handStrength.toFixed(2),
                           '| 阶段加成:', phaseBonus, '| 位置加成:', positionBonus);
                actionCallback('raise', Math.max(raiseAmount, game.bigBlind));
            } else {
                console.log('🎲 [机器人决策] 免费过牌 (牌力:', handStrength.toFixed(2), ')');
                actionCallback('call');
            }
            return;
        }

        // 🎯 决策逻辑：结合牌力、潜力和筹码比例
        // 计算决策分数：牌力越强，越愿意跟注/加注
        let decisionScore = handStrength - chipRatio * 0.6; // 从0.8降低到0.6，更难被吓退

        // 🎯 金花潜力加成 - 这是关键！差一张形成金花时要非常激进
        if (flushPotential >= 0.25) {
            decisionScore += 0.4; // 差一张金花时大幅提升决策分数
            console.log('🎲 [金花潜力] 检测到4张同花，大幅提升积极性！决策分数:', decisionScore.toFixed(2));
        } else if (flushPotential >= 0.15) {
            decisionScore += 0.2; // 有金花希望时适度提升
            console.log('🎲 [金花希望] 检测到3张同花，适度提升积极性。决策分数:', decisionScore.toFixed(2));
        }

        // 🎯 顺子潜力加成
        if (straightPotential >= 0.12) {
            decisionScore += 0.15;
            console.log('🎲 [顺子潜力] 检测到4张连牌，提升决策分数:', decisionScore.toFixed(2));
        }

        // 如果对手all-in，提高弃牌倾向（但不像之前那么高）
        let foldThreshold = -0.35; // 从-0.2降低到-0.35，更难弃牌
        if (hasAggressiveAction) {
            foldThreshold = -0.05; // 从0.1降低到-0.05，面对all-in也更勇敢
            console.log('🎲 [对手行为] 检测到All-In，提高弃牌阈值到', foldThreshold);
        }

        // 虚张声势时，降低弃牌阈值
        if (isBluffing) {
            foldThreshold -= 0.3;
            console.log('🎲 [虚张声势模式] 降低弃牌阈值到', foldThreshold);
        }

        // 根据决策分数和阶段判断
        if (decisionScore < foldThreshold) {
            // 牌力太弱，弃牌
            console.log('🎲 [机器人决策] 弃牌 | 决策分数:', decisionScore.toFixed(2),
                '| 牌力:', handStrength.toFixed(2), '| 筹码比例:', chipRatio.toFixed(2));
            actionCallback('fold');
            return;
        }

        // 小额跟注（<5%筹码）
        if (chipRatio < 0.05) {
            this.handleSmallBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, actionCallback);
            return;
        }

        // 中等投入（5%-20%筹码）
        if (chipRatio < 0.2) {
            this.handleMediumBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, hasAggressiveAction, actionCallback);
            return;
        }

        // 大额投入（20%-50%筹码）
        if (chipRatio < 0.5) {
            this.handleLargeBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, actionCallback);
            return;
        }

        // 巨额投入（>50%筹码），非常谨慎，但要考虑潜力
        this.handleHugeBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, actionCallback);
    }

    /**
     * 处理小额下注（<5%筹码）
     */
    handleSmallBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, actionCallback) {
        const needStrict = game.currentBet > game.bigBlind * 2;

        let minStrength = 0.3;
        if (needStrict) minStrength = 0.4;
        if (game.gamePhase === 'preflop') minStrength += 0.1;

        if (flushPotential >= 0.25 || straightPotential >= 0.12) {
            minStrength = Math.min(minStrength, 0.15);
            console.log('🎲 [潜力决策] 小额下注时检测到强潜力，大幅降低跟注门槛到15%');
        } else if (flushPotential >= 0.15 || straightPotential >= 0.08) {
            minStrength = Math.min(minStrength, 0.2);
            console.log('🎲 [潜力希望] 小额下注时检测到潜力，降低跟注门槛到20%');
        }

        if (adjustedPotOdds < 0.08) {
            minStrength = Math.min(minStrength, 0.1);
            console.log('🎲 [底池赔率] 小额跟注且赔率极佳，门槛降到10%');
        }

        if (handStrength > minStrength || (adjustedPotOdds < 0.15 && handStrength > 0.25) || isBluffing) {
            const action = isBluffing && handStrength < 0.35 ? '虚张声势跟注' : '小额跟注';
            console.log('🎲 [机器人决策]', action, '| 牌力:', handStrength.toFixed(2),
                       '| 最小要求:', minStrength, '| 激进加注:', needStrict);
            actionCallback('call');
        } else {
            console.log('🎲 [机器人决策] 小额弃牌 | 牌力:', handStrength.toFixed(2),
                       '| 未达到要求:', minStrength);
            actionCallback('fold');
        }
    }

    /**
     * 处理中等下注（5%-20%筹码）
     */
    handleMediumBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, hasAggressiveAction, actionCallback) {
        const hasRepeatedRaises = game.pot > game.bigBlind * 6;

        let callThreshold = game.gamePhase === 'preflop' ? 0.4 : 0.3;
        if (hasRepeatedRaises) callThreshold += 0.15;

        if (flushPotential >= 0.25) {
            callThreshold = Math.min(callThreshold, 0.2);
            console.log('🎲 [金花决策] 中额下注时检测到4张同花，大幅降低跟注门槛到20%');
        } else if (flushPotential >= 0.15) {
            callThreshold = Math.min(callThreshold, 0.25);
            console.log('🎲 [金花希望] 中额下注时检测到3张同花，降低跟注门槛到25%');
        }

        if (straightPotential >= 0.12) {
            callThreshold = Math.min(callThreshold, 0.2);
            console.log('🎲 [顺子决策] 中额下注时检测到4张连牌，大幅降低跟注门槛到20%');
        } else if (straightPotential >= 0.08) {
            callThreshold = Math.min(callThreshold, 0.25);
            console.log('🎲 [顺子希望] 中额下注时检测到3张连牌，降低跟注门槛到25%');
        }

        if (adjustedPotOdds < 0.1) {
            callThreshold = Math.min(callThreshold, 0.15);
            console.log('🎲 [底池赔率] 极佳的底池赔率，进一步降低跟注门槛到15%');
        }

        if (handStrength > 0.55 || isBluffing) {
            const random = Math.random();

            let raiseChance = isBluffing ? 0.4 : 0.3;
            if (game.gamePhase !== 'preflop' && !hasRepeatedRaises) raiseChance += 0.1;
            if (hasRepeatedRaises) raiseChance -= 0.2;

            if (random < raiseChance && !hasAggressiveAction) {
                const raiseAmount = this.normalizeBetAmount(game.currentBet + Math.floor(game.pot * (isBluffing ? 0.5 : 0.4)));
                const action = isBluffing && handStrength < 0.4 ? '虚张声势加注' : '中额加注';
                console.log('🎲 [机器人决策]', action, '| 牌力:', handStrength.toFixed(2),
                           '| 阶段:', game.gamePhase, '| 连续加注:', hasRepeatedRaises);
                actionCallback('raise', raiseAmount);
            } else {
                const action = isBluffing && handStrength < 0.4 ? '虚张声势跟注' : '中额跟注';
                console.log('🎲 [机器人决策]', action, '| 牌力:', handStrength.toFixed(2));
                actionCallback('call');
            }
        } else if (handStrength > callThreshold) {
            console.log('🎲 [机器人决策] 中额跟注 | 牌力:', handStrength.toFixed(2),
                       '| 跟注门槛:', callThreshold, '| 连续加注:', hasRepeatedRaises);
            actionCallback('call');
        } else {
            console.log('🎲 [机器人决策] 中额弃牌 | 牌力:', handStrength.toFixed(2),
                       '| 未达到要求:', callThreshold);
            actionCallback('fold');
        }
    }

    /**
     * 处理大额下注（20%-50%筹码）
     */
    handleLargeBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, actionCallback) {
        const chipPressure = player.chips < 100;
        const isRebuyThreat = player.chips <= (game.currentBet - player.bet) * 2;

        let callThreshold = 0.6;
        if (game.gamePhase !== 'preflop') callThreshold = 0.5;
        if (game.gamePhase === 'river') callThreshold = 0.45;

        if (chipPressure) callThreshold += 0.15;
        if (isRebuyThreat) callThreshold += 0.1;

        if (flushPotential >= 0.25) {
            callThreshold = Math.min(callThreshold, 0.35);
            console.log('🎲 [金花勇气] 大额下注时仍检测到4张同花，降低跟注门槛到35%');
        } else if (flushPotential >= 0.15) {
            callThreshold = Math.min(callThreshold, 0.4);
            console.log('🎲 [金花希望] 大额下注时检测到3张同花，降低跟注门槛到40%');
        }

        if (straightPotential >= 0.12) {
            callThreshold = Math.min(callThreshold, 0.35);
            console.log('🎲 [顺子勇气] 大额下注时仍检测到4张连牌，降低跟注门槛到35%');
        } else if (straightPotential >= 0.08) {
            callThreshold = Math.min(callThreshold, 0.4);
            console.log('🎲 [顺子希望] 大额下注时检测到3张连牌，降低跟注门槛到40%');
        }

        if (adjustedPotOdds < 0.05) {
            callThreshold = Math.min(callThreshold, 0.25);
            console.log('🎲 [底池赔率] 大额下注但赔率极佳，大幅降低跟注门槛到25%');
        }

        if (handStrength > callThreshold || (isBluffing && handStrength > 0.4 && !chipPressure)) {
            const action = isBluffing && handStrength < 0.6 ? '虚张声势大额跟注' : '大额跟注';
            console.log('🎲 [机器人决策]', action, '| 牌力:', handStrength.toFixed(2),
                       '| 阶段:', game.gamePhase, '| 跟注门槛:', callThreshold,
                       '| 筹码压力:', chipPressure, '| 重买威胁:', isRebuyThreat);
            actionCallback('call');
        } else {
            console.log('🎲 [机器人决策] 大额弃牌 | 牌力:', handStrength.toFixed(2),
                       '| 门槛未达到:', callThreshold, '| 筹码压力:', chipPressure);
            actionCallback('fold');
        }
    }

    /**
     * 处理巨额下注（>50%筹码）
     */
    handleHugeBet(game, player, chipRatio, handStrength, adjustedPotOdds, flushPotential, straightPotential, isBluffing, actionCallback) {
        let callThreshold = 0.7;

        if (flushPotential >= 0.25 || straightPotential >= 0.12) {
            callThreshold = 0.5;
            console.log('🎲 [巨额潜力] 检测到强潜力（差一张成牌），降低巨额跟注门槛到50%');
        } else if (flushPotential >= 0.15 || straightPotential >= 0.08) {
            callThreshold = 0.6;
            console.log('🎲 [巨额希望] 检测到潜力希望，降低巨额跟注门槛到60%');
        }

        if (chipRatio >= 1.0) {
            if (game.gamePhase === 'river') {
                callThreshold = Math.min(callThreshold, 0.4);
                console.log('🎲 [河牌All-In] 河牌阶段All-In，大幅降低跟注门槛到40%');
            } else if (game.gamePhase === 'turn') {
                callThreshold = Math.min(callThreshold, 0.45);
                console.log('🎲 [转牌All-In] 转牌阶段All-In，降低跟注门槛到45%');
            } else {
                callThreshold = Math.min(callThreshold, 0.55);
                console.log('🎲 [翻牌前All-In] 翻牌前All-In，适度降低跟注门槛到55%');
            }
        }

        if (adjustedPotOdds < 0.05) {
            callThreshold = Math.min(callThreshold, 0.3);
            console.log('🎲 [巨额赔率] 巨额投入但赔率极佳，门槛降到30%');
        }

        if (handStrength > callThreshold || (isBluffing && handStrength > 0.5)) {
            const action = isBluffing && handStrength < 0.6 ? '虚张声势巨额跟注' : '巨额跟注';
            console.log('🎲 [机器人决策]', action, '| 牌力:', handStrength.toFixed(2),
                       '| 跟注门槛:', callThreshold, '| 阶段:', game.gamePhase);
            actionCallback('call');
        } else {
            console.log('🎲 [机器人决策] 巨额弃牌 | 牌力:', handStrength.toFixed(2),
                       '| 门槛未达到:', callThreshold);
            actionCallback('fold');
        }
    }

    /**
     * 评估机器人当前手牌强度（返回 0-1 的分数）
     */
    getHandStrength(playerCards, communityCards, gamePhase) {
        if (communityCards.length === 0) {
            return this.evaluatePreflopStrength(playerCards);
        }

        const allCards = [...playerCards, ...communityCards];
        const handRank = evaluateHand(allCards);

        let baseStrength = handRank.rank / 9;
        const kickerBonus = handRank.tiebreakers[0] / 14 * 0.1;

        const flushPotential = this.evaluateFlushPotential(playerCards, communityCards);
        baseStrength += flushPotential;

        const straightPotential = this.evaluateStraightPotential(playerCards, communityCards);
        baseStrength += straightPotential * 0.5;

        return Math.min(1, baseStrength + kickerBonus);
    }

    /**
     * 评估金花（同花）潜力
     */
    evaluateFlushPotential(playerCards, communityCards) {
        const allCards = [...playerCards, ...communityCards];
        const suits = ['♠', '♥', '♦', '♣'];
        let maxFlushPotential = 0;

        for (let suit of suits) {
            const suitCards = allCards.filter(card => card.suit === suit);
            const playerSuitCards = playerCards.filter(card => card.suit === suit);

            const currentCount = suitCards.length;
            let potential = 0;

            if (currentCount >= 5) {
                potential = 0.3;
            } else if (currentCount === 4) {
                potential = 0.25;

                if (playerSuitCards.length > 0) {
                    const highCardValue = Math.max(...playerSuitCards.map(c => getCardValue(c.rank)));
                    potential += (highCardValue / 14) * 0.1;
                }

                const remainingCards = 52 - allCards.length;
                const outs = 13 - currentCount;
                const hitProbability = outs / remainingCards;
                potential += hitProbability * 0.15;

            } else if (currentCount === 3) {
                potential = 0.08;

                if (playerSuitCards.length === 2) {
                    potential += 0.05;
                }
            }

            maxFlushPotential = Math.max(maxFlushPotential, potential);
        }

        return maxFlushPotential;
    }

    /**
     * 评估顺子潜力
     */
    evaluateStraightPotential(playerCards, communityCards) {
        const allCards = [...playerCards, ...communityCards];
        const values = allCards.map(c => getCardValue(c.rank)).sort((a, b) => a - b);

        const uniqueValues = [...new Set(values)];
        let maxConsecutive = 1;
        let currentConsecutive = 1;

        for (let i = 1; i < uniqueValues.length; i++) {
            if (uniqueValues[i] === uniqueValues[i-1] + 1) {
                currentConsecutive++;
            } else {
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                currentConsecutive = 1;
            }
        }
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);

        if (uniqueValues.includes(14) && uniqueValues.includes(2) && uniqueValues.includes(3) &&
            uniqueValues.includes(4) && uniqueValues.includes(5)) {
            maxConsecutive = Math.max(maxConsecutive, 5);
        }

        if (maxConsecutive >= 5) {
            return 0.2;
        } else if (maxConsecutive === 4) {
            return 0.12;
        } else if (maxConsecutive === 3) {
            return 0.05;
        }

        return 0;
    }

    /**
     * 评估翻牌前手牌强度
     */
    evaluatePreflopStrength(cards) {
        const values = cards.map(c => getCardValue(c.rank)).sort((a, b) => b - a);
        const isPair = values[0] === values[1];
        const isSuited = cards[0].suit === cards[1].suit;
        const highCard = values[0];
        const gap = values[0] - values[1];

        let strength = 0;

        if (isPair) {
            strength = 0.5 + (highCard - 2) / 12 * 0.5;
        } else {
            strength = highCard / 14 * 0.4;

            if (isSuited) {
                strength += 0.1;
            }

            if (gap <= 4) {
                strength += (4 - gap) / 4 * 0.15;
            }

            if (highCard >= 12) {
                strength += 0.1;
            }
        }

        return Math.min(1, strength);
    }

    /**
     * 获取当前位置优势加成
     */
    getCurrentPositionBonus(playerIndex, dealerPosition, playerCount) {
        let position = (playerIndex - dealerPosition + playerCount) % playerCount;

        let bonus = 0;
        if (position >= 2) bonus = 0.1;
        if (position === 3) bonus = 0.15;

        return bonus;
    }

    /**
     * 标准化下注金额为10的倍数
     */
    normalizeBetAmount(amount) {
        return Math.floor(amount / this.bettingUnit) * this.bettingUnit;
    }
}

module.exports = BotAI;

// 手牌评估模块
// 负责评估和比较德州扑克手牌

/**
 * 获取牌的数值（用于比较）
 * @param {string} rank - 牌面值
 * @returns {number} 牌的数值
 */
function getCardValue(rank) {
    const values = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
        '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank];
}

/**
 * 获取所有k张牌的组合
 * @param {Array} arr - 牌数组
 * @param {number} k - 组合数量
 * @returns {Array} 所有组合
 */
function getCombinations(arr, k) {
    const result = [];
    const combine = (start, combo) => {
        if (combo.length === k) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    };
    combine(0, []);
    return result;
}

/**
 * 判断5张牌的牌型
 * @param {Array} cards - 5张牌
 * @returns {Object} 牌型信息 {rank, name, tiebreakers, cards}
 */
function rankHand(cards) {
    const values = cards.map(c => getCardValue(c.rank)).sort((a, b) => b - a);
    const suits = cards.map(c => c.suit);

    // 统计每个数值出现的次数
    const valueCounts = {};
    values.forEach(v => {
        valueCounts[v] = (valueCounts[v] || 0) + 1;
    });
    const counts = Object.values(valueCounts).sort((a, b) => b - a);
    // 修复：按出现次数排序（次数多的在前），次数相同则按牌值排序（大的在前）
    const uniqueValues = Object.keys(valueCounts)
        .map(Number)
        .sort((a, b) => {
            const countDiff = valueCounts[b] - valueCounts[a];
            return countDiff !== 0 ? countDiff : b - a;
        });

    // 检查是否同花
    const isFlush = suits.every(s => s === suits[0]);

    // 检查是否顺子（包括 A-2-3-4-5）
    let isStraight = false;
    if (values[0] - values[4] === 4 && new Set(values).size === 5) {
        isStraight = true;
    } else if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
        // A-2-3-4-5 特殊顺子
        isStraight = true;
        values.unshift(values.pop()); // 把A移到最后，作为1
    }

    // 牌型判断（rank越大越好）
    let rank = 0;
    let name = '';
    let tiebreakers = [];

    if (isStraight && isFlush && values[0] === 14 && values[1] === 13) {
        // 皇家同花顺
        rank = 9;
        name = '皇家同花顺';
        tiebreakers = [14];
    } else if (isStraight && isFlush) {
        // 同花顺
        rank = 8;
        name = '同花顺';
        tiebreakers = [values[0]];
    } else if (counts[0] === 4) {
        // 四条
        rank = 7;
        name = '四条';
        tiebreakers = [uniqueValues[0], uniqueValues[1]];
    } else if (counts[0] === 3 && counts[1] === 2) {
        // 葫芦
        rank = 6;
        name = '葫芦';
        tiebreakers = [uniqueValues[0], uniqueValues[1]];
    } else if (isFlush) {
        // 同花
        rank = 5;
        name = '同花';
        tiebreakers = uniqueValues;
    } else if (isStraight) {
        // 顺子
        rank = 4;
        name = '顺子';
        tiebreakers = [values[0]];
    } else if (counts[0] === 3) {
        // 三条
        rank = 3;
        name = '三条';
        tiebreakers = uniqueValues;
    } else if (counts[0] === 2 && counts[1] === 2) {
        // 两对
        rank = 2;
        name = '两对';
        tiebreakers = uniqueValues;
    } else if (counts[0] === 2) {
        // 一对
        rank = 1;
        name = '一对';
        tiebreakers = uniqueValues;
    } else {
        // 高牌
        rank = 0;
        name = '高牌';
        tiebreakers = uniqueValues;
    }

    return { rank, name, tiebreakers, cards };
}

/**
 * 比较两个手牌，返回 1 表示hand1赢，-1 表示hand2赢，0 表示平局
 * @param {Object} hand1 - 手牌1
 * @param {Object} hand2 - 手牌2
 * @returns {number} 比较结果
 */
function compareHands(hand1, hand2) {
    if (hand1.rank !== hand2.rank) {
        return hand1.rank > hand2.rank ? 1 : -1;
    }

    // 牌型相同，比较tiebreakers
    for (let i = 0; i < Math.max(hand1.tiebreakers.length, hand2.tiebreakers.length); i++) {
        const v1 = hand1.tiebreakers[i] || 0;
        const v2 = hand2.tiebreakers[i] || 0;
        if (v1 !== v2) {
            return v1 > v2 ? 1 : -1;
        }
    }

    return 0; // 平局
}

/**
 * 评估手牌，返回牌型和比较值
 * @param {Array} cards - 应该包含7张牌：2张手牌 + 5张公共牌
 * @returns {Object} 最佳手牌
 */
function evaluateHand(cards) {
    const allCombos = getCombinations(cards, 5);
    let bestHand = null;

    for (let combo of allCombos) {
        const handRank = rankHand(combo);

        // 如果是第一手牌，或者这手牌更好，就更新
        if (bestHand === null || compareHands(handRank, bestHand) > 0) {
            bestHand = handRank;
        }
    }

    return bestHand;
}

module.exports = {
    getCardValue,
    getCombinations,
    rankHand,
    compareHands,
    evaluateHand
};

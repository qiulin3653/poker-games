// 边池管理模块
// 负责管理边池系统和分配奖池

class PotManager {
    constructor() {
        this.allInPlayers = []; // All-In玩家列表，记录他们的All-In金额
    }

    /**
     * 重置边池系统
     */
    reset() {
        this.allInPlayers = [];
    }

    /**
     * 创建边池记录
     * @param {Object} allInPlayer - All-In的玩家
     */
    createSidePot(allInPlayer) {
        const allInAmount = allInPlayer.totalBet;  // 使用totalBet而不是bet
        console.log('🎲 [边池创建] 玩家:', allInPlayer.name, 'All-In金额:', allInAmount);

        // 将该玩家加入All-In列表
        this.allInPlayers.push({
            player: allInPlayer,
            amount: allInAmount,
            timestamp: Date.now()
        });

        // 🎯 简化边池逻辑：不立即创建边池，而是在摊牌时统一处理
        // 只记录All-In信息，实际边池计算在distributePots中进行
        console.log('🎲 [All-In记录] 已记录', this.allInPlayers.length, '位All-In玩家');
    }

    /**
     * 分配边池和主池
     * @param {Array} players - 所有玩家
     * @param {Array} winners - 赢家数组
     * @param {number} potAmount - 奖池总额
     * @returns {Array} 分配详情数组
     */
    distributePots(players, winners, potAmount) {
        const distribution = [];

        console.log('🎲 [边池分析] All-In玩家:', this.allInPlayers.map(ai => `${ai.player.name}:$${ai.amount}`).join(', '));
        console.log('🎲 [边池分析] 所有玩家状态:', players.map(p => `${p.name}: 弃牌${p.folded}, AllIn${p.isAllIn}, 总下注${p.totalBet}, 筹码${p.chips}`).join(' | '));

        // 🎯 简化处理：如果没有All-In玩家，直接平分总奖池
        if (this.allInPlayers.length === 0) {
            const shareAmount = Math.floor(potAmount / winners.length);
            const remainder = potAmount % winners.length;

            winners.forEach((winnerObj, index) => {
                const amount = index < remainder ? shareAmount + 1 : shareAmount;
                winnerObj.player.chips += amount;
                distribution.push({
                    pot: '奖池',
                    amount: amount,
                    winners: [winnerObj.player.name]
                });

                console.log('🎲 [奖池分配]', winnerObj.player.name, '获得:', amount, '| 剩余筹码:', winnerObj.player.chips);
            });

            return distribution;
        }

        // 🎯 有All-In玩家时的正确处理
        // 获取所有参与下注的玩家（包括All-In玩家）
        const activePlayers = players.filter(p => !p.folded);

        // 按All-In金额从小到大排序
        const sortedAllIns = [...this.allInPlayers].sort((a, b) => a.amount - b.amount);

        console.log('🎲 [边池处理] All-In玩家数量:', this.allInPlayers.length, '活跃玩家:', activePlayers.length, '总奖池:', potAmount);

        // 🎯 修复：直接使用总奖池，因为其他玩家弃牌后，All-In玩家应该获得全部奖池
        // 当只有一个赢家且其他玩家都弃牌时，赢家获得全部奖池
        if (winners.length === 1 && activePlayers.every(p => p.folded || p === winners[0].player)) {
            const winnerObj = winners[0];
            winnerObj.player.chips += potAmount;
            distribution.push({
                pot: '奖池',
                amount: potAmount,
                winners: [winnerObj.player.name]
            });

            console.log('🎲 [奖池分配] 其他玩家全部弃牌', winnerObj.player.name, '获得全部奖池:', potAmount, '| 剩余筹码:', winnerObj.player.chips);
            return distribution;
        }

        // 🎯 正常的边池计算（多个玩家比牌的情况）
        let remainingPot = potAmount;
        let previousAllInAmount = 0;

        // 🎯 处理每个All-In级别
        sortedAllIns.forEach((allInInfo, index) => {
            const currentAllInAmount = allInInfo.amount;

            // 🎯 修复：如果有多个相同金额的All-In，只处理一次
            if (index > 0 && currentAllInAmount === sortedAllIns[index - 1].amount) {
                console.log('🎲 [边池级别', index, '] 跳过重复的All-In金额:', currentAllInAmount);
                return;
            }

            // 计算这个级别的奖池金额：所有玩家至少下注到currentAllInAmount的部分
            const potLevel = currentAllInAmount - previousAllInAmount;

            // 🎯 修复：正确计算有资格的玩家数
            const eligiblePlayers = activePlayers.filter(p => {
                // 玩家有资格如果：
                // 1. 玩家没有All-In，或者All-In金额 >= 当前级别
                // 2. 玩家没有弃牌
                if (p.folded) return false;
                if (p.isAllIn) return true; // All-In玩家总是有资格参与自己所在级别的奖池
                return p.totalBet >= currentAllInAmount;  // 使用totalBet而不是bet
            });

            const eligiblePlayerCount = eligiblePlayers.length;
            const levelPotAmount = potLevel * eligiblePlayerCount;

            console.log('🎲 [边池级别', index, '] AllIn金额:', currentAllInAmount, '级别差值:', potLevel,
                '参与人数:', eligiblePlayerCount, '级别奖池:', levelPotAmount);
            console.log('🎲 [资格玩家]', eligiblePlayers.map(p => p.name).join(', '));

            if (levelPotAmount > 0 && eligiblePlayerCount > 0) {
                // 计算哪些赢家有资格参与这个级别的奖池
                const eligibleWinners = winners.filter(w => eligiblePlayers.includes(w.player));

                if (eligibleWinners.length > 0) {
                    const shareAmount = Math.floor(levelPotAmount / eligibleWinners.length);
                    const remainder = levelPotAmount % eligibleWinners.length;

                    eligibleWinners.forEach((winnerObj, idx) => {
                        const amount = idx < remainder ? shareAmount + 1 : shareAmount;
                        winnerObj.player.chips += amount;
                        distribution.push({
                            pot: index === 0 ? '主池' : `边池${index}`,
                            amount: amount,
                            winners: [winnerObj.player.name]
                        });

                        console.log('🎲 [奖池分配]', winnerObj.player.name, '从', index === 0 ? '主池' : `边池${index}`, '获得:', amount, '| 剩余筹码:', winnerObj.player.chips);
                    });

                    remainingPot -= levelPotAmount;
                } else {
                    console.log('🎲 [边池级别', index, '] 没有有资格的赢家，奖池保留到下一级别');
                }
            }

            previousAllInAmount = currentAllInAmount;
        });

        // 🎯 修复：剩余的奖池应该分配给所有赢家（当所有All-In金额相同时）
        if (remainingPot > 0) {
            // 如果所有All-In金额都相同，剩余奖池应该分配给所有赢家
            const allSameAmount = sortedAllIns.every(ai => ai.amount === sortedAllIns[0].amount);

            let finalWinners = [];
            if (allSameAmount) {
                finalWinners = winners; // 所有赢家都有资格
                console.log('🎲 [剩余奖池] All-In金额相同，所有赢家都有资格分配剩余奖池');
            } else {
                // 正常情况：只有没有All-In的玩家有资格
                finalWinners = winners.filter(w => !w.player.isAllIn);
                console.log('🎲 [剩余奖池] 只有非All-In赢家有资格分配剩余奖池');
            }

            if (finalWinners.length > 0) {
                const shareAmount = Math.floor(remainingPot / finalWinners.length);
                const remainder = remainingPot % finalWinners.length;

                finalWinners.forEach((winnerObj, idx) => {
                    const amount = idx < remainder ? shareAmount + 1 : shareAmount;
                    winnerObj.player.chips += amount;
                    distribution.push({
                        pot: `剩余奖池`,
                        amount: amount,
                        winners: [winnerObj.player.name]
                    });

                    console.log('🎲 [剩余奖池分配]', winnerObj.player.name, '获得:', amount, '| 剩余筹码:', winnerObj.player.chips);
                });
            } else {
                console.log('🎲 [剩余奖池警告] 没有有资格的玩家分配剩余奖池:', remainingPot);
            }
        }

        return distribution;
    }
}

module.exports = PotManager;

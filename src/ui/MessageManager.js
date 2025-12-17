// 消息管理模块
// 负责管理消息历史和生成工具提示文本

let messageHistory = [];
const MAX_HISTORY = 30;

/**
 * 添加消息到历史记录
 * @param {string} msg - 消息内容
 */
function addMessage(msg) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullMessage = `[${timestamp}] ${msg}`;
    messageHistory.unshift(fullMessage);

    // 输出到控制台，方便调试
    console.log('🎲 德州扑克:', fullMessage);

    if (messageHistory.length > MAX_HISTORY) {
        messageHistory = messageHistory.slice(0, MAX_HISTORY);
    }
}

/**
 * 生成工具提示文本
 * @param {Object} game - 游戏实例
 * @returns {string} 工具提示文本
 */
function getTooltipText(game) {
    if (!game) return '**德州扑克游戏**\n\n点击"开始游戏"开始\n\n[设置游戏参数](command:poker.settings)';

    const player = game.players[0];
    let tooltip = ['**德州扑克游戏状态**\n'];

    // 当前状态
    tooltip.push('**游戏信息：**');
    tooltip.push(`- 你的筹码: **$${player.chips}**`);

    if (player.chips < game.bigBlind) {
        tooltip.push('- ⚠️ 筹码不足，无法继续游戏');
        tooltip.push('- 点击"重新开始"重置游戏');
    } else {
        tooltip.push(`- 底池: **$${game.pot}**`);
        tooltip.push(`- 当前赌注: **$${game.currentBet}**`);
        tooltip.push(`- 阶段: **${game.getPhaseText()}**`);

        if (player.cards.length > 0 && !player.folded) {
            const cardsText = player.cards.map(c => c.rank + c.suit).join(' ');
            tooltip.push(`- 你的手牌: **${cardsText}**`);
        }

        if (game.communityCards.length > 0) {
            const communityText = game.communityCards.map(c => c.rank + c.suit).join(' ');
            tooltip.push(`- 公共牌: **${communityText}**`);
        }

        // 其他玩家状态
        tooltip.push('\n**玩家状态：**');
        tooltip.push('| 玩家 | 状态 | 筹码 |');
        tooltip.push('|------|------|------|');

        game.players.forEach((p, idx) => {
            if (idx === 0) return; // 跳过自己

            let status = '';
            let chips = `$${p.chips}`;

            if (game.gameEnded && p.cards.length > 0) {
                const cardsText = p.cards.map(c => c.rank + c.suit).join('');
                status = p.folded ? `已弃牌 (${cardsText})` : `手牌: ${cardsText}`;
            } else {
                if (p.folded) {
                    status = '已弃牌';
                } else if (p.isAllIn) {
                    status = '💥All-In';
                } else {
                    status = '游戏中';
                }
            }

            const indicator = game.currentPlayer === idx ? '→' : '';
            const acted = p.hasActedThisRound ? '✓' : '';
            const playerName = `${indicator}${acted} ${p.name}`;

            tooltip.push(`| ${playerName} | ${status} | ${chips} |`);
        });
    }

    // 消息历史
    if (messageHistory.length > 0) {
        tooltip.push('\n**最近动态：**');
        messageHistory.slice(0, 10).forEach(msg => {
            tooltip.push(`- ${msg}`);
        });
    }

    tooltip.push('\n[设置游戏参数](command:poker.settings)');

    return tooltip.join('\n');
}

/**
 * 获取消息历史
 * @returns {Array} 消息历史数组
 */
function getMessageHistory() {
    return messageHistory;
}

/**
 * 清空消息历史
 */
function clearHistory() {
    messageHistory = [];
}

module.exports = {
    addMessage,
    getTooltipText,
    getMessageHistory,
    clearHistory
};

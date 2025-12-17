// 命令注册模块
// 负责注册所有 VSCode 命令

const vscode = require('vscode');
const { addMessage, getTooltipText, clearHistory } = require('../ui/MessageManager');

/**
 * 注册所有命令
 * @param {vscode.ExtensionContext} context - VSCode 扩展上下文
 * @param {Function} getGame - 获取游戏实例的函数
 * @param {Function} setGame - 设置游戏实例的函数
 * @param {StatusBarManager} statusBarManager - 状态栏管理器
 */
function registerCommands(context, getGame, setGame, statusBarManager) {
    // 开始游戏命令
    const startCommand = vscode.commands.registerCommand('poker.start', () => {
        console.log('poker.start command executed');
        let game = getGame();

        if (!game) {
            // 这种情况不应该发生，因为game在activate中已创建
            console.log('Warning: game is null in start command');
            return;
        }

        // 检查玩家筹码
        if (game.players[0].chips < game.bigBlind) {
            addMessage('💸 筹码不足！点击"重新开始"重置游戏');
            statusBarManager.updateStatusBar(game);
            return;
        }

        game.startNewHand();
        statusBarManager.updateStatusBar(game);
    });
    context.subscriptions.push(startCommand);

    // 重置游戏命令
    const resetCommand = vscode.commands.registerCommand('poker.reset', () => {
        console.log('poker.reset command executed');
        const { PokerGame } = require('../game/PokerGame');
        const newGame = new PokerGame(() => statusBarManager.updateStatusBar(getGame()));
        setGame(newGame);
        clearHistory();
        addMessage('🔄 游戏已重置，所有玩家筹码恢复至$1000');
        statusBarManager.items.start.text = '$(play) 开始游戏';
        statusBarManager.items.start.command = 'poker.start';
        statusBarManager.items.start.tooltip = '开始新一局德州扑克';
        statusBarManager.items.info.text = '💰1000 | 准备就绪';
        statusBarManager.items.info.tooltip = new vscode.MarkdownString(getTooltipText(null));
        statusBarManager.items.info.tooltip.isTrusted = true;
    });
    context.subscriptions.push(resetCommand);

    // 弃牌命令
    const foldCommand = vscode.commands.registerCommand('poker.fold', () => {
        console.log('poker.fold command executed');
        const game = getGame();
        if (game && game.isPlayerTurn()) {
            game.playerAction('fold');
            statusBarManager.updateStatusBar(game);
        }
    });
    context.subscriptions.push(foldCommand);

    // 跟注命令
    const callCommand = vscode.commands.registerCommand('poker.call', () => {
        console.log('poker.call command executed');
        const game = getGame();
        if (game && game.isPlayerTurn()) {
            game.playerAction('call');
            statusBarManager.updateStatusBar(game);
        }
    });
    context.subscriptions.push(callCommand);

    // 加注命令
    const raiseCommand = vscode.commands.registerCommand('poker.raise', () => {
        console.log('poker.raise command executed');
        const game = getGame();
        if (game && game.isPlayerTurn()) {
            vscode.window.showInputBox({
                prompt: '输入加注金额（必须是10的倍数）',
                placeHolder: '例如: 50, 60, 100',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0) {
                        return '请输入有效的正整数';
                    }
                    if (num % 10 !== 0) {
                        return '金额必须是10的倍数';
                    }
                    if (num > game.players[0].chips) {
                        return '金额超过你的筹码';
                    }
                    return null;
                }
            }).then(amount => {
                if (amount) {
                    game.playerAction('raise', parseInt(amount));
                    statusBarManager.updateStatusBar(game);
                }
            });
        }
    });
    context.subscriptions.push(raiseCommand);

    // 快速加注50命令
    const raise50Command = vscode.commands.registerCommand('poker.raise50', () => {
        console.log('poker.raise50 command executed');
        const game = getGame();
        if (game && game.isPlayerTurn()) {
            const player = game.players[0];
            const callAmount = game.currentBet - player.bet;
            const totalAmount = callAmount + 50;

            if (totalAmount > player.chips) {
                vscode.window.showWarningMessage('筹码不足，无法加注50');
                return;
            }

            game.playerAction('raise', totalAmount);
            statusBarManager.updateStatusBar(game);
        }
    });
    context.subscriptions.push(raise50Command);

    // 设置游戏参数命令
    const settingsCommand = vscode.commands.registerCommand('poker.settings', async () => {
        console.log('poker.settings command executed');
        const game = getGame();
        if (!game) return;

        // 获取当前设置
        const currentSmallBlind = game.smallBlind;
        const currentBigBlind = game.bigBlind;
        const currentBettingUnit = game.bettingUnit;
        const currentPlayerChips = game.players[0].chips;
        const currentPlayerCount = game.players.length;

        // 输入小盲注
        const smallBlindInput = await vscode.window.showInputBox({
            prompt: '设置小盲注',
            value: currentSmallBlind.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) return '请输入正整数';
                return null;
            }
        });
        if (!smallBlindInput) return;
        const smallBlind = parseInt(smallBlindInput);

        // 输入大盲注
        const bigBlindInput = await vscode.window.showInputBox({
            prompt: '设置大盲注',
            value: (smallBlind * 2).toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) return '请输入正整数';
                if (num < smallBlind) return '大盲注不能小于小盲注';
                return null;
            }
        });
        if (!bigBlindInput) return;
        const bigBlind = parseInt(bigBlindInput);

        // 输入每个玩家的筹码额度
        const playerChipsInput = await vscode.window.showInputBox({
            prompt: '设置每个玩家的初始筹码',
            value: currentPlayerChips.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < bigBlind) return `筹码至少需要${bigBlind}`;
                return null;
            }
        });
        if (!playerChipsInput) return;
        const playerChips = parseInt(playerChipsInput);

        // 输入玩家个数
        const playerCountInput = await vscode.window.showInputBox({
            prompt: '设置玩家个数（包括你自己，2-9人）',
            value: currentPlayerCount.toString(),
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 2 || num > 9) return '玩家个数必须在2-9之间';
                return null;
            }
        });
        if (!playerCountInput) return;
        const playerCount = parseInt(playerCountInput);

        // 更新游戏设置
        game.smallBlind = smallBlind;
        game.bigBlind = bigBlind;

        // 更新玩家筹码
        game.players.forEach(player => {
            player.chips = playerChips;
        });

        // 调整玩家数量
        if (playerCount > game.players.length) {
            // 添加机器人玩家
            for (let i = game.players.length; i < playerCount; i++) {
                game.players.push({
                    id: i,
                    name: `机器人${i}`,
                    chips: playerChips,
                    cards: [],
                    bet: 0,
                    totalBet: 0,
                    folded: false,
                    isBot: true,
                    hasActedThisRound: false,
                    isAllIn: false
                });
            }
        } else if (playerCount < game.players.length) {
            // 移除多余玩家
            game.players = game.players.slice(0, playerCount);
        }

        addMessage(`⚙️ 游戏参数已更新: 小盲注$${smallBlind}, 大盲注$${bigBlind}, 初始筹码$${playerChips}, 玩家数${playerCount}`);
        statusBarManager.updateStatusBar(game);

        // 自动重置游戏以应用新设置
        const { PokerGame } = require('../game/PokerGame');
        const newGame = new PokerGame(() => statusBarManager.updateStatusBar(getGame()));
        // 应用新设置到新游戏
        newGame.smallBlind = smallBlind;
        newGame.bigBlind = bigBlind;
        newGame.players = [
            { id: 0, name: '你', chips: playerChips, cards: [], bet: 0, totalBet: 0, folded: false, isBot: false, hasActedThisRound: false, isAllIn: false }
        ];
        for (let i = 1; i < playerCount; i++) {
            newGame.players.push({
                id: i,
                name: `机器人${i}`,
                chips: playerChips,
                cards: [],
                bet: 0,
                totalBet: 0,
                folded: false,
                isBot: true,
                hasActedThisRound: false,
                isAllIn: false
            });
        }
        setGame(newGame);
        clearHistory();
        addMessage('🔄 游戏已重置并应用新设置');
        statusBarManager.items.start.text = '$(play) 开始游戏';
        statusBarManager.items.start.command = 'poker.start';
        statusBarManager.items.start.tooltip = '开始新一局德州扑克';
        statusBarManager.items.info.text = `💰${playerChips} | 准备就绪`;
        statusBarManager.items.info.tooltip = new vscode.MarkdownString(getTooltipText(null));
        statusBarManager.items.info.tooltip.isTrusted = true;

        // 自动开始新游戏
        newGame.startNewHand();
        statusBarManager.updateStatusBar(newGame);
    });
    context.subscriptions.push(settingsCommand);

    console.log('All commands registered successfully');
}

module.exports = { registerCommands };

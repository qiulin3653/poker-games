// 状态栏管理模块
// 负责管理所有状态栏项目和更新逻辑

const vscode = require('vscode');
const { getTooltipText } = require('./MessageManager');

class StatusBarManager {
    constructor(context) {
        this.items = {};

        // 创建状态栏项目
        this.items.info = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
        this.items.start = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 999);
        this.items.fold = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 998);
        this.items.call = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 997);
        this.items.raise = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 996);
        this.items.raise50 = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 995);

        console.log('Status bar items created successfully');

        // 设置按钮
        this.items.fold.text = '$(close) 弃牌';
        this.items.fold.command = 'poker.fold';
        this.items.fold.tooltip = '放弃这一轮';

        this.items.call.text = '$(check) 跟注';
        this.items.call.command = 'poker.call';
        this.items.call.tooltip = '跟注当前赌注';

        this.items.raise.text = '$(arrow-up) 加注';
        this.items.raise.command = 'poker.raise';
        this.items.raise.tooltip = '增加赌注';

        this.items.raise50.text = '$(arrow-up)+50';
        this.items.raise50.command = 'poker.raise50';
        this.items.raise50.tooltip = '快速加注50筹码';

        this.items.start.text = '$(play) 开始游戏';
        this.items.start.command = 'poker.start';
        this.items.start.tooltip = '开始新一局德州扑克';

        this.items.info.text = '等待开始...';
        this.items.info.tooltip = new vscode.MarkdownString('点击"开始游戏"开始\n\n[设置游戏参数](command:poker.settings)');
        this.items.info.tooltip.isTrusted = true;

        console.log('Status bar items configured successfully');

        // 显示状态栏
        this.items.info.show();
        this.items.start.show();
        console.log('Status bar items shown');

        // 订阅状态栏项目到context
        context.subscriptions.push(this.items.info);
        context.subscriptions.push(this.items.fold);
        context.subscriptions.push(this.items.call);
        context.subscriptions.push(this.items.raise);
        context.subscriptions.push(this.items.raise50);
        context.subscriptions.push(this.items.start);

        console.log('Status bar items subscribed');
    }

    /**
     * 更新状态栏显示
     * @param {Object} game - 游戏实例
     */
    updateStatusBar(game) {
        if (!game) {
            // 没有游戏实例时，显示初始状态
            if (this.items.info) {
                this.items.info.text = '等待开始...';
                this.items.info.tooltip = '点击"开始游戏"开始德州扑克';
            }

            if (this.items.fold) this.items.fold.hide();
            if (this.items.call) this.items.call.hide();
            if (this.items.raise) this.items.raise.hide();
            if (this.items.raise50) this.items.raise50.hide();

            if (this.items.start && !this.items.start.text.includes('重新开始')) {
                this.items.start.text = '$(play) 开始游戏';
                this.items.start.command = 'poker.start';
                this.items.start.tooltip = '开始新一局德州扑克';
            }
            if (this.items.start) this.items.start.show();
            return;
        }

        const player = game.players[0];
        const isPlayerTurn = game.isPlayerTurn();

        // 🎯 检查是否需要显示重新开始按钮
        const eligiblePlayers = game.players.filter(p => p.chips >= game.bigBlind);
        const needReset = (player.chips < game.bigBlind && !player.isAllIn) || (eligiblePlayers.length < 2 && game.gameEnded);

        if (needReset) {
            // 判断具体情况
            if (player.chips < game.bigBlind) {
                this.items.info.text = `💸 破产了！筹码: $${player.chips}`;
                this.items.info.tooltip = '你的筹码已不足以继续游戏\n点击"重新开始"重置游戏';
            } else {
                this.items.info.text = '🏆 你是唯一赢家！点击重新开始';
                this.items.info.tooltip = '恭喜！所有机器人都已破产\n点击"重新开始"开始新游戏';
            }

            if (this.items.fold) this.items.fold.hide();
            if (this.items.call) this.items.call.hide();
            if (this.items.raise) this.items.raise.hide();
            if (this.items.raise50) this.items.raise50.hide();

            if (this.items.start) {
                this.items.start.text = '$(sync) 重新开始';
                this.items.start.command = 'poker.reset';
                this.items.start.tooltip = '点击重置游戏';
                this.items.start.show();
            }
            return;
        }

        // 更新主信息
        let infoText = `💰${player.chips} | 🎲底池$${game.pot}`;

        if (player.cards.length > 0 && !player.folded) {
            const cardsText = player.cards.map(c => c.rank + c.suit).join(' ');
            infoText += ` | 手牌: ${cardsText}`;
        }

        if (game.communityCards.length > 0) {
            const communityText = game.communityCards.map(c => c.rank + c.suit).join(' ');
            infoText += ` | 公牌: ${communityText}`;
        }

        if (this.items.info) {
            this.items.info.text = infoText;
            this.items.info.tooltip = new vscode.MarkdownString(getTooltipText(game));
            this.items.info.tooltip.isTrusted = true;
        }

        // 更新按钮可见性
        if (isPlayerTurn) {
            // 计算需要跟注的金额
            const callAmount = game.currentBet - player.bet;
            if (callAmount === 0) {
                this.items.call.text = '$(check) 过牌';
                this.items.call.tooltip = '不加注，继续游戏';
            } else {
                this.items.call.text = `$(check) 跟注 $${callAmount}`;
                this.items.call.tooltip = `跟注当前赌注 $${callAmount}`;
            }

            if (this.items.fold) this.items.fold.show();
            if (this.items.call) this.items.call.show();
            if (this.items.raise) this.items.raise.show();

            // 智能显示加注50按钮
            const totalAmount = callAmount + 50;

            if (totalAmount <= player.chips) {
                if (this.items.raise50) {
                    this.items.raise50.text = `$(arrow-up)+50`;
                    this.items.raise50.tooltip = `快速加注50筹码 (总计$${totalAmount})`;
                    this.items.raise50.show();
                }
            } else {
                if (this.items.raise50) this.items.raise50.hide();
            }

            if (this.items.start) this.items.start.hide();
        } else {
            if (this.items.fold) this.items.fold.hide();
            if (this.items.call) this.items.call.hide();
            if (this.items.raise) this.items.raise.hide();
            if (this.items.raise50) this.items.raise50.hide();
            if (this.items.start) {
                if (game.gameEnded) {
                    // 检查是否需要重置
                    if (player.chips < game.bigBlind) {
                        this.items.start.text = '$(sync) 重新开始';
                        this.items.start.command = 'poker.reset';
                        this.items.start.tooltip = '筹码不足，点击重置游戏';
                    } else {
                        this.items.start.text = '$(play) 开始游戏';
                        this.items.start.command = 'poker.start';
                        this.items.start.tooltip = '开始新一局';
                    }
                    this.items.start.show();
                } else {
                    this.items.start.hide();
                }
            }
        }
    }

    /**
     * 清理资源
     */
    dispose() {
        Object.values(this.items).forEach(item => {
            if (item && item.dispose) {
                item.dispose();
            }
        });
    }
}

module.exports = StatusBarManager;

// 德州扑克 VSCode 扩展主入口
// 该文件已重构，主要逻辑已拆分到各个模块中

const vscode = require('vscode');
const StatusBarManager = require('./src/ui/StatusBarManager');
const { PokerGame, clearAllTimers } = require('./src/game/PokerGame');
const { registerCommands } = require('./src/commands/CommandRegistry');

let game = null;
let statusBarManager = null;

/**
 * 扩展激活函数
 */
function activate(context) {
    console.log('Texas Hold\'em Poker extension is now active');

    try {
        // 创建状态栏管理器
        statusBarManager = new StatusBarManager(context);
        console.log('StatusBarManager initialized successfully');

        // 创建游戏实例（传入更新状态栏的回调）
        game = new PokerGame(() => {
            if (statusBarManager && game) {
                statusBarManager.updateStatusBar(game);
            }
        });
        console.log('PokerGame instance created successfully');

        // 注册所有命令
        registerCommands(
            context,
            () => game,  // getGame
            (newGame) => { game = newGame; },  // setGame
            statusBarManager
        );
        console.log('Commands registered successfully');

        console.log('Extension activation completed successfully');
    } catch (error) {
        console.error('Error during activation:', error);
        vscode.window.showErrorMessage('德州扑克扩展激活失败: ' + error.message);
    }
}

/**
 * 扩展停用函数
 */
function deactivate() {
    console.log('Deactivating Poker Game extension...');

    try {
        // 清理状态栏
        if (statusBarManager) {
            statusBarManager.dispose();
            statusBarManager = null;
        }

        // 清理所有定时器
        clearAllTimers();

        // 清理游戏实例
        if (game) {
            game = null;
        }

        console.log('Poker Game extension deactivated successfully');
    } catch (error) {
        console.error('Error during deactivation:', error);
    }
}

module.exports = {
    activate,
    deactivate
};

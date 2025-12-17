# 本地调试VSCode插件

## 方法一：使用F5调试（推荐）

这是最简单的调试方法：

1. **打开项目文件夹**
   - 在VSCode中打开 `e:\codess\canvas` 文件夹（当前文件夹）

2. **启动调试**
   - 按 `F5` 键
   - 或点击菜单：`运行 > 启动调试`
   - 或点击左侧调试图标，然后点击"Run Extension"

3. **新窗口打开**
   - VSCode会打开一个新的窗口，标题栏显示 `[扩展开发宿主]`
   - 这个新窗口中，你的插件已经加载

4. **测试插件**
   - 在新窗口中按 `Ctrl+Shift+P`
   - 输入 "Open Performance Dashboard"
   - 或使用快捷键：`Ctrl+Shift+P` 然后 `Ctrl+Shift+D`
   - 游戏界面会打开！

5. **调试技巧**
   - 可以在 `extension.js` 中设置断点
   - 在原窗口查看调试控制台输出
   - 修改代码后，在调试窗口按 `Ctrl+R` 重新加载

## 方法二：手动安装到扩展目录

1. **复制文件夹到扩展目录**
   ```bash
   # Windows
   xcopy /E /I "e:\codess\canvas" "%USERPROFILE%\.vscode\extensions\code-performance-analyzer"
   ```

2. **重启VSCode**

3. **使用插件**
   - 按 `Ctrl+Shift+P`
   - 输入 "Open Performance Dashboard"

## 方法三：打包成.vsix文件

1. **安装vsce工具**
   ```bash
   npm install -g @vscode/vsce
   ```

2. **打包插件**
   ```bash
   cd e:\codess\canvas
   vsce package
   ```

3. **安装.vsix文件**
   - 在VSCode中：`扩展 > ... > 从VSIX安装`
   - 选择生成的 `.vsix` 文件

## 调试配置说明

已创建的文件：
- `.vscode/launch.json` - 调试配置文件

调试配置包含：
- **Run Extension**: 在扩展开发宿主中运行插件

## 常见问题

**Q: 按F5后没反应？**
A: 确保在VSCode中打开的是 `e:\codess\canvas` 文件夹作为工作区

**Q: 找不到命令？**
A: 检查命令面板中输入的是 "Open Performance Dashboard"

**Q: 修改代码后不生效？**
A: 在扩展开发宿主窗口按 `Ctrl+R` 重新加载窗口

**Q: 想查看控制台输出？**
A: 在扩展开发宿主窗口按 `Ctrl+Shift+I` 打开开发者工具

## 快速开始

最简单的方法：
1. 确保当前文件夹在VSCode中打开
2. 按 `F5`
3. 在新窗口中按 `Ctrl+Shift+P`，输入 "Open Performance Dashboard"
4. 点击 "New Game" 开始游戏！

enjoy!

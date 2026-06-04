# 炸金花

一个可直接打开的静态网页卡牌游戏，包含德州扑克和炸金花两种玩法。

## 本地试玩

双击 `index.html` 即可打开游戏。

## 发给别人试玩

把以下文件一起打包发送给对方：

- `index.html`
- `styles.css`
- `game.js`

对方解压后双击 `index.html` 即可玩。

## 做成网页链接

推荐使用 GitHub Pages：

1. 新建一个 GitHub 仓库。
2. 上传 `index.html`、`styles.css`、`game.js`。
3. 进入仓库 `Settings` -> `Pages`。
4. Source 选择 `Deploy from a branch`。
5. Branch 选择 `main`，目录选择 `/root`。
6. 保存后等待 GitHub 生成访问链接。

也可以使用 Netlify 或 Vercel，直接上传这三个静态文件所在文件夹即可。

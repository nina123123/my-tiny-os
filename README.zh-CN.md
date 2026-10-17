# my-tiny-os

**一个长得像“小电脑”的个人网站，用你的名字命名。**朋友点开链接，就像翻你的笔记本电脑一样看你的作品。你不用写代码：Claude 会先问你几个问题，按你的性格设计，再帮你做出来。

<p>
  <img src="docs/screenshots/desktop.jpg" alt="示范网站的电脑版：桌面上有图标、欢迎卡片和程序坞" width="68%">
  <img src="docs/screenshots/phone.jpg" alt="示范网站的手机版：主屏幕上有问候和应用图标" width="25%">
</p>

**[看在线示范 →](https://nina123123.github.io/my-tiny-os/)** 截图和示范站里是一个虚构人物 *AlexOS*。你的网站不会长这样：Claude 会按你的特点换掉颜色、字体、logo、壁纸和文字。

[English →](README.md)

---

## 4 步做出你的网站

**需要：**一个免费的 [GitHub](https://github.com) 账号，和 [Claude Code](https://claude.ai/code)（需要付费版 Claude）。

1. **复制模板：**点页面上方的 **Use this template → Create a new repository**。名字可以叫 `my-site`，选 **Public**。
2. **用 Claude Code 打开：**
   - 网页版：打开 [claude.ai/code](https://claude.ai/code)，连接 GitHub，选你刚建的仓库。
   - 电脑上：把仓库下载到本地，在文件夹里运行 `claude`。
3. **说“帮我做网站”**（或输入 `/make-my-site`）。Claude 会：
   - 问你大约 10 分钟：你是谁、谁会来看、想要什么感觉、你的作品；
   - 把你的网站说明书写进 `docs/DESIGN.md`；
   - 把网站改成你的样子，给你看电脑和手机的截图；
   - 一次改一处，直到你满意。
4. **放到网上：**
   - 在仓库里打开 **Settings → Pages → Source**，选 **GitHub Actions**；
   - 如果你用的是网页版 Claude Code，再合并 Claude 开的 Pull Request；
   - 大约一分钟后，网站就会出现在 `https://你的用户名.github.io/my-site/`。

把链接发到群里吧 🎉

## 里面有什么

- **一个系统，两种样子：**电脑上是桌面、可拖动的窗口和程序坞；手机上是主屏幕和全屏应用。
- **应用：**
  - **作品**（主角）：每个作品都有故事、会滚动的数字、照片和视频；
  - **关于我**；
  - **留言板**：朋友可以留一句话；
  - **联系方式**；
  - **Hello 欢迎卡片**。
- **三种心情：**日出、日落、夜晚，再加一张会动的壁纸。
- **无障碍：**支持键盘操作、读屏和减少动效。

## 让网站更好的几个诀窍

- **把感觉说具体：**说出 3 个形容词、喜欢的颜色，还有“不想要什么”（比如“不要像公司官网”“不要太粉”）。这比说“做酷一点”有用得多。
- **真实内容最重要：**准备 3–5 个作品，每个配一个数字和 2–3 张照片。
- **一次只改一件事，**对着截图说，比如“标题太细了”“这个按钮换成我的主色”。
- **发给别人之前，**让 Claude “像一个挑剔的朋友一样检查整个网站：设计、手机、无障碍、bug、速度、文字”。

## 可选：真正的留言板

留言板一开始就能用，只是在演示模式下，留言只存在每个访客自己的设备上。想让所有人都看到所有留言，就连一个免费的 [Supabase](https://supabase.com) 项目。Claude 会一步步带你做，每一步也写在 [docs/GUESTBOOK.md](docs/GUESTBOOK.md) 里。

只把 **Project URL** 和 **publishable key**（`sb_publishable_` 开头）发给 Claude。secret key 和数据库密码不要发给任何人。

---

作者 [@nina123123](https://github.com/nina123123)，由她自己的网站改编而来。MIT 许可证。

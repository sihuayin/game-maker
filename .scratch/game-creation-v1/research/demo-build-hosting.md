# demo 产物怎么构建、怎么静态托管

票 [03](../issues/03-phaser-vite-playwright-chain.md) 的产出。2026-09-24 调研。
**所有结论以官方文档 / 官方源码 / 本机实测为准；实测命令与原始输出附在每节。**
查不到或没实测的，明确标注，不填空。

实测环境：macOS 15（Darwin 24.6.0, arm64）、Node v22.23.2、npm 10.9.8、
Google Chrome 153.0.8010.53、Python 3.13.3、**Vite 8.3.0**、**Phaser 3.90.0**。

可复跑的实验工程：`../experiments/vite-build-hosting-probe/`。

---

## 0. 四条最重要的（先读这个）

### ⚠️ A. **产物 B 用 `file://` 直接打开是做不到的。** 有两个**互相独立**的否决理由

| # | 否决点 | 触发条件 | 实测证据 |
|---|---|---|---|
| 1 | **ES module 脚本撞 CORS** | 只要 dist 里有 `<script type="module">`（Vite 默认必然有） | Chrome 153 报 `blocked by CORS policy: Cross origin requests are only supported for protocol schemes: chrome, chrome-extension, chrome-untrusted, data, http, https, isolated-app` |
| 2 | **Phaser 加载 atlas 撞 CORS** | 只要 atlas PNG/JSON 是**文件**（不管怎么打包） | 同上，`Access to XMLHttpRequest at 'file:///…/atlas.png' from origin 'null' has been blocked` |

第 2 条是**架构性的、绕不过的**：Phaser 3 的 loader 对**所有**资源类型都用
`XMLHttpRequest`，连图片都不用 `<img src>`（见 §2.2 源码）。所以「把 bundle 改成 IIFE
就好了」是**错的** —— 脚本能跑起来，游戏也能启动、canvas 也会出来，但**纹理是空的**
（实测 `frames: []`），是**静默的没图**而不是报错崩溃，更难发现。

**→ 唯一的 file:// 例外**：把 atlas 以 **base64 data URI + 内联 JSON 对象**喂给
`this.load.atlas()`。实测可行（§2.4），但产物会变成一个**自包含单 HTML**，
和 R6「B 吃一个资源包」的形状冲突。**不作为推荐路线，仅作为「必须双击打开」时的逃生舱。**

### ✅ B. 最小可行托管 = **任意静态 HTTP server 起在 dist 目录上**。本机三条路都验证过

按「零安装成本」排序：

| 方式 | 命令 | 需要什么 | 实测 |
|---|---|---|---|
| **Python 内置** | `cd dist && python3 -m http.server 8000` | 只要 Python 3（本机 3.13.3 已有） | ✅ 通过 |
| Vite 自带 | `npx vite preview --port 8000` | 需要项目 node_modules | ✅ 通过 |
| npm 包 | `npx serve dist` | 首次需要联网拉包 | ⚠️ **未实测**（本机没装，且拉包走的是慢镜像） |

**推荐 `python3 -m http.server`**：零 npm 依赖、零联网、跨平台（macOS/Linux 自带
python3），正好满足「产物 B 不吃生图能力、喂 fixture 也能跑」那条验收 —— 它连
node 都不需要。

注意 `vite preview` 官方定位（[Vite CLI 文档](https://vite.dev/guide/cli.html#vite-preview)原文）：

> Locally preview the production build. **Do not use this as a production server as it's not designed for it.**

以及 [Deploying a Static Site](https://vite.dev/guide/static-deploy.html)：

> It is important to note that `vite preview` is intended for previewing the build locally and not meant as a production server.

→ 本机自测可以，**交付给用户的「打开即玩」说明里不该写 `vite preview`**（它要求对方
装了 node + 项目依赖）。写 `python3 -m http.server`。

### C. 资源包走 `public/` 是**原样拷贝、不加 hash、几乎不花时间**

67 MB / 25 个文件的资源包放进 `public/pack/`，构建耗时只从 **282 ms 涨到 459 ms**。
copy 本身不是瓶颈（`cp -R` 同量级数据 0.13 s，APFS 上近似免费）。
**构建耗时几乎完全由「打包 Phaser 本体」决定，与资源包体积无关。**

### D. 构建耗时量级：**亚秒级**（进票 19 的账本）

| 场景 | Vite 自报 | 端到端 wall（含 `npx` 冷启 node） |
|---|---|---|
| 只有 Phaser，无资源包 | **280–282 ms** | 0.47 s |
| + 67 MB 资源包（25 文件） | **409–459 ms** | 0.60–0.66 s |

相比生图链路单次 47–63 s（票 01 / 票 19），**`vite build` 在预算里可以忽略不计**。

---

## 1. 构建产物形态（票 03 问题 ①）

### 1.1 实测的最小工程

```
phaser-demo/
├── package.json          vite@8  phaser@3.90.0
├── vite.config.js        { base: './', build: { outDir: 'dist', assetsDir: 'assets' } }
├── index.html            <script type="module" src="/src/main.js">
├── src/main.js           new Phaser.Game({...}) + this.load.atlas('pack', …)
└── public/assets/        atlas.png (288 B) + atlas.json (438 B)   ← 运行时资源
```

构建命令：`npx vite build`

### 1.2 产物目录（实测 `find dist -type f`）

```
dist/index.html                     0.33 kB │ gzip:   0.24 kB
dist/assets/index-DxhXxVJr.js   1,198.77 kB │ gzip: 319.64 kB
dist/assets/atlas.json                 438 B      ← 来自 public/，名字原样保留
dist/assets/atlas.png                  288 B      ← 来自 public/，名字原样保留
```

`dist/index.html` 内容（**原文**）：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Phaser 3 + Vite build probe</title>
    <script type="module" crossorigin src="./assets/index-DxhXxVJr.js"></script>
  </head>
  <body>
    <div id="game"></div>
  </body>
</html>
```

四个要点，逐条对官方文档：

1. **入口 = `<root>/index.html`**，被改写成 `<script type="module" crossorigin src="…">`，
   原来的 `<script src="/src/main.js">` 消失。
   （[Building for Production](https://vite.dev/guide/build.html)：「By default, it uses
   `<root>/index.html` as the build entry point」）
2. **命名带内容 hash**：`index-DxhXxVJr.js`。同一份源码重复构建 hash 稳定；
   `assetsDir` 默认 `'assets'`（[build.assetsDir](https://vite.dev/config/build-options.html#build-assetsdir)）。
3. **`crossorigin` 属性是 Vite 主动加的** —— 这正是 §2.1 里 file:// 被 CORS 拒的直接原因。
4. **`base` 决定前缀**：设 `base: './'` 后是 `./assets/…` 而非 `/assets/…`。

### 1.3 base path：**必须设 `base: './'`**

[Vite 文档原文](https://vite.dev/config/shared-options.html#base)：

> * **Type:** `string`
> * **Default:** `/`
>
> Base public path when served in development or production. Valid values include:
> * Absolute URL pathname, e.g. `/foo/`
> * Full URL, e.g. `https://bar.com/foo/`
> * **Empty string or `./` (for embedded deployment)**

[Relative base 一节](https://vite.dev/guide/build.html#relative-base)：

> If you don't know the base path in advance, you may set a relative base path with
> `"base": "./"` or `"base": ""`. This will make all generated URLs to be relative to each file.

**实测确认**：`base: './'` 的产物整体拷到任意嵌套子路径
（`http://127.0.0.1:8733/deep/nested/`）后**原样可跑**，无 404，Phaser 正常启动。

> 影响：产物目录可以整体搬走 / 改名 / 放进 zip / 挂到任意子路径，
> `ArtifactRef.path` 指向该目录即可，不需要记录部署基址。

**Phaser 官方 Vite 模板也是这么设的**（[phaserjs/template-vite `vite/config.prod.mjs`](https://github.com/phaserjs/template-vite/blob/main/vite/config.prod.mjs)）：

```js
export default defineConfig({
    base: './',
    logLevel: 'warn',
    build: {
        rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
        minify: 'terser',
        …
    },
    …
});
```

### 1.4 一个必须处理的构建告警

```
(!) Some chunks are larger than 500 kB after minification.
```

Phaser 3.90 打出来 **1,198.77 kB / gzip 319.64 kB** —— 必然超 500 kB 阈值。
两个选择：官方模板那样 `manualChunks` 把 phaser 单独切一个 chunk，或直接调
`build.chunkSizeWarningLimit`。**这条告警会一直存在，构建脚本里要显式吃掉，
否则每次构建都刷一屏噪音。**

---

## 2. 「打开即玩」到底能不能（票 03 问题 ②）—— **本票最重要的一节**

### 2.1 否决点 1：ES module 脚本在 `file://` 上被 CORS 拒

**规范依据**（[HTML Standard, The script element](https://html.spec.whatwg.org/multipage/scripting.html#the-script-element) 原文）：

> Unlike classic scripts, module scripts require the use of the CORS protocol for cross-origin fetching.

**MDN 也直说了**（[JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) 原文）：

> CORS errors due to JavaScript module security requirements. You need to do your testing through a server.

**本机实测**（对**真实 `vite build` 产物**，Chrome 153 headless，`file:///…/dist/__probe.html`）：

```
Access to script at 'file:///tmp/rsch/phaser-demo/dist/assets/index-DxhXxVJr.js'
from origin 'null' has been blocked by CORS policy: Cross origin requests are only
supported for protocol schemes: chrome, chrome-extension, chrome-untrusted, data,
http, https, isolated-app.
```

页面探针结果：`{"log":["ERR (no msg) @ file:///…/index-DxhXxVJr.js"],"probe":null,"ready":false}`
→ **游戏连构造函数都没跑到**。

**根因**：`file://` 下的 origin 是 **opaque / null**。
（[MDN Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) 原文）：

> Modern browsers usually treat the origin of files loaded using the `file:///` scheme as
> **opaque origins**. What this means is that if a file includes other files from the same
> folder (say), they are not assumed to come from the same origin, and may trigger CORS errors.

注意那句「even files in the same folder」—— **不是路径问题，是协议问题，改成相对路径也救不了。**

### 2.2 否决点 2（**更致命**）：Phaser 的资源加载器整个建立在 XMLHttpRequest 上

这是**architecture-level** 的事实，必须记住：

[`src/loader/XHRLoader.js` @ v3.90.0](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/XHRLoader.js)
—— **所有** loader 资源的唯一出口：

```js
var xhr = new XMLHttpRequest();
xhr.open('GET', file.src, config.async, config.user, config.password);
xhr.responseType = file.xhrSettings.responseType;
```

[`filetypes/ImageFile.js`](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/filetypes/ImageFile.js)
—— **PNG 也走 XHR，不用 `<img src>`**：

```js
// line 68
responseType: 'blob',
…
// line 109-129
this.data = new Image();
this.data.crossOrigin = this.crossOrigin;
…
File.createObjectURL(this.data, this.xhrLoader.response, 'image/png');
```

[`filetypes/JSONFile.js`](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/filetypes/JSONFile.js)：`responseType: 'text'` —— 同样 XHR。

[`filetypes/AtlasJSONFile.js`](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/filetypes/AtlasJSONFile.js)
把两者捆在一起：

```js
image = new ImageFile(loader, key, textureURL, textureXhrSettings);
data  = new JSONFile(loader, key, atlasURL, atlasXhrSettings);
MultiFile.call(this, loader, 'atlasjson', key, [ image, data, image.linkFile ]);
```

**实测**（把 bundle 完全绕开：`file://` 页面 + **classic `<script src>`** 加载
`phaser.min.js` + 内联游戏代码，唯一的外部资源是 `./atlas.png` / `./atlas.json`）：

```
Access to XMLHttpRequest at 'file:///tmp/rsch/filetest/atlas.png'  from origin 'null' has been blocked by CORS policy: …
Access to XMLHttpRequest at 'file:///tmp/rsch/filetest/atlas.json' from origin 'null' has been blocked by CORS policy: …
```

探针结果：

```json
{"log":[], "probe":{"phaser":"3.90.0","renderer":"CANVAS","frames":[]}}
```

**故障模式要特别注意**：`probe` **非空**、`renderer: CANVAS`、Phaser v3.90.0 横幅正常打印
—— 游戏**启动成功了**，只是 `frames: []`，**一张图都没有**。这是「白屏/没精灵但不报错」，
比硬崩更难排查。**product 上不能靠「有没有报错」判断这件事。**

### 2.3 两个否决点是**串联**的，不是并联的

| 你做了什么 | 脚本能跑？ | 图能加载？ | 结果 |
|---|---|---|---|
| Vite 默认产物，`file://` | ❌ | — | 页面全黑，控制台一条 CORS |
| 手改成 IIFE/classic script，`file://` | ✅ | ❌ | **游戏跑起来但没图**（最阴险） |
| 加 `--allow-file-access-from-files` 启动 Chrome | ✅ | ✅ | 能跑，但**要求用户改浏览器启动参数**，不算「打开即玩」 |
| **单文件自包含 + base64 data URI** | ✅ | ✅ | 能跑（§2.4） |

（带 flag 那一行是实测的：`--allow-file-access-from-files` 同时解掉两个否决点。）

### 2.4 唯一的 file:// 逃生舱：base64 data URI（实测可行，但**不推荐**）

`XHRLoader` 对 data URI 有专门的 fake-XHR 分支
（[源码](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/XHRLoader.js)）：

```js
if (file.base64)
{
    var base64Data = file.url.split(';base64,').pop() || file.url.split(',').pop();
    …
    file.onBase64Load(fakeXHR);
    return;          // ← 根本没碰 XMLHttpRequest
}
```

且 `AtlasJSONFile` 的 `atlasURL` 参数接受**「a well formed JSON object」**（源码 JSDoc 原文），
所以 JSON 可以内联成对象、PNG 内联成 data URI：

```js
this.load.atlas('pack', window.__ATLAS_PNG__ /* "data:image/png;base64,…" */,
                          window.__ATLAS_JSON__ /* 对象字面量 */);
```

**实测**（同一个 `file://` 页面）：`{"phaser":"3.90.0","renderer":"CANVAS","frames":["hero_0","hero_1"]}`
—— **成功**。288 B 的图 + 438 B 的 JSON → base64 脚本 891 B。

**为什么不推荐作为主路线**：
- 与 **R6**「A 与 B 之间只有一个可序列化的资源包文件」冲突 —— 这条路线把包**编译进 HTML**，
  包就不再是可独立替换的输入（喂 fixture 包要重新构建，不能只换目录）。
- 体积按 base64 膨胀 **4/3**；真实资源包是几十 MB 量级，内联不现实。
- 每次换包都要重跑构建。

**定位**：如果哪天产品上出现「必须邮件发一个文件、双击就玩」的需求，这是唯一可行解，
且**已实测**。写在这里是为了将来不用重查。

### 2.5 结论

> **「打开即玩」的准确含义是「起一个静态 HTTP server 后打开即玩」，不是「双击 HTML 文件」。**
> 验收标准里的「静态可托管」成立，「零依赖双击打开」不成立。
> 最小替代方案：`cd dist && python3 -m http.server 8000` → 浏览器开 `http://localhost:8000`。
> 建议在产物目录里附带一个 `serve.sh` / `README`，把这个命令写死，别让用户自己猜。

---

## 3. 资源包怎么进构建产物（票 03 问题 ③）

**三种物理模型，全部实测过。** 这直接决定产物 B 的目录形状。

### 模型 1：`public/` —— 运行时加载，构建期原样拷贝（**推荐**）

```
phaser-demo/public/assets/atlas.png   →   dist/assets/atlas.png   （名字不变、不 hash）
```

[Vite 文档原文](https://vite.dev/guide/assets.html#the-public-directory)：

> Assets in this directory will be served at root path `/` during dev, and
> **copied to the root of the `dist` directory as-is**.

配套配置（[build.copyPublicDir](https://vite.dev/config/build-options.html#build-copyPublicDir)，
默认 `true`，**别关**）：`copyPublicDir: true`。

游戏侧用**相对路径**取（`base: './'` 下与站点目录一起搬走仍然有效）：

```js
const ASSET_BASE = './assets/';
this.load.atlas('pack', ASSET_BASE + 'atlas.png', ASSET_BASE + 'atlas.json');
```

- ✅ **换包不用重建**：把 `public/assets/` 换成另一个包 → 若走 `public` 则需重建；
  若走 `build.copyPublicDir: false` 则**直接改 dist 目录即可**（见模型 3）。
- ✅ 包体积不进 JS bundle，不进 hash 计算，构建耗时与包大小无关（§0.C：67 MB → +177 ms）。
- ⚠️ **坑**：`public/` 的内容拷到 **outDir 根**（`dist/`），**不进 `assetsDir`**。
  所以 `public/assets/…` 会和 Vite 生成的 `dist/assets/index-*.js` **落在同一个目录**里。
  名字不冲突（一个带 hash 一个不带），但看到 `dist/assets/` 里混着两种来源的文件时别惊讶。
- ⚠️ 文档原话：「Note that you should always reference `public` assets using root absolute
  path - for example, `public/icon.png` should be referenced in source code as `/icon.png`.」
  —— 这条在 `base: './'` 场景下**不适用**（实测用 `./assets/…` 相对路径才是对的），
  文档这句是给默认 `base: '/'` 写的。

### 模型 2：`import` —— 构建期打进 bundle

```js
import atlasUrl from './assets/atlas.png';
import atlasJsonUrl from './assets/atlas.json';
this.load.atlas('pack', atlasUrl, atlasJsonUrl);
```

**实测发现两个必须知道的行为**（[build.assetsInlineLimit](https://vite.dev/config/build-options.html#build-assetsInlineLimit) 默认 **4096 B**）：

> Imported or referenced assets that are smaller than this threshold will be
> **inlined as base64 URLs** to avoid extra http requests.

- 288 B 的 PNG → **被内联成 data URI 塞进 JS**，`dist/assets/` 里**根本没有这个 png 文件**
  （实测 `find dist-import -type f` 只有 `import.html` + `main-*.js`）。
- **导入的 `.json` 不是 URL，是对象**。Vite 的 JSON 插件把它编译成 JS 模块
  （[shared-options `json.stringify`](https://vite.dev/config/shared-options.html#json-stringify)，
  默认 `'auto'`，>10 kB 走 `JSON.parse("…")`）。
  实测 bundle 里出现 `hero_0:{frame:{x:0…` —— 变量拿到的是**对象**。
  `this.load.atlas(key, url, object)` 恰好能接受对象（AtlasJSONFile JSDoc），
  **所以能跑，但这是巧合而非设计**；换成 `this.load.image()` 之类就会静默出错。

- ❌ 大包不可行：几十 MB 进 bundle，hash 计算、体积、内存全炸。
- ❌ 与 R6 冲突：包被**编译**进去了，不是「一个可序列化的资源包文件」。
- ⚠️ 内联阈值还和 `file://` 有微妙的相互作用，别指望靠它碰巧自包含。

### 模型 3：**站点目录 + 同级资源包目录**（R6 最忠实的形状）

```
artifact/
├── site/          ← dist 的全部内容（index.html + assets/）
└── pack/          ← 资源包目录（manifest.json + atlas.png + atlas.json）
```

游戏侧：`const ASSET_BASE = '../pack/';`

**实测（已跑通）**：服务 `artifact/` 父目录，访问 `http://127.0.0.1:8734/site/sibling.html`，
server log 显示：

```
GET /site/sibling.html    200
GET /site/assets/main-Cz5BOCUH.js  200
GET /pack/atlas.json      200
GET /pack/atlas.png       200
```

探针：`frames:["hero_0","hero_1"]`（图集正常装载）。

- ✅ 完全兑现 R6：**换包只换 `pack/` 目录，`site/` 一个字节都不动，不重新构建。**
- ⚠️ **代价：HTTP server 的根必须是 `artifact/`，不能是 `artifact/site/`。**
  也就是说「产物 B 的路径」（`ArtifactRef.path`）是**父目录**，不是 dist。
  这一点必须写进契约，否则用户会 `cd site && python3 -m http.server` 然后拿到 404。
- ⚠️ 更稳健的写法是用 Phaser 的 `loaderBaseURL` 让包基址可配置
  （[`LoaderPlugin.js` @ v3.90.0](https://github.com/phaserjs/phaser/blob/v3.90.0/src/loader/LoaderPlugin.js) 源码原文：

  > If you want to append a URL before the path of any asset you can set this here.
  > **Useful if allowing the asset base url to be configured outside of the game code.**

  对应 Game Config 字段是 `loaderBaseURL` / `loaderPath`），
  这样同一份 `site/` 既能吃 `./assets/` 也能吃 `../pack/`，不必重新构建。

### 建议

**模型 3 是终局（对齐 R6），模型 1 是当前能立刻跑起来的简化版。**
两者可以共存：装配代码用 `loaderBaseURL` 读一个可配置基址，默认 `./assets/`（模型 1，
`public/` 打包进来），也可指到 `../pack/`（模型 3，外部包）。
**票 33（资源包 → 运行时的装配）应该把这一条作为输入**：装配 API 需要一个
「包基址」参数，而不是把路径写死。

---

## 4. 构建耗时（票 03 问题 ④，进票 19 的账本）

**机器**：macOS / arm64 / Node v22.23.2 / Vite 8.3.0 / Phaser 3.90.0，三次取稳。

| 场景 | Vite 自报 `built in` | 端到端 wall |
|---|---|---|
| 冷构建（删 `dist` + `node_modules/.vite`），无资源包 | 280 / 282 / 282 ms | 0.47 / 0.47 / 0.48 s |
| 冷构建，`public/pack/` 放入 **67 MB / 25 文件** | 410 / 409 / 459 ms | 0.61 / 0.60 / 0.66 s |
| 预热重建（`node_modules/.vite` 保留） | 471 ms（另一轮实测） | 0.67 s |

**量级：亚秒级。**
- 端到端 wall 含 `npx` 冷启 Node（约 0.15–0.2 s 固定开销）；
  真正进账本的应该是 Vite 自报值：**0.3–0.5 s**。
- **资源包体积对构建耗时几乎无影响**（67 MB 只加约 130–180 ms；底层的
  `cp -R` 同量级数据耗时 0.13 s）。
- **构建耗时的绝对主项是打包 Phaser 本体**（1.2 MB / gzip 320 kB），不是资源。

> 对照票 19 的账本：生图链路单次 47–63 s，`vite build` **小于 1 s**，
> 在「一批资源生成」的预算里可以当作零。**本票不构成票 19 的瓶颈。**

⚠️ **只测了 Vite 8.3.0**。Vite 8 换成了 **Rolldown**（文档里是 `build.rolldownOptions`，
`build.rollupOptions` 已标 Deprecated），Vite 7 及以前是 Rollup + esbuild。
产物形状两代一致，但耗时数字不能直接套到 Vite 7 上。

---

## 5. 对本项目其余票的直接输入

| 票 | 本票给出的输入 |
|---|---|
| [19 生图配额与成本账本](../issues/19-latency-budget.md) | `vite build` = **0.3–0.5 s**，与资源包体积无关 |
| [25 交付格式规格](../issues/25-delivery-format-spec.md) | 资源包目录里若含 `manifest.json`，**用 `public/` 原样拷贝即可**；若要 `import` 需注意 `.json` 会被编译成 JS 对象 |
| [32 固定 runtime 外壳](../issues/32-runtime-shell.md) | 外壳的资源路径必须走**可配置基址**（`loaderBaseURL`），否则模型 1/3 之间切换要改代码 |
| [33 资源包 → 运行时装配](../issues/33-runtime-assembly.md) | 装配需要一个「包基址」参数；**产出目录 = 父目录（site/ + pack/）**，HTTP 根必须是父目录 |
| [07 项目工作区](../issues/07-project-workspace.md) | `packages/demo` 的构建脚本要显式吃掉 >500 kB 的 chunk 告警 |

---

## 6. 查不到 / 未实测的部分（不填空）

1. **Firefox / Safari 的 `file://` 行为未实测**。只有 Chrome 153 的实测输出。
   不过 [MDN Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
   的描述是普适的（「Modern browsers **usually** treat the origin of files loaded using
   the `file:///` scheme as **opaque origins**」），且 HTML 规范对 module script 的 CORS
   要求是跨浏览器的，**结论不会因浏览器而异**。
2. **`npx serve` 未实测**（本机未安装；首次运行需联网拉包，本机 npm 走的是慢镜像）。
   它的定位和 `python3 -m http.server` 完全等价，风险很低，但要写进文档前建议实测一次。
3. **Vite 7 及更早版本的实测数字没有**。本次只测了 Vite 8.3.0。
4. **CI / 别的机器上的构建耗时没有**。上面的数字全部来自本机。
5. **Vite 是否接受 `build.rolldownOptions.output.format = 'iife'` 把 app 构建成 classic script
   未实测**。§2.3 表里「改成 IIFE」那一行是用**手写的 classic-script 页面 + `phaser.min.js`**
   测的（完全绕开 Vite），够证明「绕开 module 也救不了 atlas」这个结论，但没证明
   Vite 能配出这种产物。**结论不受影响**（否决点 2 独立成立）。

---

## 附：实测命令索引（可复跑）

```bash
# 0) 环境
node -v && npm -v && python3 -V
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --version

# 1) 建工程（见 ../experiments/vite-build-hosting-probe/）
cd phaser-demo
npm install --registry=https://registry.npmjs.org vite@8 phaser@3.90.0

# 2) 构建 + 计时
rm -rf dist node_modules/.vite
/usr/bin/time -p npx vite build

# 3) file:// 实测（会 CORS 失败，这是预期结果）
"$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=8000 \
  --enable-logging=stderr --v=0 --dump-dom "file:///…/dist/index.html"

# 4) 最小托管实测（会成功）
cd dist && python3 -m http.server 8731 --bind 127.0.0.1 &
"$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=8000 \
  --dump-dom "http://127.0.0.1:8731/index.html"

# 5) 逃生舱实测（data URI，file:// 下成功）
"$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=9000 \
  --dump-dom "file:///tmp/rsch/filetest/inline.html"
```

> **注意 registry**：本机 `.npmrc` 指向 `registry.npmmirror.com`，装 Vite 8 时
> `@rolldown/binding-*` 会把**所有平台**的二进制都拉一遍，实测**卡死超过 5 分钟**。
> 加 `--registry=https://registry.npmjs.org` 后 **42 秒**装完。
> **这是本机环境坑，值得写进项目 README。**

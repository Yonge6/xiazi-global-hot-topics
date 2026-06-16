# 虾子曰品牌资产清单

## 可直接用于网站

| 资产 | 路径 | 状态 |
|---|---|---|
| 虾子曰圆形品牌图 | `public/brand/xiazi-reference.png` | PNG，含 Alpha |
| 豆豆龙圆形品牌图 | `public/brand/doudoulong-reference.png` | PNG，白底，适合圆形裁切 |

## 角色生成参考

| 资产 | 路径 | 用途 |
|---|---|---|
| 虾子曰角色板 | `public/brand/references/xiazi-character-sheet.png` | 多视角、表情、动作、色板 |
| 虾子曰全身立绘 | `public/brand/references/xiazi-fullbody-reference.png` | 体态、服装、触须和道具参考 |
| 豆豆龙角色板 | `public/brand/references/doudoulong-character-sheet.png` | 三视图、表情、动作、色板 |
| 豆豆龙全身立绘 | `public/brand/references/doudoulong-fullbody-reference.png` | 毛绒质感与正面造型参考 |
| 豆豆龙毛绒四视图 | `public/brand/references/doudoulong-plush-turnaround.png` | 正背面与侧面体积参考 |
| 品牌素材总览 | `public/brand/references/brand-asset-overview.png` | Logo、色彩、字体方向、禁用造型 |

## 文件事实

新提供的两张“透明背景”全身立绘在文件层面均为 RGB PNG，不含 Alpha 通道；棋盘格已经烘焙进像素。因此它们只作为图像模型参考，不直接叠加到正式海报。

正式排版资产仍建议补充：

- 虾子曰全身透明 PNG；
- 豆豆龙全身透明 PNG；
- 两个品牌 Logo 的 SVG；
- 经授权可自托管的 WOFF2 字体；
- 角色参考图的无文字纯图版本。

## 不可变特征

### 虾子曰

- 红橙色拟人虾形；
- 两根修长飘逸触须；
- 强壮大钳；
- 青边中式长袍；
- 沉稳、智慧、略带幽默。

### 豆豆龙

- 暖橙色小龙；
- 米白双角；
- 小巧橙金翅膀与长尾；
- 青色星星魔法帽和斗篷；
- 金色星星魔杖；
- 活泼、勇敢、好奇、正向。

代码中的机器可读规则位于 `src/lib/brand/characters.ts`。

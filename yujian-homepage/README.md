# 玉鉴 · PHOTO STUDIO 首页

参考影视飓风官网的全屏视频、透明导航、居中标题结构，使用用户提供的 46_raw.MP4 原视频（15.05 秒，1280×720）。没有使用参考站的品牌、文案或视频素材。

纯 HTML / CSS / JavaScript，无外部构建依赖。`public/` 为源文件目录，执行 `node scripts/build.mjs` 生成 `out/` 发布目录。

## 功能

- 背景静音循环、暂停、声音开关；尊重减少动态效果设置。
- 玉鉴拍摄问卷：https://yujian-photo-studio.a1613351407.chatgpt.site
- 景区探索（现有「景去」）：https://jingqu-wuhan-0913.a1613351407.chatgpt.site
- 摄影师工作台：问卷站 `/studio`。
- 桌面和移动导航、键盘操作、视频封面与播放失败提示。

两个业务站点保持现有功能与访问权限，本项目提供直达入口。不发送测试问卷或修改飞书内容。

## 本地预览

```sh
python3 -m http.server 4176 --directory public --bind 127.0.0.1
```

打开 http://127.0.0.1:4176 。站点源码独立于现有问卷与景区项目。

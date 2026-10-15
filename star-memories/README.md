# 星迹 · 回忆星图

以星图为入口的回忆记录应用。点击未点亮的星芒，填写日期和时间、上传最多 6 张照片、写下文字。保存后返回星图，星芒显示对应日期；再次点击可回看照片和文字。

## 运行

- Node.js >= 22.13，`npm ci` 安装依赖。
- `npm run dev` 启动本地预览。打开星图即可使用，无需登录。
- D1 存储记录、账号和照片元数据，R2 保存照片。未登录时记录按浏览器专属 Cookie 隔离；可用用户名和密码注册账号，注册时需确认两次密码（至少 6 个字符），并自动把当前浏览器的回忆转入账号，之后可在其他设备登录查看。已存在账号登录时，当前浏览器的未绑定回忆会留在该浏览器，退出后可查看。密码须自行妥善保管，目前不提供找回。
- 新环境先 `npm run build`，再依次应用 `drizzle/0000_shocking_lester.sql` 与 `drizzle/0001_tricky_luke_cage.sql`：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shocking_lester.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_tricky_luke_cage.sql
```

正式环境使用 D1 和 R2。原先按 ChatGPT 身份保存的记录保留在数据库中，但不会自动显示在新的浏览器星图里。本地测试数据不会上传到正式环境。

## 验证

`npx tsc --noEmit` 检查类型，`npm run build` 构建 Cloudflare Worker。启动开发预览后，`node scripts/smoke-test.mjs`、`node scripts/smoke-edit.mjs` 和 `node scripts/smoke-account.mjs` 验证照片、编辑、浏览器隔离、注册迁移、跨浏览器登录及退出。这些脚本会创建明确标识的本地测试记录，不应用于生产站点。

浏览器已验证：点击星芒、照片选择与预览、自选日期、填写文字、保存返回、日期标记、刷新恢复、再次回看、未保存提示及窄屏布局。生产 Worker 本地预览验证不同浏览器不能读取彼此的记录及照片。

## 图片素材

`public/images/starfield.png` 使用内置图像生成功能生成。完整提示词见 `docs/starfield-prompt.txt`。工具不暴露模型选择参数，因此未将其标记为特定的 image2.5 模型。

照片上传时会保留方向并适度缩小到最长边 2200 像素，转为高质量 JPEG；用户选择的本地源文件不会修改。时间按填写的当地日期与时刻保存，不随浏览设备时区转换。

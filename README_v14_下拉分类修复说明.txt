家庭食谱 v14

本版专门修复“分类仍显示输入框”的问题：
1. index.html 里分类是 select 下拉框。
2. app.js 里增加运行时修复：如果浏览器仍读到旧 input，会自动替换成下拉框。
3. 版本号改为 ?v=14。

注意：
- 你的内容保存在 Supabase，不会因为覆盖 GitHub 文件丢失。
- 不要运行 SQL，不要删除 Supabase 表。
- 如果你已经有正确 config.js，可以不覆盖 config.js；这个包里的 config.js 是你之前上传过的配置。

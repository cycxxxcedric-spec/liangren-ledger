# 两人小账
手机家庭记账工具：金库、分类预算结转、收入、年度存款、CSV 导出及 JSON 备份。

## 发布
在仓库 Settings → Pages 选择 GitHub Actions，再运行 Pages 工作流。
工作流会自动适配仓库网址路径；网站无需登录，数据仅保存在访问者浏览器，不自动同步。

## 迁移已有记录
先在原网址导出 JSON 备份，再在新网址恢复备份。不要把个人账本、银行流水或备份提交到此仓库。

## 开发
Node 22，npm ci，npm run dev。npm run build 生成 out。

代码来自本地已验证的手机版。GitHub Pages 可用性须在实际手机网络上验证，不保证所有网络免 VPN 可达。

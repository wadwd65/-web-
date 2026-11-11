# 参与初程

欢迎报告具体使用问题。请提供页面、版本、步骤与期望结果；使用合成金额与脱敏文字，不在 Issues、PR、截图或日志附 Key、密码、真实合同及他人资料。

项目以毕业生八事务工具为主，音乐与三维为辅助，仅桌面。既有视觉、交互与否定方向见 [AGENTS.md](AGENTS.md)；开发先执行 `npm run resume`，读取现有记忆，避免重复规划或回退已修问题。

Node 24.21+ 下依次执行 `npm ci`、`npm test`、`npm run build`。离线测试无需 Key；真实模型验证需显式使用本机私有配置，并区分合成回归与真实用户验收。

修改后更新现有 `docs/DEVELOPMENT_LOG.md`、`docs/VERSION_HISTORY.md` 与 `docs/memory/progress.json`，执行 `npm run memory:stamp`、`npm run memory:check`。维护者有桌面参赛包时另按约定同步总日志，普通克隆无需该本机目录。

不要提交依赖、构建、私有配置、个人材料、数据库、临时输出或重复快照。第三方模型、图片、音乐与字体权利分别维护在 [第三方声明](THIRD_PARTY_NOTICES.md)，提交 PR 不代表自动获得整套素材的再分发授权。

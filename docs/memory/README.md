# 项目记忆入口

恢复开发运行 `npm run resume`，按顺序读 [progress.json](progress.json)、[DECISIONS.md](DECISIONS.md)、[ARCHITECTURE.md](ARCHITECTURE.md)。

progress 是唯一当前事实与下一步；BACKLOG 只指向同一待办，SESSIONS 只保留当前交接。历史变化统一见[开发总日志](../DEVELOPMENT_LOG.md)与[版本沿革](../VERSION_HISTORY.md)。旧零散原件在 Git 历史、冻结快照和桌面参赛包“03-开发日志/历史资料归档”。

2026-11-07按用户要求另有固定的人类/AI交接入口：桌面参赛包 `00-交接文档`，含交接、官方评分及核验记录。它是本次状态摘要，不覆盖后续progress；不要每轮另建一个交接文件夹。

交付时更新现有文件，运行 `npm run memory:stamp`、`npm run memory:check`，同步总日志。checkpoint 只检查文件指纹，不代表视觉或功能通过。跨会话必须重读文件，不保证模型自动回忆。

# Knowledge 测试清单

本清单用于补充自动化测试，重点进行手动验证。

## 准备工作

- 运行 `npm install`
- 运行 `npm run compile`
- 按 `F5` 启动 Extension Development Host 窗口

## Explorer 视图

- 确认活动栏中的 Knowledge 图标可见
- 打开 `Knowledge > Explorer`，确认在无知识库时空状态正常
- 执行命令 `Knowledge: Add Knowledge Repository`
  - 选择一个文件夹
  - 确认知识库显示在根节点
- 右键知识库根节点，确认右键菜单包含：
  - Add/Clone/Refresh/New File/New Folder/Remove/Open in New Window
- 通过右键菜单创建文件和文件夹
- 分别重命名文件和文件夹
- 删除文件/文件夹，确认原路径已移除
- 在系统文件管理器中修改文件，确认 TreeView 自动刷新
- 确认每个目录内排序为文件夹优先
- 配置 `knowledge.excludePatterns` 后，确认被排除项不会显示

## Search 视图

- 打开 `Knowledge > Search`
- 输入查询词，确认防抖行为（约 300ms）
- 确认内容搜索结果显示文件路径、行号和预览文本
- 确认仅文件名命中时，结果为 `[File] <name>` 样式
- 点击结果，确认编辑器打开并跳转到预期行
- 确认结果按知识库名称分组显示
- 确认被排除的文件/文件夹不会出现在结果中
- 确认浅色/深色主题下可读性正常

## Git 集成

- 对非 Git 文件夹，确认根节点不显示 git 标记
- 对已初始化的 Git 仓库，确认根节点显示 git 标记
- 执行 `Knowledge: Clone Repository as Knowledge`
  - 输入远程仓库 URL
  - 选择父目录并填写本地目标目录名
  - 确认克隆完成后自动加入知识库列表
- 在知识库根节点执行 `Knowledge: Open in New Window`，确认会打开新窗口

## 回归场景

- 多个知识库可以独立添加和移除
- 中文路径和带空格路径可正常使用
- 空知识库搜索不会崩溃
- 超大知识库在展开目录/搜索时仍保持可响应

## 发布前检查

- `npm run compile` 通过
- `npm test` 通过
- `npm run package` 能生成 `.vsix`
- 手动安装 `.vsix` 并进行一次快速冒烟测试

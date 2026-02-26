# Changelog

## [0.33.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.32.0...@spaceflow/publish@0.33.0) (2026-02-26)

### 文档更新

* **cli:** 更新 CLI README 以明确其定位和工作原理 ([88a4e8e](https://github.com/Lydanne/spaceflow/commit/88a4e8e6cc5be014cf418367c89e00f65cc6d57c))
* **core:** 更新核心包 README，反映新架构和职责 ([5d8ed7b](https://github.com/Lydanne/spaceflow/commit/5d8ed7b131af4deaf8f815e4db547e52de337758))
* **publish:** 更新 README 以反映扩展包独立安装方式 ([042ac92](https://github.com/Lydanne/spaceflow/commit/042ac920fe6e8e018cf50539a990f6231582e460))
* **review:** 更新 README.md 以反映扩展架构和配置变更 ([560f270](https://github.com/Lydanne/spaceflow/commit/560f27080f3739c2e222cdd985222cfaacafbab6))
* **shared:** 为 shared 包添加 README 文档 ([5d171d5](https://github.com/Lydanne/spaceflow/commit/5d171d5872f849a62251c646294903d11a0c46d2))
* 更新文档以反映新架构和扩展系统重构 ([828c436](https://github.com/Lydanne/spaceflow/commit/828c436bdbba7798ee3211fc77c4f2ef485c6f55))

### 其他修改

* **cli:** released version 0.31.0 [no ci] ([9038e40](https://github.com/Lydanne/spaceflow/commit/9038e4018cfcbea7ab466ee94546324fcebceabe))
* **core:** released version 0.10.0 [no ci] ([21facb5](https://github.com/Lydanne/spaceflow/commit/21facb554c145cac4f6daac121157e5c11db4191))
* **review-summary:** released version 0.10.0 [no ci] ([69ce9f8](https://github.com/Lydanne/spaceflow/commit/69ce9f809a93eb244c5851605062fdd6e26ec73e))
* **review:** released version 0.40.0 [no ci] ([4e89094](https://github.com/Lydanne/spaceflow/commit/4e890941e688b42d5802e5dd65ed9a754871464b))
* **scripts:** released version 0.10.0 [no ci] ([ced0072](https://github.com/Lydanne/spaceflow/commit/ced00727f30171a281555664bc874d1a38a28762))
* **shared:** released version 0.2.0 [no ci] ([2a9db6f](https://github.com/Lydanne/spaceflow/commit/2a9db6fb0ef4af1bfd0bdeac23119df329c34351))
* **shell:** released version 0.10.0 [no ci] ([8ea0f8b](https://github.com/Lydanne/spaceflow/commit/8ea0f8bebe51e8cfff30cfbdcbb3deb66a4b3909))

## [0.32.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.31.0...@spaceflow/publish@0.32.0) (2026-02-26)

### 代码重构

* **cli:** 从配置文件读取扩展依赖，自动同步到 .spaceflow/package.json ([0f3a0ae](https://github.com/Lydanne/spaceflow/commit/0f3a0ae3f1e580b6fed627e29caf55d8207ece14))
* **cli:** 将 .env 加载提前至主流程最开始，确保子进程启动前环境变量已就绪 ([8851359](https://github.com/Lydanne/spaceflow/commit/88513596b52299c2f8262548fa60ec89d1c466f4))
* **cli:** 将 .spaceflow/bin/ 添加到 .gitignore，移除静态生成的入口文件 ([df01d2d](https://github.com/Lydanne/spaceflow/commit/df01d2d6a8dc647d8b067e3f529b0967b2a6eabd))
* **cli:** 改用 dynamic import 加载扩展，确保 i18n 在扩展模块执行前初始化 ([926286d](https://github.com/Lydanne/spaceflow/commit/926286d98d867a7521e7943e15d62952df35c017))
* **cli:** 重构配置和 .env 文件查找逻辑，支持从 cwd 向上遍历目录树 ([62a381b](https://github.com/Lydanne/spaceflow/commit/62a381bac340033ce0ff9c39afca82d7f8f20311))
* **config:** 将 .env 加载逻辑迁移至 shared 包，并在 CLI 壳子阶段提前加载 ([4c6b825](https://github.com/Lydanne/spaceflow/commit/4c6b825d44a98d1fec92ed6a4e17b74a79f7206d))
* **core:** 移除 ConfigReaderService，统一使用 IConfigReader 接口 ([ea9ed2b](https://github.com/Lydanne/spaceflow/commit/ea9ed2b9d35886f768eac9c6d1a50ca4fc79b67d))
* **core:** 重构 CLI 架构，将运行时逻辑迁移至 Core 包 ([6539795](https://github.com/Lydanne/spaceflow/commit/653979503d720c8a37f1731044e3c65ac2dd6e1c))
* **core:** 重构 i18n 模块结构，统一导出路径至 cli-runtime/i18n ([b49ae95](https://github.com/Lydanne/spaceflow/commit/b49ae95cf99a41a91f9018e141afb5bbfb6b8884))
* **mcp:** 移除重复的扩展加载逻辑，新增 TTY 检测避免手动运行时阻塞 ([51fb35f](https://github.com/Lydanne/spaceflow/commit/51fb35fab28c11cf8d297d7950c31a60bc4c4e2a))
* 调整构建顺序，优先构建 shared 包并排除其重复构建 ([d7cd392](https://github.com/Lydanne/spaceflow/commit/d7cd392ed6578acb1e6ee85ae2097d92d81e5efb))

### 其他修改

* **cli:** released version 0.30.0 [no ci] ([7af2925](https://github.com/Lydanne/spaceflow/commit/7af292524349effcfc85a26cf3285dba7726b441))
* **core:** released version 0.9.0 [no ci] ([e4bd091](https://github.com/Lydanne/spaceflow/commit/e4bd091c3f3cb4ae675f4e594d0c651cea481bc5))
* **review-summary:** released version 0.9.0 [no ci] ([c1a2322](https://github.com/Lydanne/spaceflow/commit/c1a2322bb7535d15c63251ea515ee21ea7a4e1bf))
* **review:** released version 0.39.0 [no ci] ([0fbda14](https://github.com/Lydanne/spaceflow/commit/0fbda140982510f49c449eb35605b0dedd27c8cc))
* **scripts:** released version 0.9.0 [no ci] ([8db4c68](https://github.com/Lydanne/spaceflow/commit/8db4c681b6a00bb9717f05aa809bb4e13bbb7e53))
* **shared:** released version 0.1.0 [no ci] ([243e31d](https://github.com/Lydanne/spaceflow/commit/243e31de49dbde605d5a16ec9f0d589792b9cc30))
* **shell:** released version 0.9.0 [no ci] ([b161fe1](https://github.com/Lydanne/spaceflow/commit/b161fe17aec13f59f0dbc04a7a2d392ba6740cca))

## [0.31.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.30.0...@spaceflow/publish@0.31.0) (2026-02-26)

### 修复BUG

* **cli:** 自动安装扩展时根据命令行参数动态设置 verbose 级别 ([d2da6f5](https://github.com/Lydanne/spaceflow/commit/d2da6f5eb30425e48bb4fd924c73bb9237a437ab))

### 其他修改

* **cli:** released version 0.29.0 [no ci] ([5fd87d3](https://github.com/Lydanne/spaceflow/commit/5fd87d31511d13d4937b1b1a247ad8a322d6fc9c))
* **review-summary:** released version 0.8.0 [no ci] ([0e73a97](https://github.com/Lydanne/spaceflow/commit/0e73a97b035692b0fe7f59e36585cffccf6c6854))
* **review:** released version 0.38.0 [no ci] ([f8c96be](https://github.com/Lydanne/spaceflow/commit/f8c96bed623f24e6c21af389aaaaecf7c057ae5f))
* **scripts:** released version 0.8.0 [no ci] ([efea246](https://github.com/Lydanne/spaceflow/commit/efea246fe1bbd8815c7af44e8fd40df57a0219d6))
* **shell:** released version 0.8.0 [no ci] ([607b93b](https://github.com/Lydanne/spaceflow/commit/607b93bd911e3da102a73dd4513a4733b40c8672))

## [0.30.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.29.0...@spaceflow/publish@0.30.0) (2026-02-26)

### 修复BUG

* **cli:** 修复扩展自动安装逻辑，优化 npm 包名解析 ([0271dd4](https://github.com/Lydanne/spaceflow/commit/0271dd48e0169ae5055cfab28e0656e777de10f4))

### 其他修改

* **cli:** released version 0.28.0 [no ci] ([944de26](https://github.com/Lydanne/spaceflow/commit/944de26607e91123818bad469ee7b7487473de5f))
* **review-summary:** released version 0.7.0 [no ci] ([21aced5](https://github.com/Lydanne/spaceflow/commit/21aced5a10fd522122e5f2c6f4ce3a318b80dff2))
* **review:** released version 0.37.0 [no ci] ([b26e2bb](https://github.com/Lydanne/spaceflow/commit/b26e2bba0df5471d4fb54c70bf230d6f2c964504))
* **scripts:** released version 0.7.0 [no ci] ([6392c03](https://github.com/Lydanne/spaceflow/commit/6392c03e2c8dc9376ae24baaa3ef3fc62be9c762))
* **shell:** released version 0.7.0 [no ci] ([da9dd6b](https://github.com/Lydanne/spaceflow/commit/da9dd6b07b0cfc807a20fecaa84418c90fc97b7b))

## [0.29.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.28.0...@spaceflow/publish@0.29.0) (2026-02-26)

### 代码重构

* **core:** 将 i18n 实例管理从 core 迁移至 cli，core 仅提供翻译接口 ([64b5398](https://github.com/Lydanne/spaceflow/commit/64b5398bfaf8ad7b7032400a3bf15bd7433896b8))

### 其他修改

* **cli:** released version 0.27.0 [no ci] ([b0c745d](https://github.com/Lydanne/spaceflow/commit/b0c745d2ddee978533b8be11062608b00238c92f))
* **core:** released version 0.8.0 [no ci] ([1ef855e](https://github.com/Lydanne/spaceflow/commit/1ef855e1e67e7b1cc0a45278b208f4e539ad6602))
* **review-summary:** released version 0.6.0 [no ci] ([185e4ff](https://github.com/Lydanne/spaceflow/commit/185e4ff5488a13cd32e54a442bf41728abdadb4e))
* **review:** released version 0.36.0 [no ci] ([32df799](https://github.com/Lydanne/spaceflow/commit/32df799cf56a1bd7ca987fe79c6392dfc829f841))
* **scripts:** released version 0.6.0 [no ci] ([91ea44e](https://github.com/Lydanne/spaceflow/commit/91ea44ec943c2de318b32c0cd29d8c6ce1e89012))
* **shell:** released version 0.6.0 [no ci] ([bffd7b5](https://github.com/Lydanne/spaceflow/commit/bffd7b5cef4f3d4b7e306339e93e1c7752d459df))

## [0.28.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.27.0...@spaceflow/publish@0.28.0) (2026-02-26)

### 代码重构

* **core:** 使用 globalThis 确保多份 core 实例共享同一个 i18n 状态 ([c46e713](https://github.com/Lydanne/spaceflow/commit/c46e713d3e6e4d84447ebecad6ea719fc861854f))
* **core:** 实现扩展自动安装机制，确保 .spaceflowrc 声明的依赖自动同步 ([89af2ae](https://github.com/Lydanne/spaceflow/commit/89af2ae864decd6f2acb917d59afd657ee8e4562))

### 其他修改

* **cli:** released version 0.26.0 [no ci] ([55f6cf7](https://github.com/Lydanne/spaceflow/commit/55f6cf7f76c49a8a871e0a1516520db78d841752))
* **core:** released version 0.7.0 [no ci] ([1e37534](https://github.com/Lydanne/spaceflow/commit/1e37534d5e25ce8e08bb90a073c402d0cae80c9d))
* **review-summary:** released version 0.5.0 [no ci] ([8ebcc22](https://github.com/Lydanne/spaceflow/commit/8ebcc224b61afebd77a21ec9beafe5e813b2e7ec))
* **review:** released version 0.35.0 [no ci] ([d33b8ee](https://github.com/Lydanne/spaceflow/commit/d33b8eebdbcb2871a151df004c41bee86bfaedb7))
* **scripts:** released version 0.5.0 [no ci] ([0d8de8d](https://github.com/Lydanne/spaceflow/commit/0d8de8d0b211b8e398730de25d06eee7d3cfb7b3))
* **shell:** released version 0.5.0 [no ci] ([d26230c](https://github.com/Lydanne/spaceflow/commit/d26230c5d45e4f4301c11581304e4c8f536abac0))

## [0.27.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.26.0...@spaceflow/publish@0.27.0) (2026-02-25)

### 代码重构

* **core:** 修复 dependencies 写入格式，确保与 package.json 规范一致 ([b3d4ada](https://github.com/Lydanne/spaceflow/commit/b3d4ada9ece7d191bdbf035550553c9919d9d90f))

### 其他修改

* **cli:** released version 0.25.0 [no ci] ([f0a7707](https://github.com/Lydanne/spaceflow/commit/f0a7707caffd9868b7b6b64fca4ffa01091d1478))
* **core:** released version 0.6.0 [no ci] ([42d7669](https://github.com/Lydanne/spaceflow/commit/42d76699e3b74fd3fe64031a004003967ddbdbd6))
* **review-summary:** released version 0.4.0 [no ci] ([6a9e7d5](https://github.com/Lydanne/spaceflow/commit/6a9e7d58f796a72fb381e18bfb0d0a1799fd2d5d))
* **review:** released version 0.34.0 [no ci] ([fb1ae4a](https://github.com/Lydanne/spaceflow/commit/fb1ae4a48a6ff6f68b43ea45ac8950283605bad6))
* **scripts:** released version 0.4.0 [no ci] ([b30f118](https://github.com/Lydanne/spaceflow/commit/b30f118e07506485ceaafaa850d13b3167facea9))
* **shell:** released version 0.4.0 [no ci] ([dca978f](https://github.com/Lydanne/spaceflow/commit/dca978fd7c620a78ecc9f23e96f29775a1276f0d))

## [0.26.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.25.0...@spaceflow/publish@0.26.0) (2026-02-25)

### 代码重构

* **cli:** 统一使用 core 层配置读取函数，移除重复的配置解析逻辑 ([5783e5f](https://github.com/Lydanne/spaceflow/commit/5783e5f693b0aafd8346ee3a250692265aad55c5))

### 其他修改

* **cli:** released version 0.24.0 [no ci] ([418daf8](https://github.com/Lydanne/spaceflow/commit/418daf8a8571e9dec2ef5c13e8fb103b876fb483))
* **review-summary:** released version 0.3.0 [no ci] ([9a881e9](https://github.com/Lydanne/spaceflow/commit/9a881e94b6141592aefc835861bf2bf7cca9eefe))
* **review:** released version 0.33.0 [no ci] ([467cf91](https://github.com/Lydanne/spaceflow/commit/467cf91c60c0693e22c172a9358d0981dc8a9d64))
* **scripts:** released version 0.3.0 [no ci] ([7b62b7b](https://github.com/Lydanne/spaceflow/commit/7b62b7bc7a4c4795472d729df321acbde808ec4d))
* **shell:** released version 0.3.0 [no ci] ([baa26b3](https://github.com/Lydanne/spaceflow/commit/baa26b3d6bc63de2c252101d915badf4461dfbd1))

## [0.25.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.24.0...@spaceflow/publish@0.25.0) (2026-02-25)

### 代码重构

* **core:** 优化 dependencies 配置管理，支持按字段查找配置文件并原地更新 ([6d97021](https://github.com/Lydanne/spaceflow/commit/6d97021a3051602ac655b0beff89acdfc8dbe497))

### 其他修改

* **cli:** released version 0.23.0 [no ci] ([7a71e2c](https://github.com/Lydanne/spaceflow/commit/7a71e2c21a409999fde86a7fca9e6b26fa8bef14))
* **core:** released version 0.5.0 [no ci] ([1d491aa](https://github.com/Lydanne/spaceflow/commit/1d491aa3d527714e2d0df2bbc55bc3e1374332f3))
* **review-summary:** released version 0.2.0 [no ci] ([f947083](https://github.com/Lydanne/spaceflow/commit/f94708316cafbddbd225594b90c9a91e41d4599f))
* **review:** released version 0.32.0 [no ci] ([43498f0](https://github.com/Lydanne/spaceflow/commit/43498f04b5f33cc3de6a3ca652b2bc2f12c47ac8))
* **scripts:** released version 0.2.0 [no ci] ([7848836](https://github.com/Lydanne/spaceflow/commit/7848836911f50b67302db82aa05e22d5670ef01e))
* **shell:** released version 0.2.0 [no ci] ([6a31ede](https://github.com/Lydanne/spaceflow/commit/6a31edeebf7c212bd4095766fc44a1fd66c37ab7))

## [0.24.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.23.0...@spaceflow/publish@0.24.0) (2026-02-25)

### 修复BUG

* **core:** 移除 isPnpmWorkspace 检查，改为在读取项目 package.json 版本时处理 workspace 协议 ([ed04f56](https://github.com/Lydanne/spaceflow/commit/ed04f568cebdc71a9c9ad08eebe343bf82250d5d))

### 代码重构

* **cli:** 移除 ensureSpaceflowPackageJson 调用中的 isGlobal 和 cwd 参数 ([731758f](https://github.com/Lydanne/spaceflow/commit/731758fabb54236c0002be6815070af804c1801e))
* **core:** 移除 .spaceflow 目录的 pnpm-workspace.yaml 创建逻辑 ([538f7b0](https://github.com/Lydanne/spaceflow/commit/538f7b0e1b71515f3cdfa7273747f0fa728f737a))
* **core:** 简化 ensureSpaceflowPackageJson，移除 isGlobal 参数，改为从 cli 入口读取 core 版本 ([eb4df3e](https://github.com/Lydanne/spaceflow/commit/eb4df3e3af261e3017ad26a308afe760667acba5))
* 将 .spaceflow 配置迁移到根目录 .spaceflowrc，统一使用 workspace: 协议管理依赖 ([0aff2af](https://github.com/Lydanne/spaceflow/commit/0aff2afa6176e97c1f131b37cec51e32051a346a))

### 其他修改

* **cli:** released version 0.22.0 [no ci] ([e90581b](https://github.com/Lydanne/spaceflow/commit/e90581bfd7e1f388aeec35077753971939fbf25f))
* **core:** released version 0.4.0 [no ci] ([144a5d8](https://github.com/Lydanne/spaceflow/commit/144a5d8afdc9681b548406f83491359a2accfa3c))
* **review-summary:** released version 0.1.0 [no ci] ([eb52706](https://github.com/Lydanne/spaceflow/commit/eb527063cc6e99530436d5a370827596baae44a3))
* **review:** released version 0.31.0 [no ci] ([ec5ffe5](https://github.com/Lydanne/spaceflow/commit/ec5ffe5213099a7e77549648bd9da9ad53c640cc))
* **scripts:** released version 0.1.0 [no ci] ([98abf0e](https://github.com/Lydanne/spaceflow/commit/98abf0e6e17985320a4d96e1350cea05e8f81b15))
* **shell:** released version 0.1.0 [no ci] ([e03b69e](https://github.com/Lydanne/spaceflow/commit/e03b69e7ad7d3db6e96c699ec715c2313b236196))

## [0.23.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.22.0...@spaceflow/publish@0.23.0) (2026-02-25)

### 新特性

* 支持删除旧行级评论后重新创建，添加 deletePullReviewComment API ([485703c](https://github.com/Lydanne/spaceflow/commit/485703cd778eece364a297f6265a0a81fde5c6dc))
* 添加 /review --flush 指令，仅刷新状态不执行 LLM 审查 ([3546748](https://github.com/Lydanne/spaceflow/commit/354674857ef062a855e64529a6deab461dd8d5c6))

### 修复BUG

* Gitea 适配器 updatePullReview 使用删除+创建方式实现 ([8193668](https://github.com/Lydanne/spaceflow/commit/81936684e552d057f74b69505f93e7f86209d79a))
* GitHub 行级评论 reactions 使用正确的 pulls/comments API 路径 ([a028bc4](https://github.com/Lydanne/spaceflow/commit/a028bc42a1fb8a1445e0535d2da22da2ca487a8a))
* GitHub 行级评论使用 line+side 替代废弃的 position，批量失败时逐条发布 ([01b4873](https://github.com/Lydanne/spaceflow/commit/01b4873fe165d5c9134e0579e25a995f5eafefa4))
* GitHub 适配器 updatePullReview 也使用删除+创建方式，因为已提交的 review 无法更新 ([25b74ce](https://github.com/Lydanne/spaceflow/commit/25b74ce16cb34fa6446529c224288da96cb51466))
* GitHub 通过 GraphQL 查询 review thread resolved 状态，修复 Resolve conversation 不生效问题 ([28a4e0b](https://github.com/Lydanne/spaceflow/commit/28a4e0b0da2a1e4f233a194be34aeafb32ef1e1d))
* 使用 updatePullReview 替代删除+创建，避免 GitHub 重复审查报告 ([a0dc74d](https://github.com/Lydanne/spaceflow/commit/a0dc74ddc49bd4130152931bb4f95d274949afb1))
* 修复重复审查报告问题，支持删除已提交的 AI 评论 ([e531113](https://github.com/Lydanne/spaceflow/commit/e531113d145a51cd504ca11dd837c0d04cbaf5b6))
* 修复问题去重逻辑，所有历史问题（含无效和已解决）都阻止重复报告 ([0e5eadd](https://github.com/Lydanne/spaceflow/commit/0e5eadd2ab4122f433b881489889b1a154aeb676))
* 避免重复创建行级评论，已存在时跳过（GitHub 已提交的 review 无法删除） ([30985b7](https://github.com/Lydanne/spaceflow/commit/30985b7323b2254ca4feaa5ba39cd28ca0adaed3))
* 重写 syncResolvedComments，通过 GraphQL 直接查询所有 resolved threads 的 path+line 匹配 issues ([5429cbc](https://github.com/Lydanne/spaceflow/commit/5429cbc4c7ae5df94c9c6c733dc72443fddf474f))

### 代码重构

* 主评论改用 Issue Comment API，行级评论仍用 PR Review API，彻底解决 GitHub 重复审查报告问题 ([3ffb9d4](https://github.com/Lydanne/spaceflow/commit/3ffb9d47d05e74722a9a964281588e0cc26d212e))
* 优化 PR 审查工作流触发条件和并发控制 ([74b84d7](https://github.com/Lydanne/spaceflow/commit/74b84d7f5078b631d33c1f6759130df3d0401e51))
* 分离 PR 审查评论为主评论和行级评论两部分 ([dda2ef6](https://github.com/Lydanne/spaceflow/commit/dda2ef6491a8cbce890dc68eba6f5660085428b5))
* 提取 REVIEW_STATE 和 DIFF_SIDE 常量，消除魔法字符串 ([264132e](https://github.com/Lydanne/spaceflow/commit/264132e4ca68ef44e9e3a477eab0e9af080f5902))
* 移除 PR 审查工作流中的 workflows 写权限 ([63357e2](https://github.com/Lydanne/spaceflow/commit/63357e22146c803c2271f729214d54af8f34aa86))
* 简化 PR 审查工作流配置 ([b9b9a47](https://github.com/Lydanne/spaceflow/commit/b9b9a47a660904fc683d827c0a65020170ae323b))
* 重命名扩展包,统一命名规范 ([13bfefe](https://github.com/Lydanne/spaceflow/commit/13bfefe94a4a63389a17e0faefd9533bcbda8198))

### 其他修改

* **cli:** released version 0.21.0 [no ci] ([6f32080](https://github.com/Lydanne/spaceflow/commit/6f32080459bb3bcef895f3e51ee5341c2a4ddc74))
* **core:** released version 0.3.0 [no ci] ([7a66bea](https://github.com/Lydanne/spaceflow/commit/7a66beac3702107884f638a1f3fd54c5c10be568))
* **review:** released version 0.30.0 [no ci] ([1e880b1](https://github.com/Lydanne/spaceflow/commit/1e880b1e535945125d746a0e5e4cb5453422373e))

## [0.22.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.21.3...@spaceflow/publish@0.22.0) (2026-02-16)

### 新特性

* **ci-scripts:** 迁移到新架构格式 ([5df3630](https://github.com/Lydanne/spaceflow/commit/5df3630208894e6543d34f9985fcf0f612a78d7e))
* **ci-shell:** 迁移到新架构格式 ([b7d92fd](https://github.com/Lydanne/spaceflow/commit/b7d92fd5f83e9a5e8edeb0ce4971b19190078a7f))
* **cli:** 修复 commander.js 集成问题 ([8e6aeca](https://github.com/Lydanne/spaceflow/commit/8e6aecadb06e6168050371ec5da3b0a3c40d51c2))
* **cli:** 阶段3 - 创建新 CLI 架构基础 ([deeaf0d](https://github.com/Lydanne/spaceflow/commit/deeaf0dfeedb3e8c9a8f30fcd05c37e9db18cb55))
* **core:** 阶段2 - 去除核心服务的 NestJS 装饰器 ([684ec07](https://github.com/Lydanne/spaceflow/commit/684ec0723a90383a6c5fb84fc9198d8b908a89d8))
* **period-summary:** 迁移到新架构格式 ([b6c7a92](https://github.com/Lydanne/spaceflow/commit/b6c7a927963c84349637884e8fab37d550daa91f))
* **publish:** 迁移到新架构格式 ([5df49a8](https://github.com/Lydanne/spaceflow/commit/5df49a8b3df6906e7ff65fd2a3bae4ee5ef31bc5))
* **review:** 迁移到新架构格式 ([6bda477](https://github.com/Lydanne/spaceflow/commit/6bda4773eed9cdbc82593ee29888d1d2cce6efef))

### 修复BUG

* 修复 ReviewSpecService 构造函数调用，传入 gitProvider 参数 ([747b87e](https://github.com/Lydanne/spaceflow/commit/747b87e7e4621b8976c6444e0350e71600c20801))
* 修复 StorageServiceOptions 类型错误 ([0bd2820](https://github.com/Lydanne/spaceflow/commit/0bd2820af594f2f30473e57ba4843197e3e7a2ff))
* 修复 TypeScript 编译配置 ([8c3a4f1](https://github.com/Lydanne/spaceflow/commit/8c3a4f148ccbd5598fb553608f4832ec6a4dc40b))
* 修复扩展 tsconfig.json 中的路径错误 ([ff42b24](https://github.com/Lydanne/spaceflow/commit/ff42b244645128b1c31714e6e6cf6c71fa4bbc80))
* 清理 list.service.ts 中的 NestJS 依赖 ([f483bc1](https://github.com/Lydanne/spaceflow/commit/f483bc1edcaf472acf2bdc38902d992840d004c8))
* 清理命令服务中的 NestJS 依赖 ([a5ca870](https://github.com/Lydanne/spaceflow/commit/a5ca870782eaf4117ecc4f58a689e001df34ce5e))
* 清理命令服务中的 NestJS 依赖 ([2bebe2a](https://github.com/Lydanne/spaceflow/commit/2bebe2ab23367d661706368c37c01bc6360e5e36))

### 代码重构

* 使用 ciConfig 函数替代配置读取，简化 CI 配置获取 ([9356752](https://github.com/Lydanne/spaceflow/commit/93567520181a95398f36413a68e8334342d01e51))
* 删除不再使用的 cli.module.ts ([5b86cb2](https://github.com/Lydanne/spaceflow/commit/5b86cb21d0b55aa4ed8934a51c7bba88f3892ece))
* 删除所有不再使用的 .module.ts 文件 ([7049a59](https://github.com/Lydanne/spaceflow/commit/7049a59fca05906e163a58a2bc1ad64b51dbccf1))
* 增强 MCP 工具收集的日志输出 ([e889c2b](https://github.com/Lydanne/spaceflow/commit/e889c2bad0c2dba833905299af2cb4a76126ed0e))
* 实现 MCP 工具收集和 Inspector 模式支持 ([0702d83](https://github.com/Lydanne/spaceflow/commit/0702d83791e9836ed54576b6d3d373a0fc5085b4))
* 支持 verbose 计数选项，实现 -vvv 累加级别 ([42ab32d](https://github.com/Lydanne/spaceflow/commit/42ab32dbbf42cff1774d27a1ba2fedab02f33038))
* 清理 NestJS 依赖和模块文件 ([3efe7d7](https://github.com/Lydanne/spaceflow/commit/3efe7d7555746f93737d91508b06a0061ba2295f))
* 清理剩余的 NestJS 依赖 ([a3104b3](https://github.com/Lydanne/spaceflow/commit/a3104b36cecb0c93bc839472dba63b88e71bb662))
* 移除 dtoToJsonSchema 中的 class-validator 元数据推断逻辑 ([0dd1c8e](https://github.com/Lydanne/spaceflow/commit/0dd1c8e1424e1de57ca40b8e317f3bad00d08e7d))
* 移除 MonorepoService 中的 NestJS 依赖 ([c6a3243](https://github.com/Lydanne/spaceflow/commit/c6a32439da97efb287239e16723f4cb982bdf208))
* 移除测试文件中的 NestJS 依赖，改用直接实例化 ([325f2e3](https://github.com/Lydanne/spaceflow/commit/325f2e36b434ebb4e471c17b5e2ef2f9a4db2456))
* 简化 list 命令，只显示外部扩展 ([babcb24](https://github.com/Lydanne/spaceflow/commit/babcb245f527c427103726e290ff889444c1e8da))
* 统一配置管理，支持环境变量自动合并 ([f6b09a3](https://github.com/Lydanne/spaceflow/commit/f6b09a35c273f1f96f5a07546f2bf58ceb6942f6))
* 迁移 ci-scripts、ci-shell、publish、review 扩展到新架构 ([4630116](https://github.com/Lydanne/spaceflow/commit/4630116c96699a6a3c36aa439badaa3567cc4c06))
* 重构服务容器为懒加载依赖注入架构 ([c74a346](https://github.com/Lydanne/spaceflow/commit/c74a346ef27540836b06a8fd825283155722d4af))

### 文档更新

* **architecture:** 添加 Spaceflow 架构重设计方案 v2 ([21b252c](https://github.com/Lydanne/spaceflow/commit/21b252c97aaf4561cc5837b68229356e5ffa8d36))

### 其他修改

* **ci-scripts:** released version 0.20.0 [no ci] ([ed8d88d](https://github.com/Lydanne/spaceflow/commit/ed8d88df09c7d119df092793e4c83d451d67a6b8))
* **ci-shell:** released version 0.20.0 [no ci] ([5109d94](https://github.com/Lydanne/spaceflow/commit/5109d944bfbd95596e71d6e11e56d3e3599f8297))
* **cli:** released version 0.20.0 [no ci] ([7cb015c](https://github.com/Lydanne/spaceflow/commit/7cb015c9fba3b9b4a8a170f66597505300e35e10))
* **core:** released version 0.2.0 [no ci] ([6176e7e](https://github.com/Lydanne/spaceflow/commit/6176e7e5755dd594dee7d4e0016dfb89b391d824))
* **period-summary:** released version 0.20.0 [no ci] ([54feb4a](https://github.com/Lydanne/spaceflow/commit/54feb4adaf0d72d402287bef84fd9433db673ed6))
* **review:** released version 0.29.3 [no ci] ([82ba72d](https://github.com/Lydanne/spaceflow/commit/82ba72d00c3cf7e50434ea63e7cd30c6ea851a51))

## [0.21.3](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.21.2...@spaceflow/publish@0.21.3) (2026-02-16)

### 修复BUG

* **cli:** 配置 CommandFactory 在错误时不中止执行 ([e55eaa9](https://github.com/Lydanne/spaceflow/commit/e55eaa9a8f0c3f90564657df2a9cb5cd3314956c))

### 其他修改

* **ci-scripts:** released version 0.19.3 [no ci] ([dfa4ebf](https://github.com/Lydanne/spaceflow/commit/dfa4ebf2b8cad72c8088750ac601f062f973411f))
* **ci-shell:** released version 0.19.3 [no ci] ([0cf07cd](https://github.com/Lydanne/spaceflow/commit/0cf07cdb70fbfb5c7a36a7955f5c9f248bb917fd))
* **cli:** released version 0.19.4 [no ci] ([caddff1](https://github.com/Lydanne/spaceflow/commit/caddff1553a3d2d2a9f3aaba225d1dfb6eb2318f))
* **period-summary:** released version 0.19.3 [no ci] ([85827b9](https://github.com/Lydanne/spaceflow/commit/85827b95d44e0f7db28e083515a8232310e2359f))
* **review:** released version 0.29.2 [no ci] ([ec0f499](https://github.com/Lydanne/spaceflow/commit/ec0f499c802d57a64cc01580dbccf991a6855331))

## [0.21.2](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.21.1...@spaceflow/publish@0.21.2) (2026-02-16)

### 其他修改

* **ci-scripts:** released version 0.19.2 [no ci] ([aabfbf3](https://github.com/Lydanne/spaceflow/commit/aabfbf327353bdda370884f6887be92ee2e23c0c))
* **ci-shell:** released version 0.19.2 [no ci] ([ef258b7](https://github.com/Lydanne/spaceflow/commit/ef258b7cd02305c82c5813c4056def14548261d3))
* **cli:** released version 0.19.3 [no ci] ([30b95d5](https://github.com/Lydanne/spaceflow/commit/30b95d5bffdc617b610e6d31367c84f450050f13))
* **core:** released version 0.1.3 [no ci] ([e02f23b](https://github.com/Lydanne/spaceflow/commit/e02f23b8d3ea3078b93bc4467de845bbd4bd1c35))
* **period-summary:** released version 0.19.2 [no ci] ([ce5530e](https://github.com/Lydanne/spaceflow/commit/ce5530ecc75703872d00a97aa19a745be4fd2a6d))
* **review:** released version 0.29.1 [no ci] ([a285a81](https://github.com/Lydanne/spaceflow/commit/a285a8160adade1dd3d08d8434aeec4bafe65c86))
* 为 cli 和 core 包添加 files 字段以控制发布内容 ([5a43ee2](https://github.com/Lydanne/spaceflow/commit/5a43ee2499995dab8bdc06042269fa163fc98e31))

## [0.21.1](https://github.com/Lydanne/spaceflow/compare/@spaceflow/publish@0.21.0...@spaceflow/publish@0.21.1) (2026-02-15)

### 文档更新

* **ci-scripts:** 更新 README，添加徽章和描述 ([f95f952](https://github.com/Lydanne/spaceflow/commit/f95f95207d6ad31ce756ca36bc8d3acfea398edc))
* **ci-shell:** 更新 README，添加徽章和描述优化 ([c4419ad](https://github.com/Lydanne/spaceflow/commit/c4419ad33139f0e9811b4c1eeae5fd5d046139be))
* **cli:** 更新 CLI README 文档，添加徽章并统一术语 ([19fd319](https://github.com/Lydanne/spaceflow/commit/19fd319771d538be21c35bee94a25bd05440e1bb))
* **core:** 更新核心包 README，添加徽章并优化文档结构 ([0e7e576](https://github.com/Lydanne/spaceflow/commit/0e7e5766e512c9fc86edd078e5701a687be5bfae))
* **period-summary:** 更新 README，添加徽章和说明 ([bf57823](https://github.com/Lydanne/spaceflow/commit/bf5782373c2cd7db35ff4d71cbb0cf2bd2b85380))
* **publish:** 更新发布插件 README 文档 ([8320c84](https://github.com/Lydanne/spaceflow/commit/8320c844d9585ceccedb84b6deeb701625973703))
* **review:** 更新 README 文档格式和徽章 ([5bdb6aa](https://github.com/Lydanne/spaceflow/commit/5bdb6aabbdc8264da8fbd4567ebe6efdbd40e9f4))
* 更新 README 文档，统一术语为“扩展” ([6c0a612](https://github.com/Lydanne/spaceflow/commit/6c0a61260e450f3b952749019483069369388e2b))

### 其他修改

* **ci-scripts:** released version 0.19.1 [no ci] ([9f24102](https://github.com/Lydanne/spaceflow/commit/9f2410204dcffd20678a529c0a94fee461c436c8))
* **ci-shell:** released version 0.19.1 [no ci] ([b58c112](https://github.com/Lydanne/spaceflow/commit/b58c1128f55491a551d71d45792a8af1a009dafd))
* **cli:** released version 0.19.2 [no ci] ([e6c7488](https://github.com/Lydanne/spaceflow/commit/e6c7488675e88910ddadc15924e6ca5beca05f1d))
* **core:** released version 0.1.2 [no ci] ([cc6f4af](https://github.com/Lydanne/spaceflow/commit/cc6f4afe2ad57cf482e11d9af80dddf50b53868c))
* **period-summary:** released version 0.19.1 [no ci] ([4338a6d](https://github.com/Lydanne/spaceflow/commit/4338a6d8c4b7f8335d1adfc2ccce2cc7bb1568c8))

## [0.21.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.20.0...@spaceflow/publish@0.21.0) (2026-02-15)

### 新特性

* **cli:** 新增 MCP Server 命令并集成 review 扩展的 MCP 工具 ([b794b36](https://git.bjxgj.com/xgj/spaceflow/commit/b794b36d90788c7eb4cbb253397413b4a080ae83))
* **cli:** 新增 MCP Server 导出类型支持 ([9568cbd](https://git.bjxgj.com/xgj/spaceflow/commit/9568cbd14d4cfbdedaf2218379c72337af6db271))
* **core:** 为所有命令添加 i18n 国际化支持 ([867c5d3](https://git.bjxgj.com/xgj/spaceflow/commit/867c5d3eccc285c8a68803b8aa2f0ffb86a94285))
* **core:** 新增 GitLab 平台适配器并完善配置支持 ([47be9ad](https://git.bjxgj.com/xgj/spaceflow/commit/47be9adfa90944a9cb183e03286a7a96fec747f1))
* **core:** 新增 Logger 全局日志工具并支持 plain/tui 双模式渲染 ([8baae7c](https://git.bjxgj.com/xgj/spaceflow/commit/8baae7c24139695a0e379e1c874023cd61dfc41b))
* **docs:** 新增 VitePress 文档站点并完善项目文档 ([a79d620](https://git.bjxgj.com/xgj/spaceflow/commit/a79d6208e60390a44fa4c94621eb41ae20159e98))
* **mcp:** 新增 MCP Inspector 交互式调试支持并优化工具日志输出 ([05fd2ee](https://git.bjxgj.com/xgj/spaceflow/commit/05fd2ee941c5f6088b769d1127cb7c0615626f8c))
* **review:** 为 MCP 服务添加 i18n 国际化支持 ([a749054](https://git.bjxgj.com/xgj/spaceflow/commit/a749054eb73b775a5f5973ab1b86c04f2b2ddfba))
* **review:** 新增规则级 includes 解析测试并修复文件级/规则级 includes 过滤逻辑 ([4baca71](https://git.bjxgj.com/xgj/spaceflow/commit/4baca71c17782fb92a95b3207f9c61e0b410b9ff))

### 修复BUG

* **actions:** 修正 pnpm setup 命令调用方式 ([8f014fa](https://git.bjxgj.com/xgj/spaceflow/commit/8f014fa90b74e20de4c353804d271b3ef6f1288f))
* **mcp:** 添加 -y 选项确保 Inspector 自动安装依赖 ([a9201f7](https://git.bjxgj.com/xgj/spaceflow/commit/a9201f74bd9ddc5eba92beaaa676f377842863e0))

### 代码重构

* **claude:** 移除 .claude 目录及其 .gitignore 配置文件 ([91916a9](https://git.bjxgj.com/xgj/spaceflow/commit/91916a99f65da31c1d34e6f75b5cbea1d331ba35))
* **cli:** 优化依赖安装流程并支持 .spaceflow 目录配置 ([5977631](https://git.bjxgj.com/xgj/spaceflow/commit/597763183eaa61bb024bba2703d75239650b54fb))
* **cli:** 拆分 CLI 为独立包并重构扩展加载机制 ([b385d28](https://git.bjxgj.com/xgj/spaceflow/commit/b385d281575f29b823bb6dc4229a396a29c0e226))
* **cli:** 移除 ExtensionModule 并优化扩展加载机制 ([8f7077d](https://git.bjxgj.com/xgj/spaceflow/commit/8f7077deaef4e5f4032662ff5ac925cd3c07fdb6))
* **cli:** 调整依赖顺序并格式化导入语句 ([32a9c1c](https://git.bjxgj.com/xgj/spaceflow/commit/32a9c1cf834725a20f93b1f8f60b52692841a3e5))
* **cli:** 重构 getPluginConfigFromPackageJson 方法以提高代码可读性 ([f5f6ed9](https://git.bjxgj.com/xgj/spaceflow/commit/f5f6ed9858cc4ca670e30fac469774bdc8f7b005))
* **cli:** 重构扩展配置格式，支持 flow/command/skill 三种导出类型 ([958dc13](https://git.bjxgj.com/xgj/spaceflow/commit/958dc130621f78bbcc260224da16a5f16ae0b2b1))
* **core:** 为 build/clear/commit 命令添加国际化支持 ([de82cb2](https://git.bjxgj.com/xgj/spaceflow/commit/de82cb2f1ed8cef0e446a2d42a1bf1f091e9c421))
* **core:** 优化 list 命令输出格式并修复 MCP Inspector 包管理器兼容性 ([a019829](https://git.bjxgj.com/xgj/spaceflow/commit/a019829d3055c083aeb86ed60ce6629d13012d91))
* **core:** 将 rspack 配置和工具函数中的 @spaceflow/cli 引用改为 @spaceflow/core ([3c301c6](https://git.bjxgj.com/xgj/spaceflow/commit/3c301c60f3e61b127db94481f5a19307f5ef00eb))
* **core:** 将扩展依赖从 @spaceflow/cli 迁移到 @spaceflow/core ([6f9ffd4](https://git.bjxgj.com/xgj/spaceflow/commit/6f9ffd4061cecae4faaf3d051e3ca98a0b42b01f))
* **core:** 提取 source 处理和包管理器工具函数到共享模块 ([ab3ff00](https://git.bjxgj.com/xgj/spaceflow/commit/ab3ff003d1cd586c0c4efc7841e6a93fe3477ace))
* **core:** 新增 getEnvFilePaths 工具函数统一管理 .env 文件路径优先级 ([809fa18](https://git.bjxgj.com/xgj/spaceflow/commit/809fa18f3d0b8eabcb068988bab53d548eaf03ea))
* **core:** 新增远程仓库规则拉取功能并支持 Git API 获取目录内容 ([69ade16](https://git.bjxgj.com/xgj/spaceflow/commit/69ade16c9069f9e1a90b3ef56dc834e33a3c0650))
* **core:** 统一 LogLevel 类型定义并支持字符串/数字双模式 ([557f6b0](https://git.bjxgj.com/xgj/spaceflow/commit/557f6b0bc39fcfb0e3f773836cbbf08c1a8790ae))
* **core:** 重构配置读取逻辑,新增 ConfigReaderService 并支持 .spaceflowrc 配置文件 ([72e88ce](https://git.bjxgj.com/xgj/spaceflow/commit/72e88ced63d03395923cdfb113addf4945162e54))
* **i18n:** 将 locales 导入从命令文件迁移至扩展入口文件 ([0da5d98](https://git.bjxgj.com/xgj/spaceflow/commit/0da5d9886296c4183b24ad8c56140763f5a870a4))
* **i18n:** 移除扩展元数据中的 locales 字段并改用 side-effect 自动注册 ([2c7d488](https://git.bjxgj.com/xgj/spaceflow/commit/2c7d488a9dfa59a99b95e40e3c449c28c2d433d8))
* **mcp:** 使用 DTO + Swagger 装饰器替代手动 JSON Schema 定义 ([87ec262](https://git.bjxgj.com/xgj/spaceflow/commit/87ec26252dd295536bb090ae8b7e418eec96e1bd))
* **mcp:** 升级 MCP SDK API 并优化 Inspector 调试配置 ([176d04a](https://git.bjxgj.com/xgj/spaceflow/commit/176d04a73fbbb8d115520d922f5fedb9a2961aa6))
* **mcp:** 将 MCP 元数据存储从 Reflect Metadata 改为静态属性以支持跨模块访问 ([cac0ea2](https://git.bjxgj.com/xgj/spaceflow/commit/cac0ea2029e1b504bc4278ce72b3aa87fff88c84))
* **test:** 迁移测试框架从 Jest 到 Vitest ([308f9d4](https://git.bjxgj.com/xgj/spaceflow/commit/308f9d49089019530588344a5e8880f5b6504a6a))
* 优化构建流程并调整 MCP/review 日志输出级别 ([74072c0](https://git.bjxgj.com/xgj/spaceflow/commit/74072c04be7a45bfc0ab53b636248fe5c0e1e42a))
* 将 .spaceflow/package.json 纳入版本控制并自动添加到根项目依赖 ([ab83d25](https://git.bjxgj.com/xgj/spaceflow/commit/ab83d2579cb5414ee3d78a9768fac2147a3d1ad9))
* 将 GiteaSdkModule/GiteaSdkService 重命名为 GitProviderModule/GitProviderService ([462f492](https://git.bjxgj.com/xgj/spaceflow/commit/462f492bc2607cf508c5011d181c599cf17e00c9))
* 恢复 pnpm catalog 配置并移除 .spaceflow 工作区导入器 ([217387e](https://git.bjxgj.com/xgj/spaceflow/commit/217387e2e8517a08162e9bcaf604893fd9bca736))
* 迁移扩展依赖到 .spaceflow 工作区并移除 pnpm catalog ([c457c0f](https://git.bjxgj.com/xgj/spaceflow/commit/c457c0f8918171f1856b88bc007921d76c508335))
* 重构 Extension 安装机制为 pnpm workspace 模式 ([469b12e](https://git.bjxgj.com/xgj/spaceflow/commit/469b12eac28f747b628e52a5125a3d5a538fba39))
* 重构插件加载改为扩展模式 ([0e6e140](https://git.bjxgj.com/xgj/spaceflow/commit/0e6e140b19ea2cf6084afc261c555d2083fe04f9))

### 文档更新

* **guide:** 更新编辑器集成文档,补充四种导出类型说明和 MCP 注册机制 ([19a7409](https://git.bjxgj.com/xgj/spaceflow/commit/19a7409092c89d002f11ee51ebcb6863118429bd))
* **guide:** 更新配置文件位置说明并补充 RC 文件支持 ([2214dc4](https://git.bjxgj.com/xgj/spaceflow/commit/2214dc4e197221971f5286b38ceaa6fcbcaa7884))

### 测试用例

* **core:** 新增 GiteaAdapter 完整单元测试并实现自动检测 provider 配置 ([c74f745](https://git.bjxgj.com/xgj/spaceflow/commit/c74f7458aed91ac7d12fb57ef1c24b3d2917c406))
* **review:** 新增 DeletionImpactService 测试覆盖并配置 coverage 工具 ([50bfbfe](https://git.bjxgj.com/xgj/spaceflow/commit/50bfbfe37192641f1170ade8f5eb00e0e382af67))

### 其他修改

* **ci-scripts:** released version 0.19.0 [no ci] ([9f747c6](https://git.bjxgj.com/xgj/spaceflow/commit/9f747c617b387e105e92b4a5dcd0f5d3cf51c26d))
* **ci-shell:** released version 0.19.0 [no ci] ([59ac30d](https://git.bjxgj.com/xgj/spaceflow/commit/59ac30da6802a9493c33e560ea9121d378597e89))
* **ci:** 迁移工作流从 Gitea 到 GitHub 并统一环境变量命名 ([57e3bae](https://git.bjxgj.com/xgj/spaceflow/commit/57e3bae635b324c8c4ea50a9fb667b6241fae0ef))
* **cli:** released version 0.19.0 [no ci] ([6b63149](https://git.bjxgj.com/xgj/spaceflow/commit/6b631499e2407a1822395d5f40cec2d725331b78))
* **config:** 将 git 推送白名单用户从 "Gitea Actions" 改为 "GiteaActions" ([fdbb865](https://git.bjxgj.com/xgj/spaceflow/commit/fdbb865341e6f02b26fca32b54a33b51bee11cad))
* **config:** 将 git 推送白名单用户从 github-actions[bot] 改为 Gitea Actions ([9c39819](https://git.bjxgj.com/xgj/spaceflow/commit/9c39819a9f95f415068f7f0333770b92bc98321b))
* **config:** 移除 review-spec 私有仓库依赖 ([8ae18f1](https://git.bjxgj.com/xgj/spaceflow/commit/8ae18f13c441b033d1cbc75119695a5cc5cb6a0b))
* **core:** released version 0.1.0 [no ci] ([170fa67](https://git.bjxgj.com/xgj/spaceflow/commit/170fa670e98473c2377120656d23aae835c51997))
* **core:** 禁用 i18next 初始化时的 locize.com 推广日志 ([a99fbb0](https://git.bjxgj.com/xgj/spaceflow/commit/a99fbb068441bc623efcf15a1dd7b6bd38c05f38))
* **deps:** 移除 pnpm catalog 配置并更新依赖锁定 ([753fb9e](https://git.bjxgj.com/xgj/spaceflow/commit/753fb9e3e43b28054c75158193dc39ab4bab1af5))
* **docs:** 统一文档脚本命名,为 VitePress 命令添加 docs: 前缀 ([3cc46ea](https://git.bjxgj.com/xgj/spaceflow/commit/3cc46eab3a600290f5064b8270902e586b9c5af4))
* **i18n:** 配置 i18n-ally-next 自动提取键名生成策略 ([753c3dc](https://git.bjxgj.com/xgj/spaceflow/commit/753c3dc3f24f3c03c837d1ec2c505e8e3ce08b11))
* **i18n:** 重构 i18n 配置并统一 locales 目录结构 ([3e94037](https://git.bjxgj.com/xgj/spaceflow/commit/3e94037fa6493b3b0e4a12ff6af9f4bea48ae217))
* **period-summary:** released version 0.19.0 [no ci] ([b833948](https://git.bjxgj.com/xgj/spaceflow/commit/b83394888ac47ae8d91bfd9317980f56bd322b34))
* **review:** released version 0.28.0 [no ci] ([a2d89ed](https://git.bjxgj.com/xgj/spaceflow/commit/a2d89ed5f386eb6dd299c0d0a208856ce267ab5e))
* **scripts:** 修正 setup 和 build 脚本的过滤条件,避免重复构建 cli 包 ([ffd2ffe](https://git.bjxgj.com/xgj/spaceflow/commit/ffd2ffedca08fd56cccb6a9fbd2b6bd106e367b6))
* **templates:** 新增 MCP 工具插件模板 ([5f6df60](https://git.bjxgj.com/xgj/spaceflow/commit/5f6df60b60553f025414fd102d8a279cde097485))
* **workflows:** 为所有 GitHub Actions 工作流添加 GIT_PROVIDER_TYPE 环境变量 ([a463574](https://git.bjxgj.com/xgj/spaceflow/commit/a463574de6755a0848a8d06267f029cb947132b0))
* **workflows:** 在发布流程中添加 GIT_PROVIDER_TYPE 环境变量 ([a4bb388](https://git.bjxgj.com/xgj/spaceflow/commit/a4bb3881f39ad351e06c5502df6895805b169a28))
* **workflows:** 在发布流程中添加扩展安装步骤 ([716be4d](https://git.bjxgj.com/xgj/spaceflow/commit/716be4d92641ccadb3eaf01af8a51189ec5e9ade))
* **workflows:** 将发布流程的 Git 和 NPM 配置从 GitHub 迁移到 Gitea ([6d9acff](https://git.bjxgj.com/xgj/spaceflow/commit/6d9acff06c9a202432eb3d3d5552e6ac972712f5))
* **workflows:** 将发布流程的 GITHUB_TOKEN 改为使用 CI_GITEA_TOKEN ([e7fe7b4](https://git.bjxgj.com/xgj/spaceflow/commit/e7fe7b4271802fcdbfc2553b180f710eed419335))
* 为所有 commands 包添加 @spaceflow/cli 开发依赖 ([d4e6c83](https://git.bjxgj.com/xgj/spaceflow/commit/d4e6c8344ca736f7e55d7db698482e8fa2445684))
* 优化依赖配置并移除 .spaceflow 包依赖 ([be5264e](https://git.bjxgj.com/xgj/spaceflow/commit/be5264e5e0fe1f53bbe3b44a9cb86dd94ab9d266))
* 修正 postinstall 脚本命令格式 ([3f0820f](https://git.bjxgj.com/xgj/spaceflow/commit/3f0820f85dee88808de921c3befe2d332f34cc36))
* 恢复 pnpm catalog 配置并更新依赖锁定 ([0b2295c](https://git.bjxgj.com/xgj/spaceflow/commit/0b2295c1f906d89ad3ba7a61b04c6e6b94f193ef))
* 新增 .spaceflow/pnpm-workspace.yaml 防止被父级 workspace 接管并移除根项目 devDependencies 自动添加逻辑 ([61de3a2](https://git.bjxgj.com/xgj/spaceflow/commit/61de3a2b75e8a19b28563d2a6476158d19f6c5be))
* 新增 postinstall 钩子自动执行 setup 脚本 ([64dae0c](https://git.bjxgj.com/xgj/spaceflow/commit/64dae0cb440bd5e777cb790f826ff2d9f8fe65ba))
* 移除 postinstall 钩子避免依赖安装时自动执行构建 ([ea1dc85](https://git.bjxgj.com/xgj/spaceflow/commit/ea1dc85ce7d6cf23a98c13e2c21e3c3bcdf7dd79))

## [0.20.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.19.0...@spaceflow/publish@0.20.0) (2026-02-04)

### 代码重构

* **verbose:** 扩展 verbose 级别支持至 3 ([c1a0808](https://git.bjxgj.com/xgj/spaceflow/commit/c1a080859e5d25ca1eb3dc7e00a67b32eb172635))

### 其他修改

* **ci-scripts:** released version 0.18.0 [no ci] ([e17894a](https://git.bjxgj.com/xgj/spaceflow/commit/e17894a5af53ff040a0a17bc602d232f78415e1b))
* **ci-shell:** released version 0.18.0 [no ci] ([f64fd80](https://git.bjxgj.com/xgj/spaceflow/commit/f64fd8009a6dd725f572c7e9fbf084d9320d5128))
* **core:** released version 0.18.0 [no ci] ([c5e973f](https://git.bjxgj.com/xgj/spaceflow/commit/c5e973fbe22c0fcd0d6d3af6e4020e2fbff9d31f))
* **period-summary:** released version 0.18.0 [no ci] ([f0df638](https://git.bjxgj.com/xgj/spaceflow/commit/f0df63804d06f8c75e04169ec98226d7a4f5d7f9))
* **review:** released version 0.27.0 [no ci] ([ac3fc5a](https://git.bjxgj.com/xgj/spaceflow/commit/ac3fc5a5d7317d537d0447e05a61bef15a1accbe))

## [0.19.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.18.0...@spaceflow/publish@0.19.0) (2026-02-04)

### 新特性

- **review:** 新增 override 作用域测试,验证 includes 对 override 过滤的影响 ([820e0cb](https://git.bjxgj.com/xgj/spaceflow/commit/820e0cb0f36783dc1c7e1683ad08501e91f094b2))

### 修复BUG

- **core:** 从 PR diff 填充缺失的 patch 字段 ([24bfaa7](https://git.bjxgj.com/xgj/spaceflow/commit/24bfaa76f3bd56c8ead307e73e0623a2221c69cf))
- **review:** 新增 getFileContents、getChangedFilesBetweenRefs 和 filterIssuesByValidCommits 方法的单元测试 ([7618c91](https://git.bjxgj.com/xgj/spaceflow/commit/7618c91bc075d218b9f51b862e5161d15a306bf8))

### 代码重构

- **config:** 降低并发数以优化 AI 审查性能 ([052dd72](https://git.bjxgj.com/xgj/spaceflow/commit/052dd728f759da0a31e86a0ad480e9bb35052781))
- **review:** 优化 Markdown 格式化器的代码风格和 JSON 数据输出逻辑 ([ca1b0c9](https://git.bjxgj.com/xgj/spaceflow/commit/ca1b0c96d9d0663a8b8dc93b4a9f63d4e5590df0))
- **review:** 优化 override 和变更行过滤的日志输出,增强调试信息的可读性 ([9a7c6f5](https://git.bjxgj.com/xgj/spaceflow/commit/9a7c6f5b4ef2b8ae733fa499a0e5ec82feebc1d2))
- **review:** 使用 Base64 编码存储审查数据,避免 JSON 格式在 Markdown 中被转义 ([fb91e30](https://git.bjxgj.com/xgj/spaceflow/commit/fb91e30d0979cfe63ed8e7657c578db618b5e783))
- **review:** 基于 fileContents 实际 commit hash 验证问题归属,替代依赖 LLM 填写的 commit 字段 ([de3e377](https://git.bjxgj.com/xgj/spaceflow/commit/de3e3771eb85ff93200c63fa9feb38941914a07d))
- **review:** 新增测试方法用于验证 PR 审查功能 ([5c57833](https://git.bjxgj.com/xgj/spaceflow/commit/5c578332cedffb7fa7e5ad753a788bcd55595c68))
- **review:** 移除 filterNoCommit 配置项,统一使用基于 commit hash 的问题过滤逻辑 ([82429b1](https://git.bjxgj.com/xgj/spaceflow/commit/82429b1072affb4f2b14d52f99887e12184d8218))
- **review:** 移除测试方法 testMethod ([21e9938](https://git.bjxgj.com/xgj/spaceflow/commit/21e9938100c5dd7d4eada022441c565b5c41a55a))
- **review:** 统一使用 parseLineRange 方法解析行号,避免重复的正则匹配逻辑 ([c64f96a](https://git.bjxgj.com/xgj/spaceflow/commit/c64f96aa2e1a8e22dcd3e31e1a2acc1bb338a1a8))
- **review:** 调整 filterIssuesByValidCommits 逻辑,保留无 commit 的 issue 交由 filterNoCommit 配置处理 ([e9c5d47](https://git.bjxgj.com/xgj/spaceflow/commit/e9c5d47aebef42507fd9fcd67e5eab624437e81a))
- **review:** 过滤 merge commits,避免在代码审查中处理合并提交 ([d7c647c](https://git.bjxgj.com/xgj/spaceflow/commit/d7c647c33156a58b42bfb45a67417723b75328c6))
- **review:** 过滤非 PR commits 的问题,避免 merge commit 引入的代码被审查 ([9e20f54](https://git.bjxgj.com/xgj/spaceflow/commit/9e20f54d57e71725432dfb9e7c943946aa6677d4))

### 测试用例

- **review:** 新增新增文件无 patch 时的测试用例,优化变更行标记逻辑 ([a593f0d](https://git.bjxgj.com/xgj/spaceflow/commit/a593f0d4a641b348f7c9d30b14f639b24c12dcfa))

### 其他修改

- **ci-scripts:** released version 0.17.0 [no ci] ([31abd3d](https://git.bjxgj.com/xgj/spaceflow/commit/31abd3dcb48e2ddea5175552c0a87c1eaa1e7a41))
- **ci-shell:** released version 0.17.0 [no ci] ([a53508b](https://git.bjxgj.com/xgj/spaceflow/commit/a53508b15e4020e3399bae9cc04e730f1539ad8e))
- **core:** released version 0.17.0 [no ci] ([c85a8ed](https://git.bjxgj.com/xgj/spaceflow/commit/c85a8ed88929d867d2d460a44d08d8b7bc4866a2))
- **period-summary:** released version 0.17.0 [no ci] ([ac4e5b6](https://git.bjxgj.com/xgj/spaceflow/commit/ac4e5b6083773146ac840548a69006f6c4fbac1d))
- **review:** released version 0.20.0 [no ci] ([8b0f82f](https://git.bjxgj.com/xgj/spaceflow/commit/8b0f82f94813c79d579dbae8decb471b20e45e9d))
- **review:** released version 0.21.0 [no ci] ([b51a1dd](https://git.bjxgj.com/xgj/spaceflow/commit/b51a1ddcba3e6a4b3b3eb947864e731d8f87d62b))
- **review:** released version 0.22.0 [no ci] ([fca3bfc](https://git.bjxgj.com/xgj/spaceflow/commit/fca3bfc0c53253ac78566e88c7e5d31020a3896b))
- **review:** released version 0.23.0 [no ci] ([ed5bf22](https://git.bjxgj.com/xgj/spaceflow/commit/ed5bf22819094df070708c2724669d0b5f7b9008))
- **review:** released version 0.24.0 [no ci] ([5f1f94e](https://git.bjxgj.com/xgj/spaceflow/commit/5f1f94ee02123baa05802fb2bb038ccf9d50a0cc))
- **review:** released version 0.25.0 [no ci] ([69cfeaf](https://git.bjxgj.com/xgj/spaceflow/commit/69cfeaf768e4bf7b2aaba6f089064469338a1ac0))
- **review:** released version 0.26.0 [no ci] ([dec9c7e](https://git.bjxgj.com/xgj/spaceflow/commit/dec9c7ec66455cf83588368c930d12510ada6c0f))

## [0.18.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.17.0...@spaceflow/publish@0.18.0) (2026-02-02)

### 新特性

- **core:** 新增 Git diff 行号映射工具并优化 Claude 配置 ([88ef340](https://git.bjxgj.com/xgj/spaceflow/commit/88ef3400127fac3ad52fc326ad79fdc7bd058e98))
- **review:** 为 execute 方法添加文档注释 ([a21f582](https://git.bjxgj.com/xgj/spaceflow/commit/a21f58290c873fb07789e70c8c5ded2b5874a29d))
- **review:** 为 getPrNumberFromEvent 方法添加文档注释 ([54d1586](https://git.bjxgj.com/xgj/spaceflow/commit/54d1586f4558b5bfde81b926c7b513a32e5caf89))
- **review:** 优化行号更新统计,分别统计更新和标记无效的问题数量 ([892b8be](https://git.bjxgj.com/xgj/spaceflow/commit/892b8bed8913531a9440579f777b1965fec772e5))

### 代码重构

- **review:** 优化历史 issue commit 匹配逻辑,支持短 SHA 与完整 SHA 的前缀匹配 ([e30c6dd](https://git.bjxgj.com/xgj/spaceflow/commit/e30c6ddefb14ec6631ce341f1d45c59786e94a46))
- **review:** 简化历史问题处理策略,将行号更新改为标记变更文件问题为无效 ([5df7f00](https://git.bjxgj.com/xgj/spaceflow/commit/5df7f0087c493e104fe0dc054fd0b6c19ebe3500))
- **review:** 简化行号更新逻辑,使用最新 commit diff 替代增量 diff ([6de7529](https://git.bjxgj.com/xgj/spaceflow/commit/6de7529c90ecbcee82149233fc01c393c5c4e7f7))
- **review:** 重构行号更新逻辑,使用增量 diff 替代全量 diff ([d4f4304](https://git.bjxgj.com/xgj/spaceflow/commit/d4f4304e1e41614f7be8946d457eea1cf4e202fb))

### 测试用例

- **review:** 添加单元测试以覆盖行号更新逻辑 ([ebf33e4](https://git.bjxgj.com/xgj/spaceflow/commit/ebf33e45c18c910b88b106cdd4cfeb516b3fb656))

### 其他修改

- **actions:** 增强命令执行日志,输出原始 command 和 args 参数 ([0f0c238](https://git.bjxgj.com/xgj/spaceflow/commit/0f0c238de7d6f10875022f364746cefa56631b7f))
- **ci-scripts:** released version 0.16.0 [no ci] ([9ab007d](https://git.bjxgj.com/xgj/spaceflow/commit/9ab007db178878e093ba93ea27c4f05ca813a65d))
- **ci-shell:** released version 0.16.0 [no ci] ([87fd703](https://git.bjxgj.com/xgj/spaceflow/commit/87fd7030b54d2f614f23e092499c5c51bfc33788))
- **core:** released version 0.16.0 [no ci] ([871f981](https://git.bjxgj.com/xgj/spaceflow/commit/871f981b0b908c981aaef366f2382ec6ca2e2269))
- **period-summary:** released version 0.16.0 [no ci] ([b214e31](https://git.bjxgj.com/xgj/spaceflow/commit/b214e31221d5afa04481c48d9ddb878644a22ae7))
- **review:** released version 0.19.0 [no ci] ([0ba5c0a](https://git.bjxgj.com/xgj/spaceflow/commit/0ba5c0a39879b598da2d774acc0834c590ef6d4c))
- 在 PR 审查工作流中启用 --filter-no-commit 参数 ([e0024ad](https://git.bjxgj.com/xgj/spaceflow/commit/e0024ad5cb29250b452a841db2ce6ebf84016a2c))
- 禁用删除代码分析功能 ([988e3f1](https://git.bjxgj.com/xgj/spaceflow/commit/988e3f156f2ca4e92413bf7a455eba1760ad9eba))

## [0.17.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.16.0...@spaceflow/publish@0.17.0) (2026-02-02)

### 新特性

- **core:** 在 Gitea SDK 中新增编辑 Pull Request 的方法 ([a586bf1](https://git.bjxgj.com/xgj/spaceflow/commit/a586bf110789578f23b39d64511229a1e5635dc4))
- **core:** 在 Gitea SDK 中新增获取 reactions 的方法 ([9324cf2](https://git.bjxgj.com/xgj/spaceflow/commit/9324cf2550709b8302171e5522d0792c08bc1415))
- **review:** 优化 commit author 获取逻辑,支持 committer 作为备选 ([b75b613](https://git.bjxgj.com/xgj/spaceflow/commit/b75b6133e5b8c95580516480315bc979fc6eb59b))
- **review:** 优化 commit author 获取逻辑,支持从 Git 原始作者信息中提取 ([10ac821](https://git.bjxgj.com/xgj/spaceflow/commit/10ac8210a4457e0356c3bc1645f54f6f3d8c904c))
- **review:** 优化 commit author 获取逻辑,通过 Gitea API 搜索用户以关联 Git 原始作者 ([daa274b](https://git.bjxgj.com/xgj/spaceflow/commit/daa274bba2255e92d1e9a6e049e20846a69e8df7))
- **review:** 优化 PR 标题生成的格式要求 ([a4d807d](https://git.bjxgj.com/xgj/spaceflow/commit/a4d807d0a4feee4ccc88c6096e069c6dbb650a03))
- **review:** 优化 verbose 参数支持多级别累加,将日志级别扩展为 0-3 级 ([fe4c830](https://git.bjxgj.com/xgj/spaceflow/commit/fe4c830cac137c5502d700d2cd5f22b52a629e5f))
- **review:** 优化历史问题的 author 信息填充逻辑 ([b18d171](https://git.bjxgj.com/xgj/spaceflow/commit/b18d171c9352fe5815262d43ffd9cd7751f03a4e))
- **review:** 优化审查报告中回复消息的格式显示 ([f478c8d](https://git.bjxgj.com/xgj/spaceflow/commit/f478c8da4c1d7494819672006e3230dbc8e0924d))
- **review:** 优化审查报告中的消息展示格式 ([0996c2b](https://git.bjxgj.com/xgj/spaceflow/commit/0996c2b45c9502c84308f8a7f9186e4dbd4164fb))
- **review:** 优化问题 author 信息填充时机,统一在所有问题合并后填充 ([ea8c586](https://git.bjxgj.com/xgj/spaceflow/commit/ea8c586fc60061ffd339e85c6c298b905bdfdcd8))
- **review:** 优化问题展示和无效标记逻辑 ([e2b45e1](https://git.bjxgj.com/xgj/spaceflow/commit/e2b45e1ec594488bb79f528911fd6009a3213eca))
- **review:** 在 fillIssueAuthors 方法中添加详细的调试日志 ([42ab288](https://git.bjxgj.com/xgj/spaceflow/commit/42ab288933296abdeeb3dbbedbb2aecedbea2251))
- **review:** 在 syncReactionsToIssues 中添加详细日志并修复团队成员获取逻辑 ([91f166a](https://git.bjxgj.com/xgj/spaceflow/commit/91f166a07c2e43dabd4dd4ac186ec7b5f03dfc71))
- **review:** 在审查报告的回复中为用户名添加 @ 前缀 ([bc6186b](https://git.bjxgj.com/xgj/spaceflow/commit/bc6186b97f0764f6335690eca1f8af665f9b7629))
- **review:** 在审查问题中添加作者信息填充功能 ([8332dba](https://git.bjxgj.com/xgj/spaceflow/commit/8332dba4bb826cd358dc96db5f9b9406fb23df9b))
- **review:** 将审查命令的详细日志参数从 --verbose 简化为 -vv ([5eb320b](https://git.bjxgj.com/xgj/spaceflow/commit/5eb320b92d1f7165052730b2e90eee52367391dd))
- **review:** 扩展评审人收集逻辑,支持从 PR 指定的评审人和团队中获取 ([bbd61af](https://git.bjxgj.com/xgj/spaceflow/commit/bbd61af9d3e2b9e1dcf28c5e3867645fdda52e6f))
- **review:** 支持 AI 自动生成和更新 PR 标题 ([e02fb02](https://git.bjxgj.com/xgj/spaceflow/commit/e02fb027d525dd3e794d649e6dbc53c99a3a9a59))
- **review:** 支持 PR 关闭事件触发审查并自动传递事件类型参数 ([03967d9](https://git.bjxgj.com/xgj/spaceflow/commit/03967d9e860af7da06e3c04539f16c7bb31557ff))
- **review:** 支持在审查报告中展示评论的 reactions 和回复记录 ([f4da31a](https://git.bjxgj.com/xgj/spaceflow/commit/f4da31adf6ce412cb0ce27bfe7a1e87e5350e915))
- **review:** 移除 handleReview 中的重复 author 填充逻辑 ([e458bfd](https://git.bjxgj.com/xgj/spaceflow/commit/e458bfd0d21724c37fdd4023265d6a2dd1700404))
- **review:** 限制 PR 标题自动更新仅在第一轮审查时执行 ([1891cbc](https://git.bjxgj.com/xgj/spaceflow/commit/1891cbc8d85f6eaef9e7107a7f1003bdc654d3a3))
- **review:** 默认启用 PR 标题自动更新功能 ([fda6656](https://git.bjxgj.com/xgj/spaceflow/commit/fda6656efaf6479bb398ddc5cb1955142f31f369))

### 修复BUG

- **actions:** 修复日志输出中的 emoji 显示问题,将 � 替换为 ℹ️ ([d3cd94a](https://git.bjxgj.com/xgj/spaceflow/commit/d3cd94afa9c6893b923d316fdcb5904f42ded632))
- **review:** 修复审查完成日志中的乱码 emoji ([36c1c48](https://git.bjxgj.com/xgj/spaceflow/commit/36c1c48faecda3cc02b9e0b097aebba0a85ea5f8))
- **review:** 将 UserInfo 的 id 字段类型从 number 改为 string ([505e019](https://git.bjxgj.com/xgj/spaceflow/commit/505e019c85d559ce1def1350599c1de218f7516a))

### 其他修改

- **ci-scripts:** released version 0.15.0 [no ci] ([e314fb1](https://git.bjxgj.com/xgj/spaceflow/commit/e314fb11e7425b27c337d3650857cf3b737051fd))
- **ci-shell:** released version 0.15.0 [no ci] ([5c0dc0b](https://git.bjxgj.com/xgj/spaceflow/commit/5c0dc0b5482366ccfd7854868d1eb5f306c24810))
- **core:** released version 0.15.0 [no ci] ([48f3875](https://git.bjxgj.com/xgj/spaceflow/commit/48f38754dee382548bab968c57dd0f40f2343981))
- **period-summary:** released version 0.15.0 [no ci] ([3dd72cb](https://git.bjxgj.com/xgj/spaceflow/commit/3dd72cb65a422b5b008a83820e799b810a6d53eb))
- **review:** released version 0.18.0 [no ci] ([d366e3f](https://git.bjxgj.com/xgj/spaceflow/commit/d366e3fa9c1b32369a3d98e56fc873e033d71d00))

## [0.16.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.15.0...@spaceflow/publish@0.16.0) (2026-01-31)

### 修复BUG

- **core:** 统一所有命令的错误处理,添加堆栈信息输出 ([31224a1](https://git.bjxgj.com/xgj/spaceflow/commit/31224a16ce7155402504bd8d3e386e59e47949df))
- **review:** 增强错误处理,添加堆栈信息输出 ([e0fb5de](https://git.bjxgj.com/xgj/spaceflow/commit/e0fb5de6bc877d8f0b3dc3c03f8d614320427bf3))

### 其他修改

- **ci-scripts:** released version 0.14.0 [no ci] ([c536208](https://git.bjxgj.com/xgj/spaceflow/commit/c536208e352baa82e5b56c490ea9df0aff116cb2))
- **ci-shell:** released version 0.14.0 [no ci] ([c6e4bdc](https://git.bjxgj.com/xgj/spaceflow/commit/c6e4bdca44874739694e3e46998e376779503e53))
- **core:** released version 0.14.0 [no ci] ([996dbc6](https://git.bjxgj.com/xgj/spaceflow/commit/996dbc6f80b0d3fb8049df9a9a31bd1e5b5d4b92))
- **period-summary:** released version 0.14.0 [no ci] ([55a72f2](https://git.bjxgj.com/xgj/spaceflow/commit/55a72f2b481e5ded1d9207a5a8d6a6864328d5a0))
- **review:** released version 0.17.0 [no ci] ([9f25412](https://git.bjxgj.com/xgj/spaceflow/commit/9f254121557ae238e32f4093b0c8b5dd8a4b9a72))

## [0.15.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.14.0...@spaceflow/publish@0.15.0) (2026-01-31)

### 新特性

- **review:** 为删除影响分析添加文件过滤功能 ([7304293](https://git.bjxgj.com/xgj/spaceflow/commit/73042937c5271ff4b0dcb6cd6d823e5aa0c03e7b))
- **review:** 新增过滤无commit问题的选项 ([7a4c458](https://git.bjxgj.com/xgj/spaceflow/commit/7a4c458da03ae4a4646abca7e5f03abc849dc405))

### 修复BUG

- **core:** 修复 resolveRef 方法未处理空 ref 参数的问题 ([0824c83](https://git.bjxgj.com/xgj/spaceflow/commit/0824c8392482263036888b2fec95935371d67d4d))
- **review:** 修复参数空值检查，增强代码健壮性 ([792a192](https://git.bjxgj.com/xgj/spaceflow/commit/792a192fd5dd80ed1e6d85cd61f6ce997bcc9dd9))
- **review:** 修复按指定提交过滤时未处理空值导致的潜在问题 ([5d4d3e0](https://git.bjxgj.com/xgj/spaceflow/commit/5d4d3e0390a50c01309bb09e01c7328b211271b8))

### 其他修改

- **ci-scripts:** released version 0.13.0 [no ci] ([021eefd](https://git.bjxgj.com/xgj/spaceflow/commit/021eefdf2ff72d16b36123335548df2d3ad1d6b7))
- **ci-shell:** released version 0.13.0 [no ci] ([81e7582](https://git.bjxgj.com/xgj/spaceflow/commit/81e75820eb69ca188155e33945111e2b1f6b3012))
- **core:** released version 0.13.0 [no ci] ([e3edde3](https://git.bjxgj.com/xgj/spaceflow/commit/e3edde3e670c79544af9a7249d566961740a2284))
- **period-summary:** released version 0.13.0 [no ci] ([1d47460](https://git.bjxgj.com/xgj/spaceflow/commit/1d47460e40ba422a32865ccddd353e089eb91c6a))
- **review:** released version 0.13.0 [no ci] ([4214c44](https://git.bjxgj.com/xgj/spaceflow/commit/4214c4406ab5482b151ec3c00da376b1d3d50887))
- **review:** released version 0.14.0 [no ci] ([4165b05](https://git.bjxgj.com/xgj/spaceflow/commit/4165b05f8aab90d753193f3c1c2800e7f03ea4de))
- **review:** released version 0.15.0 [no ci] ([a2ab86d](https://git.bjxgj.com/xgj/spaceflow/commit/a2ab86d097943924749876769f0a144926178783))
- **review:** released version 0.16.0 [no ci] ([64c8866](https://git.bjxgj.com/xgj/spaceflow/commit/64c88666fc7e84ced013198d3a53a8c75c7889eb))

## [0.14.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.13.0...@spaceflow/publish@0.14.0) (2026-01-31)

### 新特性

- **core:** 为 CLI 入口文件添加 Node shebang 支持 ([0d787d3](https://git.bjxgj.com/xgj/spaceflow/commit/0d787d329e69f2b53d26ba04720d60625ca51efd))

### 其他修改

- **ci-scripts:** released version 0.12.0 [no ci] ([097863f](https://git.bjxgj.com/xgj/spaceflow/commit/097863f0c5cc46cb5cb930f14a6f379f60a13f08))
- **ci-shell:** released version 0.12.0 [no ci] ([274216f](https://git.bjxgj.com/xgj/spaceflow/commit/274216fc930dfbf8390d02e25c06efcb44980fed))
- **core:** released version 0.12.0 [no ci] ([1ce5034](https://git.bjxgj.com/xgj/spaceflow/commit/1ce50346d73a1914836333415f5ead9fbfa27be7))
- **period-summary:** released version 0.12.0 [no ci] ([38490aa](https://git.bjxgj.com/xgj/spaceflow/commit/38490aa75ab20789c5495a5d8d009867f954af4f))
- **review:** released version 0.12.0 [no ci] ([3da605e](https://git.bjxgj.com/xgj/spaceflow/commit/3da605ea103192070f1c63112ad896a33fbc4312))

## [0.13.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.12.0...@spaceflow/publish@0.13.0) (2026-01-29)

### 新特性

- **core:** 优化 commit message 的 scope 处理逻辑 ([42869dd](https://git.bjxgj.com/xgj/spaceflow/commit/42869dd4bde0a3c9bf8ffb827182775e2877a57b))
- **core:** 重构 commit 服务并添加结构化 commit message 支持 ([22b4db8](https://git.bjxgj.com/xgj/spaceflow/commit/22b4db8619b0ce038667ab42dea1362706887fc9))

### 其他修改

- **ci-scripts:** released version 0.11.0 [no ci] ([d4f5bba](https://git.bjxgj.com/xgj/spaceflow/commit/d4f5bba6f89e9e051dde8d313b6e102c6dadfa41))
- **ci-shell:** released version 0.11.0 [no ci] ([cf9e486](https://git.bjxgj.com/xgj/spaceflow/commit/cf9e48666197295f118396693abc08b680b3ddee))
- **core:** released version 0.11.0 [no ci] ([f0025c7](https://git.bjxgj.com/xgj/spaceflow/commit/f0025c792e332e8b8752597a27f654c0197c36eb))
- **period-summary:** released version 0.11.0 [no ci] ([b518887](https://git.bjxgj.com/xgj/spaceflow/commit/b518887bddd5a452c91148bac64d61ec64b0b509))
- **review:** released version 0.11.0 [no ci] ([150cd9d](https://git.bjxgj.com/xgj/spaceflow/commit/150cd9df7d380c26e6f3f7f0dfd027022f610e6e))

## [0.12.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.11.0...@spaceflow/publish@0.12.0) (2026-01-29)

### 新特性

- **core:** 优化 npm 包名处理逻辑 ([ae23ebd](https://git.bjxgj.com/xgj/spaceflow/commit/ae23ebdc3144b611e1aa8c4e66bf0db074d09798))
- **core:** 添加依赖更新功能 ([1a544eb](https://git.bjxgj.com/xgj/spaceflow/commit/1a544eb5e2b64396a0187d4518595e9dcb51d73e))
- **review:** 支持绝对路径转换为相对路径 ([9050f64](https://git.bjxgj.com/xgj/spaceflow/commit/9050f64b8ef67cb2c8df9663711a209523ae9d18))

### 其他修改

- **ci-scripts:** released version 0.10.0 [no ci] ([ca2daad](https://git.bjxgj.com/xgj/spaceflow/commit/ca2daada8b04bbe809e69a3d5bd9373e897c6f40))
- **ci-shell:** released version 0.10.0 [no ci] ([53864b8](https://git.bjxgj.com/xgj/spaceflow/commit/53864b8c2534cae265b8fbb98173a5b909682d4e))
- **core:** released version 0.10.0 [no ci] ([a80d34f](https://git.bjxgj.com/xgj/spaceflow/commit/a80d34fb647e107343a07a8793363b3b76320e81))
- **period-summary:** released version 0.10.0 [no ci] ([c1ca3bb](https://git.bjxgj.com/xgj/spaceflow/commit/c1ca3bb67fa7f9dbb4de152f0461d644f3044946))
- **review:** released version 0.10.0 [no ci] ([6465de8](https://git.bjxgj.com/xgj/spaceflow/commit/6465de8751028787efb509670988c62b4dbbdf2a))
- **review:** released version 0.9.0 [no ci] ([13dd62c](https://git.bjxgj.com/xgj/spaceflow/commit/13dd62c6f307aa6d3b78c34f485393434036fe59))

## [0.11.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.10.0...@spaceflow/publish@0.11.0) (2026-01-28)

### 新特性

- **core:** 为 npm 包添加 npx 直接执行支持 ([e67a7da](https://git.bjxgj.com/xgj/spaceflow/commit/e67a7da34c4e41408760da4de3a499495ce0df2f))

### 其他修改

- **ci-scripts:** released version 0.9.0 [no ci] ([1b9e816](https://git.bjxgj.com/xgj/spaceflow/commit/1b9e8167bb8fc67fcc439b2ef82e7a63dc323e6d))
- **ci-shell:** released version 0.9.0 [no ci] ([accdda7](https://git.bjxgj.com/xgj/spaceflow/commit/accdda7ee4628dc8447e9a89da6c8101c572cb90))
- **core:** released version 0.9.0 [no ci] ([8127211](https://git.bjxgj.com/xgj/spaceflow/commit/812721136828e8c38adf0855fb292b0da89daf1a))
- **period-summary:** released version 0.9.0 [no ci] ([ac03f9b](https://git.bjxgj.com/xgj/spaceflow/commit/ac03f9bcff742d669c6e8b2f94e40153b6c298f5))
- **review:** released version 0.8.0 [no ci] ([ec6e7e5](https://git.bjxgj.com/xgj/spaceflow/commit/ec6e7e5defd2a5a6349d3530f3b0f4732dd5bb62))

## [0.10.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.9.0...@spaceflow/publish@0.10.0) (2026-01-28)

### 新特性

- **core:** 优化 commit 消息生成器中的 scope 处理逻辑 ([1592079](https://git.bjxgj.com/xgj/spaceflow/commit/1592079edde659fe94a02bb6e2dea555c80d3b6b))

### 其他修改

- **ci-scripts:** released version 0.8.0 [no ci] ([be6273d](https://git.bjxgj.com/xgj/spaceflow/commit/be6273dab7f1c80c58abdb8de6f0eeb986997e28))
- **ci-shell:** released version 0.8.0 [no ci] ([3102178](https://git.bjxgj.com/xgj/spaceflow/commit/310217827c6ec29294dee5689b2dbb1b66492728))
- **core:** released version 0.8.0 [no ci] ([625dbc0](https://git.bjxgj.com/xgj/spaceflow/commit/625dbc0206747b21a893ae43032f55d0a068c6fd))
- **period-summary:** released version 0.8.0 [no ci] ([44ff3c5](https://git.bjxgj.com/xgj/spaceflow/commit/44ff3c505b243e1291565e354e239ce893e5e47c))
- **review:** released version 0.7.0 [no ci] ([1d195d7](https://git.bjxgj.com/xgj/spaceflow/commit/1d195d74685f12edf3b1f4e13b58ccc3d221fd94))

## [0.9.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.8.0...@spaceflow/publish@0.9.0) (2026-01-28)

### 代码重构

- **core:** 重构安装服务目录结构和命名 ([50cc900](https://git.bjxgj.com/xgj/spaceflow/commit/50cc900eb864b23f20c5f48dec20d1a754238286))

### 其他修改

- **ci-scripts:** released version 0.7.0 [no ci] ([ea294e1](https://git.bjxgj.com/xgj/spaceflow/commit/ea294e138c6b15033af85819629727915dfcbf4b))
- **ci-shell:** released version 0.7.0 [no ci] ([247967b](https://git.bjxgj.com/xgj/spaceflow/commit/247967b30876aae78cfb1f9c706431b5bb9fb57e))
- **core:** released version 0.7.0 [no ci] ([000c53e](https://git.bjxgj.com/xgj/spaceflow/commit/000c53eff80899dbadad8d668a2227921373daad))
- **period-summary:** released version 0.7.0 [no ci] ([8869d58](https://git.bjxgj.com/xgj/spaceflow/commit/8869d5876e86ebe83ae65c3259cd9a7e402257cf))
- **review:** released version 0.6.0 [no ci] ([48a90b2](https://git.bjxgj.com/xgj/spaceflow/commit/48a90b253dbe03f46d26bb88f3e0158193aa1dba))

## [0.8.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.7.0...@spaceflow/publish@0.8.0) (2026-01-28)

### 新特性

- **core:** 优化pnpm包安装逻辑，检测是否为workspace ([6555daf](https://git.bjxgj.com/xgj/spaceflow/commit/6555dafe1f08a244525be3a0345cc585f2552086))

### 其他修改

- **ci-scripts:** released version 0.6.0 [no ci] ([d485758](https://git.bjxgj.com/xgj/spaceflow/commit/d48575827941cae6ffc7ae6ba911e5d4cf3bd7fa))
- **ci-shell:** released version 0.6.0 [no ci] ([a2d1239](https://git.bjxgj.com/xgj/spaceflow/commit/a2d12397997b309062a9d93af57a5588cdb82a79))
- **core:** released version 0.6.0 [no ci] ([21e1ec6](https://git.bjxgj.com/xgj/spaceflow/commit/21e1ec61a2de542e065034f32a259092dd7c0e0d))
- **period-summary:** released version 0.6.0 [no ci] ([6648dfb](https://git.bjxgj.com/xgj/spaceflow/commit/6648dfb31b459e8c4522cff342dfa87a4bdaab4b))
- **review:** released version 0.5.0 [no ci] ([93c3088](https://git.bjxgj.com/xgj/spaceflow/commit/93c308887040f39047766a789a37d24ac6146359))

## [0.7.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.6.0...@spaceflow/publish@0.7.0) (2026-01-28)

### 新特性

- **core:** 优化包管理器检测与 npm 包处理逻辑 ([63f7fa4](https://git.bjxgj.com/xgj/spaceflow/commit/63f7fa4f55cb41583009b2ea313b5ad327615e52))

### 代码重构

- **core:** 优化配置合并逻辑，添加字段覆盖策略 ([18680e6](https://git.bjxgj.com/xgj/spaceflow/commit/18680e69b0d6e9e05c843ed3f07766830955d658))

### 其他修改

- **ci-scripts:** released version 0.5.0 [no ci] ([a87a1da](https://git.bjxgj.com/xgj/spaceflow/commit/a87a1da0490986c46c2a527cda5e7d0df9df6d03))
- **ci-shell:** released version 0.5.0 [no ci] ([920d9a8](https://git.bjxgj.com/xgj/spaceflow/commit/920d9a8165fe6eabf7a074eb65762f4693883438))
- **core:** released version 0.5.0 [no ci] ([ad20098](https://git.bjxgj.com/xgj/spaceflow/commit/ad20098ef954283dd6d9867a4d2535769cbb8377))
- **period-summary:** released version 0.5.0 [no ci] ([8e547e9](https://git.bjxgj.com/xgj/spaceflow/commit/8e547e9e6a6496a8c314c06cf6e88c97e623bc2d))
- **review:** released version 0.4.0 [no ci] ([3b5f8a9](https://git.bjxgj.com/xgj/spaceflow/commit/3b5f8a934de5ba4f59e232e1dcbccbdff1b8b17c))
- 更新项目依赖锁定文件 ([19d2d1d](https://git.bjxgj.com/xgj/spaceflow/commit/19d2d1d86bb35b8ee5d3ad20be51b7aa68e83eff))
- 移除 npm registry 配置文件 ([2d9fac6](https://git.bjxgj.com/xgj/spaceflow/commit/2d9fac6db79e81a09ca8e031190d0ebb2781cc31))
- 调整依赖配置并添加npm registry配置 ([a754db1](https://git.bjxgj.com/xgj/spaceflow/commit/a754db1bad1bafcea50b8d2825aaf19457778f2e))

## [0.6.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.5.0...@spaceflow/publish@0.6.0) (2026-01-28)

### 代码重构

- **publish:** 调整zod依赖的导入来源 ([574eef1](https://git.bjxgj.com/xgj/spaceflow/commit/574eef1910809a72a4b13acd4cb070e12dc42ce8))
- **review:** 调整zod依赖的导入路径 ([02014cd](https://git.bjxgj.com/xgj/spaceflow/commit/02014cdab9829df583f0f621150573b8c45a3ad7))

### 其他修改

- **ci-scripts:** released version 0.4.0 [no ci] ([364f696](https://git.bjxgj.com/xgj/spaceflow/commit/364f696d0df5d84be915cfaa9202a592073d9b46))
- **ci-shell:** released version 0.4.0 [no ci] ([7e6bf1d](https://git.bjxgj.com/xgj/spaceflow/commit/7e6bf1dabffc6250b918b89bb850d478d3f4b875))
- **core:** released version 0.4.0 [no ci] ([bc4cd89](https://git.bjxgj.com/xgj/spaceflow/commit/bc4cd89af70dce052e7e00fe413708790f65be61))
- **core:** 调整核心依赖与配置，新增Zod类型系统支持 ([def0751](https://git.bjxgj.com/xgj/spaceflow/commit/def0751577d9f3350494ca3c7bb4a4b087dab05e))
- **period-summary:** released version 0.4.0 [no ci] ([ca89a9b](https://git.bjxgj.com/xgj/spaceflow/commit/ca89a9b9436761e210dedfc38fb3c16ef39b0718))
- **review:** released version 0.3.0 [no ci] ([865c6fd](https://git.bjxgj.com/xgj/spaceflow/commit/865c6fdee167df187d1bc107867f842fe25c1098))
- 调整项目依赖配置 ([6802386](https://git.bjxgj.com/xgj/spaceflow/commit/6802386f38f4081a3b5d5c47ddc49e9ec2e4f28d))

## [0.5.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.4.0...@spaceflow/publish@0.5.0) (2026-01-28)

### 其他修改

- **ci-scripts:** released version 0.3.0 [no ci] ([9292b52](https://git.bjxgj.com/xgj/spaceflow/commit/9292b524f2b8171f8774fab4e4ef4b32991f5d3d))
- **ci-shell:** released version 0.3.0 [no ci] ([7b25e55](https://git.bjxgj.com/xgj/spaceflow/commit/7b25e557b628fdfa66d7a0be4ee21267906ac15f))
- **core:** released version 0.3.0 [no ci] ([bf8b005](https://git.bjxgj.com/xgj/spaceflow/commit/bf8b005ccbfcdd2061c18ae4ecdd476584ecbb53))
- **core:** 调整依赖配置 ([c86534a](https://git.bjxgj.com/xgj/spaceflow/commit/c86534ad213293ee2557ba5568549e8fbcb74ba5))
- **period-summary:** released version 0.3.0 [no ci] ([7e74c59](https://git.bjxgj.com/xgj/spaceflow/commit/7e74c59d90d88e061e693829f8196834d9858307))
- 调整项目依赖配置 ([f4009cb](https://git.bjxgj.com/xgj/spaceflow/commit/f4009cb0c369b225c356584afb28a7ff5a1a89ec))

## [0.4.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.3.0...@spaceflow/publish@0.4.0) (2026-01-28)

### 代码重构

- **publish:** 调整包变更检测的日志输出格式 ([df35e92](https://git.bjxgj.com/xgj/spaceflow/commit/df35e92d614ce59e202643cf34a0fef2803412a1))

### 其他修改

- **review:** released version 0.2.0 [no ci] ([d0bd3ed](https://git.bjxgj.com/xgj/spaceflow/commit/d0bd3edf364dedc7c077d95801b402d41c3fdd9c))

## [0.3.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.2.0...@spaceflow/publish@0.3.0) (2026-01-28)

### 文档更新

- **core:** 更新核心框架README文档 ([0d98658](https://git.bjxgj.com/xgj/spaceflow/commit/0d98658f6ab01f119f98d3387fb5651d4d4351a8))

### 其他修改

- **ci-scripts:** released version 0.2.0 [no ci] ([716e9ad](https://git.bjxgj.com/xgj/spaceflow/commit/716e9ad0f32bde09c608143da78f0a4299017797))
- **ci-shell:** released version 0.2.0 [no ci] ([4f5314b](https://git.bjxgj.com/xgj/spaceflow/commit/4f5314b1002b90d7775a5ef51e618a3f227ae5a9))
- **core:** released version 0.2.0 [no ci] ([5a96529](https://git.bjxgj.com/xgj/spaceflow/commit/5a96529cabdce4fb150732b34c55e668c33cb50c))
- **period-summary:** released version 0.2.0 [no ci] ([66a4e20](https://git.bjxgj.com/xgj/spaceflow/commit/66a4e209519b64d946ec21b1d1695105fb9de106))

## [0.2.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.1.2...@spaceflow/publish@0.2.0) (2026-01-28)

### 新特性

- **publish:** 增强包变更检测的日志输出 ([b89c5cc](https://git.bjxgj.com/xgj/spaceflow/commit/b89c5cc0654713b6482ee591325d4f92ad773600))

### 修复BUG

- **publish:** 修复分支锁定时未捕获异常处理器的资源泄漏问题 ([ae326e9](https://git.bjxgj.com/xgj/spaceflow/commit/ae326e95c0cea033893cf084cbf7413fb252bd33))

### 其他修改

- **review:** released version 0.1.2 [no ci] ([9689d3e](https://git.bjxgj.com/xgj/spaceflow/commit/9689d3e37781ca9ae6cb14d7b12717c061f2919d))
- 优化CI工作流的代码检出配置 ([d9740dd](https://git.bjxgj.com/xgj/spaceflow/commit/d9740dd6d1294068ffdcd7a12b61149773866a2a))

## [0.1.2](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.1.1...@spaceflow/publish@0.1.2) (2026-01-28)

### 修复BUG

- **publish:** 修复预演模式下的交互式提示问题 ([0b785bf](https://git.bjxgj.com/xgj/spaceflow/commit/0b785bfddb9f35e844989bd3891817dc502302f8))

### 其他修改

- **ci-scripts:** released version 0.1.2 [no ci] ([ab9c100](https://git.bjxgj.com/xgj/spaceflow/commit/ab9c1000bcbe64d8a99ffa6bebb974c024b14325))
- **ci-shell:** released version 0.1.2 [no ci] ([bf7977b](https://git.bjxgj.com/xgj/spaceflow/commit/bf7977bed684b557555861b9dc0359eda3c5d476))
- **core:** released version 0.1.2 [no ci] ([8292dbe](https://git.bjxgj.com/xgj/spaceflow/commit/8292dbe59a200cc640a95b86afb6451ec0c044ce))
- **period-summary:** released version 0.1.2 [no ci] ([eaf41a0](https://git.bjxgj.com/xgj/spaceflow/commit/eaf41a0149ee4306361ccab0b3878bded79677df))

## [0.1.1](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.1.0...@spaceflow/publish@0.1.1) (2026-01-28)

### 文档更新

- **publish:** 完善发布插件README文档 ([faa57b0](https://git.bjxgj.com/xgj/spaceflow/commit/faa57b095453c00fb3c9a7704bc31b63953c0ac5))

### 其他修改

- **ci-scripts:** released version 0.1.1 [no ci] ([19ca0d8](https://git.bjxgj.com/xgj/spaceflow/commit/19ca0d8461f9537f4318b772cad3ea395d2b3264))
- **ci-shell:** released version 0.1.1 [no ci] ([488a686](https://git.bjxgj.com/xgj/spaceflow/commit/488a6869240151e7d1cf37a3b177897c2b5d5c1e))
- **core:** released version 0.1.1 [no ci] ([0cf3a4d](https://git.bjxgj.com/xgj/spaceflow/commit/0cf3a4d37d7d1460e232dd30bc7ab8dc015ed11f))
- **period-summary:** released version 0.1.1 [no ci] ([b77e96b](https://git.bjxgj.com/xgj/spaceflow/commit/b77e96b1b768efa81d37143101057224fc3cef0f))

## [0.1.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/publish@0.0.1...@spaceflow/publish@0.1.0) (2026-01-28)

### 新特性

- **core:** 添加同步解锁分支方法用于进程退出清理 ([cbec480](https://git.bjxgj.com/xgj/spaceflow/commit/cbec480511e074de3ccdc61226f3baa317cff907))

### 其他修改

- **ci-scripts:** released version 0.1.0 [no ci] ([57b3a1c](https://git.bjxgj.com/xgj/spaceflow/commit/57b3a1c826dafd5ec51d68b7471266efd5cc32b2))
- **ci-shell:** released version 0.1.0 [no ci] ([2283d9d](https://git.bjxgj.com/xgj/spaceflow/commit/2283d9d69ada1c071bef6c548dc756fe062893bd))
- **core:** released version 0.1.0 [no ci] ([f455607](https://git.bjxgj.com/xgj/spaceflow/commit/f45560735082840410e08e0d8113f366732a1243))
- **period-summary:** released version 0.1.0 [no ci] ([36fb7a4](https://git.bjxgj.com/xgj/spaceflow/commit/36fb7a486da82e1d8e4b0574c68b4473cd86b28e))

## 0.0.1 (2026-01-28)

### 其他修改

- **ci-scripts:** released version 0.0.1 [no ci] ([b38fb9b](https://git.bjxgj.com/xgj/spaceflow/commit/b38fb9ba56200ced1baf563b097faa8717693783))
- **ci-shell:** released version 0.0.1 [no ci] ([ec2a84b](https://git.bjxgj.com/xgj/spaceflow/commit/ec2a84b298c5fb989951caf42e2b016b3336f6a0))
- **core:** released version 0.0.1 [no ci] ([66497d6](https://git.bjxgj.com/xgj/spaceflow/commit/66497d60be04b4756a3362dbec4652177910165c))
- **period-summary:** released version 0.0.1 [no ci] ([7ab3504](https://git.bjxgj.com/xgj/spaceflow/commit/7ab3504750191b88643fe5db6b92bb08acc9ab5d))
- 重置所有包版本至 0.0.0 并清理 CHANGELOG 文件 ([f7efaf9](https://git.bjxgj.com/xgj/spaceflow/commit/f7efaf967467f1272e05d645720ee63941fe79be))

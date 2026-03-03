# Changelog

## [0.39.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.38.0...@spaceflow/cli@0.39.0) (2026-03-03)

### 新特性

* **actions:** 增强对 Gitea 平台的环境变量支持 ([21ba3da](https://github.com/Lydanne/spaceflow/commit/21ba3daa182083ecaec0113de91caf2ab1068000))
* **actions:** 支持 Gitea 作为 Git Provider ([4c88b36](https://github.com/Lydanne/spaceflow/commit/4c88b36d97ab49a322bac571385b0e57029676ff))
* **core:** Gitea适配器支持通过标签名称创建Issue ([cf10eda](https://github.com/Lydanne/spaceflow/commit/cf10eda5d025c560cc0d8e3826dad40716020d5c))
* **core:** 为 Gitea 和 GitHub 适配器完善已解决评论列表功能 ([7134c83](https://github.com/Lydanne/spaceflow/commit/7134c83b0b440bdfb688d93e86c9552302bf45b2))
* **core:** 在安装过程中记录并提示 @spaceflow/core 版本变更 ([1992129](https://github.com/Lydanne/spaceflow/commit/19921299bf77b98b150ba6522c1b37ac872f431e))
* **core:** 增强对 Gitea 平台的支持并修复类型转换 ([bfbb45c](https://github.com/Lydanne/spaceflow/commit/bfbb45c521035c80f0e81f5572d5aa1b554405f7))
* **core:** 新增 Git SDK 本地变更管理能力 ([b96d05a](https://github.com/Lydanne/spaceflow/commit/b96d05a93729635020f317ffc2f0343fc1be8be1))
* **publish:** 支持 Gitea 环境变量作为 CI 配置来源 ([cd1ba77](https://github.com/Lydanne/spaceflow/commit/cd1ba778617731ef85f9851883122175a99d72ac))
* **review-summary:** commit-based 评分新增修复问题加分机制，支持从 review 模块精确提取问题统计 ([304bf81](https://github.com/Lydanne/spaceflow/commit/304bf81ab475b280ab5f4011159bc697861bddf6))
* **review-summary:** 实现 review-summary 命令核心功能 ([5964eec](https://github.com/Lydanne/spaceflow/commit/5964eec0e2ee4ac46f74808466429b0edc0cbaa1))
* **review-summary:** 支持为周期统计报告 Issue 配置自定义标签 ([df1cc61](https://github.com/Lydanne/spaceflow/commit/df1cc61167851ff7106104914319f43f73ba8902))
* **review-summary:** 支持通过配置文件自定义评分权重 ([53e1a37](https://github.com/Lydanne/spaceflow/commit/53e1a371288aea6ceac63b03fda99eea1739be4b))
* **review-summary:** 新增 commit-based 评分策略，支持按有效 commit 累计计分 ([111c0d6](https://github.com/Lydanne/spaceflow/commit/111c0d6b9d87d12096e0edb69a11eceff55b79c1))
* **review-summary:** 新增 defect-rate 缺陷率评分策略 ([2777f4d](https://github.com/Lydanne/spaceflow/commit/2777f4da6d364cbc801792f4fa7ac6323da5e1bc))
* **review-summary:** 新增 issue-based 评分策略并更新文档 ([b6d923e](https://github.com/Lydanne/spaceflow/commit/b6d923e060aafd0b298a39d6fdc3e2f76facf1f3))
* **review-summary:** 新增文件过滤功能并优化缺陷率计算 ([9655f82](https://github.com/Lydanne/spaceflow/commit/9655f828cec77c4a7db29ae1cda59fd3ea10ceab))
* **review:** 为行级评论 Review 添加统计信息摘要 ([58d5b37](https://github.com/Lydanne/spaceflow/commit/58d5b37ba54daa24bd2f8396318fedc87f388c74))
* **review:** 优化问题统计展示，按 severity 分级显示 error/warn 数量 ([bcb2608](https://github.com/Lydanne/spaceflow/commit/bcb26086589a67e815db075f3001209904572926))
* **review:** 保留历史行级评论，为每轮 Review 生成独立评论并添加上轮回顾 ([de431a0](https://github.com/Lydanne/spaceflow/commit/de431a09b4e3b5e1ada9ee5f1ee65786d22b6ff9))
* **review:** 增强已解决问题同步功能，支持记录解决者 ([2c74996](https://github.com/Lydanne/spaceflow/commit/2c74996471e003f8666f8ccec715590f0f64c017))
* **review:** 支持从 Gitea Actions 事件文件解析 PR 编号 ([09e2e58](https://github.com/Lydanne/spaceflow/commit/09e2e58d84f773b8a3184feb73b90cb110993ebd))
* **review:** 支持用户手动 resolve 评论并在报告中区分 AI 修复与手动解决 ([c968b65](https://github.com/Lydanne/spaceflow/commit/c968b65c850bc68de3f4409aa3b5294e5a0311ff))
* **review:** 新增 MCP 工具支持从目录批量加载代码审查规则 ([289a836](https://github.com/Lydanne/spaceflow/commit/289a83650f1e222482fcbaaa69fb5ea562c5a4c2))
* **review:** 新增本地代码审查模式，支持审查未提交代码 ([b80614a](https://github.com/Lydanne/spaceflow/commit/b80614a7dff570a078e7709a70628752e35ec9e8))
* **review:** 新增解决率统计指标，区分修复率和解决率的计算维度 ([436541f](https://github.com/Lydanne/spaceflow/commit/436541fce605319da562445a81242a8feb257df9))
* **review:** 本地模式无变更时自动回退到分支比较模式 ([820ff8d](https://github.com/Lydanne/spaceflow/commit/820ff8d04f5af84340d861e03ccbf66d57fc2c1c))
* **shared:** 优化获取 core 版本逻辑，支持 .spaceflowrc 显式指定 ([916a87d](https://github.com/Lydanne/spaceflow/commit/916a87d5b7a7fc8c8dba3f959f3379fee26e0017))

### 修复BUG

* **actions:** 修正 GitHub Actions 路径并优化命令行选项 ([50a9946](https://github.com/Lydanne/spaceflow/commit/50a99464633afe234ef56d4a081c6d04686b3e57))
* **core:** 重构配置 Schema 生成逻辑，使用 SpaceflowConfigSchema 作为基础 ([c73eb1c](https://github.com/Lydanne/spaceflow/commit/c73eb1ce5b6f212b8a932a15224db7e63822f8d0))
* **review:** 修复率计算仅统计 AI 修复的问题，排除手动解决的问题 ([12b3415](https://github.com/Lydanne/spaceflow/commit/12b3415749c9d8523e8b23365fbb39fc7657ff1d))
* **review:** 修复重复 AI 评论问题，改进评论查找和清理逻辑 ([5ec3757](https://github.com/Lydanne/spaceflow/commit/5ec3757533f618aa6210ccebecabf411b2dae9a4))
* **review:** 修改 generateDescription 选项处理逻辑，仅在明确指定时设置为 true ([48e710a](https://github.com/Lydanne/spaceflow/commit/48e710ade62e0aeaf2effa3db58dbcb2b2a0983e))
* **review:** 修正 PR 评论标题中的 emoji 显示问题 ([bcdc946](https://github.com/Lydanne/spaceflow/commit/bcdc9467bf7970c9acd3ea00303bcae5eaff131f))

### 代码重构

* **core:** 统一插件配置中的 'extensions' 为 'skills' ([50646a0](https://github.com/Lydanne/spaceflow/commit/50646a061f66ec6935c66199d78915b9d7896bd3))
* **review:** 为文件总结标题添加 💡 图标,增强视觉识别度 ([69cecf0](https://github.com/Lydanne/spaceflow/commit/69cecf0a6deadf1935db060800f8f110ae4b9889))
* **review:** 优化无效问题统计逻辑,排除已修复和已解决的问题 ([1de7b2a](https://github.com/Lydanne/spaceflow/commit/1de7b2a23fcc3ff73f679fc219342e111d96acf7))
* **review:** 优化问题统计展示,统一状态图标并新增汇总行 ([c764625](https://github.com/Lydanne/spaceflow/commit/c76462548a299ee51af98553c73ba4f705031cd3))
* **review:** 优化问题统计表格布局,将总结内容移至折叠块展示 ([629e96f](https://github.com/Lydanne/spaceflow/commit/629e96f5960167b689c724a4fb4df4fb29088002))
* **review:** 优化问题验证逻辑，将 resolved 状态纳入有效性判断 ([1e2302d](https://github.com/Lydanne/spaceflow/commit/1e2302d81cd0f653d606483ef6c9138143ca6d60))
* **review:** 抽取规则加载和问题验证逻辑为独立方法，优化代码复用性 ([7ea02ba](https://github.com/Lydanne/spaceflow/commit/7ea02ba86e369bc130c69c561195634072cc060a))

### 文档更新

* **docs:** 为 review-summary 命令文档补充 Issue 输出配置说明 ([196fa94](https://github.com/Lydanne/spaceflow/commit/196fa94ad1ed2dbadbdcb332ef26cf1fe7fcd8d7))
* **docs:** 更新 review-summary 命令的 CI 配置示例 ([8b2b2c5](https://github.com/Lydanne/spaceflow/commit/8b2b2c55ed497619cbb91bd4fd2e5124b6f5ac37))
* **docs:** 更新 review-summary 命令的 CI 集成示例 ([60c5b70](https://github.com/Lydanne/spaceflow/commit/60c5b70695aa6a4c9cae1e3936670b34d5486792))
* **docs:** 更新环境变量参考文档，增加 GitLab 支持并优化 Gitea 说明 ([a02f8e0](https://github.com/Lydanne/spaceflow/commit/a02f8e0309368334bc77a331f65338435657eddb))
* **docs:** 统一扩展类型命名：extension 改为 skill ([96db479](https://github.com/Lydanne/spaceflow/commit/96db47948981c0c2b5860c2835f86dec77736cf0))
* **review-summary:** 完善文档，新增时间预设、评分算法及输出示例说明 ([fb04685](https://github.com/Lydanne/spaceflow/commit/fb04685dde4157f0a1a2f8edaf1fb3c125280e27))
* **review-summary:** 更新错误信息以支持 Gitea 环境变量 ([cd02818](https://github.com/Lydanne/spaceflow/commit/cd028183fe7e14d993566e8dc49849b07d2540d9))
* **review:** 完善 review 命令文档，新增审查流程、多轮审查、问题生命周期等核心机制说明 ([d6b2a20](https://github.com/Lydanne/spaceflow/commit/d6b2a20802ab98e5ddb01937c0fe8b268c403c6f))
* **scripts:** 更新错误信息以支持 Gitea 环境变量 ([9a9d7f2](https://github.com/Lydanne/spaceflow/commit/9a9d7f20a63bea4cc13d284ed41bc9c4f4aa6595))
* **shell:** 更新错误信息以支持 Gitea 环境变量 ([72c51d7](https://github.com/Lydanne/spaceflow/commit/72c51d792c140d44d8aa3cb05666de72d170a185))
* 修复 GitHub Actions 配置示例的 Markdown 渲染问题 ([01daec5](https://github.com/Lydanne/spaceflow/commit/01daec551f2e23ab70357f88b7789897922064a7))
* 更新 MCP 架构为 Meta-tool 代理模式并统一导出类型命名 ([f60c53b](https://github.com/Lydanne/spaceflow/commit/f60c53b103f24e8a4123e4c4ec850885cb40f7d7))
* 简化 MCP 工具声明方式并完善扩展系统文档 ([9cdcab9](https://github.com/Lydanne/spaceflow/commit/9cdcab986559bd34c75e48b6c380c74516adb05c))

### 代码格式

* 格式化代码并更新 Prettier 忽略规则 ([baed10e](https://github.com/Lydanne/spaceflow/commit/baed10e7cd91fda1285d7e2e0019d291cb563055))

### 测试用例

* **core:** 修复测试用例中的导入和模拟函数实现 ([0137d4b](https://github.com/Lydanne/spaceflow/commit/0137d4b400f272ce7f7ba74fc5b37fcc453ed717))
* **review:** 增强 AI 评论识别和过滤功能的测试覆盖 ([bda706b](https://github.com/Lydanne/spaceflow/commit/bda706b99aab113521afe6bcd386a590811e20a6))
* **review:** 新增 deleteExistingAiReviews、buildLineReviewBody、findExistingAiComments、syncReactionsToIssues 和 filterIssuesByValidCommits 方法的详细日志测试 ([0619e9c](https://github.com/Lydanne/spaceflow/commit/0619e9cc1e5a81d24703e2e574026a249d87f236))
* **review:** 新增 invalidateIssuesForChangedFiles、updateIssueLineNumbers、filterIssuesByValidCommits 和 ensureClaudeCli 方法的单元测试 ([876f827](https://github.com/Lydanne/spaceflow/commit/876f82746331cf2e353b0a537b8691395e2a1084))

### 其他修改

* **core:** released version 0.16.0 [no ci] ([4486a32](https://github.com/Lydanne/spaceflow/commit/4486a320fccea858e400b79c5b4f18ed4a6f58ea))
* **core:** released version 0.17.0 [no ci] ([4e8f807](https://github.com/Lydanne/spaceflow/commit/4e8f8074fa9d174995e97c9466c379ba81227f9f))
* **core:** released version 0.18.0 [no ci] ([7d931eb](https://github.com/Lydanne/spaceflow/commit/7d931eba98a172cf6ad365f09b780251ad35b212))
* **core:** released version 0.19.0 [no ci] ([c8bfe6b](https://github.com/Lydanne/spaceflow/commit/c8bfe6ba20893e2c3cd383ed7e7d3217b0492eb6))
* **core:** released version 0.20.0 [no ci] ([b7ed239](https://github.com/Lydanne/spaceflow/commit/b7ed239455244cd96f2b59ef67886dd0bfc057a8))
* **core:** released version 0.21.0 [no ci] ([7fa4381](https://github.com/Lydanne/spaceflow/commit/7fa438124cc27316ad5f37d5cbacc848ebd3b9df))
* **core:** released version 0.22.0 [no ci] ([68aa47d](https://github.com/Lydanne/spaceflow/commit/68aa47df425eb9d1ceac1237fee3cc1b29de668f))
* **core:** released version 0.23.0 [no ci] ([07a2d7d](https://github.com/Lydanne/spaceflow/commit/07a2d7d51223aeb98161f91fa931b4cb63b03cda))
* **core:** released version 0.24.0 [no ci] ([c1d77e4](https://github.com/Lydanne/spaceflow/commit/c1d77e4c8e612e7b64a70c5d9d4384452a3ccbc1))
* **publish:** released version 0.40.0 [no ci] ([8fe14c7](https://github.com/Lydanne/spaceflow/commit/8fe14c7faffa2784b91710d3f129911534bf64d2))
* **publish:** released version 0.41.0 [no ci] ([e96a488](https://github.com/Lydanne/spaceflow/commit/e96a48824bbb305142b78afa989e3473eec0c1c2))
* **publish:** released version 0.42.0 [no ci] ([61ac6b2](https://github.com/Lydanne/spaceflow/commit/61ac6b233564550d35e84759eff60a9e04181c46))
* **publish:** released version 0.43.0 [no ci] ([1074b9c](https://github.com/Lydanne/spaceflow/commit/1074b9c5fb21a447093ef23300c451d790710b33))
* **publish:** released version 0.44.0 [no ci] ([5b29159](https://github.com/Lydanne/spaceflow/commit/5b29159b2f0129d2ce81329cf48734d3d56b226e))
* **publish:** released version 0.45.0 [no ci] ([9bd3bbe](https://github.com/Lydanne/spaceflow/commit/9bd3bbe725a3362f762a1407c6a92a993359dfe5))
* **publish:** released version 0.46.0 [no ci] ([68ebfc3](https://github.com/Lydanne/spaceflow/commit/68ebfc32bfb5b39354947f08b73306b5f8512fdf))
* **publish:** released version 0.47.0 [no ci] ([3f59345](https://github.com/Lydanne/spaceflow/commit/3f593450066c9138adac5b101edb8057a5de1ff6))
* **publish:** released version 0.48.0 [no ci] ([da4065f](https://github.com/Lydanne/spaceflow/commit/da4065fdbc9c193ebca207c371ed0ea17a13c0db))
* **review-summary:** released version 0.18.0 [no ci] ([164fb64](https://github.com/Lydanne/spaceflow/commit/164fb64c511d93466585cb5d6df7cd6be0922c8c))
* **review-summary:** released version 0.19.0 [no ci] ([f1b6a2e](https://github.com/Lydanne/spaceflow/commit/f1b6a2e21cc2f9e07bb8e100a358abcba16f2d03))
* **review-summary:** released version 0.20.0 [no ci] ([bb3f815](https://github.com/Lydanne/spaceflow/commit/bb3f81567bf6946964a19b9207b8b9beff690b8a))
* **review-summary:** released version 0.21.0 [no ci] ([11379c4](https://github.com/Lydanne/spaceflow/commit/11379c478859a12dd0340a78b1578487d9a24b31))
* **review-summary:** released version 0.22.0 [no ci] ([e0fde59](https://github.com/Lydanne/spaceflow/commit/e0fde59b23109f8323bd247ab2c1f553812284e1))
* **review-summary:** released version 0.23.0 [no ci] ([f6681ec](https://github.com/Lydanne/spaceflow/commit/f6681ecdcd8f8036da3c4ac7778e5cc75af59c9f))
* **review-summary:** released version 0.24.0 [no ci] ([690e9ed](https://github.com/Lydanne/spaceflow/commit/690e9ed64b197f50e201afe73dc55e866867a7fd))
* **review-summary:** released version 0.25.0 [no ci] ([4eaca03](https://github.com/Lydanne/spaceflow/commit/4eaca0397411585112697e6800b66484bd73ffde))
* **review-summary:** released version 0.26.0 [no ci] ([5e8dedf](https://github.com/Lydanne/spaceflow/commit/5e8dedf10cb7104dcc15550d7f5ba05f10cae7d3))
* **review-summary:** released version 0.27.0 [no ci] ([90ac2a4](https://github.com/Lydanne/spaceflow/commit/90ac2a44706ddb2dd231ea57d3734c7445565ee9))
* **review-summary:** released version 0.28.0 [no ci] ([e131ed8](https://github.com/Lydanne/spaceflow/commit/e131ed83528ef8b45b3e3edaac5dab3389812323))
* **review-summary:** released version 0.29.0 [no ci] ([ef6209c](https://github.com/Lydanne/spaceflow/commit/ef6209cf15114fa9ece2e7e11a9131081d92d443))
* **review-summary:** released version 0.30.0 [no ci] ([3902c7b](https://github.com/Lydanne/spaceflow/commit/3902c7be16ceb6ab7ff2abe52e434634de12a664))
* **review-summary:** released version 0.31.0 [no ci] ([9b028ce](https://github.com/Lydanne/spaceflow/commit/9b028cedd03d8c60f8c1db58b189cd022ea562cf))
* **review-summary:** released version 0.32.0 [no ci] ([b6e083d](https://github.com/Lydanne/spaceflow/commit/b6e083d0f6187c6cfb9be86cf58544653cded2bd))
* **review-summary:** released version 0.33.0 [no ci] ([ca07fa3](https://github.com/Lydanne/spaceflow/commit/ca07fa33f9418147a6a511d0a2699159d01b892c))
* **review:** released version 0.48.0 [no ci] ([4e92d6f](https://github.com/Lydanne/spaceflow/commit/4e92d6f72dcd1e94fbf8a9a772b561da9d39c92c))
* **review:** released version 0.49.0 [no ci] ([404588d](https://github.com/Lydanne/spaceflow/commit/404588d61e77d2230b53c22afad404d20f5e1665))
* **review:** released version 0.50.0 [no ci] ([cff42fa](https://github.com/Lydanne/spaceflow/commit/cff42fafcc588d0c497d9e0e4750620262adcfec))
* **review:** released version 0.51.0 [no ci] ([c93be78](https://github.com/Lydanne/spaceflow/commit/c93be78f6f1df9cb5e3515cee58cda65cad1b00f))
* **review:** released version 0.52.0 [no ci] ([c86406f](https://github.com/Lydanne/spaceflow/commit/c86406f6934d5de4f198eadff66ee6c3f7cfbe0d))
* **review:** released version 0.53.0 [no ci] ([5a6af03](https://github.com/Lydanne/spaceflow/commit/5a6af03c260060ac1b1901bb7273f501ca0037c7))
* **review:** released version 0.54.0 [no ci] ([252269a](https://github.com/Lydanne/spaceflow/commit/252269a299f9e580b858e04814e7d9a13fed7736))
* **review:** released version 0.55.0 [no ci] ([0245743](https://github.com/Lydanne/spaceflow/commit/02457439788dd70925b91118f7d5936a61d0e0de))
* **review:** released version 0.56.0 [no ci] ([2481dec](https://github.com/Lydanne/spaceflow/commit/2481dec141b0d5f444b5815ab9598378ac3e0b12))
* **review:** released version 0.57.0 [no ci] ([238a831](https://github.com/Lydanne/spaceflow/commit/238a83165fa1810a9429b8d6a66a1f75c477ce22))
* **review:** released version 0.58.0 [no ci] ([790dc5f](https://github.com/Lydanne/spaceflow/commit/790dc5f4b38eba28df6f6e4414dd9c536d5a6377))
* **review:** released version 0.59.0 [no ci] ([afb7e5c](https://github.com/Lydanne/spaceflow/commit/afb7e5c469820cb201e7f24ab47abfd33300668a))
* **review:** released version 0.60.0 [no ci] ([a3d381c](https://github.com/Lydanne/spaceflow/commit/a3d381ced314e95135a0a13d4ee1ff1cb72b465d))
* **review:** released version 0.61.0 [no ci] ([f48fa24](https://github.com/Lydanne/spaceflow/commit/f48fa24b378fef0efe95972ef32c0a256a569a7f))
* **review:** released version 0.62.0 [no ci] ([9f535e1](https://github.com/Lydanne/spaceflow/commit/9f535e149ffd7063407e3f865418be35b2eb417b))
* **review:** released version 0.63.0 [no ci] ([7f6b75c](https://github.com/Lydanne/spaceflow/commit/7f6b75cc1f9d594ff596a742e44869884f07d08e))
* **review:** released version 0.64.0 [no ci] ([55de549](https://github.com/Lydanne/spaceflow/commit/55de54963608d0f8c5410d435fdad184fd902af0))
* **review:** released version 0.65.0 [no ci] ([8de84ba](https://github.com/Lydanne/spaceflow/commit/8de84ba1ca6f2254299de199827a3940beff76a0))
* **review:** 移除 .spaceflow 目录及其配置文件 ([64b310d](https://github.com/Lydanne/spaceflow/commit/64b310d8a77614a259a8d7588a09169626efb3ae))
* **scripts:** released version 0.18.0 [no ci] ([289be06](https://github.com/Lydanne/spaceflow/commit/289be06674264d98ab9e1da908d088fff4e1cf7e))
* **scripts:** released version 0.19.0 [no ci] ([e198652](https://github.com/Lydanne/spaceflow/commit/e198652a1dcbd137dcd0fe4d7a2f404e12a991bc))
* **scripts:** released version 0.20.0 [no ci] ([e1fac49](https://github.com/Lydanne/spaceflow/commit/e1fac49257bf4a5902c5884ec0e054384a7859d6))
* **scripts:** released version 0.21.0 [no ci] ([1f0a213](https://github.com/Lydanne/spaceflow/commit/1f0a2139d155807451dc968de8213bafe2e4edb8))
* **scripts:** released version 0.22.0 [no ci] ([f482504](https://github.com/Lydanne/spaceflow/commit/f48250486906016b414a7b00aabac342c1399045))
* **scripts:** released version 0.23.0 [no ci] ([2f18d22](https://github.com/Lydanne/spaceflow/commit/2f18d2274e83b65ce006dceed47a985942c8dd1d))
* **scripts:** released version 0.24.0 [no ci] ([717de65](https://github.com/Lydanne/spaceflow/commit/717de6571faa2cb24f04b7493e7fd6d8404f2bd5))
* **scripts:** released version 0.25.0 [no ci] ([88292c0](https://github.com/Lydanne/spaceflow/commit/88292c07b7787bcd4492c8b88cfb516b3e81d9be))
* **scripts:** released version 0.26.0 [no ci] ([e757eba](https://github.com/Lydanne/spaceflow/commit/e757eba5ae1cdbea428d4cc1c6de6e7e68e546ff))
* **shared:** released version 0.7.0 [no ci] ([e9ade7e](https://github.com/Lydanne/spaceflow/commit/e9ade7e8caefd9f5ee4603b52b3a350ae604dfea))
* **shell:** released version 0.18.0 [no ci] ([88bf217](https://github.com/Lydanne/spaceflow/commit/88bf2178e3361516871c887fda75f7a0086ed55f))
* **shell:** released version 0.19.0 [no ci] ([2dc2597](https://github.com/Lydanne/spaceflow/commit/2dc25974cfeac9c80d03a601e722133bccb25086))
* **shell:** released version 0.20.0 [no ci] ([8b69b53](https://github.com/Lydanne/spaceflow/commit/8b69b5340fe99973add2bea3e7d53f2082d0da54))
* **shell:** released version 0.21.0 [no ci] ([b619af7](https://github.com/Lydanne/spaceflow/commit/b619af741e16053868a2eedd41f56d50134954d8))
* **shell:** released version 0.22.0 [no ci] ([e716369](https://github.com/Lydanne/spaceflow/commit/e716369f57bfa20e710d354245c54d3a80e701f4))
* **shell:** released version 0.23.0 [no ci] ([0668aa9](https://github.com/Lydanne/spaceflow/commit/0668aa97671ca235509bef547503c301237324f9))
* **shell:** released version 0.24.0 [no ci] ([5694d19](https://github.com/Lydanne/spaceflow/commit/5694d193f9207e41e840d9ebaa5a43e3527e6af8))
* **shell:** released version 0.25.0 [no ci] ([fc78e10](https://github.com/Lydanne/spaceflow/commit/fc78e10a0bab04d575867732b922a2a1989a594e))
* **shell:** released version 0.26.0 [no ci] ([753cf30](https://github.com/Lydanne/spaceflow/commit/753cf3044ee7d09ea3f1f9150bf045395703c712))

## [0.38.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.37.0...@spaceflow/cli@0.38.0) (2026-02-27)

### 新特性

* **mcp:** 添加 MCP 资源支持，包括扩展资源和内置配置/扩展列表资源 ([ab19889](https://github.com/Lydanne/spaceflow/commit/ab198890a13c998c17987734da3875834f747a70))

### 其他修改

* **core:** released version 0.15.0 [no ci] ([e44cd0a](https://github.com/Lydanne/spaceflow/commit/e44cd0af8caadf1f2b89179d1ea44ecc0d018966))
* **publish:** released version 0.39.0 [no ci] ([f4db046](https://github.com/Lydanne/spaceflow/commit/f4db04635eab83ad44f8f3b935aa66ecfd02feff))
* **review-summary:** released version 0.17.0 [no ci] ([e00f17d](https://github.com/Lydanne/spaceflow/commit/e00f17dc2ade751ff4de7b45b4d9671b25271f7c))
* **review:** released version 0.47.0 [no ci] ([994893e](https://github.com/Lydanne/spaceflow/commit/994893edb3355ecf7f0c9f3e8bec6090511f987c))
* **scripts:** released version 0.17.0 [no ci] ([8946ea6](https://github.com/Lydanne/spaceflow/commit/8946ea68e1ea372ae9d1c20cef098e1ef59bdf25))
* **shell:** released version 0.17.0 [no ci] ([fb4e833](https://github.com/Lydanne/spaceflow/commit/fb4e833b1a469bf2446b25656a3b439584a4639a))

## [0.37.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.36.0...@spaceflow/cli@0.37.0) (2026-02-27)

### 新特性

* **shared:** 新增 findProjectRoot 函数用于查找项目根目录 ([7135262](https://github.com/Lydanne/spaceflow/commit/71352621f13e17a192821363e655607cfc097307))

### 修复BUG

* **cli:** 为扩展动态导入添加错误处理，防止单个扩展加载失败导致整体崩溃 ([09230dd](https://github.com/Lydanne/spaceflow/commit/09230ddf88568286b1f65c389976cb9a1a2fc880))
* **cli:** 修复 connectProjectMcpClient 函数中工作目录解析问题 ([94a927c](https://github.com/Lydanne/spaceflow/commit/94a927c8850b0b754459e0d8833be70721bc38d1))

### 代码重构

* **cli:** 分离工作目录和项目根目录概念，修复 .spaceflow 目录定位逻辑 ([5b7daab](https://github.com/Lydanne/spaceflow/commit/5b7daab2a3965fbd298ff85ad210d45028ff9d3d))
* **cli:** 重构工作目录和 .spaceflow 目录获取逻辑 ([a9708da](https://github.com/Lydanne/spaceflow/commit/a9708da6ea5b4315f802a0709125e24fe42bb10f))
* **core:** 优化 ExtensionLoader 访问器，简化 MCP 服务上下文获取 ([c1ac91f](https://github.com/Lydanne/spaceflow/commit/c1ac91f1990b565dbbc449e8349561e65fae368f))
* **core:** 简化 MCP 架构，移除 McpServerDefinition 层级 ([0d963a8](https://github.com/Lydanne/spaceflow/commit/0d963a874d03df50a140c57707b5363407e6b37d))
* **core:** 统一工作目录管理，优化 MCP 服务上下文 ([efe7244](https://github.com/Lydanne/spaceflow/commit/efe72444ff6207077a503200c629373a97e47a2c))
* **review:** 简化 MCP 工具的输入参数，统一从上下文获取工作目录 ([104893b](https://github.com/Lydanne/spaceflow/commit/104893b689bf32444850b06a2f4566292a1f8eba))

### 其他修改

* **.spaceflow:** 初始化 Spaceflow 扩展的包结构和依赖 ([5ac8d70](https://github.com/Lydanne/spaceflow/commit/5ac8d7008edcb96168a15ffc04973d154ca9f955))
* **core:** released version 0.14.0 [no ci] ([67f47ac](https://github.com/Lydanne/spaceflow/commit/67f47ac3a894529f174f3136925707d24570df98))
* **publish:** released version 0.38.0 [no ci] ([2a3adf7](https://github.com/Lydanne/spaceflow/commit/2a3adf75af6a44a890b198609bed1090f6d3be6d))
* **review-summary:** released version 0.16.0 [no ci] ([912b5f5](https://github.com/Lydanne/spaceflow/commit/912b5f5cf907935e7ef9e39ad32b742c46843b7e))
* **review:** released version 0.46.0 [no ci] ([54a33ce](https://github.com/Lydanne/spaceflow/commit/54a33ce9590be2b3c35eaf30c9423bc46e996ce8))
* **scripts:** released version 0.16.0 [no ci] ([77be50e](https://github.com/Lydanne/spaceflow/commit/77be50ea413e7b5c969c111429fd8cc425263cd1))
* **shared:** released version 0.6.0 [no ci] ([fcfdf75](https://github.com/Lydanne/spaceflow/commit/fcfdf75efa2146b5ed91e5c7f273a4f938c032b8))
* **shell:** released version 0.16.0 [no ci] ([538e157](https://github.com/Lydanne/spaceflow/commit/538e15783ed4482a25faf251a1513eae0dfb33ad))

## [0.36.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.35.0...@spaceflow/cli@0.36.0) (2026-02-27)

### 新特性

* **cli:** 实现 MCP meta-tool 代理模式 ([86426e9](https://github.com/Lydanne/spaceflow/commit/86426e979ea989a3688721f33e17035d7c96c984))

### 其他修改

* **core:** released version 0.13.0 [no ci] ([9244d7c](https://github.com/Lydanne/spaceflow/commit/9244d7cf8d217ea3af22d1ef1fa7a2ccec852615))
* **publish:** released version 0.37.0 [no ci] ([c1e39bd](https://github.com/Lydanne/spaceflow/commit/c1e39bd28f52a40ca4423ae1088b3b29cffe4946))
* **review-summary:** released version 0.15.0 [no ci] ([626b7dd](https://github.com/Lydanne/spaceflow/commit/626b7dd5b73c62d5f5c48f7dc585f60eb775dad0))
* **review:** released version 0.45.0 [no ci] ([bd215c4](https://github.com/Lydanne/spaceflow/commit/bd215c4fa86341c1c995b28e438bca1e528efcdd))
* **scripts:** released version 0.15.0 [no ci] ([bf9e533](https://github.com/Lydanne/spaceflow/commit/bf9e53349884b3bd4ca845f493d28421a5ffc91d))
* **shared:** released version 0.5.0 [no ci] ([c936cfc](https://github.com/Lydanne/spaceflow/commit/c936cfc432a517e87639e99870a11729b4c91ae4))
* **shell:** released version 0.15.0 [no ci] ([0dc9b31](https://github.com/Lydanne/spaceflow/commit/0dc9b31f4d73ac359e2efa7f07e1e5778f9e85c2))

## [0.35.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.34.0...@spaceflow/cli@0.35.0) (2026-02-27)

### 新特性

* **shared:** 在非 workspace 模式下为 pnpm 创建空 pnpm-workspace.yaml ([0b72b8c](https://github.com/Lydanne/spaceflow/commit/0b72b8c50068f8d1ce131f70e60438fb0ad3c0f9))

### 其他修改

* **core:** released version 0.12.0 [no ci] ([c0ed70e](https://github.com/Lydanne/spaceflow/commit/c0ed70ec187c9585eefafba44963b00abf883030))
* **publish:** released version 0.36.0 [no ci] ([28f3b14](https://github.com/Lydanne/spaceflow/commit/28f3b14f7db914556ddf143709a00d6fa877e417))
* **review-summary:** released version 0.14.0 [no ci] ([4e39c73](https://github.com/Lydanne/spaceflow/commit/4e39c7337f74ac66f10c15cfae2b6c32eccae561))
* **review:** released version 0.44.0 [no ci] ([5d984a2](https://github.com/Lydanne/spaceflow/commit/5d984a244412aed8ef2215b013127fd38d831e1e))
* **scripts:** released version 0.14.0 [no ci] ([6b3bb66](https://github.com/Lydanne/spaceflow/commit/6b3bb6659666f58cfd8aa109f12df13694c9895f))
* **shared:** released version 0.4.0 [no ci] ([ea8bcde](https://github.com/Lydanne/spaceflow/commit/ea8bcdebc41ccbfa7ed9fd66f867c327976aa334))
* **shell:** released version 0.14.0 [no ci] ([04f61bf](https://github.com/Lydanne/spaceflow/commit/04f61bfd5a45ab37319aadd6fd4a064259e62e1d))

## [0.34.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.33.0...@spaceflow/cli@0.34.0) (2026-02-27)

### 新特性

* **cli:** 优化 .spaceflow 目录查找逻辑，改为基于 .spaceflowrc 定位 ([7d98f64](https://github.com/Lydanne/spaceflow/commit/7d98f64ac6d0dce2965da4ca45f0c62524c8fc7c))

### 其他修改

* **core:** released version 0.11.0 [no ci] ([6ea0b41](https://github.com/Lydanne/spaceflow/commit/6ea0b41fe64b0dad32ec33cad420620bfc02acdb))
* **publish:** released version 0.35.0 [no ci] ([c5a2c07](https://github.com/Lydanne/spaceflow/commit/c5a2c07a9e4e9274f2e7c650e69b8d3f84fc240f))
* **review-summary:** released version 0.13.0 [no ci] ([18f5e8a](https://github.com/Lydanne/spaceflow/commit/18f5e8aa62e680f6532f74b3a3c1613cf71d703f))
* **review:** released version 0.43.0 [no ci] ([559fbc7](https://github.com/Lydanne/spaceflow/commit/559fbc7f6a6f529f3e1999a88543c7e89392bb65))
* **scripts:** released version 0.13.0 [no ci] ([b1c0499](https://github.com/Lydanne/spaceflow/commit/b1c049977190719026d6ac8b1964e1a4d0745ede))
* **shared:** released version 0.3.0 [no ci] ([a7d20f7](https://github.com/Lydanne/spaceflow/commit/a7d20f7bb9784ec8dafe466c9fba699b43e5abb8))
* **shell:** released version 0.13.0 [no ci] ([ab45a39](https://github.com/Lydanne/spaceflow/commit/ab45a39b93e26011e81abcabd90964e34e4ab9b8))

## [0.33.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.32.0...@spaceflow/cli@0.33.0) (2026-02-27)

### 新特性

* **cli:** 为 CLI 添加版本号支持，并在执行扩展时传递版本信息 ([cdcd311](https://github.com/Lydanne/spaceflow/commit/cdcd311ab9c44090b68ab594b67ca42f8e846a8a))
* **cli:** 支持通过 SPACEFLOW_CWD 环境变量指定工作目录 ([f24fe3c](https://github.com/Lydanne/spaceflow/commit/f24fe3ccfa0d219a2490585b6fd96c2f32019702))
* **core:** 在构建时注入核心版本号并支持在CLI中显示 ([8061cf8](https://github.com/Lydanne/spaceflow/commit/8061cf8af4ce22bbcdd2cce96472cef22c53a3b1))
* **publish:** 优化发布流程，在 after:bump 阶段增加构建步骤 ([9e1c859](https://github.com/Lydanne/spaceflow/commit/9e1c85977714cc43640e47c1a50c44d06e2af23c))

### 其他修改

* **publish:** released version 0.34.0 [no ci] ([6b949b5](https://github.com/Lydanne/spaceflow/commit/6b949b5894dda61198c115d60fd39a08511d64c3))
* **review-summary:** released version 0.12.0 [no ci] ([1765e00](https://github.com/Lydanne/spaceflow/commit/1765e00a7209acd4a94c79c3dcb2988061154bc5))
* **review:** released version 0.42.0 [no ci] ([366684a](https://github.com/Lydanne/spaceflow/commit/366684a36ab5ccad0cf8de848376fe8427b70b3f))
* **scripts:** released version 0.12.0 [no ci] ([eea067c](https://github.com/Lydanne/spaceflow/commit/eea067c4d7d76b14f0a57edabcb27787f2775212))
* **shell:** released version 0.12.0 [no ci] ([415a373](https://github.com/Lydanne/spaceflow/commit/415a373a32e59e78d2607938dfb7d10d91062e73))

## [0.32.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.31.0...@spaceflow/cli@0.32.0) (2026-02-27)

### 代码重构

* **cli:** 简化 getSpaceflowDir 逻辑，直接回退到全局目录 ([6763afa](https://github.com/Lydanne/spaceflow/commit/6763afab09c1a303a8a278cb8880490f2f39e769))

### 其他修改

* **core:** released version 0.10.0 [no ci] ([21facb5](https://github.com/Lydanne/spaceflow/commit/21facb554c145cac4f6daac121157e5c11db4191))
* **publish:** released version 0.33.0 [no ci] ([fdb0720](https://github.com/Lydanne/spaceflow/commit/fdb0720db798414d226541dba922155cf0cfe849))
* **review-summary:** released version 0.11.0 [no ci] ([d68ceef](https://github.com/Lydanne/spaceflow/commit/d68ceef911941e80fc1e71d530bf0b412b54a64a))
* **review:** released version 0.41.0 [no ci] ([df19355](https://github.com/Lydanne/spaceflow/commit/df193555f523bfde891cd2ab96f823713199749a))
* **scripts:** released version 0.11.0 [no ci] ([4c1d726](https://github.com/Lydanne/spaceflow/commit/4c1d726587a0be3187957e069b78d6eaefa7fddc))
* **shell:** released version 0.11.0 [no ci] ([3df4552](https://github.com/Lydanne/spaceflow/commit/3df4552e24e6f73b3cb8116c348453dd46dd1db5))

## [0.31.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.30.0...@spaceflow/cli@0.31.0) (2026-02-26)

### 文档更新

* **cli:** 更新 CLI README 以明确其定位和工作原理 ([88a4e8e](https://github.com/Lydanne/spaceflow/commit/88a4e8e6cc5be014cf418367c89e00f65cc6d57c))
* **core:** 更新核心包 README，反映新架构和职责 ([5d8ed7b](https://github.com/Lydanne/spaceflow/commit/5d8ed7b131af4deaf8f815e4db547e52de337758))
* **publish:** 更新 README 以反映扩展包独立安装方式 ([042ac92](https://github.com/Lydanne/spaceflow/commit/042ac920fe6e8e018cf50539a990f6231582e460))
* **review:** 更新 README.md 以反映扩展架构和配置变更 ([560f270](https://github.com/Lydanne/spaceflow/commit/560f27080f3739c2e222cdd985222cfaacafbab6))
* **shared:** 为 shared 包添加 README 文档 ([5d171d5](https://github.com/Lydanne/spaceflow/commit/5d171d5872f849a62251c646294903d11a0c46d2))
* 更新文档以反映新架构和扩展系统重构 ([828c436](https://github.com/Lydanne/spaceflow/commit/828c436bdbba7798ee3211fc77c4f2ef485c6f55))

### 其他修改

* **core:** released version 0.9.0 [no ci] ([e4bd091](https://github.com/Lydanne/spaceflow/commit/e4bd091c3f3cb4ae675f4e594d0c651cea481bc5))
* **publish:** released version 0.32.0 [no ci] ([77a2800](https://github.com/Lydanne/spaceflow/commit/77a2800d9b001ebd2b502db59c9a5994e54665c9))
* **review-summary:** released version 0.10.0 [no ci] ([69ce9f8](https://github.com/Lydanne/spaceflow/commit/69ce9f809a93eb244c5851605062fdd6e26ec73e))
* **review:** released version 0.40.0 [no ci] ([4e89094](https://github.com/Lydanne/spaceflow/commit/4e890941e688b42d5802e5dd65ed9a754871464b))
* **scripts:** released version 0.10.0 [no ci] ([ced0072](https://github.com/Lydanne/spaceflow/commit/ced00727f30171a281555664bc874d1a38a28762))
* **shared:** released version 0.2.0 [no ci] ([2a9db6f](https://github.com/Lydanne/spaceflow/commit/2a9db6fb0ef4af1bfd0bdeac23119df329c34351))
* **shell:** released version 0.10.0 [no ci] ([8ea0f8b](https://github.com/Lydanne/spaceflow/commit/8ea0f8bebe51e8cfff30cfbdcbb3deb66a4b3909))

## [0.30.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.29.0...@spaceflow/cli@0.30.0) (2026-02-26)

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

* **publish:** released version 0.31.0 [no ci] ([e928d60](https://github.com/Lydanne/spaceflow/commit/e928d6061e05c03fc92303a246b2563a5100740b))
* **review-summary:** released version 0.9.0 [no ci] ([c1a2322](https://github.com/Lydanne/spaceflow/commit/c1a2322bb7535d15c63251ea515ee21ea7a4e1bf))
* **review:** released version 0.39.0 [no ci] ([0fbda14](https://github.com/Lydanne/spaceflow/commit/0fbda140982510f49c449eb35605b0dedd27c8cc))
* **scripts:** released version 0.9.0 [no ci] ([8db4c68](https://github.com/Lydanne/spaceflow/commit/8db4c681b6a00bb9717f05aa809bb4e13bbb7e53))
* **shared:** released version 0.1.0 [no ci] ([243e31d](https://github.com/Lydanne/spaceflow/commit/243e31de49dbde605d5a16ec9f0d589792b9cc30))
* **shell:** released version 0.9.0 [no ci] ([b161fe1](https://github.com/Lydanne/spaceflow/commit/b161fe17aec13f59f0dbc04a7a2d392ba6740cca))

## [0.29.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.28.0...@spaceflow/cli@0.29.0) (2026-02-26)

### 修复BUG

* **cli:** 自动安装扩展时根据命令行参数动态设置 verbose 级别 ([d2da6f5](https://github.com/Lydanne/spaceflow/commit/d2da6f5eb30425e48bb4fd924c73bb9237a437ab))

### 其他修改

* **publish:** released version 0.30.0 [no ci] ([2010489](https://github.com/Lydanne/spaceflow/commit/2010489a0d3cddb9ada1c0fc4e833cdeb0c1e706))
* **review-summary:** released version 0.8.0 [no ci] ([0e73a97](https://github.com/Lydanne/spaceflow/commit/0e73a97b035692b0fe7f59e36585cffccf6c6854))
* **review:** released version 0.38.0 [no ci] ([f8c96be](https://github.com/Lydanne/spaceflow/commit/f8c96bed623f24e6c21af389aaaaecf7c057ae5f))
* **scripts:** released version 0.8.0 [no ci] ([efea246](https://github.com/Lydanne/spaceflow/commit/efea246fe1bbd8815c7af44e8fd40df57a0219d6))
* **shell:** released version 0.8.0 [no ci] ([607b93b](https://github.com/Lydanne/spaceflow/commit/607b93bd911e3da102a73dd4513a4733b40c8672))

## [0.28.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.27.0...@spaceflow/cli@0.28.0) (2026-02-26)

### 修复BUG

* **cli:** 修复扩展自动安装逻辑，优化 npm 包名解析 ([0271dd4](https://github.com/Lydanne/spaceflow/commit/0271dd48e0169ae5055cfab28e0656e777de10f4))

### 其他修改

* **publish:** released version 0.29.0 [no ci] ([4083cab](https://github.com/Lydanne/spaceflow/commit/4083cab525c06cc2f5303492f6afe38e4591a72f))
* **review-summary:** released version 0.7.0 [no ci] ([21aced5](https://github.com/Lydanne/spaceflow/commit/21aced5a10fd522122e5f2c6f4ce3a318b80dff2))
* **review:** released version 0.37.0 [no ci] ([b26e2bb](https://github.com/Lydanne/spaceflow/commit/b26e2bba0df5471d4fb54c70bf230d6f2c964504))
* **scripts:** released version 0.7.0 [no ci] ([6392c03](https://github.com/Lydanne/spaceflow/commit/6392c03e2c8dc9376ae24baaa3ef3fc62be9c762))
* **shell:** released version 0.7.0 [no ci] ([da9dd6b](https://github.com/Lydanne/spaceflow/commit/da9dd6b07b0cfc807a20fecaa84418c90fc97b7b))

## [0.27.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.26.0...@spaceflow/cli@0.27.0) (2026-02-26)

### 代码重构

* **core:** 将 i18n 实例管理从 core 迁移至 cli，core 仅提供翻译接口 ([64b5398](https://github.com/Lydanne/spaceflow/commit/64b5398bfaf8ad7b7032400a3bf15bd7433896b8))

### 其他修改

* **core:** released version 0.8.0 [no ci] ([1ef855e](https://github.com/Lydanne/spaceflow/commit/1ef855e1e67e7b1cc0a45278b208f4e539ad6602))
* **publish:** released version 0.28.0 [no ci] ([c226199](https://github.com/Lydanne/spaceflow/commit/c22619956276d6c4464ae94f6e47f798d66eba2b))
* **review-summary:** released version 0.6.0 [no ci] ([185e4ff](https://github.com/Lydanne/spaceflow/commit/185e4ff5488a13cd32e54a442bf41728abdadb4e))
* **review:** released version 0.36.0 [no ci] ([32df799](https://github.com/Lydanne/spaceflow/commit/32df799cf56a1bd7ca987fe79c6392dfc829f841))
* **scripts:** released version 0.6.0 [no ci] ([91ea44e](https://github.com/Lydanne/spaceflow/commit/91ea44ec943c2de318b32c0cd29d8c6ce1e89012))
* **shell:** released version 0.6.0 [no ci] ([bffd7b5](https://github.com/Lydanne/spaceflow/commit/bffd7b5cef4f3d4b7e306339e93e1c7752d459df))

## [0.26.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.25.0...@spaceflow/cli@0.26.0) (2026-02-26)

### 代码重构

* **core:** 使用 globalThis 确保多份 core 实例共享同一个 i18n 状态 ([c46e713](https://github.com/Lydanne/spaceflow/commit/c46e713d3e6e4d84447ebecad6ea719fc861854f))
* **core:** 实现扩展自动安装机制，确保 .spaceflowrc 声明的依赖自动同步 ([89af2ae](https://github.com/Lydanne/spaceflow/commit/89af2ae864decd6f2acb917d59afd657ee8e4562))

### 其他修改

* **core:** released version 0.7.0 [no ci] ([1e37534](https://github.com/Lydanne/spaceflow/commit/1e37534d5e25ce8e08bb90a073c402d0cae80c9d))
* **publish:** released version 0.27.0 [no ci] ([2474165](https://github.com/Lydanne/spaceflow/commit/2474165f69492a0e0038e7713436c09ee7b27ec3))
* **review-summary:** released version 0.5.0 [no ci] ([8ebcc22](https://github.com/Lydanne/spaceflow/commit/8ebcc224b61afebd77a21ec9beafe5e813b2e7ec))
* **review:** released version 0.35.0 [no ci] ([d33b8ee](https://github.com/Lydanne/spaceflow/commit/d33b8eebdbcb2871a151df004c41bee86bfaedb7))
* **scripts:** released version 0.5.0 [no ci] ([0d8de8d](https://github.com/Lydanne/spaceflow/commit/0d8de8d0b211b8e398730de25d06eee7d3cfb7b3))
* **shell:** released version 0.5.0 [no ci] ([d26230c](https://github.com/Lydanne/spaceflow/commit/d26230c5d45e4f4301c11581304e4c8f536abac0))

## [0.25.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.24.0...@spaceflow/cli@0.25.0) (2026-02-25)

### 代码重构

* **core:** 修复 dependencies 写入格式，确保与 package.json 规范一致 ([b3d4ada](https://github.com/Lydanne/spaceflow/commit/b3d4ada9ece7d191bdbf035550553c9919d9d90f))

### 其他修改

* **core:** released version 0.6.0 [no ci] ([42d7669](https://github.com/Lydanne/spaceflow/commit/42d76699e3b74fd3fe64031a004003967ddbdbd6))
* **publish:** released version 0.26.0 [no ci] ([2f196b1](https://github.com/Lydanne/spaceflow/commit/2f196b196a0cdb6da94881c27d5d55202c5fa8c0))
* **review-summary:** released version 0.4.0 [no ci] ([6a9e7d5](https://github.com/Lydanne/spaceflow/commit/6a9e7d58f796a72fb381e18bfb0d0a1799fd2d5d))
* **review:** released version 0.34.0 [no ci] ([fb1ae4a](https://github.com/Lydanne/spaceflow/commit/fb1ae4a48a6ff6f68b43ea45ac8950283605bad6))
* **scripts:** released version 0.4.0 [no ci] ([b30f118](https://github.com/Lydanne/spaceflow/commit/b30f118e07506485ceaafaa850d13b3167facea9))
* **shell:** released version 0.4.0 [no ci] ([dca978f](https://github.com/Lydanne/spaceflow/commit/dca978fd7c620a78ecc9f23e96f29775a1276f0d))

## [0.24.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.23.0...@spaceflow/cli@0.24.0) (2026-02-25)

### 代码重构

* **cli:** 统一使用 core 层配置读取函数，移除重复的配置解析逻辑 ([5783e5f](https://github.com/Lydanne/spaceflow/commit/5783e5f693b0aafd8346ee3a250692265aad55c5))

### 其他修改

* **publish:** released version 0.25.0 [no ci] ([3bae586](https://github.com/Lydanne/spaceflow/commit/3bae586e34df1978a010a33bba20611082b3c3e2))
* **review-summary:** released version 0.3.0 [no ci] ([9a881e9](https://github.com/Lydanne/spaceflow/commit/9a881e94b6141592aefc835861bf2bf7cca9eefe))
* **review:** released version 0.33.0 [no ci] ([467cf91](https://github.com/Lydanne/spaceflow/commit/467cf91c60c0693e22c172a9358d0981dc8a9d64))
* **scripts:** released version 0.3.0 [no ci] ([7b62b7b](https://github.com/Lydanne/spaceflow/commit/7b62b7bc7a4c4795472d729df321acbde808ec4d))
* **shell:** released version 0.3.0 [no ci] ([baa26b3](https://github.com/Lydanne/spaceflow/commit/baa26b3d6bc63de2c252101d915badf4461dfbd1))

## [0.23.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.22.0...@spaceflow/cli@0.23.0) (2026-02-25)

### 代码重构

* **core:** 优化 dependencies 配置管理，支持按字段查找配置文件并原地更新 ([6d97021](https://github.com/Lydanne/spaceflow/commit/6d97021a3051602ac655b0beff89acdfc8dbe497))

### 其他修改

* **core:** released version 0.5.0 [no ci] ([1d491aa](https://github.com/Lydanne/spaceflow/commit/1d491aa3d527714e2d0df2bbc55bc3e1374332f3))
* **publish:** released version 0.24.0 [no ci] ([260e96e](https://github.com/Lydanne/spaceflow/commit/260e96e2c6dfb4201c40a0c55f78428a9f6c502c))
* **review-summary:** released version 0.2.0 [no ci] ([f947083](https://github.com/Lydanne/spaceflow/commit/f94708316cafbddbd225594b90c9a91e41d4599f))
* **review:** released version 0.32.0 [no ci] ([43498f0](https://github.com/Lydanne/spaceflow/commit/43498f04b5f33cc3de6a3ca652b2bc2f12c47ac8))
* **scripts:** released version 0.2.0 [no ci] ([7848836](https://github.com/Lydanne/spaceflow/commit/7848836911f50b67302db82aa05e22d5670ef01e))
* **shell:** released version 0.2.0 [no ci] ([6a31ede](https://github.com/Lydanne/spaceflow/commit/6a31edeebf7c212bd4095766fc44a1fd66c37ab7))

## [0.22.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.21.0...@spaceflow/cli@0.22.0) (2026-02-25)

### 修复BUG

* **core:** 移除 isPnpmWorkspace 检查，改为在读取项目 package.json 版本时处理 workspace 协议 ([ed04f56](https://github.com/Lydanne/spaceflow/commit/ed04f568cebdc71a9c9ad08eebe343bf82250d5d))

### 代码重构

* **cli:** 移除 ensureSpaceflowPackageJson 调用中的 isGlobal 和 cwd 参数 ([731758f](https://github.com/Lydanne/spaceflow/commit/731758fabb54236c0002be6815070af804c1801e))
* **core:** 移除 .spaceflow 目录的 pnpm-workspace.yaml 创建逻辑 ([538f7b0](https://github.com/Lydanne/spaceflow/commit/538f7b0e1b71515f3cdfa7273747f0fa728f737a))
* **core:** 简化 ensureSpaceflowPackageJson，移除 isGlobal 参数，改为从 cli 入口读取 core 版本 ([eb4df3e](https://github.com/Lydanne/spaceflow/commit/eb4df3e3af261e3017ad26a308afe760667acba5))
* 将 .spaceflow 配置迁移到根目录 .spaceflowrc，统一使用 workspace: 协议管理依赖 ([0aff2af](https://github.com/Lydanne/spaceflow/commit/0aff2afa6176e97c1f131b37cec51e32051a346a))

### 其他修改

* **core:** released version 0.4.0 [no ci] ([144a5d8](https://github.com/Lydanne/spaceflow/commit/144a5d8afdc9681b548406f83491359a2accfa3c))
* **publish:** released version 0.23.0 [no ci] ([1a6510f](https://github.com/Lydanne/spaceflow/commit/1a6510f997718468efbbac377ac9d44f07e8e927))
* **review-summary:** released version 0.1.0 [no ci] ([eb52706](https://github.com/Lydanne/spaceflow/commit/eb527063cc6e99530436d5a370827596baae44a3))
* **review:** released version 0.31.0 [no ci] ([ec5ffe5](https://github.com/Lydanne/spaceflow/commit/ec5ffe5213099a7e77549648bd9da9ad53c640cc))
* **scripts:** released version 0.1.0 [no ci] ([98abf0e](https://github.com/Lydanne/spaceflow/commit/98abf0e6e17985320a4d96e1350cea05e8f81b15))
* **shell:** released version 0.1.0 [no ci] ([e03b69e](https://github.com/Lydanne/spaceflow/commit/e03b69e7ad7d3db6e96c699ec715c2313b236196))

## [0.21.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.20.0...@spaceflow/cli@0.21.0) (2026-02-25)

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

* **ci-scripts:** released version 0.20.0 [no ci] ([ed8d88d](https://github.com/Lydanne/spaceflow/commit/ed8d88df09c7d119df092793e4c83d451d67a6b8))
* **ci-shell:** released version 0.20.0 [no ci] ([5109d94](https://github.com/Lydanne/spaceflow/commit/5109d944bfbd95596e71d6e11e56d3e3599f8297))
* **core:** released version 0.3.0 [no ci] ([7a66bea](https://github.com/Lydanne/spaceflow/commit/7a66beac3702107884f638a1f3fd54c5c10be568))
* **period-summary:** released version 0.20.0 [no ci] ([54feb4a](https://github.com/Lydanne/spaceflow/commit/54feb4adaf0d72d402287bef84fd9433db673ed6))
* **publish:** released version 0.22.0 [no ci] ([2e39f34](https://github.com/Lydanne/spaceflow/commit/2e39f347c514490be5da690c896849fc6dbfd513))
* **review:** released version 0.30.0 [no ci] ([1e880b1](https://github.com/Lydanne/spaceflow/commit/1e880b1e535945125d746a0e5e4cb5453422373e))

## [0.20.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.19.4...@spaceflow/cli@0.20.0) (2026-02-16)

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

* **ci-scripts:** released version 0.19.3 [no ci] ([dfa4ebf](https://github.com/Lydanne/spaceflow/commit/dfa4ebf2b8cad72c8088750ac601f062f973411f))
* **ci-shell:** released version 0.19.3 [no ci] ([0cf07cd](https://github.com/Lydanne/spaceflow/commit/0cf07cdb70fbfb5c7a36a7955f5c9f248bb917fd))
* **core:** released version 0.2.0 [no ci] ([6176e7e](https://github.com/Lydanne/spaceflow/commit/6176e7e5755dd594dee7d4e0016dfb89b391d824))
* **period-summary:** released version 0.19.3 [no ci] ([85827b9](https://github.com/Lydanne/spaceflow/commit/85827b95d44e0f7db28e083515a8232310e2359f))
* **publish:** released version 0.21.3 [no ci] ([78d680c](https://github.com/Lydanne/spaceflow/commit/78d680ce99d511674b5cdafca52d1481a4f6c673))
* **review:** released version 0.29.3 [no ci] ([82ba72d](https://github.com/Lydanne/spaceflow/commit/82ba72d00c3cf7e50434ea63e7cd30c6ea851a51))

## [0.19.4](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.19.3...@spaceflow/cli@0.19.4) (2026-02-16)

### 修复BUG

* **cli:** 配置 CommandFactory 在错误时不中止执行 ([e55eaa9](https://github.com/Lydanne/spaceflow/commit/e55eaa9a8f0c3f90564657df2a9cb5cd3314956c))

### 其他修改

* **ci-scripts:** released version 0.19.2 [no ci] ([aabfbf3](https://github.com/Lydanne/spaceflow/commit/aabfbf327353bdda370884f6887be92ee2e23c0c))
* **ci-shell:** released version 0.19.2 [no ci] ([ef258b7](https://github.com/Lydanne/spaceflow/commit/ef258b7cd02305c82c5813c4056def14548261d3))
* **period-summary:** released version 0.19.2 [no ci] ([ce5530e](https://github.com/Lydanne/spaceflow/commit/ce5530ecc75703872d00a97aa19a745be4fd2a6d))
* **publish:** released version 0.21.2 [no ci] ([2adc708](https://github.com/Lydanne/spaceflow/commit/2adc708b51e331df60a2bb3173eb669bbc150d87))
* **review:** released version 0.29.2 [no ci] ([ec0f499](https://github.com/Lydanne/spaceflow/commit/ec0f499c802d57a64cc01580dbccf991a6855331))

## [0.19.3](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.19.2...@spaceflow/cli@0.19.3) (2026-02-16)

### 其他修改

* **ci-scripts:** released version 0.19.1 [no ci] ([9f24102](https://github.com/Lydanne/spaceflow/commit/9f2410204dcffd20678a529c0a94fee461c436c8))
* **ci-shell:** released version 0.19.1 [no ci] ([b58c112](https://github.com/Lydanne/spaceflow/commit/b58c1128f55491a551d71d45792a8af1a009dafd))
* **core:** released version 0.1.3 [no ci] ([e02f23b](https://github.com/Lydanne/spaceflow/commit/e02f23b8d3ea3078b93bc4467de845bbd4bd1c35))
* **period-summary:** released version 0.19.1 [no ci] ([4338a6d](https://github.com/Lydanne/spaceflow/commit/4338a6d8c4b7f8335d1adfc2ccce2cc7bb1568c8))
* **publish:** released version 0.21.1 [no ci] ([6992af8](https://github.com/Lydanne/spaceflow/commit/6992af8e311690ad197203c715ab012e635b0530))
* **review:** released version 0.29.1 [no ci] ([a285a81](https://github.com/Lydanne/spaceflow/commit/a285a8160adade1dd3d08d8434aeec4bafe65c86))
* 为 cli 和 core 包添加 files 字段以控制发布内容 ([5a43ee2](https://github.com/Lydanne/spaceflow/commit/5a43ee2499995dab8bdc06042269fa163fc98e31))

## [0.19.2](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.19.1...@spaceflow/cli@0.19.2) (2026-02-15)

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

* **core:** released version 0.1.2 [no ci] ([cc6f4af](https://github.com/Lydanne/spaceflow/commit/cc6f4afe2ad57cf482e11d9af80dddf50b53868c))

## [0.19.1](https://github.com/Lydanne/spaceflow/compare/@spaceflow/cli@0.19.0...@spaceflow/cli@0.19.1) (2026-02-15)

### 代码重构

* 优化插件发现机制，支持动态解析扩展目录 ([31d6ff9](https://github.com/Lydanne/spaceflow/commit/31d6ff9f306b28607994ad50b9e40d550f3a646b))
* 统一术语，将 skill 重命名为 extension ([cdf0736](https://github.com/Lydanne/spaceflow/commit/cdf073630708875cb814a555d407393c075fbff1))
* 调整项目目录结构，统一包管理规范 ([5f89adb](https://github.com/Lydanne/spaceflow/commit/5f89adbb17b40ebe8bdd045a85c4c337fa385c43))

### 文档更新

* 重写 README 并添加各插件文档 ([066b10a](https://github.com/Lydanne/spaceflow/commit/066b10acb869de30e3af0ece59ab5d81ec78d668))

### 其他修改

* **core:** released version 0.1.1 [no ci] ([45f4c0c](https://github.com/Lydanne/spaceflow/commit/45f4c0c5092beacf3459c16b46e517227caff91e))
* 为所有包添加 npm 公开发布配置 ([b9d2dcc](https://github.com/Lydanne/spaceflow/commit/b9d2dccd8e7bd4a74f6f0db83ee68dfb892b2d51))
* 优化 GitHub Actions 工作流和 npm 发布配置 ([7ae7cc5](https://github.com/Lydanne/spaceflow/commit/7ae7cc51ff0c865527f2b835bfaf26227372fd36))
* 初始化仓库 ([08d011d](https://github.com/Lydanne/spaceflow/commit/08d011d63f1852ecd9ae47425e743f4eb55fceb3))
* 添加 release-it-gitea 依赖 ([9c5d5d6](https://github.com/Lydanne/spaceflow/commit/9c5d5d6a56de621a8bff9cb2b3c29c6e0843b98b))
* 添加文档部署工作流并更新配置 ([0cc52fd](https://github.com/Lydanne/spaceflow/commit/0cc52fdef24f4d8696d0601cd001f6d470291ecc))
* 移除 administration 权限并禁用分支锁定 ([cc51fa5](https://github.com/Lydanne/spaceflow/commit/cc51fa50d20159ee4fd273560364ee945213018c))

## [0.19.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.18.0...@spaceflow/cli@0.19.0) (2026-02-15)

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

* **ci-scripts:** released version 0.18.0 [no ci] ([e17894a](https://git.bjxgj.com/xgj/spaceflow/commit/e17894a5af53ff040a0a17bc602d232f78415e1b))
* **ci-shell:** released version 0.18.0 [no ci] ([f64fd80](https://git.bjxgj.com/xgj/spaceflow/commit/f64fd8009a6dd725f572c7e9fbf084d9320d5128))
* **ci:** 迁移工作流从 Gitea 到 GitHub 并统一环境变量命名 ([57e3bae](https://git.bjxgj.com/xgj/spaceflow/commit/57e3bae635b324c8c4ea50a9fb667b6241fae0ef))
* **config:** 将 git 推送白名单用户从 "Gitea Actions" 改为 "GiteaActions" ([fdbb865](https://git.bjxgj.com/xgj/spaceflow/commit/fdbb865341e6f02b26fca32b54a33b51bee11cad))
* **config:** 将 git 推送白名单用户从 github-actions[bot] 改为 Gitea Actions ([9c39819](https://git.bjxgj.com/xgj/spaceflow/commit/9c39819a9f95f415068f7f0333770b92bc98321b))
* **config:** 移除 review-spec 私有仓库依赖 ([8ae18f1](https://git.bjxgj.com/xgj/spaceflow/commit/8ae18f13c441b033d1cbc75119695a5cc5cb6a0b))
* **core:** released version 0.1.0 [no ci] ([170fa67](https://git.bjxgj.com/xgj/spaceflow/commit/170fa670e98473c2377120656d23aae835c51997))
* **core:** 禁用 i18next 初始化时的 locize.com 推广日志 ([a99fbb0](https://git.bjxgj.com/xgj/spaceflow/commit/a99fbb068441bc623efcf15a1dd7b6bd38c05f38))
* **deps:** 移除 pnpm catalog 配置并更新依赖锁定 ([753fb9e](https://git.bjxgj.com/xgj/spaceflow/commit/753fb9e3e43b28054c75158193dc39ab4bab1af5))
* **docs:** 统一文档脚本命名,为 VitePress 命令添加 docs: 前缀 ([3cc46ea](https://git.bjxgj.com/xgj/spaceflow/commit/3cc46eab3a600290f5064b8270902e586b9c5af4))
* **i18n:** 配置 i18n-ally-next 自动提取键名生成策略 ([753c3dc](https://git.bjxgj.com/xgj/spaceflow/commit/753c3dc3f24f3c03c837d1ec2c505e8e3ce08b11))
* **i18n:** 重构 i18n 配置并统一 locales 目录结构 ([3e94037](https://git.bjxgj.com/xgj/spaceflow/commit/3e94037fa6493b3b0e4a12ff6af9f4bea48ae217))
* **period-summary:** released version 0.18.0 [no ci] ([f0df638](https://git.bjxgj.com/xgj/spaceflow/commit/f0df63804d06f8c75e04169ec98226d7a4f5d7f9))
* **publish:** released version 0.20.0 [no ci] ([d347e3b](https://git.bjxgj.com/xgj/spaceflow/commit/d347e3b2041157d8dc6e3ade69b05a481b2ab371))
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

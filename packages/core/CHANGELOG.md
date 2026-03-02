# Changelog

## [0.21.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.20.0...@spaceflow/core@0.21.0) (2026-03-02)

### 新特性

* **actions:** 增强对 Gitea 平台的环境变量支持 ([21ba3da](https://github.com/Lydanne/spaceflow/commit/21ba3daa182083ecaec0113de91caf2ab1068000))
* **actions:** 支持 Gitea 作为 Git Provider ([4c88b36](https://github.com/Lydanne/spaceflow/commit/4c88b36d97ab49a322bac571385b0e57029676ff))
* **core:** 增强对 Gitea 平台的支持并修复类型转换 ([bfbb45c](https://github.com/Lydanne/spaceflow/commit/bfbb45c521035c80f0e81f5572d5aa1b554405f7))
* **publish:** 支持 Gitea 环境变量作为 CI 配置来源 ([cd1ba77](https://github.com/Lydanne/spaceflow/commit/cd1ba778617731ef85f9851883122175a99d72ac))
* **review-summary:** 新增 defect-rate 缺陷率评分策略 ([2777f4d](https://github.com/Lydanne/spaceflow/commit/2777f4da6d364cbc801792f4fa7ac6323da5e1bc))
* **review-summary:** 新增 issue-based 评分策略并更新文档 ([b6d923e](https://github.com/Lydanne/spaceflow/commit/b6d923e060aafd0b298a39d6fdc3e2f76facf1f3))
* **review:** 支持从 Gitea Actions 事件文件解析 PR 编号 ([09e2e58](https://github.com/Lydanne/spaceflow/commit/09e2e58d84f773b8a3184feb73b90cb110993ebd))

### 文档更新

* **docs:** 更新 review-summary 命令的 CI 配置示例 ([8b2b2c5](https://github.com/Lydanne/spaceflow/commit/8b2b2c55ed497619cbb91bd4fd2e5124b6f5ac37))
* **docs:** 更新 review-summary 命令的 CI 集成示例 ([60c5b70](https://github.com/Lydanne/spaceflow/commit/60c5b70695aa6a4c9cae1e3936670b34d5486792))
* **docs:** 更新环境变量参考文档，增加 GitLab 支持并优化 Gitea 说明 ([a02f8e0](https://github.com/Lydanne/spaceflow/commit/a02f8e0309368334bc77a331f65338435657eddb))
* **review-summary:** 更新错误信息以支持 Gitea 环境变量 ([cd02818](https://github.com/Lydanne/spaceflow/commit/cd028183fe7e14d993566e8dc49849b07d2540d9))
* **scripts:** 更新错误信息以支持 Gitea 环境变量 ([9a9d7f2](https://github.com/Lydanne/spaceflow/commit/9a9d7f20a63bea4cc13d284ed41bc9c4f4aa6595))
* **shell:** 更新错误信息以支持 Gitea 环境变量 ([72c51d7](https://github.com/Lydanne/spaceflow/commit/72c51d792c140d44d8aa3cb05666de72d170a185))
* 修复 GitHub Actions 配置示例的 Markdown 渲染问题 ([01daec5](https://github.com/Lydanne/spaceflow/commit/01daec551f2e23ab70357f88b7789897922064a7))

### 测试用例

* **core:** 修复测试用例中的导入和模拟函数实现 ([0137d4b](https://github.com/Lydanne/spaceflow/commit/0137d4b400f272ce7f7ba74fc5b37fcc453ed717))

### 其他修改

* **publish:** released version 0.44.0 [no ci] ([5b29159](https://github.com/Lydanne/spaceflow/commit/5b29159b2f0129d2ce81329cf48734d3d56b226e))
* **review-summary:** released version 0.22.0 [no ci] ([e0fde59](https://github.com/Lydanne/spaceflow/commit/e0fde59b23109f8323bd247ab2c1f553812284e1))
* **review:** released version 0.57.0 [no ci] ([238a831](https://github.com/Lydanne/spaceflow/commit/238a83165fa1810a9429b8d6a66a1f75c477ce22))
* **scripts:** released version 0.22.0 [no ci] ([f482504](https://github.com/Lydanne/spaceflow/commit/f48250486906016b414a7b00aabac342c1399045))
* **shell:** released version 0.22.0 [no ci] ([e716369](https://github.com/Lydanne/spaceflow/commit/e716369f57bfa20e710d354245c54d3a80e701f4))

## [0.20.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.19.0...@spaceflow/core@0.20.0) (2026-03-02)

### 新特性

* **core:** Gitea适配器支持通过标签名称创建Issue ([cf10eda](https://github.com/Lydanne/spaceflow/commit/cf10eda5d025c560cc0d8e3826dad40716020d5c))
* **review-summary:** commit-based 评分新增修复问题加分机制，支持从 review 模块精确提取问题统计 ([304bf81](https://github.com/Lydanne/spaceflow/commit/304bf81ab475b280ab5f4011159bc697861bddf6))
* **review-summary:** 支持为周期统计报告 Issue 配置自定义标签 ([df1cc61](https://github.com/Lydanne/spaceflow/commit/df1cc61167851ff7106104914319f43f73ba8902))
* **review-summary:** 支持通过配置文件自定义评分权重 ([53e1a37](https://github.com/Lydanne/spaceflow/commit/53e1a371288aea6ceac63b03fda99eea1739be4b))
* **review-summary:** 新增 commit-based 评分策略，支持按有效 commit 累计计分 ([111c0d6](https://github.com/Lydanne/spaceflow/commit/111c0d6b9d87d12096e0edb69a11eceff55b79c1))
* **review:** 为行级评论 Review 添加统计信息摘要 ([58d5b37](https://github.com/Lydanne/spaceflow/commit/58d5b37ba54daa24bd2f8396318fedc87f388c74))
* **review:** 优化问题统计展示，按 severity 分级显示 error/warn 数量 ([bcb2608](https://github.com/Lydanne/spaceflow/commit/bcb26086589a67e815db075f3001209904572926))
* **review:** 保留历史行级评论，为每轮 Review 生成独立评论并添加上轮回顾 ([de431a0](https://github.com/Lydanne/spaceflow/commit/de431a09b4e3b5e1ada9ee5f1ee65786d22b6ff9))
* **review:** 支持用户手动 resolve 评论并在报告中区分 AI 修复与手动解决 ([c968b65](https://github.com/Lydanne/spaceflow/commit/c968b65c850bc68de3f4409aa3b5294e5a0311ff))
* **review:** 新增 MCP 工具支持从目录批量加载代码审查规则 ([289a836](https://github.com/Lydanne/spaceflow/commit/289a83650f1e222482fcbaaa69fb5ea562c5a4c2))
* **review:** 新增解决率统计指标，区分修复率和解决率的计算维度 ([436541f](https://github.com/Lydanne/spaceflow/commit/436541fce605319da562445a81242a8feb257df9))

### 修复BUG

* **review:** 修复率计算仅统计 AI 修复的问题，排除手动解决的问题 ([12b3415](https://github.com/Lydanne/spaceflow/commit/12b3415749c9d8523e8b23365fbb39fc7657ff1d))
* **review:** 修正 PR 评论标题中的 emoji 显示问题 ([bcdc946](https://github.com/Lydanne/spaceflow/commit/bcdc9467bf7970c9acd3ea00303bcae5eaff131f))

### 代码重构

* **review:** 抽取规则加载和问题验证逻辑为独立方法，优化代码复用性 ([7ea02ba](https://github.com/Lydanne/spaceflow/commit/7ea02ba86e369bc130c69c561195634072cc060a))

### 文档更新

* **docs:** 为 review-summary 命令文档补充 Issue 输出配置说明 ([196fa94](https://github.com/Lydanne/spaceflow/commit/196fa94ad1ed2dbadbdcb332ef26cf1fe7fcd8d7))
* **review-summary:** 完善文档，新增时间预设、评分算法及输出示例说明 ([fb04685](https://github.com/Lydanne/spaceflow/commit/fb04685dde4157f0a1a2f8edaf1fb3c125280e27))
* **review:** 完善 review 命令文档，新增审查流程、多轮审查、问题生命周期等核心机制说明 ([d6b2a20](https://github.com/Lydanne/spaceflow/commit/d6b2a20802ab98e5ddb01937c0fe8b268c403c6f))

### 其他修改

* **publish:** released version 0.43.0 [no ci] ([1074b9c](https://github.com/Lydanne/spaceflow/commit/1074b9c5fb21a447093ef23300c451d790710b33))
* **review-summary:** released version 0.21.0 [no ci] ([11379c4](https://github.com/Lydanne/spaceflow/commit/11379c478859a12dd0340a78b1578487d9a24b31))
* **review:** released version 0.53.0 [no ci] ([5a6af03](https://github.com/Lydanne/spaceflow/commit/5a6af03c260060ac1b1901bb7273f501ca0037c7))
* **review:** released version 0.54.0 [no ci] ([252269a](https://github.com/Lydanne/spaceflow/commit/252269a299f9e580b858e04814e7d9a13fed7736))
* **review:** released version 0.55.0 [no ci] ([0245743](https://github.com/Lydanne/spaceflow/commit/02457439788dd70925b91118f7d5936a61d0e0de))
* **review:** released version 0.56.0 [no ci] ([2481dec](https://github.com/Lydanne/spaceflow/commit/2481dec141b0d5f444b5815ab9598378ac3e0b12))
* **scripts:** released version 0.21.0 [no ci] ([1f0a213](https://github.com/Lydanne/spaceflow/commit/1f0a2139d155807451dc968de8213bafe2e4edb8))
* **shell:** released version 0.21.0 [no ci] ([b619af7](https://github.com/Lydanne/spaceflow/commit/b619af741e16053868a2eedd41f56d50134954d8))

## [0.19.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.18.0...@spaceflow/core@0.19.0) (2026-03-02)

### 修复BUG

* **core:** 重构配置 Schema 生成逻辑，使用 SpaceflowConfigSchema 作为基础 ([c73eb1c](https://github.com/Lydanne/spaceflow/commit/c73eb1ce5b6f212b8a932a15224db7e63822f8d0))

### 测试用例

* **review:** 增强 AI 评论识别和过滤功能的测试覆盖 ([bda706b](https://github.com/Lydanne/spaceflow/commit/bda706b99aab113521afe6bcd386a590811e20a6))

### 其他修改

* **publish:** released version 0.42.0 [no ci] ([61ac6b2](https://github.com/Lydanne/spaceflow/commit/61ac6b233564550d35e84759eff60a9e04181c46))
* **review-summary:** released version 0.20.0 [no ci] ([bb3f815](https://github.com/Lydanne/spaceflow/commit/bb3f81567bf6946964a19b9207b8b9beff690b8a))
* **review:** released version 0.50.0 [no ci] ([cff42fa](https://github.com/Lydanne/spaceflow/commit/cff42fafcc588d0c497d9e0e4750620262adcfec))
* **review:** released version 0.51.0 [no ci] ([c93be78](https://github.com/Lydanne/spaceflow/commit/c93be78f6f1df9cb5e3515cee58cda65cad1b00f))
* **review:** released version 0.52.0 [no ci] ([c86406f](https://github.com/Lydanne/spaceflow/commit/c86406f6934d5de4f198eadff66ee6c3f7cfbe0d))
* **review:** 移除 .spaceflow 目录及其配置文件 ([64b310d](https://github.com/Lydanne/spaceflow/commit/64b310d8a77614a259a8d7588a09169626efb3ae))
* **scripts:** released version 0.20.0 [no ci] ([e1fac49](https://github.com/Lydanne/spaceflow/commit/e1fac49257bf4a5902c5884ec0e054384a7859d6))
* **shell:** released version 0.20.0 [no ci] ([8b69b53](https://github.com/Lydanne/spaceflow/commit/8b69b5340fe99973add2bea3e7d53f2082d0da54))

## [0.18.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.17.0...@spaceflow/core@0.18.0) (2026-02-27)

### 新特性

* **core:** 为 Gitea 和 GitHub 适配器完善已解决评论列表功能 ([7134c83](https://github.com/Lydanne/spaceflow/commit/7134c83b0b440bdfb688d93e86c9552302bf45b2))
* **review:** 增强已解决问题同步功能，支持记录解决者 ([2c74996](https://github.com/Lydanne/spaceflow/commit/2c74996471e003f8666f8ccec715590f0f64c017))

### 其他修改

* **publish:** released version 0.41.0 [no ci] ([e96a488](https://github.com/Lydanne/spaceflow/commit/e96a48824bbb305142b78afa989e3473eec0c1c2))
* **review-summary:** released version 0.19.0 [no ci] ([f1b6a2e](https://github.com/Lydanne/spaceflow/commit/f1b6a2e21cc2f9e07bb8e100a358abcba16f2d03))
* **review:** released version 0.49.0 [no ci] ([404588d](https://github.com/Lydanne/spaceflow/commit/404588d61e77d2230b53c22afad404d20f5e1665))
* **scripts:** released version 0.19.0 [no ci] ([e198652](https://github.com/Lydanne/spaceflow/commit/e198652a1dcbd137dcd0fe4d7a2f404e12a991bc))
* **shell:** released version 0.19.0 [no ci] ([2dc2597](https://github.com/Lydanne/spaceflow/commit/2dc25974cfeac9c80d03a601e722133bccb25086))

## [0.17.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.16.0...@spaceflow/core@0.17.0) (2026-02-27)

### 修复BUG

* **review:** 修复重复 AI 评论问题，改进评论查找和清理逻辑 ([5ec3757](https://github.com/Lydanne/spaceflow/commit/5ec3757533f618aa6210ccebecabf411b2dae9a4))
* **review:** 修改 generateDescription 选项处理逻辑，仅在明确指定时设置为 true ([48e710a](https://github.com/Lydanne/spaceflow/commit/48e710ade62e0aeaf2effa3db58dbcb2b2a0983e))

### 其他修改

* **publish:** released version 0.40.0 [no ci] ([8fe14c7](https://github.com/Lydanne/spaceflow/commit/8fe14c7faffa2784b91710d3f129911534bf64d2))
* **review-summary:** released version 0.18.0 [no ci] ([164fb64](https://github.com/Lydanne/spaceflow/commit/164fb64c511d93466585cb5d6df7cd6be0922c8c))
* **review:** released version 0.48.0 [no ci] ([4e92d6f](https://github.com/Lydanne/spaceflow/commit/4e92d6f72dcd1e94fbf8a9a772b561da9d39c92c))
* **scripts:** released version 0.18.0 [no ci] ([289be06](https://github.com/Lydanne/spaceflow/commit/289be06674264d98ab9e1da908d088fff4e1cf7e))
* **shell:** released version 0.18.0 [no ci] ([88bf217](https://github.com/Lydanne/spaceflow/commit/88bf2178e3361516871c887fda75f7a0086ed55f))

## [0.16.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.15.0...@spaceflow/core@0.16.0) (2026-02-27)

### 新特性

* **mcp:** 添加 MCP 资源支持，包括扩展资源和内置配置/扩展列表资源 ([ab19889](https://github.com/Lydanne/spaceflow/commit/ab198890a13c998c17987734da3875834f747a70))

### 其他修改

* **cli:** released version 0.38.0 [no ci] ([b8c1a54](https://github.com/Lydanne/spaceflow/commit/b8c1a546876b1ad74d5da755c9ecafea9a99798d))
* **publish:** released version 0.39.0 [no ci] ([f4db046](https://github.com/Lydanne/spaceflow/commit/f4db04635eab83ad44f8f3b935aa66ecfd02feff))
* **review-summary:** released version 0.17.0 [no ci] ([e00f17d](https://github.com/Lydanne/spaceflow/commit/e00f17dc2ade751ff4de7b45b4d9671b25271f7c))
* **review:** released version 0.47.0 [no ci] ([994893e](https://github.com/Lydanne/spaceflow/commit/994893edb3355ecf7f0c9f3e8bec6090511f987c))
* **scripts:** released version 0.17.0 [no ci] ([8946ea6](https://github.com/Lydanne/spaceflow/commit/8946ea68e1ea372ae9d1c20cef098e1ef59bdf25))
* **shell:** released version 0.17.0 [no ci] ([fb4e833](https://github.com/Lydanne/spaceflow/commit/fb4e833b1a469bf2446b25656a3b439584a4639a))

## [0.15.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.14.0...@spaceflow/core@0.15.0) (2026-02-27)

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
* **cli:** released version 0.37.0 [no ci] ([a260a9a](https://github.com/Lydanne/spaceflow/commit/a260a9a13f1f7d8457ea036e40f5562548b4513e))
* **publish:** released version 0.38.0 [no ci] ([2a3adf7](https://github.com/Lydanne/spaceflow/commit/2a3adf75af6a44a890b198609bed1090f6d3be6d))
* **review-summary:** released version 0.16.0 [no ci] ([912b5f5](https://github.com/Lydanne/spaceflow/commit/912b5f5cf907935e7ef9e39ad32b742c46843b7e))
* **review:** released version 0.46.0 [no ci] ([54a33ce](https://github.com/Lydanne/spaceflow/commit/54a33ce9590be2b3c35eaf30c9423bc46e996ce8))
* **scripts:** released version 0.16.0 [no ci] ([77be50e](https://github.com/Lydanne/spaceflow/commit/77be50ea413e7b5c969c111429fd8cc425263cd1))
* **shared:** released version 0.6.0 [no ci] ([fcfdf75](https://github.com/Lydanne/spaceflow/commit/fcfdf75efa2146b5ed91e5c7f273a4f938c032b8))
* **shell:** released version 0.16.0 [no ci] ([538e157](https://github.com/Lydanne/spaceflow/commit/538e15783ed4482a25faf251a1513eae0dfb33ad))

## [0.14.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.13.0...@spaceflow/core@0.14.0) (2026-02-27)

### 新特性

* **cli:** 实现 MCP meta-tool 代理模式 ([86426e9](https://github.com/Lydanne/spaceflow/commit/86426e979ea989a3688721f33e17035d7c96c984))

### 其他修改

* **cli:** released version 0.36.0 [no ci] ([e48738a](https://github.com/Lydanne/spaceflow/commit/e48738a3d56a0fc8f5e48f2bbfffd2ca90041376))
* **publish:** released version 0.37.0 [no ci] ([c1e39bd](https://github.com/Lydanne/spaceflow/commit/c1e39bd28f52a40ca4423ae1088b3b29cffe4946))
* **review-summary:** released version 0.15.0 [no ci] ([626b7dd](https://github.com/Lydanne/spaceflow/commit/626b7dd5b73c62d5f5c48f7dc585f60eb775dad0))
* **review:** released version 0.45.0 [no ci] ([bd215c4](https://github.com/Lydanne/spaceflow/commit/bd215c4fa86341c1c995b28e438bca1e528efcdd))
* **scripts:** released version 0.15.0 [no ci] ([bf9e533](https://github.com/Lydanne/spaceflow/commit/bf9e53349884b3bd4ca845f493d28421a5ffc91d))
* **shared:** released version 0.5.0 [no ci] ([c936cfc](https://github.com/Lydanne/spaceflow/commit/c936cfc432a517e87639e99870a11729b4c91ae4))
* **shell:** released version 0.15.0 [no ci] ([0dc9b31](https://github.com/Lydanne/spaceflow/commit/0dc9b31f4d73ac359e2efa7f07e1e5778f9e85c2))

## [0.13.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.12.0...@spaceflow/core@0.13.0) (2026-02-27)

### 新特性

* **shared:** 在非 workspace 模式下为 pnpm 创建空 pnpm-workspace.yaml ([0b72b8c](https://github.com/Lydanne/spaceflow/commit/0b72b8c50068f8d1ce131f70e60438fb0ad3c0f9))

### 其他修改

* **cli:** released version 0.35.0 [no ci] ([527b4bc](https://github.com/Lydanne/spaceflow/commit/527b4bcec3a2dbe10f6f5848e80418df733a57db))
* **publish:** released version 0.36.0 [no ci] ([28f3b14](https://github.com/Lydanne/spaceflow/commit/28f3b14f7db914556ddf143709a00d6fa877e417))
* **review-summary:** released version 0.14.0 [no ci] ([4e39c73](https://github.com/Lydanne/spaceflow/commit/4e39c7337f74ac66f10c15cfae2b6c32eccae561))
* **review:** released version 0.44.0 [no ci] ([5d984a2](https://github.com/Lydanne/spaceflow/commit/5d984a244412aed8ef2215b013127fd38d831e1e))
* **scripts:** released version 0.14.0 [no ci] ([6b3bb66](https://github.com/Lydanne/spaceflow/commit/6b3bb6659666f58cfd8aa109f12df13694c9895f))
* **shared:** released version 0.4.0 [no ci] ([ea8bcde](https://github.com/Lydanne/spaceflow/commit/ea8bcdebc41ccbfa7ed9fd66f867c327976aa334))
* **shell:** released version 0.14.0 [no ci] ([04f61bf](https://github.com/Lydanne/spaceflow/commit/04f61bfd5a45ab37319aadd6fd4a064259e62e1d))

## [0.12.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.11.0...@spaceflow/core@0.12.0) (2026-02-27)

### 新特性

* **cli:** 优化 .spaceflow 目录查找逻辑，改为基于 .spaceflowrc 定位 ([7d98f64](https://github.com/Lydanne/spaceflow/commit/7d98f64ac6d0dce2965da4ca45f0c62524c8fc7c))

### 其他修改

* **cli:** released version 0.34.0 [no ci] ([020ff3c](https://github.com/Lydanne/spaceflow/commit/020ff3c44c56a2366f4c40a89653fbf49dba39b1))
* **publish:** released version 0.35.0 [no ci] ([c5a2c07](https://github.com/Lydanne/spaceflow/commit/c5a2c07a9e4e9274f2e7c650e69b8d3f84fc240f))
* **review-summary:** released version 0.13.0 [no ci] ([18f5e8a](https://github.com/Lydanne/spaceflow/commit/18f5e8aa62e680f6532f74b3a3c1613cf71d703f))
* **review:** released version 0.43.0 [no ci] ([559fbc7](https://github.com/Lydanne/spaceflow/commit/559fbc7f6a6f529f3e1999a88543c7e89392bb65))
* **scripts:** released version 0.13.0 [no ci] ([b1c0499](https://github.com/Lydanne/spaceflow/commit/b1c049977190719026d6ac8b1964e1a4d0745ede))
* **shared:** released version 0.3.0 [no ci] ([a7d20f7](https://github.com/Lydanne/spaceflow/commit/a7d20f7bb9784ec8dafe466c9fba699b43e5abb8))
* **shell:** released version 0.13.0 [no ci] ([ab45a39](https://github.com/Lydanne/spaceflow/commit/ab45a39b93e26011e81abcabd90964e34e4ab9b8))

## [0.11.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.10.0...@spaceflow/core@0.11.0) (2026-02-27)

### 新特性

* **cli:** 为 CLI 添加版本号支持，并在执行扩展时传递版本信息 ([cdcd311](https://github.com/Lydanne/spaceflow/commit/cdcd311ab9c44090b68ab594b67ca42f8e846a8a))
* **cli:** 支持通过 SPACEFLOW_CWD 环境变量指定工作目录 ([f24fe3c](https://github.com/Lydanne/spaceflow/commit/f24fe3ccfa0d219a2490585b6fd96c2f32019702))
* **core:** 在构建时注入核心版本号并支持在CLI中显示 ([8061cf8](https://github.com/Lydanne/spaceflow/commit/8061cf8af4ce22bbcdd2cce96472cef22c53a3b1))
* **publish:** 优化发布流程，在 after:bump 阶段增加构建步骤 ([9e1c859](https://github.com/Lydanne/spaceflow/commit/9e1c85977714cc43640e47c1a50c44d06e2af23c))

### 代码重构

* **cli:** 简化 getSpaceflowDir 逻辑，直接回退到全局目录 ([6763afa](https://github.com/Lydanne/spaceflow/commit/6763afab09c1a303a8a278cb8880490f2f39e769))

### 其他修改

* **cli:** released version 0.32.0 [no ci] ([0702e0e](https://github.com/Lydanne/spaceflow/commit/0702e0e4c5dd6c1d067297372d718225dab9aaee))
* **cli:** released version 0.33.0 [no ci] ([5a227d6](https://github.com/Lydanne/spaceflow/commit/5a227d6d964451096a3f08aaa7529902cd05a11b))
* **publish:** released version 0.33.0 [no ci] ([fdb0720](https://github.com/Lydanne/spaceflow/commit/fdb0720db798414d226541dba922155cf0cfe849))
* **publish:** released version 0.34.0 [no ci] ([6b949b5](https://github.com/Lydanne/spaceflow/commit/6b949b5894dda61198c115d60fd39a08511d64c3))
* **review-summary:** released version 0.11.0 [no ci] ([d68ceef](https://github.com/Lydanne/spaceflow/commit/d68ceef911941e80fc1e71d530bf0b412b54a64a))
* **review-summary:** released version 0.12.0 [no ci] ([1765e00](https://github.com/Lydanne/spaceflow/commit/1765e00a7209acd4a94c79c3dcb2988061154bc5))
* **review:** released version 0.41.0 [no ci] ([df19355](https://github.com/Lydanne/spaceflow/commit/df193555f523bfde891cd2ab96f823713199749a))
* **review:** released version 0.42.0 [no ci] ([366684a](https://github.com/Lydanne/spaceflow/commit/366684a36ab5ccad0cf8de848376fe8427b70b3f))
* **scripts:** released version 0.11.0 [no ci] ([4c1d726](https://github.com/Lydanne/spaceflow/commit/4c1d726587a0be3187957e069b78d6eaefa7fddc))
* **scripts:** released version 0.12.0 [no ci] ([eea067c](https://github.com/Lydanne/spaceflow/commit/eea067c4d7d76b14f0a57edabcb27787f2775212))
* **shell:** released version 0.11.0 [no ci] ([3df4552](https://github.com/Lydanne/spaceflow/commit/3df4552e24e6f73b3cb8116c348453dd46dd1db5))
* **shell:** released version 0.12.0 [no ci] ([415a373](https://github.com/Lydanne/spaceflow/commit/415a373a32e59e78d2607938dfb7d10d91062e73))

## [0.10.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.9.0...@spaceflow/core@0.10.0) (2026-02-26)

### 文档更新

* **cli:** 更新 CLI README 以明确其定位和工作原理 ([88a4e8e](https://github.com/Lydanne/spaceflow/commit/88a4e8e6cc5be014cf418367c89e00f65cc6d57c))
* **core:** 更新核心包 README，反映新架构和职责 ([5d8ed7b](https://github.com/Lydanne/spaceflow/commit/5d8ed7b131af4deaf8f815e4db547e52de337758))
* **publish:** 更新 README 以反映扩展包独立安装方式 ([042ac92](https://github.com/Lydanne/spaceflow/commit/042ac920fe6e8e018cf50539a990f6231582e460))
* **review:** 更新 README.md 以反映扩展架构和配置变更 ([560f270](https://github.com/Lydanne/spaceflow/commit/560f27080f3739c2e222cdd985222cfaacafbab6))
* **shared:** 为 shared 包添加 README 文档 ([5d171d5](https://github.com/Lydanne/spaceflow/commit/5d171d5872f849a62251c646294903d11a0c46d2))
* 更新文档以反映新架构和扩展系统重构 ([828c436](https://github.com/Lydanne/spaceflow/commit/828c436bdbba7798ee3211fc77c4f2ef485c6f55))

### 其他修改

* **cli:** released version 0.31.0 [no ci] ([9038e40](https://github.com/Lydanne/spaceflow/commit/9038e4018cfcbea7ab466ee94546324fcebceabe))
* **publish:** released version 0.32.0 [no ci] ([77a2800](https://github.com/Lydanne/spaceflow/commit/77a2800d9b001ebd2b502db59c9a5994e54665c9))
* **review-summary:** released version 0.10.0 [no ci] ([69ce9f8](https://github.com/Lydanne/spaceflow/commit/69ce9f809a93eb244c5851605062fdd6e26ec73e))
* **review:** released version 0.40.0 [no ci] ([4e89094](https://github.com/Lydanne/spaceflow/commit/4e890941e688b42d5802e5dd65ed9a754871464b))
* **scripts:** released version 0.10.0 [no ci] ([ced0072](https://github.com/Lydanne/spaceflow/commit/ced00727f30171a281555664bc874d1a38a28762))
* **shared:** released version 0.2.0 [no ci] ([2a9db6f](https://github.com/Lydanne/spaceflow/commit/2a9db6fb0ef4af1bfd0bdeac23119df329c34351))
* **shell:** released version 0.10.0 [no ci] ([8ea0f8b](https://github.com/Lydanne/spaceflow/commit/8ea0f8bebe51e8cfff30cfbdcbb3deb66a4b3909))

## [0.9.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.8.0...@spaceflow/core@0.9.0) (2026-02-26)

### 修复BUG

* **cli:** 修复扩展自动安装逻辑，优化 npm 包名解析 ([0271dd4](https://github.com/Lydanne/spaceflow/commit/0271dd48e0169ae5055cfab28e0656e777de10f4))
* **cli:** 自动安装扩展时根据命令行参数动态设置 verbose 级别 ([d2da6f5](https://github.com/Lydanne/spaceflow/commit/d2da6f5eb30425e48bb4fd924c73bb9237a437ab))

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

* **cli:** released version 0.27.0 [no ci] ([b0c745d](https://github.com/Lydanne/spaceflow/commit/b0c745d2ddee978533b8be11062608b00238c92f))
* **cli:** released version 0.28.0 [no ci] ([944de26](https://github.com/Lydanne/spaceflow/commit/944de26607e91123818bad469ee7b7487473de5f))
* **cli:** released version 0.29.0 [no ci] ([5fd87d3](https://github.com/Lydanne/spaceflow/commit/5fd87d31511d13d4937b1b1a247ad8a322d6fc9c))
* **cli:** released version 0.30.0 [no ci] ([7af2925](https://github.com/Lydanne/spaceflow/commit/7af292524349effcfc85a26cf3285dba7726b441))
* **publish:** released version 0.29.0 [no ci] ([4083cab](https://github.com/Lydanne/spaceflow/commit/4083cab525c06cc2f5303492f6afe38e4591a72f))
* **publish:** released version 0.30.0 [no ci] ([2010489](https://github.com/Lydanne/spaceflow/commit/2010489a0d3cddb9ada1c0fc4e833cdeb0c1e706))
* **publish:** released version 0.31.0 [no ci] ([e928d60](https://github.com/Lydanne/spaceflow/commit/e928d6061e05c03fc92303a246b2563a5100740b))
* **review-summary:** released version 0.7.0 [no ci] ([21aced5](https://github.com/Lydanne/spaceflow/commit/21aced5a10fd522122e5f2c6f4ce3a318b80dff2))
* **review-summary:** released version 0.8.0 [no ci] ([0e73a97](https://github.com/Lydanne/spaceflow/commit/0e73a97b035692b0fe7f59e36585cffccf6c6854))
* **review-summary:** released version 0.9.0 [no ci] ([c1a2322](https://github.com/Lydanne/spaceflow/commit/c1a2322bb7535d15c63251ea515ee21ea7a4e1bf))
* **review:** released version 0.37.0 [no ci] ([b26e2bb](https://github.com/Lydanne/spaceflow/commit/b26e2bba0df5471d4fb54c70bf230d6f2c964504))
* **review:** released version 0.38.0 [no ci] ([f8c96be](https://github.com/Lydanne/spaceflow/commit/f8c96bed623f24e6c21af389aaaaecf7c057ae5f))
* **review:** released version 0.39.0 [no ci] ([0fbda14](https://github.com/Lydanne/spaceflow/commit/0fbda140982510f49c449eb35605b0dedd27c8cc))
* **scripts:** released version 0.7.0 [no ci] ([6392c03](https://github.com/Lydanne/spaceflow/commit/6392c03e2c8dc9376ae24baaa3ef3fc62be9c762))
* **scripts:** released version 0.8.0 [no ci] ([efea246](https://github.com/Lydanne/spaceflow/commit/efea246fe1bbd8815c7af44e8fd40df57a0219d6))
* **scripts:** released version 0.9.0 [no ci] ([8db4c68](https://github.com/Lydanne/spaceflow/commit/8db4c681b6a00bb9717f05aa809bb4e13bbb7e53))
* **shared:** released version 0.1.0 [no ci] ([243e31d](https://github.com/Lydanne/spaceflow/commit/243e31de49dbde605d5a16ec9f0d589792b9cc30))
* **shell:** released version 0.7.0 [no ci] ([da9dd6b](https://github.com/Lydanne/spaceflow/commit/da9dd6b07b0cfc807a20fecaa84418c90fc97b7b))
* **shell:** released version 0.8.0 [no ci] ([607b93b](https://github.com/Lydanne/spaceflow/commit/607b93bd911e3da102a73dd4513a4733b40c8672))
* **shell:** released version 0.9.0 [no ci] ([b161fe1](https://github.com/Lydanne/spaceflow/commit/b161fe17aec13f59f0dbc04a7a2d392ba6740cca))

## [0.8.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.7.0...@spaceflow/core@0.8.0) (2026-02-26)

### 代码重构

* **core:** 将 i18n 实例管理从 core 迁移至 cli，core 仅提供翻译接口 ([64b5398](https://github.com/Lydanne/spaceflow/commit/64b5398bfaf8ad7b7032400a3bf15bd7433896b8))

### 其他修改

* **cli:** released version 0.26.0 [no ci] ([55f6cf7](https://github.com/Lydanne/spaceflow/commit/55f6cf7f76c49a8a871e0a1516520db78d841752))
* **publish:** released version 0.28.0 [no ci] ([c226199](https://github.com/Lydanne/spaceflow/commit/c22619956276d6c4464ae94f6e47f798d66eba2b))
* **review-summary:** released version 0.6.0 [no ci] ([185e4ff](https://github.com/Lydanne/spaceflow/commit/185e4ff5488a13cd32e54a442bf41728abdadb4e))
* **review:** released version 0.36.0 [no ci] ([32df799](https://github.com/Lydanne/spaceflow/commit/32df799cf56a1bd7ca987fe79c6392dfc829f841))
* **scripts:** released version 0.6.0 [no ci] ([91ea44e](https://github.com/Lydanne/spaceflow/commit/91ea44ec943c2de318b32c0cd29d8c6ce1e89012))
* **shell:** released version 0.6.0 [no ci] ([bffd7b5](https://github.com/Lydanne/spaceflow/commit/bffd7b5cef4f3d4b7e306339e93e1c7752d459df))

## [0.7.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.6.0...@spaceflow/core@0.7.0) (2026-02-26)

### 代码重构

* **core:** 使用 globalThis 确保多份 core 实例共享同一个 i18n 状态 ([c46e713](https://github.com/Lydanne/spaceflow/commit/c46e713d3e6e4d84447ebecad6ea719fc861854f))
* **core:** 实现扩展自动安装机制，确保 .spaceflowrc 声明的依赖自动同步 ([89af2ae](https://github.com/Lydanne/spaceflow/commit/89af2ae864decd6f2acb917d59afd657ee8e4562))

### 其他修改

* **cli:** released version 0.25.0 [no ci] ([f0a7707](https://github.com/Lydanne/spaceflow/commit/f0a7707caffd9868b7b6b64fca4ffa01091d1478))
* **publish:** released version 0.27.0 [no ci] ([2474165](https://github.com/Lydanne/spaceflow/commit/2474165f69492a0e0038e7713436c09ee7b27ec3))
* **review-summary:** released version 0.5.0 [no ci] ([8ebcc22](https://github.com/Lydanne/spaceflow/commit/8ebcc224b61afebd77a21ec9beafe5e813b2e7ec))
* **review:** released version 0.35.0 [no ci] ([d33b8ee](https://github.com/Lydanne/spaceflow/commit/d33b8eebdbcb2871a151df004c41bee86bfaedb7))
* **scripts:** released version 0.5.0 [no ci] ([0d8de8d](https://github.com/Lydanne/spaceflow/commit/0d8de8d0b211b8e398730de25d06eee7d3cfb7b3))
* **shell:** released version 0.5.0 [no ci] ([d26230c](https://github.com/Lydanne/spaceflow/commit/d26230c5d45e4f4301c11581304e4c8f536abac0))

## [0.6.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.5.0...@spaceflow/core@0.6.0) (2026-02-25)

### 代码重构

* **cli:** 统一使用 core 层配置读取函数，移除重复的配置解析逻辑 ([5783e5f](https://github.com/Lydanne/spaceflow/commit/5783e5f693b0aafd8346ee3a250692265aad55c5))
* **core:** 修复 dependencies 写入格式，确保与 package.json 规范一致 ([b3d4ada](https://github.com/Lydanne/spaceflow/commit/b3d4ada9ece7d191bdbf035550553c9919d9d90f))

### 其他修改

* **cli:** released version 0.23.0 [no ci] ([7a71e2c](https://github.com/Lydanne/spaceflow/commit/7a71e2c21a409999fde86a7fca9e6b26fa8bef14))
* **cli:** released version 0.24.0 [no ci] ([418daf8](https://github.com/Lydanne/spaceflow/commit/418daf8a8571e9dec2ef5c13e8fb103b876fb483))
* **publish:** released version 0.25.0 [no ci] ([3bae586](https://github.com/Lydanne/spaceflow/commit/3bae586e34df1978a010a33bba20611082b3c3e2))
* **publish:** released version 0.26.0 [no ci] ([2f196b1](https://github.com/Lydanne/spaceflow/commit/2f196b196a0cdb6da94881c27d5d55202c5fa8c0))
* **review-summary:** released version 0.3.0 [no ci] ([9a881e9](https://github.com/Lydanne/spaceflow/commit/9a881e94b6141592aefc835861bf2bf7cca9eefe))
* **review-summary:** released version 0.4.0 [no ci] ([6a9e7d5](https://github.com/Lydanne/spaceflow/commit/6a9e7d58f796a72fb381e18bfb0d0a1799fd2d5d))
* **review:** released version 0.33.0 [no ci] ([467cf91](https://github.com/Lydanne/spaceflow/commit/467cf91c60c0693e22c172a9358d0981dc8a9d64))
* **review:** released version 0.34.0 [no ci] ([fb1ae4a](https://github.com/Lydanne/spaceflow/commit/fb1ae4a48a6ff6f68b43ea45ac8950283605bad6))
* **scripts:** released version 0.3.0 [no ci] ([7b62b7b](https://github.com/Lydanne/spaceflow/commit/7b62b7bc7a4c4795472d729df321acbde808ec4d))
* **scripts:** released version 0.4.0 [no ci] ([b30f118](https://github.com/Lydanne/spaceflow/commit/b30f118e07506485ceaafaa850d13b3167facea9))
* **shell:** released version 0.3.0 [no ci] ([baa26b3](https://github.com/Lydanne/spaceflow/commit/baa26b3d6bc63de2c252101d915badf4461dfbd1))
* **shell:** released version 0.4.0 [no ci] ([dca978f](https://github.com/Lydanne/spaceflow/commit/dca978fd7c620a78ecc9f23e96f29775a1276f0d))

## [0.5.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.4.0...@spaceflow/core@0.5.0) (2026-02-25)

### 代码重构

* **core:** 优化 dependencies 配置管理，支持按字段查找配置文件并原地更新 ([6d97021](https://github.com/Lydanne/spaceflow/commit/6d97021a3051602ac655b0beff89acdfc8dbe497))

### 其他修改

* **cli:** released version 0.22.0 [no ci] ([e90581b](https://github.com/Lydanne/spaceflow/commit/e90581bfd7e1f388aeec35077753971939fbf25f))
* **publish:** released version 0.24.0 [no ci] ([260e96e](https://github.com/Lydanne/spaceflow/commit/260e96e2c6dfb4201c40a0c55f78428a9f6c502c))
* **review-summary:** released version 0.2.0 [no ci] ([f947083](https://github.com/Lydanne/spaceflow/commit/f94708316cafbddbd225594b90c9a91e41d4599f))
* **review:** released version 0.32.0 [no ci] ([43498f0](https://github.com/Lydanne/spaceflow/commit/43498f04b5f33cc3de6a3ca652b2bc2f12c47ac8))
* **scripts:** released version 0.2.0 [no ci] ([7848836](https://github.com/Lydanne/spaceflow/commit/7848836911f50b67302db82aa05e22d5670ef01e))
* **shell:** released version 0.2.0 [no ci] ([6a31ede](https://github.com/Lydanne/spaceflow/commit/6a31edeebf7c212bd4095766fc44a1fd66c37ab7))

## [0.4.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.3.0...@spaceflow/core@0.4.0) (2026-02-25)

### 修复BUG

* **core:** 移除 isPnpmWorkspace 检查，改为在读取项目 package.json 版本时处理 workspace 协议 ([ed04f56](https://github.com/Lydanne/spaceflow/commit/ed04f568cebdc71a9c9ad08eebe343bf82250d5d))

### 代码重构

* **cli:** 移除 ensureSpaceflowPackageJson 调用中的 isGlobal 和 cwd 参数 ([731758f](https://github.com/Lydanne/spaceflow/commit/731758fabb54236c0002be6815070af804c1801e))
* **core:** 移除 .spaceflow 目录的 pnpm-workspace.yaml 创建逻辑 ([538f7b0](https://github.com/Lydanne/spaceflow/commit/538f7b0e1b71515f3cdfa7273747f0fa728f737a))
* **core:** 简化 ensureSpaceflowPackageJson，移除 isGlobal 参数，改为从 cli 入口读取 core 版本 ([eb4df3e](https://github.com/Lydanne/spaceflow/commit/eb4df3e3af261e3017ad26a308afe760667acba5))
* 将 .spaceflow 配置迁移到根目录 .spaceflowrc，统一使用 workspace: 协议管理依赖 ([0aff2af](https://github.com/Lydanne/spaceflow/commit/0aff2afa6176e97c1f131b37cec51e32051a346a))

### 其他修改

* **cli:** released version 0.21.0 [no ci] ([6f32080](https://github.com/Lydanne/spaceflow/commit/6f32080459bb3bcef895f3e51ee5341c2a4ddc74))
* **publish:** released version 0.23.0 [no ci] ([1a6510f](https://github.com/Lydanne/spaceflow/commit/1a6510f997718468efbbac377ac9d44f07e8e927))
* **review-summary:** released version 0.1.0 [no ci] ([eb52706](https://github.com/Lydanne/spaceflow/commit/eb527063cc6e99530436d5a370827596baae44a3))
* **review:** released version 0.31.0 [no ci] ([ec5ffe5](https://github.com/Lydanne/spaceflow/commit/ec5ffe5213099a7e77549648bd9da9ad53c640cc))
* **scripts:** released version 0.1.0 [no ci] ([98abf0e](https://github.com/Lydanne/spaceflow/commit/98abf0e6e17985320a4d96e1350cea05e8f81b15))
* **shell:** released version 0.1.0 [no ci] ([e03b69e](https://github.com/Lydanne/spaceflow/commit/e03b69e7ad7d3db6e96c699ec715c2313b236196))

## [0.3.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.2.0...@spaceflow/core@0.3.0) (2026-02-25)

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
* **cli:** released version 0.20.0 [no ci] ([7cb015c](https://github.com/Lydanne/spaceflow/commit/7cb015c9fba3b9b4a8a170f66597505300e35e10))
* **period-summary:** released version 0.20.0 [no ci] ([54feb4a](https://github.com/Lydanne/spaceflow/commit/54feb4adaf0d72d402287bef84fd9433db673ed6))
* **publish:** released version 0.22.0 [no ci] ([2e39f34](https://github.com/Lydanne/spaceflow/commit/2e39f347c514490be5da690c896849fc6dbfd513))
* **review:** released version 0.30.0 [no ci] ([1e880b1](https://github.com/Lydanne/spaceflow/commit/1e880b1e535945125d746a0e5e4cb5453422373e))

## [0.2.0](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.1.3...@spaceflow/core@0.2.0) (2026-02-16)

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

* **cli:** 配置 CommandFactory 在错误时不中止执行 ([e55eaa9](https://github.com/Lydanne/spaceflow/commit/e55eaa9a8f0c3f90564657df2a9cb5cd3314956c))
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

* **ci-scripts:** released version 0.19.2 [no ci] ([aabfbf3](https://github.com/Lydanne/spaceflow/commit/aabfbf327353bdda370884f6887be92ee2e23c0c))
* **ci-scripts:** released version 0.19.3 [no ci] ([dfa4ebf](https://github.com/Lydanne/spaceflow/commit/dfa4ebf2b8cad72c8088750ac601f062f973411f))
* **ci-shell:** released version 0.19.2 [no ci] ([ef258b7](https://github.com/Lydanne/spaceflow/commit/ef258b7cd02305c82c5813c4056def14548261d3))
* **ci-shell:** released version 0.19.3 [no ci] ([0cf07cd](https://github.com/Lydanne/spaceflow/commit/0cf07cdb70fbfb5c7a36a7955f5c9f248bb917fd))
* **cli:** released version 0.19.3 [no ci] ([30b95d5](https://github.com/Lydanne/spaceflow/commit/30b95d5bffdc617b610e6d31367c84f450050f13))
* **cli:** released version 0.19.4 [no ci] ([caddff1](https://github.com/Lydanne/spaceflow/commit/caddff1553a3d2d2a9f3aaba225d1dfb6eb2318f))
* **period-summary:** released version 0.19.2 [no ci] ([ce5530e](https://github.com/Lydanne/spaceflow/commit/ce5530ecc75703872d00a97aa19a745be4fd2a6d))
* **period-summary:** released version 0.19.3 [no ci] ([85827b9](https://github.com/Lydanne/spaceflow/commit/85827b95d44e0f7db28e083515a8232310e2359f))
* **publish:** released version 0.21.2 [no ci] ([2adc708](https://github.com/Lydanne/spaceflow/commit/2adc708b51e331df60a2bb3173eb669bbc150d87))
* **publish:** released version 0.21.3 [no ci] ([78d680c](https://github.com/Lydanne/spaceflow/commit/78d680ce99d511674b5cdafca52d1481a4f6c673))
* **review:** released version 0.29.2 [no ci] ([ec0f499](https://github.com/Lydanne/spaceflow/commit/ec0f499c802d57a64cc01580dbccf991a6855331))
* **review:** released version 0.29.3 [no ci] ([82ba72d](https://github.com/Lydanne/spaceflow/commit/82ba72d00c3cf7e50434ea63e7cd30c6ea851a51))

## [0.1.3](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.1.2...@spaceflow/core@0.1.3) (2026-02-16)

### 其他修改

* **ci-scripts:** released version 0.19.1 [no ci] ([9f24102](https://github.com/Lydanne/spaceflow/commit/9f2410204dcffd20678a529c0a94fee461c436c8))
* **ci-shell:** released version 0.19.1 [no ci] ([b58c112](https://github.com/Lydanne/spaceflow/commit/b58c1128f55491a551d71d45792a8af1a009dafd))
* **cli:** released version 0.19.2 [no ci] ([e6c7488](https://github.com/Lydanne/spaceflow/commit/e6c7488675e88910ddadc15924e6ca5beca05f1d))
* **period-summary:** released version 0.19.1 [no ci] ([4338a6d](https://github.com/Lydanne/spaceflow/commit/4338a6d8c4b7f8335d1adfc2ccce2cc7bb1568c8))
* **publish:** released version 0.21.1 [no ci] ([6992af8](https://github.com/Lydanne/spaceflow/commit/6992af8e311690ad197203c715ab012e635b0530))
* **review:** released version 0.29.1 [no ci] ([a285a81](https://github.com/Lydanne/spaceflow/commit/a285a8160adade1dd3d08d8434aeec4bafe65c86))
* 为 cli 和 core 包添加 files 字段以控制发布内容 ([5a43ee2](https://github.com/Lydanne/spaceflow/commit/5a43ee2499995dab8bdc06042269fa163fc98e31))

## [0.1.2](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.1.1...@spaceflow/core@0.1.2) (2026-02-15)

### 文档更新

* **ci-scripts:** 更新 README，添加徽章和描述 ([f95f952](https://github.com/Lydanne/spaceflow/commit/f95f95207d6ad31ce756ca36bc8d3acfea398edc))
* **ci-shell:** 更新 README，添加徽章和描述优化 ([c4419ad](https://github.com/Lydanne/spaceflow/commit/c4419ad33139f0e9811b4c1eeae5fd5d046139be))
* **cli:** 更新 CLI README 文档，添加徽章并统一术语 ([19fd319](https://github.com/Lydanne/spaceflow/commit/19fd319771d538be21c35bee94a25bd05440e1bb))
* **core:** 更新核心包 README，添加徽章并优化文档结构 ([0e7e576](https://github.com/Lydanne/spaceflow/commit/0e7e5766e512c9fc86edd078e5701a687be5bfae))
* **period-summary:** 更新 README，添加徽章和说明 ([bf57823](https://github.com/Lydanne/spaceflow/commit/bf5782373c2cd7db35ff4d71cbb0cf2bd2b85380))
* **publish:** 更新发布插件 README 文档 ([8320c84](https://github.com/Lydanne/spaceflow/commit/8320c844d9585ceccedb84b6deeb701625973703))
* **review:** 更新 README 文档格式和徽章 ([5bdb6aa](https://github.com/Lydanne/spaceflow/commit/5bdb6aabbdc8264da8fbd4567ebe6efdbd40e9f4))
* 更新 README 文档，统一术语为“扩展” ([6c0a612](https://github.com/Lydanne/spaceflow/commit/6c0a61260e450f3b952749019483069369388e2b))

## [0.1.1](https://github.com/Lydanne/spaceflow/compare/@spaceflow/core@0.1.0...@spaceflow/core@0.1.1) (2026-02-15)

### 代码重构

* 优化插件发现机制，支持动态解析扩展目录 ([31d6ff9](https://github.com/Lydanne/spaceflow/commit/31d6ff9f306b28607994ad50b9e40d550f3a646b))
* 统一术语，将 skill 重命名为 extension ([cdf0736](https://github.com/Lydanne/spaceflow/commit/cdf073630708875cb814a555d407393c075fbff1))
* 调整项目目录结构，统一包管理规范 ([5f89adb](https://github.com/Lydanne/spaceflow/commit/5f89adbb17b40ebe8bdd045a85c4c337fa385c43))

### 文档更新

* 重写 README 并添加各插件文档 ([066b10a](https://github.com/Lydanne/spaceflow/commit/066b10acb869de30e3af0ece59ab5d81ec78d668))

### 其他修改

* 为所有包添加 npm 公开发布配置 ([b9d2dcc](https://github.com/Lydanne/spaceflow/commit/b9d2dccd8e7bd4a74f6f0db83ee68dfb892b2d51))
* 优化 GitHub Actions 工作流和 npm 发布配置 ([7ae7cc5](https://github.com/Lydanne/spaceflow/commit/7ae7cc51ff0c865527f2b835bfaf26227372fd36))
* 初始化仓库 ([08d011d](https://github.com/Lydanne/spaceflow/commit/08d011d63f1852ecd9ae47425e743f4eb55fceb3))
* 添加 release-it-gitea 依赖 ([9c5d5d6](https://github.com/Lydanne/spaceflow/commit/9c5d5d6a56de621a8bff9cb2b3c29c6e0843b98b))
* 添加文档部署工作流并更新配置 ([0cc52fd](https://github.com/Lydanne/spaceflow/commit/0cc52fdef24f4d8696d0601cd001f6d470291ecc))
* 移除 administration 权限并禁用分支锁定 ([cc51fa5](https://github.com/Lydanne/spaceflow/commit/cc51fa50d20159ee4fd273560364ee945213018c))

## [0.1.0](https://git.bjxgj.com/xgj/spaceflow/compare/v1.1.0...@spaceflow/core@0.1.0) (2026-02-15)

### 新特性

* add clear command ([4555769](https://git.bjxgj.com/xgj/spaceflow/commit/455576915ef3944a045459926bbcfa2969a1fc7d))
* **ci-publish:** 优化ci-publish配置字段的可选性 ([55e93c7](https://git.bjxgj.com/xgj/spaceflow/commit/55e93c71ffd7de00100799bd33af0b4a827aafe5))
* **ci-publish:** 增强 ci-publish 命令功能 ([f8890b5](https://git.bjxgj.com/xgj/spaceflow/commit/f8890b5f332a9ad873b53bb442dd9f86b510b16b))
* **ci-publish:** 支持pnpm包管理器和publishArgs配置 ([8ba878b](https://git.bjxgj.com/xgj/spaceflow/commit/8ba878b6cd8ad5a92e97a18020432170d41d1adf))
* **ci:** 在分支保护测试中添加 token 调试功能 ([424e3a3](https://git.bjxgj.com/xgj/spaceflow/commit/424e3a37536b0c4d6f2eaeb395ae9f83fd8ae248))
* **ci:** 添加分支保护测试工作流 ([eb819c5](https://git.bjxgj.com/xgj/spaceflow/commit/eb819c5f56d3bab9eb5130c3cec763fee0e4bce2))
* **cli:** 新增 MCP Server 命令并集成 review 扩展的 MCP 工具 ([b794b36](https://git.bjxgj.com/xgj/spaceflow/commit/b794b36d90788c7eb4cbb253397413b4a080ae83))
* **cli:** 新增 MCP Server 导出类型支持 ([9568cbd](https://git.bjxgj.com/xgj/spaceflow/commit/9568cbd14d4cfbdedaf2218379c72337af6db271))
* **commit:** 添加 commit 命令支持自动生成规范 commit message ([3d2e0aa](https://git.bjxgj.com/xgj/spaceflow/commit/3d2e0aa3c0fd48589c25269fb603bdc74d698ce7))
* **core:** 为 CLI 入口文件添加 Node shebang 支持 ([0d787d3](https://git.bjxgj.com/xgj/spaceflow/commit/0d787d329e69f2b53d26ba04720d60625ca51efd))
* **core:** 为 npm 包添加 npx 直接执行支持 ([e67a7da](https://git.bjxgj.com/xgj/spaceflow/commit/e67a7da34c4e41408760da4de3a499495ce0df2f))
* **core:** 为所有命令添加 i18n 国际化支持 ([867c5d3](https://git.bjxgj.com/xgj/spaceflow/commit/867c5d3eccc285c8a68803b8aa2f0ffb86a94285))
* **core:** 优化 commit message 的 scope 处理逻辑 ([42869dd](https://git.bjxgj.com/xgj/spaceflow/commit/42869dd4bde0a3c9bf8ffb827182775e2877a57b))
* **core:** 优化 commit 消息生成器中的 scope 处理逻辑 ([1592079](https://git.bjxgj.com/xgj/spaceflow/commit/1592079edde659fe94a02bb6e2dea555c80d3b6b))
* **core:** 优化 npm 包名处理逻辑 ([ae23ebd](https://git.bjxgj.com/xgj/spaceflow/commit/ae23ebdc3144b611e1aa8c4e66bf0db074d09798))
* **core:** 优化commit命令的scope处理逻辑 ([04d00fa](https://git.bjxgj.com/xgj/spaceflow/commit/04d00fae55f445b148c5d8a84187cc3d7e6e7313))
* **core:** 优化commit拆分分析，按包路径提取scope ([2b9a74d](https://git.bjxgj.com/xgj/spaceflow/commit/2b9a74dcf109f39cc679313392ede8c3ab53f255))
* **core:** 优化pnpm包安装逻辑，检测是否为workspace ([6555daf](https://git.bjxgj.com/xgj/spaceflow/commit/6555dafe1f08a244525be3a0345cc585f2552086))
* **core:** 优化包管理器检测与 npm 包处理逻辑 ([63f7fa4](https://git.bjxgj.com/xgj/spaceflow/commit/63f7fa4f55cb41583009b2ea313b5ad327615e52))
* **core:** 在 Gitea SDK 中新增编辑 Pull Request 的方法 ([a586bf1](https://git.bjxgj.com/xgj/spaceflow/commit/a586bf110789578f23b39d64511229a1e5635dc4))
* **core:** 在 Gitea SDK 中新增获取 reactions 的方法 ([9324cf2](https://git.bjxgj.com/xgj/spaceflow/commit/9324cf2550709b8302171e5522d0792c08bc1415))
* **core:** 增强setup命令的配置初始化功能 ([dd37123](https://git.bjxgj.com/xgj/spaceflow/commit/dd371234bd6d38ea37709cccf1f3011975c3bb36))
* **core:** 完成剩余内置命令的插件化迁移 ([4e04d37](https://git.bjxgj.com/xgj/spaceflow/commit/4e04d37c274a30ea6acdc58906a7c0a6b1e86291))
* **core:** 实现commit命令的插件化架构 ([1e7c090](https://git.bjxgj.com/xgj/spaceflow/commit/1e7c090e0c6b77c82b5b47fbeff1856aeaac0bd9))
* **core:** 支持处理未跟踪文件的 commit 命令优化 ([180865b](https://git.bjxgj.com/xgj/spaceflow/commit/180865bca8f2cbff7548c73f6f80124bcbe0d955))
* **core:** 新增 Git diff 行号映射工具并优化 Claude 配置 ([88ef340](https://git.bjxgj.com/xgj/spaceflow/commit/88ef3400127fac3ad52fc326ad79fdc7bd058e98))
* **core:** 新增 GitLab 平台适配器并完善配置支持 ([47be9ad](https://git.bjxgj.com/xgj/spaceflow/commit/47be9adfa90944a9cb183e03286a7a96fec747f1))
* **core:** 新增 Logger 全局日志工具并支持 plain/tui 双模式渲染 ([8baae7c](https://git.bjxgj.com/xgj/spaceflow/commit/8baae7c24139695a0e379e1c874023cd61dfc41b))
* **core:** 新增内部插件注册文件 ([68d6129](https://git.bjxgj.com/xgj/spaceflow/commit/68d6129bfb10b97f2faa54ca857082f63e197233))
* **core:** 添加 commit 命令自动拆分多个 commit 支持 ([fce2075](https://git.bjxgj.com/xgj/spaceflow/commit/fce2075c0f92b629c5d57b3896823150456f1210))
* **core:** 添加 setup 命令支持配置初始化 ([31a94d1](https://git.bjxgj.com/xgj/spaceflow/commit/31a94d1da8c307d8662509dbe64c476ffd4891dc))
* **core:** 添加commit scope分组策略配置支持 ([f38445a](https://git.bjxgj.com/xgj/spaceflow/commit/f38445a35b6214bf56c1a3f3093c1dca565c40cc))
* **core:** 添加依赖更新功能 ([1a544eb](https://git.bjxgj.com/xgj/spaceflow/commit/1a544eb5e2b64396a0187d4518595e9dcb51d73e))
* **core:** 添加内部插件注册功能并支持动态模块 ([9e8671d](https://git.bjxgj.com/xgj/spaceflow/commit/9e8671d4fbd2ad293bd2b00aead28e415d2a288e))
* **core:** 添加同步解锁分支方法用于进程退出清理 ([cbec480](https://git.bjxgj.com/xgj/spaceflow/commit/cbec480511e074de3ccdc61226f3baa317cff907))
* **core:** 添加多级详细日志支持 ([a7d75cf](https://git.bjxgj.com/xgj/spaceflow/commit/a7d75cf7726869a5e6ce6260223ad9abe2bff510))
* **core:** 重构 commit 服务并添加结构化 commit message 支持 ([22b4db8](https://git.bjxgj.com/xgj/spaceflow/commit/22b4db8619b0ce038667ab42dea1362706887fc9))
* **core:** 重构插件加载机制支持内部插件注册 ([add83ec](https://git.bjxgj.com/xgj/spaceflow/commit/add83ecfb7efcc6e63a5ed82f308aa566ee45974))
* **docs:** 新增 VitePress 文档站点并完善项目文档 ([a79d620](https://git.bjxgj.com/xgj/spaceflow/commit/a79d6208e60390a44fa4c94621eb41ae20159e98))
* **mcp:** 新增 MCP Inspector 交互式调试支持并优化工具日志输出 ([05fd2ee](https://git.bjxgj.com/xgj/spaceflow/commit/05fd2ee941c5f6088b769d1127cb7c0615626f8c))
* **publish:** 优化发布流程：支持跳过私有包和指定包发布 ([4540f62](https://git.bjxgj.com/xgj/spaceflow/commit/4540f624574bfba1dcc03565a5711eb8a377c0b3))
* **publish:** 优化变更检测逻辑，支持按包最新tag单独检测 ([c0db601](https://git.bjxgj.com/xgj/spaceflow/commit/c0db601550b0d2fdecaeb49b8791d9838790e1e1))
* **publish:** 增强包变更检测的日志输出 ([b89c5cc](https://git.bjxgj.com/xgj/spaceflow/commit/b89c5cc0654713b6482ee591325d4f92ad773600))
* **publish:** 新增CI发布插件用于分支锁定解锁 ([3ab9f2e](https://git.bjxgj.com/xgj/spaceflow/commit/3ab9f2e2fedf1590ee2d2851463e2244e20cada7))
* **publish:** 添加CI环境自动获取Git tags功能 ([89e3936](https://git.bjxgj.com/xgj/spaceflow/commit/89e393647ca1c317b26cce63e68fdd64cd1eed28))
* **publish:** 添加分支锁定开关配置 ([542bec0](https://git.bjxgj.com/xgj/spaceflow/commit/542bec05a132446eaffeeca5ba8dd945c1399f9f))
* **publish:** 添加分支锁定推送白名单功能 ([7073039](https://git.bjxgj.com/xgj/spaceflow/commit/7073039599984e28f3ac9068deceee5bd7773079))
* **publish:** 添加进程退出时自动解锁分支的保护机制 ([b92438d](https://git.bjxgj.com/xgj/spaceflow/commit/b92438d461695b38ff671f571b9577b97119233f))
* **review:** 为 execute 方法添加文档注释 ([a21f582](https://git.bjxgj.com/xgj/spaceflow/commit/a21f58290c873fb07789e70c8c5ded2b5874a29d))
* **review:** 为 getPrNumberFromEvent 方法添加文档注释 ([54d1586](https://git.bjxgj.com/xgj/spaceflow/commit/54d1586f4558b5bfde81b926c7b513a32e5caf89))
* **review:** 为 MCP 服务添加 i18n 国际化支持 ([a749054](https://git.bjxgj.com/xgj/spaceflow/commit/a749054eb73b775a5f5973ab1b86c04f2b2ddfba))
* **review:** 为删除影响分析添加文件过滤功能 ([7304293](https://git.bjxgj.com/xgj/spaceflow/commit/73042937c5271ff4b0dcb6cd6d823e5aa0c03e7b))
* **review:** 优化 commit author 获取逻辑,支持 committer 作为备选 ([b75b613](https://git.bjxgj.com/xgj/spaceflow/commit/b75b6133e5b8c95580516480315bc979fc6eb59b))
* **review:** 优化 commit author 获取逻辑,支持从 Git 原始作者信息中提取 ([10ac821](https://git.bjxgj.com/xgj/spaceflow/commit/10ac8210a4457e0356c3bc1645f54f6f3d8c904c))
* **review:** 优化 commit author 获取逻辑,通过 Gitea API 搜索用户以关联 Git 原始作者 ([daa274b](https://git.bjxgj.com/xgj/spaceflow/commit/daa274bba2255e92d1e9a6e049e20846a69e8df7))
* **review:** 优化 PR 标题生成的格式要求 ([a4d807d](https://git.bjxgj.com/xgj/spaceflow/commit/a4d807d0a4feee4ccc88c6096e069c6dbb650a03))
* **review:** 优化 verbose 参数支持多级别累加,将日志级别扩展为 0-3 级 ([fe4c830](https://git.bjxgj.com/xgj/spaceflow/commit/fe4c830cac137c5502d700d2cd5f22b52a629e5f))
* **review:** 优化review配置字段的可选性 ([7d9123d](https://git.bjxgj.com/xgj/spaceflow/commit/7d9123dc74f793cf0e58a98d86751b36bf9507eb))
* **review:** 优化历史问题的 author 信息填充逻辑 ([b18d171](https://git.bjxgj.com/xgj/spaceflow/commit/b18d171c9352fe5815262d43ffd9cd7751f03a4e))
* **review:** 优化审查报告中回复消息的格式显示 ([f478c8d](https://git.bjxgj.com/xgj/spaceflow/commit/f478c8da4c1d7494819672006e3230dbc8e0924d))
* **review:** 优化审查报告中的消息展示格式 ([0996c2b](https://git.bjxgj.com/xgj/spaceflow/commit/0996c2b45c9502c84308f8a7f9186e4dbd4164fb))
* **review:** 优化行号更新统计,分别统计更新和标记无效的问题数量 ([892b8be](https://git.bjxgj.com/xgj/spaceflow/commit/892b8bed8913531a9440579f777b1965fec772e5))
* **review:** 优化问题 author 信息填充时机,统一在所有问题合并后填充 ([ea8c586](https://git.bjxgj.com/xgj/spaceflow/commit/ea8c586fc60061ffd339e85c6c298b905bdfdcd8))
* **review:** 优化问题展示和无效标记逻辑 ([e2b45e1](https://git.bjxgj.com/xgj/spaceflow/commit/e2b45e1ec594488bb79f528911fd6009a3213eca))
* **review:** 在 fillIssueAuthors 方法中添加详细的调试日志 ([42ab288](https://git.bjxgj.com/xgj/spaceflow/commit/42ab288933296abdeeb3dbbedbb2aecedbea2251))
* **review:** 在 syncReactionsToIssues 中添加详细日志并修复团队成员获取逻辑 ([91f166a](https://git.bjxgj.com/xgj/spaceflow/commit/91f166a07c2e43dabd4dd4ac186ec7b5f03dfc71))
* **review:** 在审查报告的回复中为用户名添加 @ 前缀 ([bc6186b](https://git.bjxgj.com/xgj/spaceflow/commit/bc6186b97f0764f6335690eca1f8af665f9b7629))
* **review:** 在审查问题中添加作者信息填充功能 ([8332dba](https://git.bjxgj.com/xgj/spaceflow/commit/8332dba4bb826cd358dc96db5f9b9406fb23df9b))
* **review:** 将审查命令的详细日志参数从 --verbose 简化为 -vv ([5eb320b](https://git.bjxgj.com/xgj/spaceflow/commit/5eb320b92d1f7165052730b2e90eee52367391dd))
* **review:** 扩展评审人收集逻辑,支持从 PR 指定的评审人和团队中获取 ([bbd61af](https://git.bjxgj.com/xgj/spaceflow/commit/bbd61af9d3e2b9e1dcf28c5e3867645fdda52e6f))
* **review:** 支持 AI 自动生成和更新 PR 标题 ([e02fb02](https://git.bjxgj.com/xgj/spaceflow/commit/e02fb027d525dd3e794d649e6dbc53c99a3a9a59))
* **review:** 支持 PR 关闭事件触发审查并自动传递事件类型参数 ([03967d9](https://git.bjxgj.com/xgj/spaceflow/commit/03967d9e860af7da06e3c04539f16c7bb31557ff))
* **review:** 支持在审查报告中展示评论的 reactions 和回复记录 ([f4da31a](https://git.bjxgj.com/xgj/spaceflow/commit/f4da31adf6ce412cb0ce27bfe7a1e87e5350e915))
* **review:** 支持绝对路径转换为相对路径 ([9050f64](https://git.bjxgj.com/xgj/spaceflow/commit/9050f64b8ef67cb2c8df9663711a209523ae9d18))
* **review:** 新增 override 作用域测试,验证 includes 对 override 过滤的影响 ([820e0cb](https://git.bjxgj.com/xgj/spaceflow/commit/820e0cb0f36783dc1c7e1683ad08501e91f094b2))
* **review:** 新增规则级 includes 解析测试并修复文件级/规则级 includes 过滤逻辑 ([4baca71](https://git.bjxgj.com/xgj/spaceflow/commit/4baca71c17782fb92a95b3207f9c61e0b410b9ff))
* **review:** 新增过滤无commit问题的选项 ([7a4c458](https://git.bjxgj.com/xgj/spaceflow/commit/7a4c458da03ae4a4646abca7e5f03abc849dc405))
* **review:** 移除 handleReview 中的重复 author 填充逻辑 ([e458bfd](https://git.bjxgj.com/xgj/spaceflow/commit/e458bfd0d21724c37fdd4023265d6a2dd1700404))
* **review:** 限制 PR 标题自动更新仅在第一轮审查时执行 ([1891cbc](https://git.bjxgj.com/xgj/spaceflow/commit/1891cbc8d85f6eaef9e7107a7f1003bdc654d3a3))
* **review:** 默认启用 PR 标题自动更新功能 ([fda6656](https://git.bjxgj.com/xgj/spaceflow/commit/fda6656efaf6479bb398ddc5cb1955142f31f369))
* 为 ClaudeSetupCommand 添加 dry-run 和 ci 命令行选项 ([00369f0](https://git.bjxgj.com/xgj/spaceflow/commit/00369f0586893a8f3d6af07eab2c4bab21ff2b46))
* 为 PR 审查任务清单中的文件名添加反引号标记 ([74ff94f](https://git.bjxgj.com/xgj/spaceflow/commit/74ff94fb4597acac2512b666eb10fb73bf90d26f))
* 为 PR 审查提示词中 commit 消息的首行添加引号包裹 ([edf08ac](https://git.bjxgj.com/xgj/spaceflow/commit/edf08ac574d174b935d36b3796b8a7c772fdf8a2))
* 从 action 中移除 Claude CLI 安装步骤 ([beba37d](https://git.bjxgj.com/xgj/spaceflow/commit/beba37d63b61c39f0cc9d5ab9900d257dae53e2c))
* 优化 Gitea Token 获取优先级并在开发模式下添加 Claude CLI 全局安装 ([cc092dc](https://git.bjxgj.com/xgj/spaceflow/commit/cc092dc57b96254e35ee74b413d6360907199ab5))
* 优化 GitHub Action 构建流程,统一使用 pnpm 和仓库根目录 ([8f95a12](https://git.bjxgj.com/xgj/spaceflow/commit/8f95a129c44a991029b45abc96b1e50e2490a609))
* 优化 JS/TS 审查规范的标题表述并调整单文件代码行数限制 ([c236754](https://git.bjxgj.com/xgj/spaceflow/commit/c2367549801a0765c0b048fc17f230e8f117351d))
* 优化 OpenAI 审查输出格式，从 JSON Schema 改为文本提示 ([cbf88c1](https://git.bjxgj.com/xgj/spaceflow/commit/cbf88c1b12152d2c4e5bc3a24826068647a67407))
* 优化 PR 审查任务清单，添加回归审查步骤并简化任务描述 ([68ae475](https://git.bjxgj.com/xgj/spaceflow/commit/68ae4756ba681f756ac0625adc11964afaf986fc))
* 优化 PR 审查提示词中 commit 消息的多行格式化处理 ([f13bc81](https://git.bjxgj.com/xgj/spaceflow/commit/f13bc8176dd1ae05be9fd6703e6e5e66bfd4fa59))
* 优化 PR 审查提示词的规范展示格式 ([b261c24](https://git.bjxgj.com/xgj/spaceflow/commit/b261c2469e29d88292daf35e5e98a88f14908021))
* 优化 PR 审查系统提示词，强调全面严格审查规范的要求 ([9503ca4](https://git.bjxgj.com/xgj/spaceflow/commit/9503ca42ea2972917474ace88fa9f05827adf7c9))
* 优化 PR 审查系统提示词，添加逐步审查的指导说明 ([b5ee377](https://git.bjxgj.com/xgj/spaceflow/commit/b5ee377b876f756e00e459a705df139faee7a1c0))
* 优化 PR 审查系统提示词的格式和表述，提升可读性 ([70eda36](https://git.bjxgj.com/xgj/spaceflow/commit/70eda369571dcda3a87919d8029e46c035ec764c))
* 优化 PR 审查系统提示词的表述，提升审查要求的明确性 ([03187df](https://git.bjxgj.com/xgj/spaceflow/commit/03187df34f98dad10e5a09f92dcd8c123966980c))
* 优化 PR 审查系统提示词的规范引用和问题描述表述 ([6a50064](https://git.bjxgj.com/xgj/spaceflow/commit/6a5006459b6fe845ad9e2ad2f056d73ec58db839))
* 优化审查结果 Schema，将 commit 字段改为可选并调整字段顺序 ([aec675a](https://git.bjxgj.com/xgj/spaceflow/commit/aec675a8ac6fd751fcc02b804c477e8991c8b569))
* 优化审查结果总结格式，在总结标题和内容之间添加换行符 ([e94981a](https://git.bjxgj.com/xgj/spaceflow/commit/e94981a4284ae999e6c8c9b96c6dc8bd2311f6b9))
* 优化工具调用输入的日志格式并添加未知类型块的日志输出 ([d9a1d40](https://git.bjxgj.com/xgj/spaceflow/commit/d9a1d40bffd7e07adc05e331318049512a797710))
* 优化开发模式构建流程并改进依赖管理 ([313963a](https://git.bjxgj.com/xgj/spaceflow/commit/313963a7e624f8c5c196a0a396f045dac7dc8f45))
* 使用容器用户选项替代手动用户切换步骤 ([adcaa46](https://git.bjxgj.com/xgj/spaceflow/commit/adcaa46e8ffd83eba145e809d51fe0c4a800f235))
* 切换 PR 审查工作流从 Claude 到 OpenAI（豆包模型） ([f339227](https://git.bjxgj.com/xgj/spaceflow/commit/f3392275f2041727e28bee4abf324109cd6ecb49))
* 升级 ci-publish action 运行时从 node20 到 node24 ([45c2f8b](https://git.bjxgj.com/xgj/spaceflow/commit/45c2f8bb35c9a50b827f2411a390ffd89dac301b))
* 在 Claude CLI 安装后添加版本检查步骤 ([36b3f7f](https://git.bjxgj.com/xgj/spaceflow/commit/36b3f7f8e1d898784958d3665febc26b8d059f9e))
* 在 PR 审查工作流中启用 verbose 模式并禁用 Claude 权限跳过选项 ([3d9df75](https://git.bjxgj.com/xgj/spaceflow/commit/3d9df75a13cfea7211114d603886bb85b1d36c98))
* 在 PR 审查工作流中添加 claude-setup 步骤并移除 pr-review 的 --ci 参数 ([0d1d6ea](https://git.bjxgj.com/xgj/spaceflow/commit/0d1d6ea8a6042d1dcca0fffd05362536e4cbbfa1))
* 在 PR 审查工作流中添加非 root 用户创建步骤并移除 Claude 权限跳过配置 ([d76352b](https://git.bjxgj.com/xgj/spaceflow/commit/d76352b73c3e3bd910d2ab9fa0d6c5839b18aca0))
* 在 PR 审查提示词中添加审查任务清单 ([4ed1012](https://git.bjxgj.com/xgj/spaceflow/commit/4ed1012cd79ceb9d81febabb5b58c1498fefcb06))
* 在 PR 审查服务中添加允许工具列表配置 ([7940003](https://git.bjxgj.com/xgj/spaceflow/commit/79400038531c5e18643c7eb83f1efb5c5f8e5a0f))
* 在 PR 审查系统提示词中强调严格审查和问题发现 ([0e16043](https://git.bjxgj.com/xgj/spaceflow/commit/0e160437a8a965fa7dfaef526a685c64769c9f82))
* 在 PR 审查系统提示词中添加 JSON 输出格式要求 ([7705b50](https://git.bjxgj.com/xgj/spaceflow/commit/7705b50a2d3f8e3bc07debd4b25ef7cd0df43c88))
* 在 PR 审查系统提示词中添加"全面"关键词以强调审查完整性 ([bbf5b51](https://git.bjxgj.com/xgj/spaceflow/commit/bbf5b5168280daee7d5ad0aa047061bc185fd1c3))
* 在 PR 审查系统提示词中添加审查范围限制说明 ([cf947ea](https://git.bjxgj.com/xgj/spaceflow/commit/cf947ea6c7c535bd8ba6458fb70ed8ee2d73f8f2))
* 在 PR 审查系统提示词中添加工具使用限制说明 ([bd6570c](https://git.bjxgj.com/xgj/spaceflow/commit/bd6570c24bf969564bd5703a63fc02711cc63cd7))
* 在 review.includes 中排除测试文件和配置文件 ([64a19c9](https://git.bjxgj.com/xgj/spaceflow/commit/64a19c9f9369d818ff20e82fd14b48e9ee19bd3f))
* 在开发模式下添加 Claude CLI 版本检查步骤 ([a388332](https://git.bjxgj.com/xgj/spaceflow/commit/a388332689901687132e469ce24053ccc05e295a))
* 增强 Claude API 调用的诊断信息和错误处理 ([8a9709d](https://git.bjxgj.com/xgj/spaceflow/commit/8a9709d4d00d60da0682750a820f1cd2f6c97c05))
* 将 Claude CLI 全局安装步骤从 action 移至工作流配置阶段 ([98f85a9](https://git.bjxgj.com/xgj/spaceflow/commit/98f85a95e64bcc6275e3b69cc7dfa77066c076b5))
* 将 Claude Code Router 启动命令从 npx 改为 pnpx ([dc138e3](https://git.bjxgj.com/xgj/spaceflow/commit/dc138e35fff678f7c0f28855d0563335e2c492a7))
* 将 Claude Code Router 启动命令从 pnpx 改为 pnpm dlx ([c776e54](https://git.bjxgj.com/xgj/spaceflow/commit/c776e5490632589cd8da1a0676143fdac1f0bd89))
* 将 Claude Code Router 启动方式从 pnpm dlx 改为 bunx ([3c4e3d7](https://git.bjxgj.com/xgj/spaceflow/commit/3c4e3d7f3defd814b1df0016ac0163fd548aa72b))
* 将 Claude 进程调试日志改为仅在 verbose 模式下输出 ([241b08b](https://git.bjxgj.com/xgj/spaceflow/commit/241b08bbd96e1eb96e891cb1626bf7eb225ec9fa))
* 将 PR 审查任务清单从系统提示词移至用户提示词 ([8582c1b](https://git.bjxgj.com/xgj/spaceflow/commit/8582c1b9898f666240f0fdfbc70ba427c50c91b1))
* 将 pr-review 命令参数从 command 字段移至 args 字段 ([5e05d88](https://git.bjxgj.com/xgj/spaceflow/commit/5e05d889ca7d3b40f5143af751eced6ed7d0a977))
* 将 review-spec 作为 Git 子模块集成到 .claude/skills 目录 ([7ef06d0](https://git.bjxgj.com/xgj/spaceflow/commit/7ef06d0ef019462010b5ef27a4e160cc0a6bbbb8))
* 提取 spawnClaudeCodeProcess 函数并添加 allowDangerouslySkipPermissions 选项 ([6164571](https://git.bjxgj.com/xgj/spaceflow/commit/616457104646a830cec9387cdd42c56562cd3949))
* 支持从 git remote 自动获取仓库信息 ([2991cb8](https://git.bjxgj.com/xgj/spaceflow/commit/2991cb8a5f87978831b3e68781bcf51f6ec76b18))
* 支持从环境变量获取 Gitea 服务器地址和令牌 ([5b30aba](https://git.bjxgj.com/xgj/spaceflow/commit/5b30aba76323a20f6e5077c561629cbbfe07130f))
* 支持从配置文件读取 Claude 模型名称 ([b29b128](https://git.bjxgj.com/xgj/spaceflow/commit/b29b128baefb0fad1ebc5288d89cc6dfcace4af1))
* 支持基于 includes 模式过滤 commits 并从配置文件读取默认 includes ([607fb78](https://git.bjxgj.com/xgj/spaceflow/commit/607fb78a26ce7dac0f1c52d67c3fd9e9142c6adb))
* 支持本地模式下的 PR 审查功能 ([a8cf6b7](https://git.bjxgj.com/xgj/spaceflow/commit/a8cf6b7f63b4bfa61e630330e4e29d2875394513))
* 支持通过环境变量覆盖 Claude 配置参数 ([35207c7](https://git.bjxgj.com/xgj/spaceflow/commit/35207c7f84e06d69053418460deae9fd716c236a))
* 支持通过配置文件自动配置 Claude CLI 设置 ([bb60d3c](https://git.bjxgj.com/xgj/spaceflow/commit/bb60d3c9e015a007492592bcdb78bfec3ae1a09c))
* 新增 LLM 代理适配器架构，支持 Claude 和 OpenAI 两种 LLM 提供商 ([a92910a](https://git.bjxgj.com/xgj/spaceflow/commit/a92910aacf2ce411f2849edf72555a1b9f05dc37))
* 新增 PR 评论指令触发功能，支持从评论中解析 /ai-review 命令 ([ac95860](https://git.bjxgj.com/xgj/spaceflow/commit/ac95860a2edfbb7b988f564b17af401ec93f2231))
* 新增CI发布工作流和monorepo配置 ([19860b0](https://git.bjxgj.com/xgj/spaceflow/commit/19860b04c0578f87af2c758a17f7ceb5a17b3165))
* 新增删除代码影响分析功能，支持通过 --analyze-deletions 选项分析删除代码可能带来的影响 ([e286938](https://git.bjxgj.com/xgj/spaceflow/commit/e2869387239949d4af4ecb2686c4189a90f9c59c))
* 更新 JS/TS 审查规范，放宽魔法字符串和数字规则的适用范围 ([b5d17bb](https://git.bjxgj.com/xgj/spaceflow/commit/b5d17bb285b200e0eea9194a4b69ad5d888cd77f))
* 更新 PR 审查使用的 AI 模型版本 ([ed7664e](https://git.bjxgj.com/xgj/spaceflow/commit/ed7664e8900d663e72ce8f091b919f307db50b58))
* 更新 PR 审查使用的 AI 模型版本 ([33c4b72](https://git.bjxgj.com/xgj/spaceflow/commit/33c4b727241886a3b53a393f98c4d1b4fedf4ef7))
* 更新 PR 审查工作流中用户切换步骤的名称 ([5de92da](https://git.bjxgj.com/xgj/spaceflow/commit/5de92da95d89c8c2f611d13aa6c5e99a293e3d33))
* 注释掉 PR 审查工作流中的 claude setup 步骤 ([735e6ac](https://git.bjxgj.com/xgj/spaceflow/commit/735e6acb0b0b68f3816b00a580edb413996aab5b))
* 添加 --ignore-error 参数 ([46beca6](https://git.bjxgj.com/xgj/spaceflow/commit/46beca6ae4174e00448b7e9eec8831bb02feb10e))
* 添加 ci-review 命令用于 PR 代码自动审查 ([c6c5b19](https://git.bjxgj.com/xgj/spaceflow/commit/c6c5b1937756da422e4eb1067302f0c7f60281dd))
* 添加 ci-script 命令用于在分支锁定/解锁之间执行脚本 ([216a22e](https://git.bjxgj.com/xgj/spaceflow/commit/216a22e20406d66b3994ba342dece7a942b0c9e3))
* 添加 ci-shell 命令用于在分支锁定/解锁之间执行 Shell 命令 ([3275be5](https://git.bjxgj.com/xgj/spaceflow/commit/3275be514230bd1e2726653c98458b277684568d))
* 添加 Claude CLI 安装支持并优化错误处理 ([c397c72](https://git.bjxgj.com/xgj/spaceflow/commit/c397c72ad31a623c52c8960ab1ba6942dc2470c6))
* 添加 Claude CLI 进程调试日志和错误输出捕获 ([bfd3b45](https://git.bjxgj.com/xgj/spaceflow/commit/bfd3b45c8b7a8a523d457b52071f740b1892cf42))
* 添加 Claude Code Router 环境准备和启动步骤 ([cade327](https://git.bjxgj.com/xgj/spaceflow/commit/cade3271c25bc441b179f40b6cc7f4e0dc4b719d))
* 添加 Claude 配置并优化代码格式 ([ae8d247](https://git.bjxgj.com/xgj/spaceflow/commit/ae8d2477b062e10b7be829375ad9b76e605ba758))
* 添加 dev-mode 参数支持开发模式运行 Actions ([31a217d](https://git.bjxgj.com/xgj/spaceflow/commit/31a217d875ed2d1bde632bd86ffa40086f9efed6))
* 添加 Gitea Actions 工作流用于测试和运行命令 ([0a1d102](https://git.bjxgj.com/xgj/spaceflow/commit/0a1d102cf1a8aeb061a69c2c6fd7b854ce2ef5aa))
* 添加 GitHub/Gitea Actions 支持和输出服务 ([320a0aa](https://git.bjxgj.com/xgj/spaceflow/commit/320a0aab13a9725d418b1c631f2ef9b6cc0177fc))
* 添加 LLM 类型必填校验，在执行 PR 审查前检查参数有效性 ([717b80d](https://git.bjxgj.com/xgj/spaceflow/commit/717b80dc723921ed5e48a1c726b11e21fd03d209))
* 添加 OpenAI LLM 支持，允许在 PR 审查中选择不同的 AI 模型 ([1c7427e](https://git.bjxgj.com/xgj/spaceflow/commit/1c7427eca4de3884d877d1c874005a133fb97fb7))
* 添加 OpenAI 配置支持，允许通过环境变量自定义 API 端点和模型 ([62929db](https://git.bjxgj.com/xgj/spaceflow/commit/62929db9fd2f5edf9ac53c1e434dc993bc97a87b))
* 添加 PR 审查详细输出模式 ([888732c](https://git.bjxgj.com/xgj/spaceflow/commit/888732c12530a1d3ef1238bc29d72567d8b53bac))
* 添加ci参数 ([4141e99](https://git.bjxgj.com/xgj/spaceflow/commit/4141e999d31276cbc7db3d52b37dd183946d2b51))
* 添加文件过滤功能支持 glob 模式匹配 ([21a4732](https://git.bjxgj.com/xgj/spaceflow/commit/21a4732fb84a496cc6bd0f87de24af54b9526c93))
* 添加规范严重程度（severity）机制，支持在规范文件和配置中自定义问题级别 ([a077797](https://git.bjxgj.com/xgj/spaceflow/commit/a07779702cd4204395f7e168454654da2fc7696c))
* 添加规范覆盖（override）机制，支持在 Nest.js 规范中覆盖基础规范 ([32c0ea3](https://git.bjxgj.com/xgj/spaceflow/commit/32c0ea3d316e919932aaf92f38fd02d9e173acf7))
* 移除 Claude Code Router 本地服务，直接使用火山引擎 API ([b25efa1](https://git.bjxgj.com/xgj/spaceflow/commit/b25efa1964ab8c5fc5ae3dcbab94cfea6ba3cf7f))
* 简化 PR 审查任务清单，将具体文件列表改为统一描述 ([7b397a9](https://git.bjxgj.com/xgj/spaceflow/commit/7b397a97217ad741c32d63a70c3587d7ae92ab3f))
* 统一文件审查日志格式，在所有审查日志前添加双换行符 ([4e72b59](https://git.bjxgj.com/xgj/spaceflow/commit/4e72b59773b7f56244f032435221fa2cca8a8bcd))
* 调整 PR 审查提示词结构，将 commits 信息移至变更文件之前 ([3585a3c](https://git.bjxgj.com/xgj/spaceflow/commit/3585a3c01ff6e9ecbaf24de3d98cea24076cc976))
* 调整 PR 审查系统提示词中"审查任务"章节的位置 ([147f508](https://git.bjxgj.com/xgj/spaceflow/commit/147f508211a38b082435999b14c00aecdea8af25))
* 配置 PR 审查工作流并添加 Claude 认证 ([1983526](https://git.bjxgj.com/xgj/spaceflow/commit/19835263be8b28e674fc5eef7321575d34ab4442))
* 配置 PR 工作流权限并添加 CI 模式支持 ([4eb6ab2](https://git.bjxgj.com/xgj/spaceflow/commit/4eb6ab2169cf36d4f649f683d13721f646e6e179))
* 重构 LLM JSON 输出处理，引入 LlmJsonPut 工具类统一管理 JSON 解析和修复 ([44e2bd9](https://git.bjxgj.com/xgj/spaceflow/commit/44e2bd95c6f7f8aaf7b1e95740c580ed37384cde))
* 重构 PR 审查为按文件逐个审查，提升审查精度和错误处理能力 ([4a46a4d](https://git.bjxgj.com/xgj/spaceflow/commit/4a46a4d9261548652365b4e362bac4afdd0f4839))
* 重构 PR 审查提示词结构，将系统提示和用户提示分离 ([a2474bc](https://git.bjxgj.com/xgj/spaceflow/commit/a2474bc46f346593edfe9e9d40aa33794d508243))
* 重构 PR 审查服务，引入 LlmProxyService 统一管理多 LLM 适配器调用 ([d1e01f6](https://git.bjxgj.com/xgj/spaceflow/commit/d1e01f6c0ebf1c1155ca9cb2a5802d61c2e34673))

### 修复BUG

* **actions:** 修复日志输出中的 emoji 显示问题,将 � 替换为 ℹ️ ([d3cd94a](https://git.bjxgj.com/xgj/spaceflow/commit/d3cd94afa9c6893b923d316fdcb5904f42ded632))
* **actions:** 修正 pnpm setup 命令调用方式 ([8f014fa](https://git.bjxgj.com/xgj/spaceflow/commit/8f014fa90b74e20de4c353804d271b3ef6f1288f))
* **core:** 从 PR diff 填充缺失的 patch 字段 ([24bfaa7](https://git.bjxgj.com/xgj/spaceflow/commit/24bfaa76f3bd56c8ead307e73e0623a2221c69cf))
* **core:** 修复 resolveRef 方法未处理空 ref 参数的问题 ([0824c83](https://git.bjxgj.com/xgj/spaceflow/commit/0824c8392482263036888b2fec95935371d67d4d))
* **core:** 修复CI配置类型定义错误 ([7162dd3](https://git.bjxgj.com/xgj/spaceflow/commit/7162dd3acf1f2b5e81c3b8bb63071ebd4e2d58ae))
* **core:** 修复commit命令分组分析的防御性检查 ([62c9d47](https://git.bjxgj.com/xgj/spaceflow/commit/62c9d475ec76d885927bdb1bb9c3bcd9ae5f9f68))
* **core:** 修复commit命令拆分时重复打印信息的问题 ([c1d343a](https://git.bjxgj.com/xgj/spaceflow/commit/c1d343a70858513e0fa6fd530e6f9244840d721b))
* **core:** 修复全局配置文件存储路径 ([b04361d](https://git.bjxgj.com/xgj/spaceflow/commit/b04361d59a5904b5e92e3ba850ea4ad54cf0a87c))
* **core:** 统一所有命令的错误处理,添加堆栈信息输出 ([31224a1](https://git.bjxgj.com/xgj/spaceflow/commit/31224a16ce7155402504bd8d3e386e59e47949df))
* dryRun 模式优化 ([5dd545b](https://git.bjxgj.com/xgj/spaceflow/commit/5dd545b544664e4d46aca92b1edd2dc104a65f50))
* **mcp:** 添加 -y 选项确保 Inspector 自动安装依赖 ([a9201f7](https://git.bjxgj.com/xgj/spaceflow/commit/a9201f74bd9ddc5eba92beaaa676f377842863e0))
* **publish:** 修复分支锁定时未捕获异常处理器的资源泄漏问题 ([ae326e9](https://git.bjxgj.com/xgj/spaceflow/commit/ae326e95c0cea033893cf084cbf7413fb252bd33))
* **publish:** 修复预演模式下的交互式提示问题 ([0b785bf](https://git.bjxgj.com/xgj/spaceflow/commit/0b785bfddb9f35e844989bd3891817dc502302f8))
* **review:** 修复删除代码影响分析的防御性检查 ([06e073f](https://git.bjxgj.com/xgj/spaceflow/commit/06e073f59c68ade187ff989f850a312880a1961f))
* **review:** 修复参数空值检查，增强代码健壮性 ([792a192](https://git.bjxgj.com/xgj/spaceflow/commit/792a192fd5dd80ed1e6d85cd61f6ce997bcc9dd9))
* **review:** 修复审查完成日志中的乱码 emoji ([36c1c48](https://git.bjxgj.com/xgj/spaceflow/commit/36c1c48faecda3cc02b9e0b097aebba0a85ea5f8))
* **review:** 修复按指定提交过滤时未处理空值导致的潜在问题 ([5d4d3e0](https://git.bjxgj.com/xgj/spaceflow/commit/5d4d3e0390a50c01309bb09e01c7328b211271b8))
* **review:** 增强错误处理,添加堆栈信息输出 ([e0fb5de](https://git.bjxgj.com/xgj/spaceflow/commit/e0fb5de6bc877d8f0b3dc3c03f8d614320427bf3))
* **review:** 将 UserInfo 的 id 字段类型从 number 改为 string ([505e019](https://git.bjxgj.com/xgj/spaceflow/commit/505e019c85d559ce1def1350599c1de218f7516a))
* **review:** 新增 getFileContents、getChangedFilesBetweenRefs 和 filterIssuesByValidCommits 方法的单元测试 ([7618c91](https://git.bjxgj.com/xgj/spaceflow/commit/7618c91bc075d218b9f51b862e5161d15a306bf8))
* Update install command and service ([92b9fcf](https://git.bjxgj.com/xgj/spaceflow/commit/92b9fcf3e3ffb0fac7411ff2a799d52587c8dbec))
* 优化PR输出 ([7bb19e4](https://git.bjxgj.com/xgj/spaceflow/commit/7bb19e4628b2e7cbf9c36415d617396dc68fde76))
* 修复 verbose 级别判断逻辑，确保 true 值仅对应 level 1 ([f1a3847](https://git.bjxgj.com/xgj/spaceflow/commit/f1a38470cb91590e0be85ed3c2be2bad04b40eeb))
* 修复review问题 ([7c417ed](https://git.bjxgj.com/xgj/spaceflow/commit/7c417ed556e33b470132449b7fc05b89ee098100))
* 修复子目录扫描问题 ([ea20ad9](https://git.bjxgj.com/xgj/spaceflow/commit/ea20ad939bd915c90e2fbbb6f3d860c683f51c36))
* 修正 release-it 配置中的 dryRun 参数名称 ([c0518e9](https://git.bjxgj.com/xgj/spaceflow/commit/c0518e9d895821000d79fb0ff1d7e9dbe0dc433d))
* 修正 release-it 配置参数格式并移除 dryRun 条件判断 ([7b08904](https://git.bjxgj.com/xgj/spaceflow/commit/7b089049e973e96e331e3ac2cb62fddb79b2ba84))
* 修正配置文件中 review.include 字段名为 review.includes ([c4a4504](https://git.bjxgj.com/xgj/spaceflow/commit/c4a4504224bb6e3c1efabf05253fc0a39f0d4d67))
* 尝试运行不执行 release-it-gitea 插件 ([bf20e12](https://git.bjxgj.com/xgj/spaceflow/commit/bf20e12271d858af0b2a6c4778f9838016a8a210))
* 支持只审核某个文件的功能 ([920493a](https://git.bjxgj.com/xgj/spaceflow/commit/920493adad78a0f7429bde4b3c73491c63903690))
* 添加 CLI 进程退出码处理 ([2ceb262](https://git.bjxgj.com/xgj/spaceflow/commit/2ceb262a4b56e8d3e3bd320c9a8860f51a3b05ab))
* 补充d参数 ([ff32dc8](https://git.bjxgj.com/xgj/spaceflow/commit/ff32dc849a9034ba5da64009523f2a5ff0b92b2f))

### 性能优化

* **core:** 优化commit命令的消息生成性能 ([43b1239](https://git.bjxgj.com/xgj/spaceflow/commit/43b12397a91507b9473526fedab4049b73bf661b))

### 代码重构

* **ci:** 优化 publish 工作流配置 ([d898d28](https://git.bjxgj.com/xgj/spaceflow/commit/d898d289027665c267af4e85b22c352b32c75a08))
* **ci:** 优化分支保护测试的 token 调试功能 ([1acadc9](https://git.bjxgj.com/xgj/spaceflow/commit/1acadc99213b02627983f5613fccc14910f24f83))
* **ci:** 优化工作流配置和 token 权限调试功能 ([807b384](https://git.bjxgj.com/xgj/spaceflow/commit/807b384a95ae887ae3bb8124859c76e01338c398))
* **ci:** 将 Git 用户名从 "gitea-actions" 改回 "GiteaActions" 并为 checkout 添加 token ([f494fb8](https://git.bjxgj.com/xgj/spaceflow/commit/f494fb8d4f9718b2b3b93b4610b8199e4e21f927))
* **ci:** 将分支保护测试文件从 ci.log 改为 ci.md ([145696a](https://git.bjxgj.com/xgj/spaceflow/commit/145696a498d79de37abfddebd45e4b769e213f00))
* **ci:** 将分支保护测试的 contents 权限改为只读 ([8e924b9](https://git.bjxgj.com/xgj/spaceflow/commit/8e924b941e12b4c21caac8bdb946e563b520f1be))
* **ci:** 恢复 publish 工作流的 push 触发器并调整 Git 配置 ([3b0d2fe](https://git.bjxgj.com/xgj/spaceflow/commit/3b0d2fe5d85971a5ffbefd2fd48b26d30bec0341))
* **ci:** 更新 npm registry 配置从 [@xgjlib](https://git.bjxgj.com/xgjlib) 到 [@spaceflow](https://git.bjxgj.com/spaceflow) ([7b5ac21](https://git.bjxgj.com/xgj/spaceflow/commit/7b5ac21950e64d89c9432a3bd84bbcfcb5015eb2))
* **ci:** 调整 publish 工作流步骤顺序 ([f6a92f2](https://git.bjxgj.com/xgj/spaceflow/commit/f6a92f28d137323230e603982c623c2fff46e524))
* **claude:** 移除 .claude 目录及其 .gitignore 配置文件 ([91916a9](https://git.bjxgj.com/xgj/spaceflow/commit/91916a99f65da31c1d34e6f75b5cbea1d331ba35))
* **cli:** 优化依赖安装流程并支持 .spaceflow 目录配置 ([5977631](https://git.bjxgj.com/xgj/spaceflow/commit/597763183eaa61bb024bba2703d75239650b54fb))
* **cli:** 拆分 CLI 为独立包并重构扩展加载机制 ([b385d28](https://git.bjxgj.com/xgj/spaceflow/commit/b385d281575f29b823bb6dc4229a396a29c0e226))
* **cli:** 移除 ExtensionModule 并优化扩展加载机制 ([8f7077d](https://git.bjxgj.com/xgj/spaceflow/commit/8f7077deaef4e5f4032662ff5ac925cd3c07fdb6))
* **cli:** 调整依赖顺序并格式化导入语句 ([32a9c1c](https://git.bjxgj.com/xgj/spaceflow/commit/32a9c1cf834725a20f93b1f8f60b52692841a3e5))
* **cli:** 重构 getPluginConfigFromPackageJson 方法以提高代码可读性 ([f5f6ed9](https://git.bjxgj.com/xgj/spaceflow/commit/f5f6ed9858cc4ca670e30fac469774bdc8f7b005))
* **cli:** 重构扩展配置格式，支持 flow/command/skill 三种导出类型 ([958dc13](https://git.bjxgj.com/xgj/spaceflow/commit/958dc130621f78bbcc260224da16a5f16ae0b2b1))
* **config:** 实现多层级配置文件合并机制 ([bce517f](https://git.bjxgj.com/xgj/spaceflow/commit/bce517f8541679e26c21926dc19f868ef525b2ec))
* **config:** 降低并发数以优化 AI 审查性能 ([052dd72](https://git.bjxgj.com/xgj/spaceflow/commit/052dd728f759da0a31e86a0ad480e9bb35052781))
* **core:** 为 build/clear/commit 命令添加国际化支持 ([de82cb2](https://git.bjxgj.com/xgj/spaceflow/commit/de82cb2f1ed8cef0e446a2d42a1bf1f091e9c421))
* **core:** 优化 list 命令输出格式并修复 MCP Inspector 包管理器兼容性 ([a019829](https://git.bjxgj.com/xgj/spaceflow/commit/a019829d3055c083aeb86ed60ce6629d13012d91))
* **core:** 优化配置合并逻辑，添加字段覆盖策略 ([18680e6](https://git.bjxgj.com/xgj/spaceflow/commit/18680e69b0d6e9e05c843ed3f07766830955d658))
* **core:** 将 rspack 配置和工具函数中的 @spaceflow/cli 引用改为 @spaceflow/core ([3c301c6](https://git.bjxgj.com/xgj/spaceflow/commit/3c301c60f3e61b127db94481f5a19307f5ef00eb))
* **core:** 将扩展依赖从 @spaceflow/cli 迁移到 @spaceflow/core ([6f9ffd4](https://git.bjxgj.com/xgj/spaceflow/commit/6f9ffd4061cecae4faaf3d051e3ca98a0b42b01f))
* **core:** 提取 source 处理和包管理器工具函数到共享模块 ([ab3ff00](https://git.bjxgj.com/xgj/spaceflow/commit/ab3ff003d1cd586c0c4efc7841e6a93fe3477ace))
* **core:** 新增 getEnvFilePaths 工具函数统一管理 .env 文件路径优先级 ([809fa18](https://git.bjxgj.com/xgj/spaceflow/commit/809fa18f3d0b8eabcb068988bab53d548eaf03ea))
* **core:** 新增远程仓库规则拉取功能并支持 Git API 获取目录内容 ([69ade16](https://git.bjxgj.com/xgj/spaceflow/commit/69ade16c9069f9e1a90b3ef56dc834e33a3c0650))
* **core:** 统一 LogLevel 类型定义并支持字符串/数字双模式 ([557f6b0](https://git.bjxgj.com/xgj/spaceflow/commit/557f6b0bc39fcfb0e3f773836cbbf08c1a8790ae))
* **core:** 重构Gitea SDK分支保护逻辑 ([df5b491](https://git.bjxgj.com/xgj/spaceflow/commit/df5b49141a4f146e74a37a72c9faf03b959d97c1))
* **core:** 重构publish配置项命名 ([18c68da](https://git.bjxgj.com/xgj/spaceflow/commit/18c68daab474eb69eb61a7103831c02f43341e38))
* **core:** 重构安装服务目录结构和命名 ([50cc900](https://git.bjxgj.com/xgj/spaceflow/commit/50cc900eb864b23f20c5f48dec20d1a754238286))
* **core:** 重构配置管理系统，引入统一配置加载器 ([992a661](https://git.bjxgj.com/xgj/spaceflow/commit/992a66108ae808140e8e4d18ab402f924a2479aa))
* **core:** 重构配置管理逻辑，集中配置操作到 spaceflow.config.ts ([f1f2ade](https://git.bjxgj.com/xgj/spaceflow/commit/f1f2ade6fe032303403d8a942e3f937b4b24d9b6))
* **core:** 重构配置读取逻辑,新增 ConfigReaderService 并支持 .spaceflowrc 配置文件 ([72e88ce](https://git.bjxgj.com/xgj/spaceflow/commit/72e88ced63d03395923cdfb113addf4945162e54))
* **i18n:** 将 locales 导入从命令文件迁移至扩展入口文件 ([0da5d98](https://git.bjxgj.com/xgj/spaceflow/commit/0da5d9886296c4183b24ad8c56140763f5a870a4))
* **i18n:** 移除扩展元数据中的 locales 字段并改用 side-effect 自动注册 ([2c7d488](https://git.bjxgj.com/xgj/spaceflow/commit/2c7d488a9dfa59a99b95e40e3c449c28c2d433d8))
* **mcp:** 使用 DTO + Swagger 装饰器替代手动 JSON Schema 定义 ([87ec262](https://git.bjxgj.com/xgj/spaceflow/commit/87ec26252dd295536bb090ae8b7e418eec96e1bd))
* **mcp:** 升级 MCP SDK API 并优化 Inspector 调试配置 ([176d04a](https://git.bjxgj.com/xgj/spaceflow/commit/176d04a73fbbb8d115520d922f5fedb9a2961aa6))
* **mcp:** 将 MCP 元数据存储从 Reflect Metadata 改为静态属性以支持跨模块访问 ([cac0ea2](https://git.bjxgj.com/xgj/spaceflow/commit/cac0ea2029e1b504bc4278ce72b3aa87fff88c84))
* **publish:** 优化 monorepo 模式下的路径处理逻辑 ([a563174](https://git.bjxgj.com/xgj/spaceflow/commit/a5631742e12e6c3f55962b8259de9b2d2b21bfce))
* **publish:** 修正 pnpm publish 命令执行目录 ([8bf2897](https://git.bjxgj.com/xgj/spaceflow/commit/8bf2897493c315a5356c8e29393c2806dc1300be))
* **publish:** 切换到包目录执行 release-it 以确保读取正确的 package.json ([0e49e67](https://git.bjxgj.com/xgj/spaceflow/commit/0e49e6764b269616756a71fe3b7ec41d43bc819c))
* **publish:** 改进错误处理和 npm 配置逻辑 ([fe11eb1](https://git.bjxgj.com/xgj/spaceflow/commit/fe11eb1326cdbeced6b3b7cf67e00dc0205b9f39))
* **publish:** 更新 Git 配置和推送白名单逻辑 ([9f992d3](https://git.bjxgj.com/xgj/spaceflow/commit/9f992d31d6adc30f964d66a932ebd06b0c26df19))
* **publish:** 禁用分支锁定功能 ([b2f8423](https://git.bjxgj.com/xgj/spaceflow/commit/b2f84233165d1ceab314667094b9e4d2d0df6e6b))
* **publish:** 简化发布命令，移除 pkgName 参数 ([31ab468](https://git.bjxgj.com/xgj/spaceflow/commit/31ab4689e0aefd4843bfc6b8d65b38ecd5e288f7))
* **publish:** 调整zod依赖的导入来源 ([574eef1](https://git.bjxgj.com/xgj/spaceflow/commit/574eef1910809a72a4b13acd4cb070e12dc42ce8))
* **publish:** 调整包变更检测的日志输出格式 ([df35e92](https://git.bjxgj.com/xgj/spaceflow/commit/df35e92d614ce59e202643cf34a0fef2803412a1))
* **review:** 优化 Markdown 格式化器的代码风格和 JSON 数据输出逻辑 ([ca1b0c9](https://git.bjxgj.com/xgj/spaceflow/commit/ca1b0c96d9d0663a8b8dc93b4a9f63d4e5590df0))
* **review:** 优化 override 和变更行过滤的日志输出,增强调试信息的可读性 ([9a7c6f5](https://git.bjxgj.com/xgj/spaceflow/commit/9a7c6f5b4ef2b8ae733fa499a0e5ec82feebc1d2))
* **review:** 优化历史 issue commit 匹配逻辑,支持短 SHA 与完整 SHA 的前缀匹配 ([e30c6dd](https://git.bjxgj.com/xgj/spaceflow/commit/e30c6ddefb14ec6631ce341f1d45c59786e94a46))
* **review:** 使用 Base64 编码存储审查数据,避免 JSON 格式在 Markdown 中被转义 ([fb91e30](https://git.bjxgj.com/xgj/spaceflow/commit/fb91e30d0979cfe63ed8e7657c578db618b5e783))
* **review:** 基于 fileContents 实际 commit hash 验证问题归属,替代依赖 LLM 填写的 commit 字段 ([de3e377](https://git.bjxgj.com/xgj/spaceflow/commit/de3e3771eb85ff93200c63fa9feb38941914a07d))
* **review:** 新增测试方法用于验证 PR 审查功能 ([5c57833](https://git.bjxgj.com/xgj/spaceflow/commit/5c578332cedffb7fa7e5ad753a788bcd55595c68))
* **review:** 移除 filterNoCommit 配置项,统一使用基于 commit hash 的问题过滤逻辑 ([82429b1](https://git.bjxgj.com/xgj/spaceflow/commit/82429b1072affb4f2b14d52f99887e12184d8218))
* **review:** 移除测试方法 testMethod ([21e9938](https://git.bjxgj.com/xgj/spaceflow/commit/21e9938100c5dd7d4eada022441c565b5c41a55a))
* **review:** 简化历史问题处理策略,将行号更新改为标记变更文件问题为无效 ([5df7f00](https://git.bjxgj.com/xgj/spaceflow/commit/5df7f0087c493e104fe0dc054fd0b6c19ebe3500))
* **review:** 简化行号更新逻辑,使用最新 commit diff 替代增量 diff ([6de7529](https://git.bjxgj.com/xgj/spaceflow/commit/6de7529c90ecbcee82149233fc01c393c5c4e7f7))
* **review:** 统一使用 parseLineRange 方法解析行号,避免重复的正则匹配逻辑 ([c64f96a](https://git.bjxgj.com/xgj/spaceflow/commit/c64f96aa2e1a8e22dcd3e31e1a2acc1bb338a1a8))
* **review:** 调整 filterIssuesByValidCommits 逻辑,保留无 commit 的 issue 交由 filterNoCommit 配置处理 ([e9c5d47](https://git.bjxgj.com/xgj/spaceflow/commit/e9c5d47aebef42507fd9fcd67e5eab624437e81a))
* **review:** 调整zod依赖的导入路径 ([02014cd](https://git.bjxgj.com/xgj/spaceflow/commit/02014cdab9829df583f0f621150573b8c45a3ad7))
* **review:** 过滤 merge commits,避免在代码审查中处理合并提交 ([d7c647c](https://git.bjxgj.com/xgj/spaceflow/commit/d7c647c33156a58b42bfb45a67417723b75328c6))
* **review:** 过滤非 PR commits 的问题,避免 merge commit 引入的代码被审查 ([9e20f54](https://git.bjxgj.com/xgj/spaceflow/commit/9e20f54d57e71725432dfb9e7c943946aa6677d4))
* **review:** 重构review模块LLM配置获取方式 ([ec7346f](https://git.bjxgj.com/xgj/spaceflow/commit/ec7346f3dd3e367015e63df7191d0e06ef15e0ef))
* **review:** 重构行号更新逻辑,使用增量 diff 替代全量 diff ([d4f4304](https://git.bjxgj.com/xgj/spaceflow/commit/d4f4304e1e41614f7be8946d457eea1cf4e202fb))
* **test:** 迁移测试框架从 Jest 到 Vitest ([308f9d4](https://git.bjxgj.com/xgj/spaceflow/commit/308f9d49089019530588344a5e8880f5b6504a6a))
* **verbose:** 扩展 verbose 级别支持至 3 ([c1a0808](https://git.bjxgj.com/xgj/spaceflow/commit/c1a080859e5d25ca1eb3dc7e00a67b32eb172635))
* 为 cursor 和 windsurf 编辑器新增插件命令文档和 skills 符号链接 ([2a08f4d](https://git.bjxgj.com/xgj/spaceflow/commit/2a08f4dfdc56bb09c736d762e221498729c12a55))
* 为代码审查提示添加文件目录树上下文，帮助 LLM 理解文件所在位置 ([0d66dd6](https://git.bjxgj.com/xgj/spaceflow/commit/0d66dd69736194a682b2570554cf90596d21f390))
* 为建议代码块添加可折叠的 details 标签，优化长代码建议的展示效果 ([376a3cd](https://git.bjxgj.com/xgj/spaceflow/commit/376a3cd54b9db343d83d8bfa5c1f1b3e4bdb8791))
* 为问题验证功能新增有效性判断，支持识别误报并在提示词中包含规则定义 ([6a3fe7b](https://git.bjxgj.com/xgj/spaceflow/commit/6a3fe7b82e6e8aa017b9accb6168eb1eb7884fad))
* 从 core 模块中移除 ReviewModule 导入，完成 review 命令插件化迁移 ([9a65fc7](https://git.bjxgj.com/xgj/spaceflow/commit/9a65fc7096c037df9049ec6893614e53036ee23f))
* 优化 AI Review 发布逻辑,将主评论与行级评论合并为单个 PR Review 提交 ([1ea0ee0](https://git.bjxgj.com/xgj/spaceflow/commit/1ea0ee08378ed1735da4f7ab195f168b7014e5d8))
* 优化 AI Review 审查流程，支持增量审查和分阶段报告提交 ([7ccbcbc](https://git.bjxgj.com/xgj/spaceflow/commit/7ccbcbca93e4cca86e749ba4b2ce50ef309a5de5))
* 优化 AI Review 输出格式处理逻辑，避免重复格式化并隐藏终端输出中的评审数据 ([c77d886](https://git.bjxgj.com/xgj/spaceflow/commit/c77d88648fe1de7c6d7b071eea0f17f38a3f696b))
* 优化 Claude Agent 模式的删除代码影响分析提示词和工具日志 ([ef59329](https://git.bjxgj.com/xgj/spaceflow/commit/ef59329a9865dab2220946ec94cc04afd0a3afc3))
* 优化 Claude Agent 模式的删除代码影响分析提示词和工具配置 ([fb02bcc](https://git.bjxgj.com/xgj/spaceflow/commit/fb02bcc75f5466c3e6e29e3ae6007f5149efde11))
* 优化 getFileBlame 方法的 git blame 命令实现，使用 awk 替代 grep 和 cut 组合 ([9274601](https://git.bjxgj.com/xgj/spaceflow/commit/9274601c68cfce7e9c1b7bbd80d7da287460a819))
* 优化 getFileBlame 方法的 git blame 输出解析，使用 TypeScript 原生字符串处理替代 awk 命令 ([7931b47](https://git.bjxgj.com/xgj/spaceflow/commit/7931b47388a090d96a6a61bb85199b88d210c73a))
* 优化 Markdown 格式化器的审查报告布局，调整章节结构并压缩 JSON 数据输出 ([d79373c](https://git.bjxgj.com/xgj/spaceflow/commit/d79373c67632659a856f72e08783d7206f9cd423))
* 优化 normalizeIssues 方法，为拆分后的多行 issue 添加建议引用逻辑 ([9fc25a4](https://git.bjxgj.com/xgj/spaceflow/commit/9fc25a4f30989ad25e5d0f8985ac7e122d45db3a))
* 优化 OpenCode 适配器服务器生命周期管理，支持动态端口分配和进程退出清理 ([5a11e36](https://git.bjxgj.com/xgj/spaceflow/commit/5a11e3625ead0aa1e5266eadb1223a7d3cffb14e))
* 优化 postOrUpdateReviewComment 方法参数，将 comment 字符串改为 ReviewResult 对象并在方法内部格式化 ([b225cfa](https://git.bjxgj.com/xgj/spaceflow/commit/b225cfa662512c5f836b7833a0c0b2f1915f8a0e))
* 优化 PR commits 获取和文件关联逻辑，使用行号映射精确匹配相关 commits ([9f7bdc3](https://git.bjxgj.com/xgj/spaceflow/commit/9f7bdc310f6101e38504133c491870f9eecc97e9))
* 优化 PR Review 发布逻辑，过滤已修复问题并移除评论标记 ([ce4e49c](https://git.bjxgj.com/xgj/spaceflow/commit/ce4e49cc5dfaa3d7e13a52190005515b7ce28236))
* 优化 review-spec 服务错误处理，目录不存在时静默跳过而非警告 ([584b878](https://git.bjxgj.com/xgj/spaceflow/commit/584b8783b75fa398d70d43bca8a1337c15c4e7eb))
* 优化CI发布工作流的GITEA_TOKEN配置 ([c5a6e2f](https://git.bjxgj.com/xgj/spaceflow/commit/c5a6e2f60b1679c9eed96a169b48430a2d0e7a92))
* 优化CI发布工作流的GITEA_TOKEN配置 ([ae69ead](https://git.bjxgj.com/xgj/spaceflow/commit/ae69eadc4ce76c453b552c829281acd99070b7e9))
* 优化publish工作流环境变量配置 ([3d83e9f](https://git.bjxgj.com/xgj/spaceflow/commit/3d83e9f559d9cf0fac9d46b06b9a22e2ab9590d7))
* 优化代码审查提示中的 commit hash 标注逻辑，在浅克隆场景下回退到 patch diff 模式 ([84bf231](https://git.bjxgj.com/xgj/spaceflow/commit/84bf23187cf7ba3bcf493f681d9a38e1fa9a5919))
* 优化分支保护操作的返回消息文案 ([3e3dade](https://git.bjxgj.com/xgj/spaceflow/commit/3e3dadeb06dafac61a7141432d85d0b51de8f842))
* 优化删除代码影响分析，支持通过 PR diff API 获取差异并新增 diff 文本解析方法 ([3814887](https://git.bjxgj.com/xgj/spaceflow/commit/3814887c34ab9e16df96260fc5252fb19cf00248))
* 优化删除代码影响分析报告的折叠展示，将整个详情区域改为可折叠 ([fa5ba3e](https://git.bjxgj.com/xgj/spaceflow/commit/fa5ba3e3ef7079fcec7da754894d2b6fcc482e14))
* 优化删除代码影响分析的分支引用解析，支持自动 fetch 远程分支并添加详细日志 ([905122e](https://git.bjxgj.com/xgj/spaceflow/commit/905122e4ed9f89eecb62db9586c32437b27242cf))
* 优化审查报告格式，支持区分有效问题和无效问题的展示 ([1b2a7be](https://git.bjxgj.com/xgj/spaceflow/commit/1b2a7be5923dace2603f7bf35b645318bfcab211))
* 优化审查提示词构建逻辑，支持按文件过滤规则并为每个文件生成独立的 systemPrompt ([9181b55](https://git.bjxgj.com/xgj/spaceflow/commit/9181b55212c74f92ce1bd61be75aead6322321e8))
* 优化审查结果展示格式，统一文件摘要和总结部分的 Markdown 样式 ([94a3bc2](https://git.bjxgj.com/xgj/spaceflow/commit/94a3bc289018c595036baf8884b69ceff2085145))
* 优化审查结果展示格式，调整严重程度图标和行号类型 ([28a8172](https://git.bjxgj.com/xgj/spaceflow/commit/28a817276f2a3ef061050fb2606f6727375e84bf))
* 优化建议代码块展示逻辑，仅对超过 3 行的代码使用折叠标签 ([6b86b74](https://git.bjxgj.com/xgj/spaceflow/commit/6b86b7427efc6777b20713d7afcd640dac3aea9e))
* 优化建议代码块格式化，自动清理嵌套的代码块标记 ([393292a](https://git.bjxgj.com/xgj/spaceflow/commit/393292a82457d90f737ffb3458226034616d843e))
* 优化建议代码块清理的正则表达式，支持更多边界情况 ([354cff3](https://git.bjxgj.com/xgj/spaceflow/commit/354cff30311d22da0f6fad134abb47e8053f9d32))
* 优化文件内容存储结构，将行号到 commit 映射集成到文件内容中 ([b98a044](https://git.bjxgj.com/xgj/spaceflow/commit/b98a044e5f941d84c02bbb1a567c801b39ae1646))
* 优化文件摘要格式，支持多行摘要的缩进展示 ([e57327a](https://git.bjxgj.com/xgj/spaceflow/commit/e57327a5f4737e01d6f555437e680b26a9d55bcc))
* 优化构建流程并调整 MCP/review 日志输出级别 ([74072c0](https://git.bjxgj.com/xgj/spaceflow/commit/74072c04be7a45bfc0ab53b636248fe5c0e1e42a))
* 优化构建脚本执行顺序,确保 spaceflow 核心包优先构建 ([18de03e](https://git.bjxgj.com/xgj/spaceflow/commit/18de03e9dd03081404b3cdf78213d20bceeec8a5))
* 优化细节的逻辑 ([4aa2a91](https://git.bjxgj.com/xgj/spaceflow/commit/4aa2a916b4b9287df73845db4420e5b31a3d97f7))
* 优化行号映射构建的日志输出控制和多行问题建议的文件路径显示 ([6e8c2a0](https://git.bjxgj.com/xgj/spaceflow/commit/6e8c2a0c5fe6b8441a88565c3ed39ec724a8d0c3))
* 优化行号映射构建过程的日志输出和错误处理 ([f699ccc](https://git.bjxgj.com/xgj/spaceflow/commit/f699ccc614840f49ee1c77d73e4cc288ba129aec))
* 优化行号映射构建逻辑，新增浅克隆场景下的回退机制和 diff 文本解析方法 ([a1a5912](https://git.bjxgj.com/xgj/spaceflow/commit/a1a5912b5e9db7f4cce0a83ef02261703fbb5e36))
* 优化行级评论格式，与 markdown.formatter.ts 保持一致的样式布局 ([9ddf9f6](https://git.bjxgj.com/xgj/spaceflow/commit/9ddf9f61bc7a2080a3f4f6f8ee6f823e3d77993e))
* 优化问题去重和验证逻辑，支持无效问题的覆盖和跳过复查 ([ef45dff](https://git.bjxgj.com/xgj/spaceflow/commit/ef45dffa38f5bec1c30f5ea3d5d7dfc077cb6b57))
* 优化问题验证提示词，明确 fixed 字段的判断标准和输出要求 ([c39e93d](https://git.bjxgj.com/xgj/spaceflow/commit/c39e93df4c56172710cdffc7949776e795e6d6fc))
* 使用 Claude Agent SDK 替代 CLI 调用方式 ([3d704ce](https://git.bjxgj.com/xgj/spaceflow/commit/3d704ce303293374f0378711c1bb22bff9c989bf))
* 使用 parallel 库重构问题验证流程，优化并发控制和进度反馈 ([ed15099](https://git.bjxgj.com/xgj/spaceflow/commit/ed15099b06439c17f2357fc8aa544ec0b3f2a415))
* 修复 OpenCode 适配器 provider 配置，使用自定义 provider ID 避免 SDK 方法冲突 ([32a5927](https://git.bjxgj.com/xgj/spaceflow/commit/32a5927f28d4c75685c6580bf889177faa6504fb))
* 修复问题标题中的严重性图标显示逻辑，避免有效问题同时显示✅和严重性图标 ([caa5998](https://git.bjxgj.com/xgj/spaceflow/commit/caa59983691df56c657b333aff1e946753397948))
* 修复问题标题中的图标显示逻辑，将 valid 字段改为 fixed 字段判断 ([1f93b4f](https://git.bjxgj.com/xgj/spaceflow/commit/1f93b4f840291cb951d2a4cf07a5442bd8b0e455))
* 修改 git diff 语法从三点改为两点，避免浅克隆时找不到 merge base ([965786e](https://git.bjxgj.com/xgj/spaceflow/commit/965786eec9f9071c69029c942c1782a3bac11d91))
* 修改名称 ([0247e73](https://git.bjxgj.com/xgj/spaceflow/commit/0247e7347c7726671048a1c20dd464eff92d83f2))
* 删除 ci-publish 命令相关文件 ([a4713ee](https://git.bjxgj.com/xgj/spaceflow/commit/a4713ee120d840e85a04dcf529fd192fc589a241))
* 升级 pr-review 工作流运行环境至 ubuntu-node-24 并移除容器用户配置 ([0c4c840](https://git.bjxgj.com/xgj/spaceflow/commit/0c4c840ff2c44648866f6b0d4e91a6f3ed128929))
* 在 actions-test 工作流中新增 LLM 服务环境变量配置 ([d9651a2](https://git.bjxgj.com/xgj/spaceflow/commit/d9651a26d295f9852a351fbb73d6b52b4d964d52))
* 在 actions-test 工作流中新增 pnpm 环境配置步骤 ([e8377e7](https://git.bjxgj.com/xgj/spaceflow/commit/e8377e73ab21d6162d99708fe082e9579ac1aceb))
* 在 AI Review 流程中新增 fillIssueCode 方法，自动填充问题对应的代码片段 ([bb7cd9b](https://git.bjxgj.com/xgj/spaceflow/commit/bb7cd9b8a5a9e2dd1b62ca3265c18ab0064fe073))
* 在 AI 代码审查配置中新增删除代码分析模式为 claude-code ([2ece119](https://git.bjxgj.com/xgj/spaceflow/commit/2ece1190bb3e1f06f87ea62fbc77d08c69c1f1ef))
* 在 claude-setup 服务中新增 authToken 必填校验，未配置时抛出错误 ([8283b5c](https://git.bjxgj.com/xgj/spaceflow/commit/8283b5c4c453cb770d4ac1e2f8ef6a11078c6dbf))
* 在 claude-setup 服务中新增详细日志输出，显示即将写入的配置内容 ([69f95a3](https://git.bjxgj.com/xgj/spaceflow/commit/69f95a3dda8edfe4f4caaadd75fe5000d57c0a58))
* 在 JS/TS 基础规范中明确魔法值检查范围，排除布尔和日期类型 ([df65aa8](https://git.bjxgj.com/xgj/spaceflow/commit/df65aa82e12863d139d8953b095b740da04b06fc))
* 在 normalizeIssues 中为问题添加发现时间，并在 Markdown 格式化器中展示发现时间和修复时间 ([224679c](https://git.bjxgj.com/xgj/spaceflow/commit/224679cbca9315d0c7730bf7d5fce4a520329829))
* 在 normalizeIssues 方法中新增 line 字段类型转换，确保 LLM 返回的数字类型被转为字符串 ([18e61db](https://git.bjxgj.com/xgj/spaceflow/commit/18e61dbe5326dd7d5a185ab731af24cc1eec6dc4))
* 在 PR 审查和命令测试工作流中新增 Git 凭证配置和子模块递归克隆支持 ([d544828](https://git.bjxgj.com/xgj/spaceflow/commit/d544828f09ee2e8c1626539e695fd2ed76afdf41))
* 在 PR 评论指令工作流中新增 claude-code 全局依赖安装 ([c103696](https://git.bjxgj.com/xgj/spaceflow/commit/c103696e01d8b97ec85f598f54ff12d79e9e3d99))
* 在 TODO 列表中新增 skills 自动修复 BUG 功能项 ([a153c6f](https://git.bjxgj.com/xgj/spaceflow/commit/a153c6f89ca617c21ecc8c7384620ee0e090393a))
* 在 Vue 代码审查规范中新增文件匹配规则，明确适用于 *.vue 文件 ([431ff38](https://git.bjxgj.com/xgj/spaceflow/commit/431ff38903f5b1ab81757ed5de86a4fc90f4afe1))
* 在代码审查提示中添加 git blame 信息，为每行代码标注对应的 commit hash ([e400acd](https://git.bjxgj.com/xgj/spaceflow/commit/e400acd155d24b74160b056cc64c0873f62aca23))
* 在全局和本地安装模式下为 commands 生成文档到 .claude/commands 目录 ([c99a61a](https://git.bjxgj.com/xgj/spaceflow/commit/c99a61ae8d6dd5088f3c1641a068171111ec4dbb))
* 在全局安装模式下将 skills 链接到 ~/.claude/skills 目录，并在目标路径生成 SKILL.md ([c92c0ca](https://git.bjxgj.com/xgj/spaceflow/commit/c92c0cac206e9526c61da444930a7fa5ce0c5940))
* 在历史问题修复验证中新增 valid 字段过滤，排除已标记为无效的问题 ([939fd19](https://git.bjxgj.com/xgj/spaceflow/commit/939fd19a851a5ac4bd23501547b98df4a8383dbb))
* 在命令测试工作流中新增环境变量配置，支持 Claude Code 和 OpenAI API 调用 ([0ae9b4c](https://git.bjxgj.com/xgj/spaceflow/commit/0ae9b4c5e1b066de77e53febae3d1f9f4463e90a))
* 在审查结果中新增 round 字段，记录问题发现的审查轮次 ([a079c37](https://git.bjxgj.com/xgj/spaceflow/commit/a079c3779ee7fe8fea4212172723c3adb7af64e4))
* 在所有命令中新增 --verbose 选项支持控制日志输出详细程度 ([d98fa88](https://git.bjxgj.com/xgj/spaceflow/commit/d98fa88e24657bda1edd9227ee57e7b511a30a86))
* 在文件审查结果中为问题添加发现时间戳，确保所有问题都有 date 字段 ([be748c7](https://git.bjxgj.com/xgj/spaceflow/commit/be748c70fe6508c4cf598376a6c69c87e27a2236))
* 在文件摘要统计中过滤无效问题，避免统计已确认无效的问题 ([432ced9](https://git.bjxgj.com/xgj/spaceflow/commit/432ced90466c9d0cba07ef41d7b256fbabe0b416))
* 在构建流程中新增 pnpm install 步骤，确保核心包构建后依赖正确安装 ([378c649](https://git.bjxgj.com/xgj/spaceflow/commit/378c64947da55c59dcdd1f1183e156d3c1b74263))
* 在行级评论中新增文件路径和行号信息展示 ([78abaae](https://git.bjxgj.com/xgj/spaceflow/commit/78abaae270be466f427f0020f3b1abd9c884a2a3))
* 在规范示例标题中添加英文标注，将"推荐做法"改为"推荐做法 (Good)"，"不推荐做法"改为"不推荐做法 (Bad)" ([8a51866](https://git.bjxgj.com/xgj/spaceflow/commit/8a51866bfb522a9f3b256f2a57a495de9b8fd542))
* 在魔法值检查规则中新增说明，明确无需检查单词拼写完整性 ([04d0485](https://git.bjxgj.com/xgj/spaceflow/commit/04d048521206c89795678a4f68f31bf066491121))
* 实现插件系统核心功能，支持 npm 包和 git 子模块两种技能包安装方式 ([65a413a](https://git.bjxgj.com/xgj/spaceflow/commit/65a413afaca40f524af532ada29edb1d14e7078d))
* 将 .spaceflow/package.json 纳入版本控制并自动添加到根项目依赖 ([ab83d25](https://git.bjxgj.com/xgj/spaceflow/commit/ab83d2579cb5414ee3d78a9768fac2147a3d1ad9))
* 将 AI Review 历史结果获取从 Issue Comment 改为 PR Review API ([6bf04ad](https://git.bjxgj.com/xgj/spaceflow/commit/6bf04adc5deaa7f3bfeca2b51e65e9aefee33857))
* 将 AI 代码审查模型从 doubao-seed-code-preview-251028 切换为 deepseek-v3-2-251201 ([f0844a4](https://git.bjxgj.com/xgj/spaceflow/commit/f0844a45f6313b4c1fbf5c4bd8f9d5e374959141))
* 将 AI 代码审查模式从 claude-code 切换回 openai，并同时保留两种 LLM 配置的环境变量 ([7bc231e](https://git.bjxgj.com/xgj/spaceflow/commit/7bc231eb4b05cf1f22d03dc6d62522c851f6ea43))
* 将 AI 代码审查模式从 openai 切换为 claude-code ([6ea1764](https://git.bjxgj.com/xgj/spaceflow/commit/6ea17641ac4754ce23ae52bae2f189a7ec74c083))
* 将 AI 代码审查默认模式从 openai 切换为 claude-code ([8b09765](https://git.bjxgj.com/xgj/spaceflow/commit/8b097657a4506d2d98396ce6f1f592ab526e59ef))
* 将 ai-review 命令重命名为 review，统一代码审查功能命名 ([12c4051](https://git.bjxgj.com/xgj/spaceflow/commit/12c40512d281159a6c0c9a25e480610810fd412e))
* 将 buildSpecsSection 方法移至 ReviewSpecService，统一规则格式化逻辑并优化问题验证提示词 ([6b5897e](https://git.bjxgj.com/xgj/spaceflow/commit/6b5897e6cb7e1739a710dd6d1f73b30a32d39e55))
* 将 ci-scripts 和 ci-shell 从 core 迁移到独立插件包，统一配置字段命名 ([5f79954](https://git.bjxgj.com/xgj/spaceflow/commit/5f799544a8bbe0f06f609af980539fc649118793))
* 将 Claude 配置逻辑提取为独立模块 ([8b3096c](https://git.bjxgj.com/xgj/spaceflow/commit/8b3096c14b7ab8c3737818eeed1f1e09d606ffda))
* 将 claude-setup 从 commands 目录迁移到 shared 目录，并新增配置备份恢复功能 ([a940a4f](https://git.bjxgj.com/xgj/spaceflow/commit/a940a4f4e5461bd2518908cd6c6e75cba00f57a5))
* 将 ensureGitHistory 调用提前至获取文件内容之前，确保 git blame 所需历史在文件读取前已补充完成 ([3a87a94](https://git.bjxgj.com/xgj/spaceflow/commit/3a87a945ddbec93cbbce232a3740f88b7d38e070))
* 将 Git 操作抽取为独立的 GitSdkService 模块 ([63a2a5c](https://git.bjxgj.com/xgj/spaceflow/commit/63a2a5c0f334adc61d2eb74a159f5bfba5ec7ca4))
* 将 GiteaSdkModule/GiteaSdkService 重命名为 GitProviderModule/GitProviderService ([462f492](https://git.bjxgj.com/xgj/spaceflow/commit/462f492bc2607cf508c5011d181c599cf17e00c9))
* 将 LLM 流式事件日志功能抽取为独立的 stream-logger 工具模块 ([5c81b9e](https://git.bjxgj.com/xgj/spaceflow/commit/5c81b9e821b5db9e6741142d4e5d361d8bce93c9))
* 将 LLM 配置移至 review 配置下，并将 claude 重命名为 claudeCode ([90d6bae](https://git.bjxgj.com/xgj/spaceflow/commit/90d6baefd03612e7636ab9c3de06aecfd1321ac4))
* 将 llmType 配置从顶层移至 review 配置块，新增 rules 字段支持规则级别覆盖 ([151ef9e](https://git.bjxgj.com/xgj/spaceflow/commit/151ef9e4a2baddee60b00c858ca2153091b0819e))
* 将 llmType 重命名为 llmMode，并新增删除代码分析模式配置 ([08d5c47](https://git.bjxgj.com/xgj/spaceflow/commit/08d5c47f471f3478f2686f1b8e465a11f74b4b48))
* 将 period-summary 命令从 core 迁移到独立插件包，实现插件化架构 ([ea349f4](https://git.bjxgj.com/xgj/spaceflow/commit/ea349f4329dc2e80eb0b8c6a9376505732c1055c))
* 将 PR 审查工作流的 AI 模型从 doubao-seed-code-preview-251028 切换为 glm-4-7-251222 ([6a7d465](https://git.bjxgj.com/xgj/spaceflow/commit/6a7d4650835a5b347ad4bc5935278ee887224d0d))
* 将 pr-review 命令重命名为 ai-review，统一代码审查功能的命名规范 ([152e8ed](https://git.bjxgj.com/xgj/spaceflow/commit/152e8ed58420bd497b0dadc760270871b90d950e))
* 将 Review Spec 相关配置和路径统一重命名为 references ([4e69b77](https://git.bjxgj.com/xgj/spaceflow/commit/4e69b779afc03e0ee404e57873e81d3fb9a7019f))
* 将 review 命令从 core 迁移到独立插件包，实现插件化架构 ([225bcf4](https://git.bjxgj.com/xgj/spaceflow/commit/225bcf4397b82f7d9834840be06a1f64da2fd8df))
* 将 review-spec 和 review-report 模块从 core 迁移到 review 插件包，完善类型导入路径 ([e24a99d](https://git.bjxgj.com/xgj/spaceflow/commit/e24a99d76bee96e7cad3d996aff426089a14c0df))
* 将 Rspack 配置文件从 CommonJS 迁移至 ESM 并移除 webpack-node-externals 依赖 ([2dfdc82](https://git.bjxgj.com/xgj/spaceflow/commit/2dfdc827f15d5d139f1179ac273e842423ef19b1))
* 将审查总结从字符串改为结构化的文件摘要数组，优化报告格式化逻辑 ([8adc314](https://git.bjxgj.com/xgj/spaceflow/commit/8adc314a8d4003ee34141dddfa04f658ef792504))
* 将所有服务和命令类的私有成员改为受保护成员，提升可扩展性 ([b0734e2](https://git.bjxgj.com/xgj/spaceflow/commit/b0734e264395be37045044195276ce082778daff))
* 将文件摘要格式从列表改为表格，提升审查报告的可读性 ([8b0010d](https://git.bjxgj.com/xgj/spaceflow/commit/8b0010d43a20ae8c8b579e50152f11d4990127c5))
* 将构建工具从 Nest CLI 迁移至 Rspack 并优化 TypeScript 导入语句 ([1b1b287](https://git.bjxgj.com/xgj/spaceflow/commit/1b1b2876fe768d340853203bb4475ecbebcb0257))
* 将项目名称从 gitea-flows 重命名为 spaceflow ([7b9fd8e](https://git.bjxgj.com/xgj/spaceflow/commit/7b9fd8e8293dea209f0a6996115e0c93f5638e63))
* 将项目级 references 目录中的代码规范文件全部删除 ([0ffe25f](https://git.bjxgj.com/xgj/spaceflow/commit/0ffe25f89334fa375e65d51fd2325f3ae6386ff7))
* 将项目级 review-spec 目录重命名为 references，与全局配置目录保持一致 ([ad81d78](https://git.bjxgj.com/xgj/spaceflow/commit/ad81d78d02c9882dfd33d283091f094132f4cc3d))
* 将默认 LLM 适配器从 Claude 改为 OpenAI，同时更新审查 Schema 中行号字段描述 ([749afb3](https://git.bjxgj.com/xgj/spaceflow/commit/749afb35942a63b7397e94d9d094c55ef548f53e))
* 恢复 pnpm catalog 配置并移除 .spaceflow 工作区导入器 ([217387e](https://git.bjxgj.com/xgj/spaceflow/commit/217387e2e8517a08162e9bcaf604893fd9bca736))
* 扩展 NestJS 代码规范，新增 proxy 和 model 文件类型及职责定义 ([f5127cc](https://git.bjxgj.com/xgj/spaceflow/commit/f5127cc8a4b6dae69901a6544ed7d5a2b1d0f956))
* 扩展 OpenCode 适配器流式事件处理，支持 agent、subtask、step 和 reasoning 类型 ([cc3a5ce](https://git.bjxgj.com/xgj/spaceflow/commit/cc3a5ce3e24b99a8fcfabc2e7bb24683107b5d1a))
* 扩展 Review Spec 加载路径，支持全局配置目录和配置文件指定 ([2ac27f7](https://git.bjxgj.com/xgj/spaceflow/commit/2ac27f7bdddf4a6cd71821c02386b78e9bb36c8f))
* 扩展删除代码分析配置，支持 ci、pr、terminal 三种环境模式 ([f43c842](https://git.bjxgj.com/xgj/spaceflow/commit/f43c8424829b1e45e855c6a59d1764d90fff3649))
* 扩展删除影响分析支持 open-code 模式，统一 Claude Agent 适配器配置 ([2d2f1e7](https://git.bjxgj.com/xgj/spaceflow/commit/2d2f1e767e5c5587b25d2c521319eefc8510a1c9))
* 提取审查报告格式化逻辑到独立模块，支持 Markdown、JSON 和 Terminal 多种输出格式 ([b590221](https://git.bjxgj.com/xgj/spaceflow/commit/b590221f89ccd6da6fd71502bb8fded5755c81cf))
* 支持从 issue_comment 事件中获取 PR 编号 ([e568afc](https://git.bjxgj.com/xgj/spaceflow/commit/e568afcb2088ffac1857115d04af0db28c0b1fde))
* 支持从配置文件读取删除代码影响分析选项，优化 PR 模式下的分支引用获取 ([ac5b725](https://git.bjxgj.com/xgj/spaceflow/commit/ac5b725898050902951de5abb376d72b26cb7348))
* 支持在 gitea-flows 配置中自定义 Gitea 主机地址 ([b430d06](https://git.bjxgj.com/xgj/spaceflow/commit/b430d06067fbc10fe5e2114c318d47b1131e3283))
* 新增 --show-all 选项支持显示所有问题，不过滤非变更行的问题 ([27c4b73](https://git.bjxgj.com/xgj/spaceflow/commit/27c4b73c4f626b4c69875e633f519d0f864c4d5a))
* 新增 AI 生成 PR 功能描述功能，支持通过 commit 记录和代码变更自动总结 PR 实现的功能 ([972cd8f](https://git.bjxgj.com/xgj/spaceflow/commit/972cd8ffff4ee6efc4166e0b3cda979d7de952ce))
* 新增 ci-publish 命令符号链接，更新 review-spec 子模块，并统一项目名称为 spaceflow ([688d729](https://git.bjxgj.com/xgj/spaceflow/commit/688d729814e4e55f7567b9b8772f48ec927650ab))
* 新增 create 命令支持从远程 Git 仓库获取模板，实现模板缓存机制 ([92dab7e](https://git.bjxgj.com/xgj/spaceflow/commit/92dab7eb481f3003435a8bc53f778e16916865ae))
* 新增 create 命令支持基于模板创建插件，实现命令型和技能型两种模板 ([3aff44f](https://git.bjxgj.com/xgj/spaceflow/commit/3aff44ffe0005cf9208435c20411c82063ed8365))
* 新增 deletionOnly 选项，支持仅执行删除代码分析模式 ([ee9d21f](https://git.bjxgj.com/xgj/spaceflow/commit/ee9d21f7d48e20713bb151b123760af3687348e5))
* 新增 filterIssuesByRuleExistence 方法，过滤不存在于规范中的问题 ([d3e0d60](https://git.bjxgj.com/xgj/spaceflow/commit/d3e0d609604c308897e9815e3f48d27582675e33))
* 新增 normalizeIssues 方法，自动拆分包含逗号的行号为多个独立 issue ([617ed4e](https://git.bjxgj.com/xgj/spaceflow/commit/617ed4e552771c0280a9966d1265b0b0927e8e0a))
* 新增 OpenCode LLM 适配器并启用 ESM 模块系统 ([d6ec569](https://git.bjxgj.com/xgj/spaceflow/commit/d6ec569c4c45198216071ba5f85b1285bcec5a30))
* 新增 OpenCode 适配器配置支持，实现 API Key 自动继承和模型格式标准化 ([cef2bfb](https://git.bjxgj.com/xgj/spaceflow/commit/cef2bfb7e7a932ceb71439e38eed60d7d09d1566))
* 新增 outputFormat 选项，支持指定审查报告输出格式 ([c89442a](https://git.bjxgj.com/xgj/spaceflow/commit/c89442a49a90cdcbb486c0d2717d2093b7bb2d04))
* 新增 resolveRef 方法支持智能解析 Git 引用，优化删除代码影响分析的分支引用处理 ([615fc2d](https://git.bjxgj.com/xgj/spaceflow/commit/615fc2db05020b9c9745c2df55b36f2ea80d302b))
* 新增 resolveRef 方法支持自动解析 Git 引用，优化 diff 和 log 命令的分支处理 ([e70fbbf](https://git.bjxgj.com/xgj/spaceflow/commit/e70fbbff58821ec63242a02b9befaa2479cde30e))
* 新增 review 命令符号链接，建立 .claude/commands 到 .spaceflow 的双向链接结构 ([df237e3](https://git.bjxgj.com/xgj/spaceflow/commit/df237e39db9b6e9e52e3088f66a9c2fd7dc0ce12))
* 新增 review 技能符号链接，完善插件配置，统一 JSON 格式化风格 ([87486d5](https://git.bjxgj.com/xgj/spaceflow/commit/87486d59792ec9cbae42de64731b5b5e0fa43830))
* 新增 runx 命令支持全局安装并运行依赖，重构 CLI 模块结构 ([ad9ae09](https://git.bjxgj.com/xgj/spaceflow/commit/ad9ae0900c470ac00d9a8c1527510ccd93515be5))
* 新增从 PR 标题解析命令参数功能，支持在标题中指定 ai-review 选项 ([916acf8](https://git.bjxgj.com/xgj/spaceflow/commit/916acf835fd0c638261458e66eacb8e443d2d3f3))
* 新增历史问题修复验证功能，使用 LLM 自动判断已有问题是否已被修复 ([c8b7352](https://git.bjxgj.com/xgj/spaceflow/commit/c8b7352f4cba260f2433677675fbd442a8c4d73d))
* 新增周期统计命令，支持按时间范围统计 PR 贡献并生成报告 ([a958d50](https://git.bjxgj.com/xgj/spaceflow/commit/a958d50855d6becb0801b10b20fa85ee6436536c))
* 新增审查数据持久化和增量更新机制，支持跳过重复问题并在评论中存储历史审查结果 ([4a3b3ea](https://git.bjxgj.com/xgj/spaceflow/commit/4a3b3eaa58bc890c25e1e268c7971ea1a85244bc))
* 新增已解决评论同步功能，在删除旧 review 前保留已修复问题的状态 ([7b04257](https://git.bjxgj.com/xgj/spaceflow/commit/7b042570c4fe00a96119e541394a880d62342f2b))
* 新增并行执行器支持文件并发审查，优化 AI 审查性能和错误处理 ([f240566](https://git.bjxgj.com/xgj/spaceflow/commit/f240566ea0fcf63565dc7214995953405dc5c2ef))
* 新增浅克隆检测和历史补充逻辑，优化 git blame 回退机制 ([dce40a2](https://git.bjxgj.com/xgj/spaceflow/commit/dce40a2784fbce268ed79926a9e987b0d7aaea1c))
* 新增行级 review 评论功能，支持在 PR 文件变更中按行定位显示审查问题 ([b4f6005](https://git.bjxgj.com/xgj/spaceflow/commit/b4f6005e40253c080c918909b71d25ea53f2d2d2))
* 新增进程退出码常量，统一错误退出码的使用 ([88a3c1c](https://git.bjxgj.com/xgj/spaceflow/commit/88a3c1c6e2f37baf130aa2835abe100f65eae736))
* 更新 GitHub Action 配置，优化开发模式构建流程并统一包名为 spaceflow ([7ca623e](https://git.bjxgj.com/xgj/spaceflow/commit/7ca623ee4de419d221f5c499ad6c5ecac37c1624))
* 更新审查 Schema 中行号字段描述，明确仅支持单行或多行格式 ([9c97758](https://git.bjxgj.com/xgj/spaceflow/commit/9c97758b57632265c182b783e9f7845655a5d526))
* 注释掉 claude-setup 服务中写入配置前的详细日志输出 ([965763a](https://git.bjxgj.com/xgj/spaceflow/commit/965763a056d62e361f07df6979d0a556ecf179ec))
* 清理 .gitmodules 中的冗余子模块配置，统一使用 HTTPS 协议访问 review-spec 仓库 ([ec897fc](https://git.bjxgj.com/xgj/spaceflow/commit/ec897fc655a42ab0a8dc3715901544d7cfdd2b5a))
* 移除 .claude/skills/review 符号链接，完成 review 技能路径清理 ([b19cbdd](https://git.bjxgj.com/xgj/spaceflow/commit/b19cbdd2e305cdb967ae89528177f08caefe25d6))
* 移除 allIssues 参数，统一使用 ReviewResult 中的 issues 字段 ([4d7b5dd](https://git.bjxgj.com/xgj/spaceflow/commit/4d7b5dd4361c180a208ba3ec247808e4ad651ed6))
* 移除 Commit 信息的代码块格式标记，改为纯文本显示 ([cd07504](https://git.bjxgj.com/xgj/spaceflow/commit/cd0750419d7277829064396342e538cadaec0f95))
* 移除 Git 子模块机制，改用直接克隆和符号链接管理依赖 ([cc46dd4](https://git.bjxgj.com/xgj/spaceflow/commit/cc46dd43902a546aac874c80d9525175d02f9820))
* 移除 git.lockBranch 配置项 ([a1758c9](https://git.bjxgj.com/xgj/spaceflow/commit/a1758c9610f744fbc83106174a130b9ae7e4ec35))
* 移除 Markdown 格式化器中 Commit 字段的代码块标记 ([be336a5](https://git.bjxgj.com/xgj/spaceflow/commit/be336a53fa5436a3604a3f91aaaba3617f2400db))
* 移除 review-spec 外部依赖配置，改用本地命令模块 ([9fa32e4](https://git.bjxgj.com/xgj/spaceflow/commit/9fa32e4e8756431fbdef29a6b26e0a1138ec4515))
* 移除工作流中的子模块递归克隆配置，注释掉手动初始化子模块步骤 ([de1fec1](https://git.bjxgj.com/xgj/spaceflow/commit/de1fec128fc9255fc88967849c4cf46b5967de34))
* 简化 JSON 格式化器并在 Markdown 报告中新增 PR 功能描述展示 ([fc594f1](https://git.bjxgj.com/xgj/spaceflow/commit/fc594f1e85019993f7a24e94b9f6b24a3ebf7d30))
* 简化建议代码块清理逻辑，将反引号替换为注释符号 ([d45540a](https://git.bjxgj.com/xgj/spaceflow/commit/d45540ae558a068b9785a4dd6a10f5e5608971c5))
* 简化文件摘要表格的列标题，移除"已解决"和"未解决"文字说明 ([1579db2](https://git.bjxgj.com/xgj/spaceflow/commit/1579db214e97fb043e5c4162b0359618e71c76d4))
* 简化预发布版本的 tag 匹配逻辑 ([51a1de2](https://git.bjxgj.com/xgj/spaceflow/commit/51a1de211598bdd1a0e2e02973fbe35cbf85e065))
* 简化魔法值检查规则说明，移除冗余的类型示例 ([f452edd](https://git.bjxgj.com/xgj/spaceflow/commit/f452eddb2ddc8905ee9587e3cf7233111675b727))
* 统一 Markdown 格式化器中的 emoji 样式，使用圆形图标替代表情符号 ([02c8dd5](https://git.bjxgj.com/xgj/spaceflow/commit/02c8dd59fa997765f01536cde8b418d3c8ed4350))
* 统一 README 中的术语格式和组件命名 ([5ceaeca](https://git.bjxgj.com/xgj/spaceflow/commit/5ceaecaac3645569bbd0c96e9e50d63721d7dea3))
* 统一插件文档命名规范，将 SKILL.md 重命名为 README.md ([e8342c1](https://git.bjxgj.com/xgj/spaceflow/commit/e8342c152058b4412c1b437bfedf9a2a84cfa2e5))
* 统一时间格式为 ISO 8601 并在展示时转换为 UTC+8 时区 ([b408781](https://git.bjxgj.com/xgj/spaceflow/commit/b4087812f7be09c27596cc4cd09f5038a985c3ed))
* 调整 commit 文件变更日志输出级别，从 verbose 1 提升至 verbose 2 ([e5180d5](https://git.bjxgj.com/xgj/spaceflow/commit/e5180d51e9a09b9f46dd7aada39dd113e4bcf2c7))
* 调整 Markdown 格式化器中问题详情的展示顺序，将发现时间和修复时间移至建议代码块之前 ([5848b03](https://git.bjxgj.com/xgj/spaceflow/commit/5848b039ae3ab102f2579952a32668b793a87b76))
* 调整 NestJS 代码规范结构，将业务代码编写位置要求独立为新章节 ([41df56e](https://git.bjxgj.com/xgj/spaceflow/commit/41df56e53ebb0458b2df511a663d60294738ae43))
* 调整功能概述中的 Markdown 标题层级，避免与主报告标题冲突 ([190cc38](https://git.bjxgj.com/xgj/spaceflow/commit/190cc38edc4127e3c35310d1d72dc8b1cc713e4d))
* 调整问题验证功能的默认配置，将核心配置默认关闭并在项目配置中启用 ([0e430c9](https://git.bjxgj.com/xgj/spaceflow/commit/0e430c911381f87d5fe2a2b146356c0af9a3488f))
* 调整问题验证跳过逻辑，仅跳过已确认无效的问题 ([8d78fa6](https://git.bjxgj.com/xgj/spaceflow/commit/8d78fa6710848a19dab084cd4bfb50dbf2580bde))
* 迁移扩展依赖到 .spaceflow 工作区并移除 pnpm catalog ([c457c0f](https://git.bjxgj.com/xgj/spaceflow/commit/c457c0f8918171f1856b88bc007921d76c508335))
* 重命名 ci-publish 命令为 publish ([804b821](https://git.bjxgj.com/xgj/spaceflow/commit/804b82175784987d7fa776e926de1bf35ee83eb2))
* 重命名 ClaudeConfig 模块为 ClaudeSetup ([c665825](https://git.bjxgj.com/xgj/spaceflow/commit/c6658257b85933ee898849e756781534c0e8e952))
* 重命名工作流文件并优化命令测试流程，统一构建和执行方式 ([01176de](https://git.bjxgj.com/xgj/spaceflow/commit/01176de3447343ea7cb21da608a9ab49efdcc9c3))
* 重命名核心包从 spaceflow 到 @spaceflow/cli ([69e04e8](https://git.bjxgj.com/xgj/spaceflow/commit/69e04e8d4ed93c2e9b84b18cb211cf17c2940ef3))
* 重构 Extension 安装机制为 pnpm workspace 模式 ([469b12e](https://git.bjxgj.com/xgj/spaceflow/commit/469b12eac28f747b628e52a5125a3d5a538fba39))
* 重构 LLM JSON Schema 处理逻辑，统一在 LlmProxyService 中管理 JSON 格式指令注入 ([e2fffeb](https://git.bjxgj.com/xgj/spaceflow/commit/e2fffeb2a1b0cb8f12ffb3847876107e1bbae593))
* 重构 LLM 配置结构，将 claude 和 openai 配置移至 review 配置下，并统一命名为 claudeCode ([4e07e8e](https://git.bjxgj.com/xgj/spaceflow/commit/4e07e8e8e60abf5c0b622d640d9407ae23720e33))
* 重构 OpenCode 适配器实现，使用 createOpencode 替代 createOpencodeClient 并移除配置文件管理 ([ee6bfff](https://git.bjxgj.com/xgj/spaceflow/commit/ee6bfffc12573a1ceadd91f7accfe0214cb16109))
* 重构 OpenCode 适配器配置，支持动态 provider 配置和统一方法命名 ([f1f50b6](https://git.bjxgj.com/xgj/spaceflow/commit/f1f50b6e2c256f338681ed3936d82b41095faaff))
* 重构 PR 审查服务，引入 ReviewSpecService 统一管理规范加载和过滤逻辑 ([d09ecea](https://git.bjxgj.com/xgj/spaceflow/commit/d09ecead6ce2ae2374bf44caeeee4f0591d1aeb7))
* 重构 runx 命令参数解析逻辑，支持自动补全命令名和动态加载插件模块 ([1938bc0](https://git.bjxgj.com/xgj/spaceflow/commit/1938bc05ac5920932defd6c8895a3eeab7c7612d))
* 重构代码审查流程，使用 commit 遍历替代 git blame 构建行号映射 ([bf75665](https://git.bjxgj.com/xgj/spaceflow/commit/bf7566541dbc0a23f9fe5d135d85000e168ee917))
* 重构删除代码影响分析，支持通过 Gitea API 获取 diff 并优化参数传递 ([33f6c59](https://git.bjxgj.com/xgj/spaceflow/commit/33f6c59b7f285d4bd5f99f30e801a9a1977def7f))
* 重构审查结果过滤和格式化逻辑，新增变更行过滤和严重程度覆盖功能 ([c2a6b99](https://git.bjxgj.com/xgj/spaceflow/commit/c2a6b999bfbb3423e4f38df78d87006ea193baa4))
* 重构插件加载改为扩展模式 ([0e6e140](https://git.bjxgj.com/xgj/spaceflow/commit/0e6e140b19ea2cf6084afc261c555d2083fe04f9))
* 重构插件安装机制，引入 .spaceflow 目录统一管理依赖，支持全局安装 ([40080fb](https://git.bjxgj.com/xgj/spaceflow/commit/40080fbaace3433fbc6bcc996ab335727409a5c2))
* 重构插件安装逻辑，支持多编辑器配置目录关联和统一的依赖管理 ([a15f59c](https://git.bjxgj.com/xgj/spaceflow/commit/a15f59c01946675600683d9d45110df0a06ce79d))
* 重构日志输出系统，引入分级 verbose 控制机制 ([e608b5d](https://git.bjxgj.com/xgj/spaceflow/commit/e608b5d58f86695e70cdc54e9f18f8f693739fea))
* 重构细节逻辑 ([16b3a1b](https://git.bjxgj.com/xgj/spaceflow/commit/16b3a1b9dea96e3508eeb6159c6fa92a44b4480c))
* 重构规范过滤机制，将 includes 和 override 过滤从规范加载阶段移至 LLM 审查后处理 ([5628305](https://git.bjxgj.com/xgj/spaceflow/commit/562830563eb2463221296703570f7e1d92c23801))
* 重构评论解析逻辑，从 issues 数组改为完整的 ReviewResult 对象 ([4651c2b](https://git.bjxgj.com/xgj/spaceflow/commit/4651c2bfd783664ce3f35d575169b91d85d4f4eb))
* 重构配置加载 ([4644ad8](https://git.bjxgj.com/xgj/spaceflow/commit/4644ad8a7bf538d7ff5e6518dceb50377bcca061))
* 重构配置模式 ([58a2303](https://git.bjxgj.com/xgj/spaceflow/commit/58a2303b1e51e159101a9eed4a8a179bc3fc10ac))

### 文档更新

* **actions:** 更新action.yml中命令描述 ([e81b550](https://git.bjxgj.com/xgj/spaceflow/commit/e81b550012db43f411493caf55d3f8b3d53e52b0))
* **core:** 更新核心框架README文档 ([0d98658](https://git.bjxgj.com/xgj/spaceflow/commit/0d98658f6ab01f119f98d3387fb5651d4d4351a8))
* **guide:** 更新编辑器集成文档,补充四种导出类型说明和 MCP 注册机制 ([19a7409](https://git.bjxgj.com/xgj/spaceflow/commit/19a7409092c89d002f11ee51ebcb6863118429bd))
* **guide:** 更新配置文件位置说明并补充 RC 文件支持 ([2214dc4](https://git.bjxgj.com/xgj/spaceflow/commit/2214dc4e197221971f5286b38ceaa6fcbcaa7884))
* **publish:** 完善发布插件README文档 ([faa57b0](https://git.bjxgj.com/xgj/spaceflow/commit/faa57b095453c00fb3c9a7704bc31b63953c0ac5))
* 完善 README 文档，新增项目结构、核心命令和配置说明 ([b6bb15a](https://git.bjxgj.com/xgj/spaceflow/commit/b6bb15a44da5e2e8fc1e8da5d0fd28eab7014887))
* 新增 AI Review 和周期统计模块的完整文档 ([7d9c169](https://git.bjxgj.com/xgj/spaceflow/commit/7d9c169b10d5cf331475b3e5955073534ba80ee9))
* 新增 Review Spec 文档规范，定义代码审查规则的 Markdown 格式和语法说明 ([70e9ed0](https://git.bjxgj.com/xgj/spaceflow/commit/70e9ed04c60ae75278ad8930f7492fd7d35d6014))
* 新增 Spaceflow 插件系统设计文档，定义插件化架构和开发规范 ([e63e1b1](https://git.bjxgj.com/xgj/spaceflow/commit/e63e1b18273df9eb3fec3b8ba9812d00da158f2b))
* 更新 JS/TS 代码规范文档,明确 interface 命名规则 ([598d371](https://git.bjxgj.com/xgj/spaceflow/commit/598d3710330dea8e181841d5b095dbb0fa647b70))
* 编写代码规范文档 ([bbe5aeb](https://git.bjxgj.com/xgj/spaceflow/commit/bbe5aebd395731fee00fadad602d0c64c3574db8))

### 测试用例

* branch protection test [no ci] ([c78f853](https://git.bjxgj.com/xgj/spaceflow/commit/c78f8536857108a3d7455c5686d83090a2ba5ffd))
* **core:** 新增 GiteaAdapter 完整单元测试并实现自动检测 provider 配置 ([c74f745](https://git.bjxgj.com/xgj/spaceflow/commit/c74f7458aed91ac7d12fb57ef1c24b3d2917c406))
* **review:** 新增 DeletionImpactService 测试覆盖并配置 coverage 工具 ([50bfbfe](https://git.bjxgj.com/xgj/spaceflow/commit/50bfbfe37192641f1170ade8f5eb00e0e382af67))
* **review:** 新增新增文件无 patch 时的测试用例,优化变更行标记逻辑 ([a593f0d](https://git.bjxgj.com/xgj/spaceflow/commit/a593f0d4a641b348f7c9d30b14f639b24c12dcfa))
* **review:** 添加单元测试以覆盖行号更新逻辑 ([ebf33e4](https://git.bjxgj.com/xgj/spaceflow/commit/ebf33e45c18c910b88b106cdd4cfeb516b3fb656))
* 为 AI 代码审查功能新增单元测试，覆盖问题验证和核心逻辑 ([3528be4](https://git.bjxgj.com/xgj/spaceflow/commit/3528be44cdeea409657b997fa476860ec5ce6f3f))
* 优化 PR 审查服务测试并改进规范解析 ([dacca5d](https://git.bjxgj.com/xgj/spaceflow/commit/dacca5df69ca7d4d1b5d456a42075265a0e678a4))
* 在 claude-code.adapter.spec.ts 中新增 ClaudeSetupService 的备份恢复方法 mock ([5fb5820](https://git.bjxgj.com/xgj/spaceflow/commit/5fb5820fc96163a31ae7787d4f2775a05cef1ce1))
* 新增 AI Review 服务的单元测试覆盖，包含删除影响分析和问题验证功能 ([ab2c52a](https://git.bjxgj.com/xgj/spaceflow/commit/ab2c52a7101d9d0a3f3f796518293ae8e1d53f4b))
* 添加 OpenAI LLM 支持的单元测试 ([fe25e7c](https://git.bjxgj.com/xgj/spaceflow/commit/fe25e7c20540f402a600b9c7aeec5482232ae508))

### 其他修改

* **actions:** 增强命令执行日志,输出原始 command 和 args 参数 ([0f0c238](https://git.bjxgj.com/xgj/spaceflow/commit/0f0c238de7d6f10875022f364746cefa56631b7f))
* **actions:** 更新Actions构建产物 ([2d71a2f](https://git.bjxgj.com/xgj/spaceflow/commit/2d71a2f4ba5bd89f7e1f130fdfc3c0e7c05f3920))
* **ci-scripts:** released version 0.0.1 [no ci] ([b38fb9b](https://git.bjxgj.com/xgj/spaceflow/commit/b38fb9ba56200ced1baf563b097faa8717693783))
* **ci-scripts:** released version 0.1.0 [no ci] ([57b3a1c](https://git.bjxgj.com/xgj/spaceflow/commit/57b3a1c826dafd5ec51d68b7471266efd5cc32b2))
* **ci-scripts:** released version 0.1.1 [no ci] ([19ca0d8](https://git.bjxgj.com/xgj/spaceflow/commit/19ca0d8461f9537f4318b772cad3ea395d2b3264))
* **ci-scripts:** released version 0.1.2 [no ci] ([ab9c100](https://git.bjxgj.com/xgj/spaceflow/commit/ab9c1000bcbe64d8a99ffa6bebb974c024b14325))
* **ci-scripts:** released version 0.10.0 [no ci] ([ca2daad](https://git.bjxgj.com/xgj/spaceflow/commit/ca2daada8b04bbe809e69a3d5bd9373e897c6f40))
* **ci-scripts:** released version 0.11.0 [no ci] ([d4f5bba](https://git.bjxgj.com/xgj/spaceflow/commit/d4f5bba6f89e9e051dde8d313b6e102c6dadfa41))
* **ci-scripts:** released version 0.12.0 [no ci] ([097863f](https://git.bjxgj.com/xgj/spaceflow/commit/097863f0c5cc46cb5cb930f14a6f379f60a13f08))
* **ci-scripts:** released version 0.13.0 [no ci] ([021eefd](https://git.bjxgj.com/xgj/spaceflow/commit/021eefdf2ff72d16b36123335548df2d3ad1d6b7))
* **ci-scripts:** released version 0.14.0 [no ci] ([c536208](https://git.bjxgj.com/xgj/spaceflow/commit/c536208e352baa82e5b56c490ea9df0aff116cb2))
* **ci-scripts:** released version 0.15.0 [no ci] ([e314fb1](https://git.bjxgj.com/xgj/spaceflow/commit/e314fb11e7425b27c337d3650857cf3b737051fd))
* **ci-scripts:** released version 0.16.0 [no ci] ([9ab007d](https://git.bjxgj.com/xgj/spaceflow/commit/9ab007db178878e093ba93ea27c4f05ca813a65d))
* **ci-scripts:** released version 0.17.0 [no ci] ([31abd3d](https://git.bjxgj.com/xgj/spaceflow/commit/31abd3dcb48e2ddea5175552c0a87c1eaa1e7a41))
* **ci-scripts:** released version 0.18.0 [no ci] ([e17894a](https://git.bjxgj.com/xgj/spaceflow/commit/e17894a5af53ff040a0a17bc602d232f78415e1b))
* **ci-scripts:** released version 0.2.0 [no ci] ([716e9ad](https://git.bjxgj.com/xgj/spaceflow/commit/716e9ad0f32bde09c608143da78f0a4299017797))
* **ci-scripts:** released version 0.3.0 [no ci] ([9292b52](https://git.bjxgj.com/xgj/spaceflow/commit/9292b524f2b8171f8774fab4e4ef4b32991f5d3d))
* **ci-scripts:** released version 0.4.0 [no ci] ([364f696](https://git.bjxgj.com/xgj/spaceflow/commit/364f696d0df5d84be915cfaa9202a592073d9b46))
* **ci-scripts:** released version 0.5.0 [no ci] ([a87a1da](https://git.bjxgj.com/xgj/spaceflow/commit/a87a1da0490986c46c2a527cda5e7d0df9df6d03))
* **ci-scripts:** released version 0.6.0 [no ci] ([d485758](https://git.bjxgj.com/xgj/spaceflow/commit/d48575827941cae6ffc7ae6ba911e5d4cf3bd7fa))
* **ci-scripts:** released version 0.7.0 [no ci] ([ea294e1](https://git.bjxgj.com/xgj/spaceflow/commit/ea294e138c6b15033af85819629727915dfcbf4b))
* **ci-scripts:** released version 0.8.0 [no ci] ([be6273d](https://git.bjxgj.com/xgj/spaceflow/commit/be6273dab7f1c80c58abdb8de6f0eeb986997e28))
* **ci-scripts:** released version 0.9.0 [no ci] ([1b9e816](https://git.bjxgj.com/xgj/spaceflow/commit/1b9e8167bb8fc67fcc439b2ef82e7a63dc323e6d))
* **ci-shell:** released version 0.0.1 [no ci] ([ec2a84b](https://git.bjxgj.com/xgj/spaceflow/commit/ec2a84b298c5fb989951caf42e2b016b3336f6a0))
* **ci-shell:** released version 0.1.0 [no ci] ([2283d9d](https://git.bjxgj.com/xgj/spaceflow/commit/2283d9d69ada1c071bef6c548dc756fe062893bd))
* **ci-shell:** released version 0.1.1 [no ci] ([488a686](https://git.bjxgj.com/xgj/spaceflow/commit/488a6869240151e7d1cf37a3b177897c2b5d5c1e))
* **ci-shell:** released version 0.1.2 [no ci] ([bf7977b](https://git.bjxgj.com/xgj/spaceflow/commit/bf7977bed684b557555861b9dc0359eda3c5d476))
* **ci-shell:** released version 0.10.0 [no ci] ([53864b8](https://git.bjxgj.com/xgj/spaceflow/commit/53864b8c2534cae265b8fbb98173a5b909682d4e))
* **ci-shell:** released version 0.11.0 [no ci] ([cf9e486](https://git.bjxgj.com/xgj/spaceflow/commit/cf9e48666197295f118396693abc08b680b3ddee))
* **ci-shell:** released version 0.12.0 [no ci] ([274216f](https://git.bjxgj.com/xgj/spaceflow/commit/274216fc930dfbf8390d02e25c06efcb44980fed))
* **ci-shell:** released version 0.13.0 [no ci] ([81e7582](https://git.bjxgj.com/xgj/spaceflow/commit/81e75820eb69ca188155e33945111e2b1f6b3012))
* **ci-shell:** released version 0.14.0 [no ci] ([c6e4bdc](https://git.bjxgj.com/xgj/spaceflow/commit/c6e4bdca44874739694e3e46998e376779503e53))
* **ci-shell:** released version 0.15.0 [no ci] ([5c0dc0b](https://git.bjxgj.com/xgj/spaceflow/commit/5c0dc0b5482366ccfd7854868d1eb5f306c24810))
* **ci-shell:** released version 0.16.0 [no ci] ([87fd703](https://git.bjxgj.com/xgj/spaceflow/commit/87fd7030b54d2f614f23e092499c5c51bfc33788))
* **ci-shell:** released version 0.17.0 [no ci] ([a53508b](https://git.bjxgj.com/xgj/spaceflow/commit/a53508b15e4020e3399bae9cc04e730f1539ad8e))
* **ci-shell:** released version 0.18.0 [no ci] ([f64fd80](https://git.bjxgj.com/xgj/spaceflow/commit/f64fd8009a6dd725f572c7e9fbf084d9320d5128))
* **ci-shell:** released version 0.2.0 [no ci] ([4f5314b](https://git.bjxgj.com/xgj/spaceflow/commit/4f5314b1002b90d7775a5ef51e618a3f227ae5a9))
* **ci-shell:** released version 0.3.0 [no ci] ([7b25e55](https://git.bjxgj.com/xgj/spaceflow/commit/7b25e557b628fdfa66d7a0be4ee21267906ac15f))
* **ci-shell:** released version 0.4.0 [no ci] ([7e6bf1d](https://git.bjxgj.com/xgj/spaceflow/commit/7e6bf1dabffc6250b918b89bb850d478d3f4b875))
* **ci-shell:** released version 0.5.0 [no ci] ([920d9a8](https://git.bjxgj.com/xgj/spaceflow/commit/920d9a8165fe6eabf7a074eb65762f4693883438))
* **ci-shell:** released version 0.6.0 [no ci] ([a2d1239](https://git.bjxgj.com/xgj/spaceflow/commit/a2d12397997b309062a9d93af57a5588cdb82a79))
* **ci-shell:** released version 0.7.0 [no ci] ([247967b](https://git.bjxgj.com/xgj/spaceflow/commit/247967b30876aae78cfb1f9c706431b5bb9fb57e))
* **ci-shell:** released version 0.8.0 [no ci] ([3102178](https://git.bjxgj.com/xgj/spaceflow/commit/310217827c6ec29294dee5689b2dbb1b66492728))
* **ci-shell:** released version 0.9.0 [no ci] ([accdda7](https://git.bjxgj.com/xgj/spaceflow/commit/accdda7ee4628dc8447e9a89da6c8101c572cb90))
* **ci:** 迁移工作流从 Gitea 到 GitHub 并统一环境变量命名 ([57e3bae](https://git.bjxgj.com/xgj/spaceflow/commit/57e3bae635b324c8c4ea50a9fb667b6241fae0ef))
* **commands/ci-scripts:** released version 0.0.1 [no ci] ([f5fc127](https://git.bjxgj.com/xgj/spaceflow/commit/f5fc127c46e275698cd9468fe16fb12ba107d782))
* **commands/ci-shell:** released version 0.0.1 [no ci] ([423404c](https://git.bjxgj.com/xgj/spaceflow/commit/423404c06adba4c525a2f3834acb5a50d32d9e31))
* **commands/period-summary:** released version 0.0.1 [no ci] ([59255e3](https://git.bjxgj.com/xgj/spaceflow/commit/59255e302b3e27bdaaabf77d70774020e0e75ea5))
* **commands/publish:** released version 0.0.1 [no ci] ([cb1867f](https://git.bjxgj.com/xgj/spaceflow/commit/cb1867f5185fbe53a6840c452cb11eae14bf1702))
* **commands/review:** released version 0.0.1 [no ci] ([6034f81](https://git.bjxgj.com/xgj/spaceflow/commit/6034f8135a97d8fe4fb064c9d977d7170a16979d))
* **config:** 将 git 推送白名单用户从 "Gitea Actions" 改为 "GiteaActions" ([fdbb865](https://git.bjxgj.com/xgj/spaceflow/commit/fdbb865341e6f02b26fca32b54a33b51bee11cad))
* **config:** 将 git 推送白名单用户从 github-actions[bot] 改为 Gitea Actions ([9c39819](https://git.bjxgj.com/xgj/spaceflow/commit/9c39819a9f95f415068f7f0333770b92bc98321b))
* **config:** 移除 review-spec 私有仓库依赖 ([8ae18f1](https://git.bjxgj.com/xgj/spaceflow/commit/8ae18f13c441b033d1cbc75119695a5cc5cb6a0b))
* **core:** released version 0.0.1 [no ci] ([66497d6](https://git.bjxgj.com/xgj/spaceflow/commit/66497d60be04b4756a3362dbec4652177910165c))
* **core:** released version 0.0.1 [no ci] ([5d82dca](https://git.bjxgj.com/xgj/spaceflow/commit/5d82dca234dd7b56cdf1d508581f53dfcecab676))
* **core:** released version 0.0.1 [no ci] ([01cb219](https://git.bjxgj.com/xgj/spaceflow/commit/01cb219a5288389d089f52a27068aad9bdcdce11))
* **core:** released version 0.1.0 [no ci] ([f455607](https://git.bjxgj.com/xgj/spaceflow/commit/f45560735082840410e08e0d8113f366732a1243))
* **core:** released version 0.1.1 [no ci] ([0cf3a4d](https://git.bjxgj.com/xgj/spaceflow/commit/0cf3a4d37d7d1460e232dd30bc7ab8dc015ed11f))
* **core:** released version 0.1.2 [no ci] ([8292dbe](https://git.bjxgj.com/xgj/spaceflow/commit/8292dbe59a200cc640a95b86afb6451ec0c044ce))
* **core:** released version 0.10.0 [no ci] ([a80d34f](https://git.bjxgj.com/xgj/spaceflow/commit/a80d34fb647e107343a07a8793363b3b76320e81))
* **core:** released version 0.11.0 [no ci] ([f0025c7](https://git.bjxgj.com/xgj/spaceflow/commit/f0025c792e332e8b8752597a27f654c0197c36eb))
* **core:** released version 0.12.0 [no ci] ([1ce5034](https://git.bjxgj.com/xgj/spaceflow/commit/1ce50346d73a1914836333415f5ead9fbfa27be7))
* **core:** released version 0.13.0 [no ci] ([e3edde3](https://git.bjxgj.com/xgj/spaceflow/commit/e3edde3e670c79544af9a7249d566961740a2284))
* **core:** released version 0.14.0 [no ci] ([996dbc6](https://git.bjxgj.com/xgj/spaceflow/commit/996dbc6f80b0d3fb8049df9a9a31bd1e5b5d4b92))
* **core:** released version 0.15.0 [no ci] ([48f3875](https://git.bjxgj.com/xgj/spaceflow/commit/48f38754dee382548bab968c57dd0f40f2343981))
* **core:** released version 0.16.0 [no ci] ([871f981](https://git.bjxgj.com/xgj/spaceflow/commit/871f981b0b908c981aaef366f2382ec6ca2e2269))
* **core:** released version 0.17.0 [no ci] ([c85a8ed](https://git.bjxgj.com/xgj/spaceflow/commit/c85a8ed88929d867d2d460a44d08d8b7bc4866a2))
* **core:** released version 0.18.0 [no ci] ([c5e973f](https://git.bjxgj.com/xgj/spaceflow/commit/c5e973fbe22c0fcd0d6d3af6e4020e2fbff9d31f))
* **core:** released version 0.2.0 [no ci] ([5a96529](https://git.bjxgj.com/xgj/spaceflow/commit/5a96529cabdce4fb150732b34c55e668c33cb50c))
* **core:** released version 0.3.0 [no ci] ([bf8b005](https://git.bjxgj.com/xgj/spaceflow/commit/bf8b005ccbfcdd2061c18ae4ecdd476584ecbb53))
* **core:** released version 0.4.0 [no ci] ([bc4cd89](https://git.bjxgj.com/xgj/spaceflow/commit/bc4cd89af70dce052e7e00fe413708790f65be61))
* **core:** released version 0.5.0 [no ci] ([ad20098](https://git.bjxgj.com/xgj/spaceflow/commit/ad20098ef954283dd6d9867a4d2535769cbb8377))
* **core:** released version 0.6.0 [no ci] ([21e1ec6](https://git.bjxgj.com/xgj/spaceflow/commit/21e1ec61a2de542e065034f32a259092dd7c0e0d))
* **core:** released version 0.7.0 [no ci] ([000c53e](https://git.bjxgj.com/xgj/spaceflow/commit/000c53eff80899dbadad8d668a2227921373daad))
* **core:** released version 0.8.0 [no ci] ([625dbc0](https://git.bjxgj.com/xgj/spaceflow/commit/625dbc0206747b21a893ae43032f55d0a068c6fd))
* **core:** released version 0.9.0 [no ci] ([8127211](https://git.bjxgj.com/xgj/spaceflow/commit/812721136828e8c38adf0855fb292b0da89daf1a))
* **core:** 禁用 i18next 初始化时的 locize.com 推广日志 ([a99fbb0](https://git.bjxgj.com/xgj/spaceflow/commit/a99fbb068441bc623efcf15a1dd7b6bd38c05f38))
* **core:** 调整依赖配置 ([c86534a](https://git.bjxgj.com/xgj/spaceflow/commit/c86534ad213293ee2557ba5568549e8fbcb74ba5))
* **core:** 调整核心依赖与配置，新增Zod类型系统支持 ([def0751](https://git.bjxgj.com/xgj/spaceflow/commit/def0751577d9f3350494ca3c7bb4a4b087dab05e))
* **deps:** 移除 pnpm catalog 配置并更新依赖锁定 ([753fb9e](https://git.bjxgj.com/xgj/spaceflow/commit/753fb9e3e43b28054c75158193dc39ab4bab1af5))
* **docs:** 统一文档脚本命名,为 VitePress 命令添加 docs: 前缀 ([3cc46ea](https://git.bjxgj.com/xgj/spaceflow/commit/3cc46eab3a600290f5064b8270902e586b9c5af4))
* **i18n:** 配置 i18n-ally-next 自动提取键名生成策略 ([753c3dc](https://git.bjxgj.com/xgj/spaceflow/commit/753c3dc3f24f3c03c837d1ec2c505e8e3ce08b11))
* **i18n:** 重构 i18n 配置并统一 locales 目录结构 ([3e94037](https://git.bjxgj.com/xgj/spaceflow/commit/3e94037fa6493b3b0e4a12ff6af9f4bea48ae217))
* **period-summary:** released version 0.0.1 [no ci] ([7ab3504](https://git.bjxgj.com/xgj/spaceflow/commit/7ab3504750191b88643fe5db6b92bb08acc9ab5d))
* **period-summary:** released version 0.1.0 [no ci] ([36fb7a4](https://git.bjxgj.com/xgj/spaceflow/commit/36fb7a486da82e1d8e4b0574c68b4473cd86b28e))
* **period-summary:** released version 0.1.1 [no ci] ([b77e96b](https://git.bjxgj.com/xgj/spaceflow/commit/b77e96b1b768efa81d37143101057224fc3cef0f))
* **period-summary:** released version 0.1.2 [no ci] ([eaf41a0](https://git.bjxgj.com/xgj/spaceflow/commit/eaf41a0149ee4306361ccab0b3878bded79677df))
* **period-summary:** released version 0.10.0 [no ci] ([c1ca3bb](https://git.bjxgj.com/xgj/spaceflow/commit/c1ca3bb67fa7f9dbb4de152f0461d644f3044946))
* **period-summary:** released version 0.11.0 [no ci] ([b518887](https://git.bjxgj.com/xgj/spaceflow/commit/b518887bddd5a452c91148bac64d61ec64b0b509))
* **period-summary:** released version 0.12.0 [no ci] ([38490aa](https://git.bjxgj.com/xgj/spaceflow/commit/38490aa75ab20789c5495a5d8d009867f954af4f))
* **period-summary:** released version 0.13.0 [no ci] ([1d47460](https://git.bjxgj.com/xgj/spaceflow/commit/1d47460e40ba422a32865ccddd353e089eb91c6a))
* **period-summary:** released version 0.14.0 [no ci] ([55a72f2](https://git.bjxgj.com/xgj/spaceflow/commit/55a72f2b481e5ded1d9207a5a8d6a6864328d5a0))
* **period-summary:** released version 0.15.0 [no ci] ([3dd72cb](https://git.bjxgj.com/xgj/spaceflow/commit/3dd72cb65a422b5b008a83820e799b810a6d53eb))
* **period-summary:** released version 0.16.0 [no ci] ([b214e31](https://git.bjxgj.com/xgj/spaceflow/commit/b214e31221d5afa04481c48d9ddb878644a22ae7))
* **period-summary:** released version 0.17.0 [no ci] ([ac4e5b6](https://git.bjxgj.com/xgj/spaceflow/commit/ac4e5b6083773146ac840548a69006f6c4fbac1d))
* **period-summary:** released version 0.18.0 [no ci] ([f0df638](https://git.bjxgj.com/xgj/spaceflow/commit/f0df63804d06f8c75e04169ec98226d7a4f5d7f9))
* **period-summary:** released version 0.2.0 [no ci] ([66a4e20](https://git.bjxgj.com/xgj/spaceflow/commit/66a4e209519b64d946ec21b1d1695105fb9de106))
* **period-summary:** released version 0.3.0 [no ci] ([7e74c59](https://git.bjxgj.com/xgj/spaceflow/commit/7e74c59d90d88e061e693829f8196834d9858307))
* **period-summary:** released version 0.4.0 [no ci] ([ca89a9b](https://git.bjxgj.com/xgj/spaceflow/commit/ca89a9b9436761e210dedfc38fb3c16ef39b0718))
* **period-summary:** released version 0.5.0 [no ci] ([8e547e9](https://git.bjxgj.com/xgj/spaceflow/commit/8e547e9e6a6496a8c314c06cf6e88c97e623bc2d))
* **period-summary:** released version 0.6.0 [no ci] ([6648dfb](https://git.bjxgj.com/xgj/spaceflow/commit/6648dfb31b459e8c4522cff342dfa87a4bdaab4b))
* **period-summary:** released version 0.7.0 [no ci] ([8869d58](https://git.bjxgj.com/xgj/spaceflow/commit/8869d5876e86ebe83ae65c3259cd9a7e402257cf))
* **period-summary:** released version 0.8.0 [no ci] ([44ff3c5](https://git.bjxgj.com/xgj/spaceflow/commit/44ff3c505b243e1291565e354e239ce893e5e47c))
* **period-summary:** released version 0.9.0 [no ci] ([ac03f9b](https://git.bjxgj.com/xgj/spaceflow/commit/ac03f9bcff742d669c6e8b2f94e40153b6c298f5))
* **publish:** released version 0.0.1 [no ci] ([16b0f64](https://git.bjxgj.com/xgj/spaceflow/commit/16b0f647cf7fe23b921947b4a53ac94076bbee9e))
* **publish:** released version 0.1.0 [no ci] ([0ca1b54](https://git.bjxgj.com/xgj/spaceflow/commit/0ca1b54fd52e1721b5453dc1922c1d5b6a00acf4))
* **publish:** released version 0.1.1 [no ci] ([43ba6cb](https://git.bjxgj.com/xgj/spaceflow/commit/43ba6cb565ab84155ddc335b8bf6a72424e99b69))
* **publish:** released version 0.1.2 [no ci] ([4786731](https://git.bjxgj.com/xgj/spaceflow/commit/4786731da7a21982dc1e912b1a5002f5ebba9104))
* **publish:** released version 0.10.0 [no ci] ([8722ba9](https://git.bjxgj.com/xgj/spaceflow/commit/8722ba9eddb03c2f73539f4e09c504ed9491a5eb))
* **publish:** released version 0.11.0 [no ci] ([df17cd1](https://git.bjxgj.com/xgj/spaceflow/commit/df17cd1250c8fd8a035eb073d292885a4b1e3322))
* **publish:** released version 0.12.0 [no ci] ([50e209e](https://git.bjxgj.com/xgj/spaceflow/commit/50e209ebc57504462ed192a0fe22f6f944165fa3))
* **publish:** released version 0.13.0 [no ci] ([1d308d9](https://git.bjxgj.com/xgj/spaceflow/commit/1d308d9e32c50902dd881144ff541204d368006f))
* **publish:** released version 0.14.0 [no ci] ([fe0e140](https://git.bjxgj.com/xgj/spaceflow/commit/fe0e14058a364362d7d218da9b34dbb5d8fb8f42))
* **publish:** released version 0.15.0 [no ci] ([4b09122](https://git.bjxgj.com/xgj/spaceflow/commit/4b091227265a57f0a05488749eb4852fb421a06e))
* **publish:** released version 0.16.0 [no ci] ([e31e46d](https://git.bjxgj.com/xgj/spaceflow/commit/e31e46d08fccb10a42b6579fa042aa6c57d79c8a))
* **publish:** released version 0.17.0 [no ci] ([8e0d065](https://git.bjxgj.com/xgj/spaceflow/commit/8e0d0654040d6af7e99fa013a8255aa93acbcc3a))
* **publish:** released version 0.18.0 [no ci] ([2f2ce01](https://git.bjxgj.com/xgj/spaceflow/commit/2f2ce01726f7b3e4387e23a17974b58acd3e6929))
* **publish:** released version 0.19.0 [no ci] ([7a96bca](https://git.bjxgj.com/xgj/spaceflow/commit/7a96bca945434a99f7d051a38cb31adfd2ade5d2))
* **publish:** released version 0.2.0 [no ci] ([bc30a82](https://git.bjxgj.com/xgj/spaceflow/commit/bc30a82082bba4cc1a66c74c11dc0ad9deef4692))
* **publish:** released version 0.20.0 [no ci] ([d347e3b](https://git.bjxgj.com/xgj/spaceflow/commit/d347e3b2041157d8dc6e3ade69b05a481b2ab371))
* **publish:** released version 0.3.0 [no ci] ([972eca4](https://git.bjxgj.com/xgj/spaceflow/commit/972eca440dd333e8c5380124497c16fe6e3eea6c))
* **publish:** released version 0.4.0 [no ci] ([be66220](https://git.bjxgj.com/xgj/spaceflow/commit/be662202c1e9e509368eb683a0d6df3afd876ff8))
* **publish:** released version 0.5.0 [no ci] ([8eecd19](https://git.bjxgj.com/xgj/spaceflow/commit/8eecd19c4dd3fbaa27187a9b24234e753fff5efe))
* **publish:** released version 0.6.0 [no ci] ([b6d8d09](https://git.bjxgj.com/xgj/spaceflow/commit/b6d8d099fc439ce67f802d56e30dadaa28afed0e))
* **publish:** released version 0.7.0 [no ci] ([7124435](https://git.bjxgj.com/xgj/spaceflow/commit/712443516845f5bbc097af16ec6e90bb57b69fa3))
* **publish:** released version 0.8.0 [no ci] ([d7cd2e9](https://git.bjxgj.com/xgj/spaceflow/commit/d7cd2e9a7af178acdf91f16ae299c82e915db6e6))
* **publish:** released version 0.9.0 [no ci] ([b404930](https://git.bjxgj.com/xgj/spaceflow/commit/b40493049877c1fd3554d77a14e9bd9ab318e15a))
* released version v1.1.1 [no ci] ([eadc0f8](https://git.bjxgj.com/xgj/spaceflow/commit/eadc0f8219066b094dfe6727423578bf9ad64a99))
* released version v1.1.2 [no ci] ([cc12323](https://git.bjxgj.com/xgj/spaceflow/commit/cc12323a4e5c42b244ecafd26d42242fa852f5b6))
* released version v1.1.3 [no ci] ([09feb13](https://git.bjxgj.com/xgj/spaceflow/commit/09feb1305cdcdc622cb5898bf16d106aeee3b7f3))
* released version v1.1.4 [no ci] ([36191c7](https://git.bjxgj.com/xgj/spaceflow/commit/36191c71c94a659d4b588a40c437b12a9b76af9e))
* released version v1.1.5 [no ci] ([9f88b27](https://git.bjxgj.com/xgj/spaceflow/commit/9f88b27de220d7e4bd288de9c54562cb0ed894cc))
* released version v1.1.6 [no ci] ([2e2db67](https://git.bjxgj.com/xgj/spaceflow/commit/2e2db6765b6eccf4fee3d6110d1fd6c3ab6040bd))
* released version v1.1.7 [no ci] ([c3e5250](https://git.bjxgj.com/xgj/spaceflow/commit/c3e52505c8ba4cea7b45fa30fac0b519a38fd428))
* released version v1.1.8 [no ci] ([d27472f](https://git.bjxgj.com/xgj/spaceflow/commit/d27472fecea7e24d41ecf99e5f5710acbfd3822b))
* **review:** released version 0.0.1 [no ci] ([478905a](https://git.bjxgj.com/xgj/spaceflow/commit/478905a2ebf11c8e10251f398d67fcf32ea7f62b))
* **review:** released version 0.1.0 [no ci] ([bd227b5](https://git.bjxgj.com/xgj/spaceflow/commit/bd227b5b650f23bcd412d2dbc105b7f958164f43))
* **review:** released version 0.1.1 [no ci] ([d06242d](https://git.bjxgj.com/xgj/spaceflow/commit/d06242dac763f6addf3eccfeeeb44bbf6a533041))
* **review:** released version 0.1.2 [no ci] ([9689d3e](https://git.bjxgj.com/xgj/spaceflow/commit/9689d3e37781ca9ae6cb14d7b12717c061f2919d))
* **review:** released version 0.10.0 [no ci] ([6465de8](https://git.bjxgj.com/xgj/spaceflow/commit/6465de8751028787efb509670988c62b4dbbdf2a))
* **review:** released version 0.11.0 [no ci] ([150cd9d](https://git.bjxgj.com/xgj/spaceflow/commit/150cd9df7d380c26e6f3f7f0dfd027022f610e6e))
* **review:** released version 0.12.0 [no ci] ([3da605e](https://git.bjxgj.com/xgj/spaceflow/commit/3da605ea103192070f1c63112ad896a33fbc4312))
* **review:** released version 0.13.0 [no ci] ([4214c44](https://git.bjxgj.com/xgj/spaceflow/commit/4214c4406ab5482b151ec3c00da376b1d3d50887))
* **review:** released version 0.14.0 [no ci] ([4165b05](https://git.bjxgj.com/xgj/spaceflow/commit/4165b05f8aab90d753193f3c1c2800e7f03ea4de))
* **review:** released version 0.15.0 [no ci] ([a2ab86d](https://git.bjxgj.com/xgj/spaceflow/commit/a2ab86d097943924749876769f0a144926178783))
* **review:** released version 0.16.0 [no ci] ([64c8866](https://git.bjxgj.com/xgj/spaceflow/commit/64c88666fc7e84ced013198d3a53a8c75c7889eb))
* **review:** released version 0.17.0 [no ci] ([9f25412](https://git.bjxgj.com/xgj/spaceflow/commit/9f254121557ae238e32f4093b0c8b5dd8a4b9a72))
* **review:** released version 0.18.0 [no ci] ([d366e3f](https://git.bjxgj.com/xgj/spaceflow/commit/d366e3fa9c1b32369a3d98e56fc873e033d71d00))
* **review:** released version 0.19.0 [no ci] ([0ba5c0a](https://git.bjxgj.com/xgj/spaceflow/commit/0ba5c0a39879b598da2d774acc0834c590ef6d4c))
* **review:** released version 0.2.0 [no ci] ([d0bd3ed](https://git.bjxgj.com/xgj/spaceflow/commit/d0bd3edf364dedc7c077d95801b402d41c3fdd9c))
* **review:** released version 0.20.0 [no ci] ([8b0f82f](https://git.bjxgj.com/xgj/spaceflow/commit/8b0f82f94813c79d579dbae8decb471b20e45e9d))
* **review:** released version 0.21.0 [no ci] ([b51a1dd](https://git.bjxgj.com/xgj/spaceflow/commit/b51a1ddcba3e6a4b3b3eb947864e731d8f87d62b))
* **review:** released version 0.22.0 [no ci] ([fca3bfc](https://git.bjxgj.com/xgj/spaceflow/commit/fca3bfc0c53253ac78566e88c7e5d31020a3896b))
* **review:** released version 0.23.0 [no ci] ([ed5bf22](https://git.bjxgj.com/xgj/spaceflow/commit/ed5bf22819094df070708c2724669d0b5f7b9008))
* **review:** released version 0.24.0 [no ci] ([5f1f94e](https://git.bjxgj.com/xgj/spaceflow/commit/5f1f94ee02123baa05802fb2bb038ccf9d50a0cc))
* **review:** released version 0.25.0 [no ci] ([69cfeaf](https://git.bjxgj.com/xgj/spaceflow/commit/69cfeaf768e4bf7b2aaba6f089064469338a1ac0))
* **review:** released version 0.26.0 [no ci] ([dec9c7e](https://git.bjxgj.com/xgj/spaceflow/commit/dec9c7ec66455cf83588368c930d12510ada6c0f))
* **review:** released version 0.27.0 [no ci] ([ac3fc5a](https://git.bjxgj.com/xgj/spaceflow/commit/ac3fc5a5d7317d537d0447e05a61bef15a1accbe))
* **review:** released version 0.28.0 [no ci] ([a2d89ed](https://git.bjxgj.com/xgj/spaceflow/commit/a2d89ed5f386eb6dd299c0d0a208856ce267ab5e))
* **review:** released version 0.3.0 [no ci] ([865c6fd](https://git.bjxgj.com/xgj/spaceflow/commit/865c6fdee167df187d1bc107867f842fe25c1098))
* **review:** released version 0.4.0 [no ci] ([3b5f8a9](https://git.bjxgj.com/xgj/spaceflow/commit/3b5f8a934de5ba4f59e232e1dcbccbdff1b8b17c))
* **review:** released version 0.5.0 [no ci] ([93c3088](https://git.bjxgj.com/xgj/spaceflow/commit/93c308887040f39047766a789a37d24ac6146359))
* **review:** released version 0.6.0 [no ci] ([48a90b2](https://git.bjxgj.com/xgj/spaceflow/commit/48a90b253dbe03f46d26bb88f3e0158193aa1dba))
* **review:** released version 0.7.0 [no ci] ([1d195d7](https://git.bjxgj.com/xgj/spaceflow/commit/1d195d74685f12edf3b1f4e13b58ccc3d221fd94))
* **review:** released version 0.8.0 [no ci] ([ec6e7e5](https://git.bjxgj.com/xgj/spaceflow/commit/ec6e7e5defd2a5a6349d3530f3b0f4732dd5bb62))
* **review:** released version 0.9.0 [no ci] ([13dd62c](https://git.bjxgj.com/xgj/spaceflow/commit/13dd62c6f307aa6d3b78c34f485393434036fe59))
* **scripts:** 修正 setup 和 build 脚本的过滤条件,避免重复构建 cli 包 ([ffd2ffe](https://git.bjxgj.com/xgj/spaceflow/commit/ffd2ffedca08fd56cccb6a9fbd2b6bd106e367b6))
* **templates:** 新增 MCP 工具插件模板 ([5f6df60](https://git.bjxgj.com/xgj/spaceflow/commit/5f6df60b60553f025414fd102d8a279cde097485))
* update ([c668651](https://git.bjxgj.com/xgj/spaceflow/commit/c668651627f12820b82d3eda0534a409efd43768))
* update ([4985196](https://git.bjxgj.com/xgj/spaceflow/commit/4985196ac6d9b7e5c37bda4f0a9b889e6c44c480))
* update ([5c31edc](https://git.bjxgj.com/xgj/spaceflow/commit/5c31edc968fb1d3e6325f776c5efdc9ca6a54c07))
* update ([9c352c7](https://git.bjxgj.com/xgj/spaceflow/commit/9c352c718bb508326e7fb2722dfbc0dca3c729c4))
* update ([09c1293](https://git.bjxgj.com/xgj/spaceflow/commit/09c12933f7ea50464668d51b9da03efb0a2f1228))
* update ([a757794](https://git.bjxgj.com/xgj/spaceflow/commit/a757794b61c459ddc80bf1f4f291eab42abf284a))
* update ([c31569e](https://git.bjxgj.com/xgj/spaceflow/commit/c31569e0415f590198f0d29be368c5881f232476))
* update ([25a81d9](https://git.bjxgj.com/xgj/spaceflow/commit/25a81d9be3c8a14160ed4db8cdd2bb8dd96350bf))
* update ([53684c5](https://git.bjxgj.com/xgj/spaceflow/commit/53684c56ffd477d56bea2b49ef33c2f02e6622d2))
* update ([af1d833](https://git.bjxgj.com/xgj/spaceflow/commit/af1d8332662807d3f2b5eb27f4f53c8d0e84274e))
* update ([892b0ec](https://git.bjxgj.com/xgj/spaceflow/commit/892b0ec272a776a66760493588f55ffb665cfae7))
* update ([afce4da](https://git.bjxgj.com/xgj/spaceflow/commit/afce4daf4bd83975311e4113a777788ce5282dcb))
* update ([086203b](https://git.bjxgj.com/xgj/spaceflow/commit/086203b6c3a656434ba1dd90fed42e463de41977))
* update ([7ff4b85](https://git.bjxgj.com/xgj/spaceflow/commit/7ff4b85215627bac08eb51d3790ddfae31da54bc))
* update ([d97522a](https://git.bjxgj.com/xgj/spaceflow/commit/d97522a58fe857d243c7c434203c4fea13216c51))
* update ([b0f05f6](https://git.bjxgj.com/xgj/spaceflow/commit/b0f05f608ab337fc259f1d57b3b2c38add943b1c))
* update ([b6e262e](https://git.bjxgj.com/xgj/spaceflow/commit/b6e262ebea3139b3ca1805accb21b4ae56727f2f))
* update ([06099e0](https://git.bjxgj.com/xgj/spaceflow/commit/06099e00a6d47db91900e7346c982e10a057ef30))
* update ([e0ff36f](https://git.bjxgj.com/xgj/spaceflow/commit/e0ff36fc5d99a34953fe5296360335c4fdafe830))
* update ([7133e2a](https://git.bjxgj.com/xgj/spaceflow/commit/7133e2ad1b370f03ec3da0bf8e5af108e77d8b31))
* update ([a77c8d1](https://git.bjxgj.com/xgj/spaceflow/commit/a77c8d102d82da06a1f1f228c9d6f0716f70c45c))
* update ci ([e9b8f2d](https://git.bjxgj.com/xgj/spaceflow/commit/e9b8f2d5f761bbe1f65c55b135c5a70a7eb67e8e))
* update ci ([5d88d06](https://git.bjxgj.com/xgj/spaceflow/commit/5d88d061eb4c81d8ddcc07e95ea104525e9cfb44))
* **workflows:** 为所有 GitHub Actions 工作流添加 GIT_PROVIDER_TYPE 环境变量 ([a463574](https://git.bjxgj.com/xgj/spaceflow/commit/a463574de6755a0848a8d06267f029cb947132b0))
* **workflows:** 在发布流程中添加 GIT_PROVIDER_TYPE 环境变量 ([a4bb388](https://git.bjxgj.com/xgj/spaceflow/commit/a4bb3881f39ad351e06c5502df6895805b169a28))
* **workflows:** 在发布流程中添加扩展安装步骤 ([716be4d](https://git.bjxgj.com/xgj/spaceflow/commit/716be4d92641ccadb3eaf01af8a51189ec5e9ade))
* **workflows:** 将发布流程的 Git 和 NPM 配置从 GitHub 迁移到 Gitea ([6d9acff](https://git.bjxgj.com/xgj/spaceflow/commit/6d9acff06c9a202432eb3d3d5552e6ac972712f5))
* **workflows:** 将发布流程的 GITHUB_TOKEN 改为使用 CI_GITEA_TOKEN ([e7fe7b4](https://git.bjxgj.com/xgj/spaceflow/commit/e7fe7b4271802fcdbfc2553b180f710eed419335))
* 为spaceflow.json添加JSON Schema提示 ([3744afb](https://git.bjxgj.com/xgj/spaceflow/commit/3744afb71d33704ec6c659bdbc8647ad2a2d8467))
* 为所有 commands 包添加 @spaceflow/cli 开发依赖 ([d4e6c83](https://git.bjxgj.com/xgj/spaceflow/commit/d4e6c8344ca736f7e55d7db698482e8fa2445684))
* 优化 Gitea Actions 工作流配置 ([106d819](https://git.bjxgj.com/xgj/spaceflow/commit/106d8196ba5e28930fb12f787c5e9718eebe5a56))
* 优化 PR 审查工作流配置 ([01bf2c5](https://git.bjxgj.com/xgj/spaceflow/commit/01bf2c5ef99759295b0b87d095de6b1bb049c773))
* 优化CI工作流的代码检出配置 ([d9740dd](https://git.bjxgj.com/xgj/spaceflow/commit/d9740dd6d1294068ffdcd7a12b61149773866a2a))
* 优化依赖配置并移除 .spaceflow 包依赖 ([be5264e](https://git.bjxgj.com/xgj/spaceflow/commit/be5264e5e0fe1f53bbe3b44a9cb86dd94ab9d266))
* 使用 node 直接运行编译后的 CLI 替代 pnpm 命令 ([7cd674b](https://git.bjxgj.com/xgj/spaceflow/commit/7cd674bf5e7466e34d96b7f91611c0092a1221ca))
* 修正 postinstall 脚本命令格式 ([3f0820f](https://git.bjxgj.com/xgj/spaceflow/commit/3f0820f85dee88808de921c3befe2d332f34cc36))
* 升级 claude-agent-sdk 版本从 0.2.1 到 0.2.7 ([0af82a3](https://git.bjxgj.com/xgj/spaceflow/commit/0af82a372a231356db18e5b9b36b172d8592ca6b))
* 在 PR 审查工作流中启用 --filter-no-commit 参数 ([e0024ad](https://git.bjxgj.com/xgj/spaceflow/commit/e0024ad5cb29250b452a841db2ce6ebf84016a2c))
* 将 PR 工作流任务名称从 test 改为 pr-review ([2239e5e](https://git.bjxgj.com/xgj/spaceflow/commit/2239e5ebdccb55a101b163e41350558d553a47e7))
* 恢复 pnpm catalog 配置并更新依赖锁定 ([0b2295c](https://git.bjxgj.com/xgj/spaceflow/commit/0b2295c1f906d89ad3ba7a61b04c6e6b94f193ef))
* 新增 .spaceflow/pnpm-workspace.yaml 防止被父级 workspace 接管并移除根项目 devDependencies 自动添加逻辑 ([61de3a2](https://git.bjxgj.com/xgj/spaceflow/commit/61de3a2b75e8a19b28563d2a6476158d19f6c5be))
* 新增 postinstall 钩子自动执行 setup 脚本 ([64dae0c](https://git.bjxgj.com/xgj/spaceflow/commit/64dae0cb440bd5e777cb790f826ff2d9f8fe65ba))
* 更新项目依赖锁定文件 ([19d2d1d](https://git.bjxgj.com/xgj/spaceflow/commit/19d2d1d86bb35b8ee5d3ad20be51b7aa68e83eff))
* 格式化actions构建产物并添加prettier忽略配置 ([94da118](https://git.bjxgj.com/xgj/spaceflow/commit/94da118b06bcaf1dc7a58044356453d129a85f87))
* 添加 ANTHROPIC_AUTH_TOKEN 环境变量调试日志 ([99e53d2](https://git.bjxgj.com/xgj/spaceflow/commit/99e53d200521d4be20cb901fc61c8e29cadc54b9))
* 禁用删除代码分析功能 ([988e3f1](https://git.bjxgj.com/xgj/spaceflow/commit/988e3f156f2ca4e92413bf7a455eba1760ad9eba))
* 移除 ANTHROPIC_AUTH_TOKEN 环境变量调试日志 ([eb41c65](https://git.bjxgj.com/xgj/spaceflow/commit/eb41c65e2bc21499d2f97966fd6c0396cdb1aef0))
* 移除 npm registry 配置文件 ([2d9fac6](https://git.bjxgj.com/xgj/spaceflow/commit/2d9fac6db79e81a09ca8e031190d0ebb2781cc31))
* 移除 postinstall 钩子避免依赖安装时自动执行构建 ([ea1dc85](https://git.bjxgj.com/xgj/spaceflow/commit/ea1dc85ce7d6cf23a98c13e2c21e3c3bcdf7dd79))
* 调整依赖配置并添加npm registry配置 ([a754db1](https://git.bjxgj.com/xgj/spaceflow/commit/a754db1bad1bafcea50b8d2825aaf19457778f2e))
* 调整项目依赖配置 ([6802386](https://git.bjxgj.com/xgj/spaceflow/commit/6802386f38f4081a3b5d5c47ddc49e9ec2e4f28d))
* 调整项目依赖配置 ([f4009cb](https://git.bjxgj.com/xgj/spaceflow/commit/f4009cb0c369b225c356584afb28a7ff5a1a89ec))
* 配置 pnpm 使用国内镜像源加速依赖安装 ([8976163](https://git.bjxgj.com/xgj/spaceflow/commit/8976163598fc0703bf4da407a929180e8e28ea84))
* 重命名 PR 工作流文件并优化 Gitea Token 获取逻辑 ([7d29722](https://git.bjxgj.com/xgj/spaceflow/commit/7d297221422354feacc7b6d5513265215dc3f90f))
* 重置所有包版本至 0.0.0 并清理 CHANGELOG 文件 ([f7efaf9](https://git.bjxgj.com/xgj/spaceflow/commit/f7efaf967467f1272e05d645720ee63941fe79be))
## 1.1.0 (2026-01-04)

### 新特性

* 支持在 gitea-flows 配置中自定义 release-it hooks ([e64d2dd](https://git.bjxgj.com/xgj/spaceflow/commit/e64d2ddec03244757419d00f33b51cb42f7c1e3f))
* 集成 release-it 插件并支持自定义配置 ([537674d](https://git.bjxgj.com/xgj/spaceflow/commit/537674d1d0c545ae8fcf17cf058b801d780a8bd0))

### 代码重构

* 将 changelog preset 配置迁移至 gitea-flows.config.js ([f8c030b](https://git.bjxgj.com/xgj/spaceflow/commit/f8c030bd8d13b6e036795f97a82221289f557cd9))
* 移除 gitea-flows 配置加载中的调试日志 ([d0715b5](https://git.bjxgj.com/xgj/spaceflow/commit/d0715b54d16ec3414b3bbc37d0db97e09c4b74d8))

### 其他修改

* released version v1.1.0 [no ci] ([051459b](https://git.bjxgj.com/xgj/spaceflow/commit/051459b1949d268821b2a9759ec3b70040eef646))
* update ([71e9155](https://git.bjxgj.com/xgj/spaceflow/commit/71e9155027070f4f1e5d8819eebaaa20ad1e825d))
* 新增 c12 配置加载器依赖 ([8d2ea34](https://git.bjxgj.com/xgj/spaceflow/commit/8d2ea34f90e8aaa063b9e73886bb16203e569d14))
## 1.0.1 (2026-01-04)

### 新特性

* 新增 --dry-run 模式并统一配置模块初始化 ([410644c](https://git.bjxgj.com/xgj/spaceflow/commit/410644c434aeed69cf7b87db9df4f8f5ae80724b))
* 新增 CI 发布命令及 Gitea SDK 集成 ([62f6962](https://git.bjxgj.com/xgj/spaceflow/commit/62f69624bce83ba4dd9b0ad9c52999afc3dd52f9))
* 新增通用存储模块,支持内存和文件两种适配器 ([492ad85](https://git.bjxgj.com/xgj/spaceflow/commit/492ad85bbcafecd21af895c4e26e77ffaff3b149))
* 新增飞书 SDK 集成及配置模块 ([7a888ea](https://git.bjxgj.com/xgj/spaceflow/commit/7a888ea3db60f79318c32080fce26ee16b5f64aa))
* 新增飞书卡片消息服务及事件处理机制 ([243da4b](https://git.bjxgj.com/xgj/spaceflow/commit/243da4b20a4ce9eaa7349f45528a78ecebdece5c))
* 集成 release-it 实现自动化版本发布 ([818cd95](https://git.bjxgj.com/xgj/spaceflow/commit/818cd958a1059c1494c08193bc20081e742ea6f6))

### 代码重构

* update name ([8a84bec](https://git.bjxgj.com/xgj/spaceflow/commit/8a84becb1b75c610ca51c54aa7c0141750b638fc))
* 将 StorageModule 设置为全局模块,简化应用集成 ([fca59a3](https://git.bjxgj.com/xgj/spaceflow/commit/fca59a312a8c252d7862441bb0bfdf89802cd714))
* 将卡片交互事件处理逻辑从 FeishuSdkService 迁移至 FeishuCardService ([1b7d625](https://git.bjxgj.com/xgj/spaceflow/commit/1b7d6252f23013d1995c806a15e625acc034fba8))
* 改名 ([9337388](https://git.bjxgj.com/xgj/spaceflow/commit/9337388a409ccfe8a41e78b7f045a036dbe3bc05))
* 注释掉 FeishuCardService 中的调试日志输出 ([20d0a50](https://git.bjxgj.com/xgj/spaceflow/commit/20d0a503274d90afcf9002d00fbdf1a807a33b6f))
* 简化卡片交互事件类型定义,使用类型继承替代字段展开 ([c732017](https://git.bjxgj.com/xgj/spaceflow/commit/c732017f293b98743670bd0eecacd5fabba40d50))
* 重构 ci-publish 命令,支持执行多个脚本并自动管理分支保护 ([1a9fcb9](https://git.bjxgj.com/xgj/spaceflow/commit/1a9fcb99b20b7ad26b79c6ac74b837ced11c5710))
* 重构 CLI 模块结构 ([cdd47b2](https://git.bjxgj.com/xgj/spaceflow/commit/cdd47b26fdd69e41698d372c7b43f0e7fbf0f6b4))
* 重构 Gitea SDK 服务命名及配置验证逻辑 ([758bb59](https://git.bjxgj.com/xgj/spaceflow/commit/758bb591a761081473a74ad44015648eca589b5f))
* 重构飞书 SDK 类型定义,优化卡片交互事件处理 ([9a6f3b7](https://git.bjxgj.com/xgj/spaceflow/commit/9a6f3b7596f967d8a282a0e000cab1b62b36e92f))

### 文档更新

* 添加项目文档和工作流配置文件 ([e3799c9](https://git.bjxgj.com/xgj/spaceflow/commit/e3799c9e3a2c23c4fb2ba38109f34120a6d2de32))

### 代码格式

* code ([1b648ca](https://git.bjxgj.com/xgj/spaceflow/commit/1b648ca79cc3e659cdd97e4c6536d794f57fb562))

### 其他修改

* init project ([22394d6](https://git.bjxgj.com/xgj/spaceflow/commit/22394d612d88935649e82371a646f25a84e8efe3))
* 初始化 monorepo 项目配置 ([ab92739](https://git.bjxgj.com/xgj/spaceflow/commit/ab92739e971300da227ae9223389c3d8676e2d12))
* 改名 ([3f0f489](https://git.bjxgj.com/xgj/spaceflow/commit/3f0f48929f8d381942d5b0541584e55fe0c9a063))
* 新增 publish-ci Action 项目及基础架构 ([c98e54e](https://git.bjxgj.com/xgj/spaceflow/commit/c98e54ed093d3a3d5251f3e58a7530cee514ca9c))
* 添加 CLI 可执行文件配置 ([4bd9bdb](https://git.bjxgj.com/xgj/spaceflow/commit/4bd9bdb02da6368be72fad0a8d0374311f21dec9))
* 添加 publish-mp 工作区及其依赖项 ([2caa90e](https://git.bjxgj.com/xgj/spaceflow/commit/2caa90e074763ab4c2e92d6bd869c1e35fa263d8))
* 移除 Gitea SDK 类型定义中的内联 ESLint 禁用注释 ([4719099](https://git.bjxgj.com/xgj/spaceflow/commit/471909928f6a4299f476a65e893e73f4014f7b75))
* 调整 ESLint 规则,禁用 TypeScript unsafe 相关警告 ([61bcdca](https://git.bjxgj.com/xgj/spaceflow/commit/61bcdcabbacdde522b91183086cab20ef2553e8d))
* 迁移至 oxlint 和 oxfmt,移除 ESLint 和 Prettier 依赖 ([d5d252f](https://git.bjxgj.com/xgj/spaceflow/commit/d5d252ffc00b05dcb6c9bb9a467698d2fcf27588))
* 迁移至 pnpm catalog 协议统一管理依赖版本 ([474529b](https://git.bjxgj.com/xgj/spaceflow/commit/474529b8b3aa9ce5417d7ed1061dd4417e736ca7))

## [0.18.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.17.0...@spaceflow/cli@0.18.0) (2026-02-04)

### 代码重构

* **verbose:** 扩展 verbose 级别支持至 3 ([c1a0808](https://git.bjxgj.com/xgj/spaceflow/commit/c1a080859e5d25ca1eb3dc7e00a67b32eb172635))

### 其他修改

* **ci-scripts:** released version 0.17.0 [no ci] ([31abd3d](https://git.bjxgj.com/xgj/spaceflow/commit/31abd3dcb48e2ddea5175552c0a87c1eaa1e7a41))
* **ci-shell:** released version 0.17.0 [no ci] ([a53508b](https://git.bjxgj.com/xgj/spaceflow/commit/a53508b15e4020e3399bae9cc04e730f1539ad8e))
* **period-summary:** released version 0.17.0 [no ci] ([ac4e5b6](https://git.bjxgj.com/xgj/spaceflow/commit/ac4e5b6083773146ac840548a69006f6c4fbac1d))
* **publish:** released version 0.19.0 [no ci] ([7a96bca](https://git.bjxgj.com/xgj/spaceflow/commit/7a96bca945434a99f7d051a38cb31adfd2ade5d2))
* **review:** released version 0.27.0 [no ci] ([ac3fc5a](https://git.bjxgj.com/xgj/spaceflow/commit/ac3fc5a5d7317d537d0447e05a61bef15a1accbe))

## [0.17.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.16.0...@spaceflow/cli@0.17.0) (2026-02-04)

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

- **ci-scripts:** released version 0.16.0 [no ci] ([9ab007d](https://git.bjxgj.com/xgj/spaceflow/commit/9ab007db178878e093ba93ea27c4f05ca813a65d))
- **ci-shell:** released version 0.16.0 [no ci] ([87fd703](https://git.bjxgj.com/xgj/spaceflow/commit/87fd7030b54d2f614f23e092499c5c51bfc33788))
- **period-summary:** released version 0.16.0 [no ci] ([b214e31](https://git.bjxgj.com/xgj/spaceflow/commit/b214e31221d5afa04481c48d9ddb878644a22ae7))
- **publish:** released version 0.18.0 [no ci] ([2f2ce01](https://git.bjxgj.com/xgj/spaceflow/commit/2f2ce01726f7b3e4387e23a17974b58acd3e6929))
- **review:** released version 0.20.0 [no ci] ([8b0f82f](https://git.bjxgj.com/xgj/spaceflow/commit/8b0f82f94813c79d579dbae8decb471b20e45e9d))
- **review:** released version 0.21.0 [no ci] ([b51a1dd](https://git.bjxgj.com/xgj/spaceflow/commit/b51a1ddcba3e6a4b3b3eb947864e731d8f87d62b))
- **review:** released version 0.22.0 [no ci] ([fca3bfc](https://git.bjxgj.com/xgj/spaceflow/commit/fca3bfc0c53253ac78566e88c7e5d31020a3896b))
- **review:** released version 0.23.0 [no ci] ([ed5bf22](https://git.bjxgj.com/xgj/spaceflow/commit/ed5bf22819094df070708c2724669d0b5f7b9008))
- **review:** released version 0.24.0 [no ci] ([5f1f94e](https://git.bjxgj.com/xgj/spaceflow/commit/5f1f94ee02123baa05802fb2bb038ccf9d50a0cc))
- **review:** released version 0.25.0 [no ci] ([69cfeaf](https://git.bjxgj.com/xgj/spaceflow/commit/69cfeaf768e4bf7b2aaba6f089064469338a1ac0))
- **review:** released version 0.26.0 [no ci] ([dec9c7e](https://git.bjxgj.com/xgj/spaceflow/commit/dec9c7ec66455cf83588368c930d12510ada6c0f))

## [0.16.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.15.0...@spaceflow/cli@0.16.0) (2026-02-02)

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
- **ci-scripts:** released version 0.15.0 [no ci] ([e314fb1](https://git.bjxgj.com/xgj/spaceflow/commit/e314fb11e7425b27c337d3650857cf3b737051fd))
- **ci-shell:** released version 0.15.0 [no ci] ([5c0dc0b](https://git.bjxgj.com/xgj/spaceflow/commit/5c0dc0b5482366ccfd7854868d1eb5f306c24810))
- **period-summary:** released version 0.15.0 [no ci] ([3dd72cb](https://git.bjxgj.com/xgj/spaceflow/commit/3dd72cb65a422b5b008a83820e799b810a6d53eb))
- **publish:** released version 0.17.0 [no ci] ([8e0d065](https://git.bjxgj.com/xgj/spaceflow/commit/8e0d0654040d6af7e99fa013a8255aa93acbcc3a))
- **review:** released version 0.19.0 [no ci] ([0ba5c0a](https://git.bjxgj.com/xgj/spaceflow/commit/0ba5c0a39879b598da2d774acc0834c590ef6d4c))
- 在 PR 审查工作流中启用 --filter-no-commit 参数 ([e0024ad](https://git.bjxgj.com/xgj/spaceflow/commit/e0024ad5cb29250b452a841db2ce6ebf84016a2c))
- 禁用删除代码分析功能 ([988e3f1](https://git.bjxgj.com/xgj/spaceflow/commit/988e3f156f2ca4e92413bf7a455eba1760ad9eba))

## [0.15.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.14.0...@spaceflow/cli@0.15.0) (2026-02-02)

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

- **ci-scripts:** released version 0.14.0 [no ci] ([c536208](https://git.bjxgj.com/xgj/spaceflow/commit/c536208e352baa82e5b56c490ea9df0aff116cb2))
- **ci-shell:** released version 0.14.0 [no ci] ([c6e4bdc](https://git.bjxgj.com/xgj/spaceflow/commit/c6e4bdca44874739694e3e46998e376779503e53))
- **period-summary:** released version 0.14.0 [no ci] ([55a72f2](https://git.bjxgj.com/xgj/spaceflow/commit/55a72f2b481e5ded1d9207a5a8d6a6864328d5a0))
- **publish:** released version 0.16.0 [no ci] ([e31e46d](https://git.bjxgj.com/xgj/spaceflow/commit/e31e46d08fccb10a42b6579fa042aa6c57d79c8a))
- **review:** released version 0.18.0 [no ci] ([d366e3f](https://git.bjxgj.com/xgj/spaceflow/commit/d366e3fa9c1b32369a3d98e56fc873e033d71d00))

## [0.14.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.13.0...@spaceflow/cli@0.14.0) (2026-01-31)

### 修复BUG

- **core:** 统一所有命令的错误处理,添加堆栈信息输出 ([31224a1](https://git.bjxgj.com/xgj/spaceflow/commit/31224a16ce7155402504bd8d3e386e59e47949df))
- **review:** 增强错误处理,添加堆栈信息输出 ([e0fb5de](https://git.bjxgj.com/xgj/spaceflow/commit/e0fb5de6bc877d8f0b3dc3c03f8d614320427bf3))

### 其他修改

- **ci-scripts:** released version 0.13.0 [no ci] ([021eefd](https://git.bjxgj.com/xgj/spaceflow/commit/021eefdf2ff72d16b36123335548df2d3ad1d6b7))
- **ci-shell:** released version 0.13.0 [no ci] ([81e7582](https://git.bjxgj.com/xgj/spaceflow/commit/81e75820eb69ca188155e33945111e2b1f6b3012))
- **period-summary:** released version 0.13.0 [no ci] ([1d47460](https://git.bjxgj.com/xgj/spaceflow/commit/1d47460e40ba422a32865ccddd353e089eb91c6a))
- **publish:** released version 0.15.0 [no ci] ([4b09122](https://git.bjxgj.com/xgj/spaceflow/commit/4b091227265a57f0a05488749eb4852fb421a06e))
- **review:** released version 0.17.0 [no ci] ([9f25412](https://git.bjxgj.com/xgj/spaceflow/commit/9f254121557ae238e32f4093b0c8b5dd8a4b9a72))

## [0.13.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.12.0...@spaceflow/cli@0.13.0) (2026-01-31)

### 新特性

- **review:** 为删除影响分析添加文件过滤功能 ([7304293](https://git.bjxgj.com/xgj/spaceflow/commit/73042937c5271ff4b0dcb6cd6d823e5aa0c03e7b))
- **review:** 新增过滤无commit问题的选项 ([7a4c458](https://git.bjxgj.com/xgj/spaceflow/commit/7a4c458da03ae4a4646abca7e5f03abc849dc405))

### 修复BUG

- **core:** 修复 resolveRef 方法未处理空 ref 参数的问题 ([0824c83](https://git.bjxgj.com/xgj/spaceflow/commit/0824c8392482263036888b2fec95935371d67d4d))
- **review:** 修复参数空值检查，增强代码健壮性 ([792a192](https://git.bjxgj.com/xgj/spaceflow/commit/792a192fd5dd80ed1e6d85cd61f6ce997bcc9dd9))
- **review:** 修复按指定提交过滤时未处理空值导致的潜在问题 ([5d4d3e0](https://git.bjxgj.com/xgj/spaceflow/commit/5d4d3e0390a50c01309bb09e01c7328b211271b8))

### 其他修改

- **ci-scripts:** released version 0.12.0 [no ci] ([097863f](https://git.bjxgj.com/xgj/spaceflow/commit/097863f0c5cc46cb5cb930f14a6f379f60a13f08))
- **ci-shell:** released version 0.12.0 [no ci] ([274216f](https://git.bjxgj.com/xgj/spaceflow/commit/274216fc930dfbf8390d02e25c06efcb44980fed))
- **period-summary:** released version 0.12.0 [no ci] ([38490aa](https://git.bjxgj.com/xgj/spaceflow/commit/38490aa75ab20789c5495a5d8d009867f954af4f))
- **publish:** released version 0.14.0 [no ci] ([fe0e140](https://git.bjxgj.com/xgj/spaceflow/commit/fe0e14058a364362d7d218da9b34dbb5d8fb8f42))
- **review:** released version 0.13.0 [no ci] ([4214c44](https://git.bjxgj.com/xgj/spaceflow/commit/4214c4406ab5482b151ec3c00da376b1d3d50887))
- **review:** released version 0.14.0 [no ci] ([4165b05](https://git.bjxgj.com/xgj/spaceflow/commit/4165b05f8aab90d753193f3c1c2800e7f03ea4de))
- **review:** released version 0.15.0 [no ci] ([a2ab86d](https://git.bjxgj.com/xgj/spaceflow/commit/a2ab86d097943924749876769f0a144926178783))
- **review:** released version 0.16.0 [no ci] ([64c8866](https://git.bjxgj.com/xgj/spaceflow/commit/64c88666fc7e84ced013198d3a53a8c75c7889eb))

## [0.12.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.11.0...@spaceflow/cli@0.12.0) (2026-01-31)

### 新特性

- **core:** 为 CLI 入口文件添加 Node shebang 支持 ([0d787d3](https://git.bjxgj.com/xgj/spaceflow/commit/0d787d329e69f2b53d26ba04720d60625ca51efd))

### 其他修改

- **ci-scripts:** released version 0.11.0 [no ci] ([d4f5bba](https://git.bjxgj.com/xgj/spaceflow/commit/d4f5bba6f89e9e051dde8d313b6e102c6dadfa41))
- **ci-shell:** released version 0.11.0 [no ci] ([cf9e486](https://git.bjxgj.com/xgj/spaceflow/commit/cf9e48666197295f118396693abc08b680b3ddee))
- **period-summary:** released version 0.11.0 [no ci] ([b518887](https://git.bjxgj.com/xgj/spaceflow/commit/b518887bddd5a452c91148bac64d61ec64b0b509))
- **publish:** released version 0.13.0 [no ci] ([1d308d9](https://git.bjxgj.com/xgj/spaceflow/commit/1d308d9e32c50902dd881144ff541204d368006f))
- **review:** released version 0.12.0 [no ci] ([3da605e](https://git.bjxgj.com/xgj/spaceflow/commit/3da605ea103192070f1c63112ad896a33fbc4312))

## [0.11.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.10.0...@spaceflow/cli@0.11.0) (2026-01-29)

### 新特性

- **core:** 优化 commit message 的 scope 处理逻辑 ([42869dd](https://git.bjxgj.com/xgj/spaceflow/commit/42869dd4bde0a3c9bf8ffb827182775e2877a57b))
- **core:** 重构 commit 服务并添加结构化 commit message 支持 ([22b4db8](https://git.bjxgj.com/xgj/spaceflow/commit/22b4db8619b0ce038667ab42dea1362706887fc9))

### 其他修改

- **ci-scripts:** released version 0.10.0 [no ci] ([ca2daad](https://git.bjxgj.com/xgj/spaceflow/commit/ca2daada8b04bbe809e69a3d5bd9373e897c6f40))
- **ci-shell:** released version 0.10.0 [no ci] ([53864b8](https://git.bjxgj.com/xgj/spaceflow/commit/53864b8c2534cae265b8fbb98173a5b909682d4e))
- **period-summary:** released version 0.10.0 [no ci] ([c1ca3bb](https://git.bjxgj.com/xgj/spaceflow/commit/c1ca3bb67fa7f9dbb4de152f0461d644f3044946))
- **publish:** released version 0.12.0 [no ci] ([50e209e](https://git.bjxgj.com/xgj/spaceflow/commit/50e209ebc57504462ed192a0fe22f6f944165fa3))
- **review:** released version 0.11.0 [no ci] ([150cd9d](https://git.bjxgj.com/xgj/spaceflow/commit/150cd9df7d380c26e6f3f7f0dfd027022f610e6e))

## [0.10.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.9.0...@spaceflow/cli@0.10.0) (2026-01-29)

### 新特性

- **core:** 优化 npm 包名处理逻辑 ([ae23ebd](https://git.bjxgj.com/xgj/spaceflow/commit/ae23ebdc3144b611e1aa8c4e66bf0db074d09798))
- **core:** 添加依赖更新功能 ([1a544eb](https://git.bjxgj.com/xgj/spaceflow/commit/1a544eb5e2b64396a0187d4518595e9dcb51d73e))
- **review:** 支持绝对路径转换为相对路径 ([9050f64](https://git.bjxgj.com/xgj/spaceflow/commit/9050f64b8ef67cb2c8df9663711a209523ae9d18))

### 其他修改

- **ci-scripts:** released version 0.9.0 [no ci] ([1b9e816](https://git.bjxgj.com/xgj/spaceflow/commit/1b9e8167bb8fc67fcc439b2ef82e7a63dc323e6d))
- **ci-shell:** released version 0.9.0 [no ci] ([accdda7](https://git.bjxgj.com/xgj/spaceflow/commit/accdda7ee4628dc8447e9a89da6c8101c572cb90))
- **period-summary:** released version 0.9.0 [no ci] ([ac03f9b](https://git.bjxgj.com/xgj/spaceflow/commit/ac03f9bcff742d669c6e8b2f94e40153b6c298f5))
- **publish:** released version 0.11.0 [no ci] ([df17cd1](https://git.bjxgj.com/xgj/spaceflow/commit/df17cd1250c8fd8a035eb073d292885a4b1e3322))
- **review:** released version 0.10.0 [no ci] ([6465de8](https://git.bjxgj.com/xgj/spaceflow/commit/6465de8751028787efb509670988c62b4dbbdf2a))
- **review:** released version 0.9.0 [no ci] ([13dd62c](https://git.bjxgj.com/xgj/spaceflow/commit/13dd62c6f307aa6d3b78c34f485393434036fe59))

## [0.9.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.8.0...@spaceflow/cli@0.9.0) (2026-01-28)

### 新特性

- **core:** 为 npm 包添加 npx 直接执行支持 ([e67a7da](https://git.bjxgj.com/xgj/spaceflow/commit/e67a7da34c4e41408760da4de3a499495ce0df2f))

### 其他修改

- **ci-scripts:** released version 0.8.0 [no ci] ([be6273d](https://git.bjxgj.com/xgj/spaceflow/commit/be6273dab7f1c80c58abdb8de6f0eeb986997e28))
- **ci-shell:** released version 0.8.0 [no ci] ([3102178](https://git.bjxgj.com/xgj/spaceflow/commit/310217827c6ec29294dee5689b2dbb1b66492728))
- **period-summary:** released version 0.8.0 [no ci] ([44ff3c5](https://git.bjxgj.com/xgj/spaceflow/commit/44ff3c505b243e1291565e354e239ce893e5e47c))
- **publish:** released version 0.10.0 [no ci] ([8722ba9](https://git.bjxgj.com/xgj/spaceflow/commit/8722ba9eddb03c2f73539f4e09c504ed9491a5eb))
- **review:** released version 0.8.0 [no ci] ([ec6e7e5](https://git.bjxgj.com/xgj/spaceflow/commit/ec6e7e5defd2a5a6349d3530f3b0f4732dd5bb62))

## [0.8.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.7.0...@spaceflow/cli@0.8.0) (2026-01-28)

### 新特性

- **core:** 优化 commit 消息生成器中的 scope 处理逻辑 ([1592079](https://git.bjxgj.com/xgj/spaceflow/commit/1592079edde659fe94a02bb6e2dea555c80d3b6b))

### 其他修改

- **ci-scripts:** released version 0.7.0 [no ci] ([ea294e1](https://git.bjxgj.com/xgj/spaceflow/commit/ea294e138c6b15033af85819629727915dfcbf4b))
- **ci-shell:** released version 0.7.0 [no ci] ([247967b](https://git.bjxgj.com/xgj/spaceflow/commit/247967b30876aae78cfb1f9c706431b5bb9fb57e))
- **period-summary:** released version 0.7.0 [no ci] ([8869d58](https://git.bjxgj.com/xgj/spaceflow/commit/8869d5876e86ebe83ae65c3259cd9a7e402257cf))
- **publish:** released version 0.9.0 [no ci] ([b404930](https://git.bjxgj.com/xgj/spaceflow/commit/b40493049877c1fd3554d77a14e9bd9ab318e15a))
- **review:** released version 0.7.0 [no ci] ([1d195d7](https://git.bjxgj.com/xgj/spaceflow/commit/1d195d74685f12edf3b1f4e13b58ccc3d221fd94))

## [0.7.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.6.0...@spaceflow/cli@0.7.0) (2026-01-28)

### 代码重构

- **core:** 重构安装服务目录结构和命名 ([50cc900](https://git.bjxgj.com/xgj/spaceflow/commit/50cc900eb864b23f20c5f48dec20d1a754238286))

### 其他修改

- **ci-scripts:** released version 0.6.0 [no ci] ([d485758](https://git.bjxgj.com/xgj/spaceflow/commit/d48575827941cae6ffc7ae6ba911e5d4cf3bd7fa))
- **ci-shell:** released version 0.6.0 [no ci] ([a2d1239](https://git.bjxgj.com/xgj/spaceflow/commit/a2d12397997b309062a9d93af57a5588cdb82a79))
- **period-summary:** released version 0.6.0 [no ci] ([6648dfb](https://git.bjxgj.com/xgj/spaceflow/commit/6648dfb31b459e8c4522cff342dfa87a4bdaab4b))
- **publish:** released version 0.8.0 [no ci] ([d7cd2e9](https://git.bjxgj.com/xgj/spaceflow/commit/d7cd2e9a7af178acdf91f16ae299c82e915db6e6))
- **review:** released version 0.6.0 [no ci] ([48a90b2](https://git.bjxgj.com/xgj/spaceflow/commit/48a90b253dbe03f46d26bb88f3e0158193aa1dba))

## [0.6.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.5.0...@spaceflow/cli@0.6.0) (2026-01-28)

### 新特性

- **core:** 优化pnpm包安装逻辑，检测是否为workspace ([6555daf](https://git.bjxgj.com/xgj/spaceflow/commit/6555dafe1f08a244525be3a0345cc585f2552086))

### 其他修改

- **ci-scripts:** released version 0.5.0 [no ci] ([a87a1da](https://git.bjxgj.com/xgj/spaceflow/commit/a87a1da0490986c46c2a527cda5e7d0df9df6d03))
- **ci-shell:** released version 0.5.0 [no ci] ([920d9a8](https://git.bjxgj.com/xgj/spaceflow/commit/920d9a8165fe6eabf7a074eb65762f4693883438))
- **period-summary:** released version 0.5.0 [no ci] ([8e547e9](https://git.bjxgj.com/xgj/spaceflow/commit/8e547e9e6a6496a8c314c06cf6e88c97e623bc2d))
- **publish:** released version 0.7.0 [no ci] ([7124435](https://git.bjxgj.com/xgj/spaceflow/commit/712443516845f5bbc097af16ec6e90bb57b69fa3))
- **review:** released version 0.5.0 [no ci] ([93c3088](https://git.bjxgj.com/xgj/spaceflow/commit/93c308887040f39047766a789a37d24ac6146359))

## [0.5.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.4.0...@spaceflow/cli@0.5.0) (2026-01-28)

### 新特性

- **core:** 优化包管理器检测与 npm 包处理逻辑 ([63f7fa4](https://git.bjxgj.com/xgj/spaceflow/commit/63f7fa4f55cb41583009b2ea313b5ad327615e52))

### 代码重构

- **core:** 优化配置合并逻辑，添加字段覆盖策略 ([18680e6](https://git.bjxgj.com/xgj/spaceflow/commit/18680e69b0d6e9e05c843ed3f07766830955d658))

### 其他修改

- **ci-scripts:** released version 0.4.0 [no ci] ([364f696](https://git.bjxgj.com/xgj/spaceflow/commit/364f696d0df5d84be915cfaa9202a592073d9b46))
- **ci-shell:** released version 0.4.0 [no ci] ([7e6bf1d](https://git.bjxgj.com/xgj/spaceflow/commit/7e6bf1dabffc6250b918b89bb850d478d3f4b875))
- **period-summary:** released version 0.4.0 [no ci] ([ca89a9b](https://git.bjxgj.com/xgj/spaceflow/commit/ca89a9b9436761e210dedfc38fb3c16ef39b0718))
- **publish:** released version 0.6.0 [no ci] ([b6d8d09](https://git.bjxgj.com/xgj/spaceflow/commit/b6d8d099fc439ce67f802d56e30dadaa28afed0e))
- **review:** released version 0.4.0 [no ci] ([3b5f8a9](https://git.bjxgj.com/xgj/spaceflow/commit/3b5f8a934de5ba4f59e232e1dcbccbdff1b8b17c))
- 更新项目依赖锁定文件 ([19d2d1d](https://git.bjxgj.com/xgj/spaceflow/commit/19d2d1d86bb35b8ee5d3ad20be51b7aa68e83eff))
- 移除 npm registry 配置文件 ([2d9fac6](https://git.bjxgj.com/xgj/spaceflow/commit/2d9fac6db79e81a09ca8e031190d0ebb2781cc31))
- 调整依赖配置并添加npm registry配置 ([a754db1](https://git.bjxgj.com/xgj/spaceflow/commit/a754db1bad1bafcea50b8d2825aaf19457778f2e))

## [0.4.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.3.0...@spaceflow/cli@0.4.0) (2026-01-28)

### 代码重构

- **publish:** 调整zod依赖的导入来源 ([574eef1](https://git.bjxgj.com/xgj/spaceflow/commit/574eef1910809a72a4b13acd4cb070e12dc42ce8))
- **review:** 调整zod依赖的导入路径 ([02014cd](https://git.bjxgj.com/xgj/spaceflow/commit/02014cdab9829df583f0f621150573b8c45a3ad7))

### 其他修改

- **ci-scripts:** released version 0.3.0 [no ci] ([9292b52](https://git.bjxgj.com/xgj/spaceflow/commit/9292b524f2b8171f8774fab4e4ef4b32991f5d3d))
- **ci-shell:** released version 0.3.0 [no ci] ([7b25e55](https://git.bjxgj.com/xgj/spaceflow/commit/7b25e557b628fdfa66d7a0be4ee21267906ac15f))
- **core:** 调整核心依赖与配置，新增Zod类型系统支持 ([def0751](https://git.bjxgj.com/xgj/spaceflow/commit/def0751577d9f3350494ca3c7bb4a4b087dab05e))
- **period-summary:** released version 0.3.0 [no ci] ([7e74c59](https://git.bjxgj.com/xgj/spaceflow/commit/7e74c59d90d88e061e693829f8196834d9858307))
- **publish:** released version 0.5.0 [no ci] ([8eecd19](https://git.bjxgj.com/xgj/spaceflow/commit/8eecd19c4dd3fbaa27187a9b24234e753fff5efe))
- **review:** released version 0.3.0 [no ci] ([865c6fd](https://git.bjxgj.com/xgj/spaceflow/commit/865c6fdee167df187d1bc107867f842fe25c1098))
- 调整项目依赖配置 ([6802386](https://git.bjxgj.com/xgj/spaceflow/commit/6802386f38f4081a3b5d5c47ddc49e9ec2e4f28d))

## [0.3.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.2.0...@spaceflow/cli@0.3.0) (2026-01-28)

### 代码重构

- **publish:** 调整包变更检测的日志输出格式 ([df35e92](https://git.bjxgj.com/xgj/spaceflow/commit/df35e92d614ce59e202643cf34a0fef2803412a1))

### 其他修改

- **ci-scripts:** released version 0.2.0 [no ci] ([716e9ad](https://git.bjxgj.com/xgj/spaceflow/commit/716e9ad0f32bde09c608143da78f0a4299017797))
- **ci-shell:** released version 0.2.0 [no ci] ([4f5314b](https://git.bjxgj.com/xgj/spaceflow/commit/4f5314b1002b90d7775a5ef51e618a3f227ae5a9))
- **core:** 调整依赖配置 ([c86534a](https://git.bjxgj.com/xgj/spaceflow/commit/c86534ad213293ee2557ba5568549e8fbcb74ba5))
- **period-summary:** released version 0.2.0 [no ci] ([66a4e20](https://git.bjxgj.com/xgj/spaceflow/commit/66a4e209519b64d946ec21b1d1695105fb9de106))
- **publish:** released version 0.3.0 [no ci] ([972eca4](https://git.bjxgj.com/xgj/spaceflow/commit/972eca440dd333e8c5380124497c16fe6e3eea6c))
- **publish:** released version 0.4.0 [no ci] ([be66220](https://git.bjxgj.com/xgj/spaceflow/commit/be662202c1e9e509368eb683a0d6df3afd876ff8))
- **review:** released version 0.2.0 [no ci] ([d0bd3ed](https://git.bjxgj.com/xgj/spaceflow/commit/d0bd3edf364dedc7c077d95801b402d41c3fdd9c))
- 调整项目依赖配置 ([f4009cb](https://git.bjxgj.com/xgj/spaceflow/commit/f4009cb0c369b225c356584afb28a7ff5a1a89ec))

## [0.2.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.1.2...@spaceflow/cli@0.2.0) (2026-01-28)

### 新特性

- **publish:** 增强包变更检测的日志输出 ([b89c5cc](https://git.bjxgj.com/xgj/spaceflow/commit/b89c5cc0654713b6482ee591325d4f92ad773600))

### 修复BUG

- **publish:** 修复分支锁定时未捕获异常处理器的资源泄漏问题 ([ae326e9](https://git.bjxgj.com/xgj/spaceflow/commit/ae326e95c0cea033893cf084cbf7413fb252bd33))

### 文档更新

- **core:** 更新核心框架README文档 ([0d98658](https://git.bjxgj.com/xgj/spaceflow/commit/0d98658f6ab01f119f98d3387fb5651d4d4351a8))

### 其他修改

- **ci-scripts:** released version 0.1.2 [no ci] ([ab9c100](https://git.bjxgj.com/xgj/spaceflow/commit/ab9c1000bcbe64d8a99ffa6bebb974c024b14325))
- **ci-shell:** released version 0.1.2 [no ci] ([bf7977b](https://git.bjxgj.com/xgj/spaceflow/commit/bf7977bed684b557555861b9dc0359eda3c5d476))
- **period-summary:** released version 0.1.2 [no ci] ([eaf41a0](https://git.bjxgj.com/xgj/spaceflow/commit/eaf41a0149ee4306361ccab0b3878bded79677df))
- **publish:** released version 0.1.2 [no ci] ([4786731](https://git.bjxgj.com/xgj/spaceflow/commit/4786731da7a21982dc1e912b1a5002f5ebba9104))
- **publish:** released version 0.2.0 [no ci] ([bc30a82](https://git.bjxgj.com/xgj/spaceflow/commit/bc30a82082bba4cc1a66c74c11dc0ad9deef4692))
- **review:** released version 0.1.2 [no ci] ([9689d3e](https://git.bjxgj.com/xgj/spaceflow/commit/9689d3e37781ca9ae6cb14d7b12717c061f2919d))
- 优化CI工作流的代码检出配置 ([d9740dd](https://git.bjxgj.com/xgj/spaceflow/commit/d9740dd6d1294068ffdcd7a12b61149773866a2a))

## [0.1.2](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.1.1...@spaceflow/cli@0.1.2) (2026-01-28)

### 修复BUG

- **publish:** 修复预演模式下的交互式提示问题 ([0b785bf](https://git.bjxgj.com/xgj/spaceflow/commit/0b785bfddb9f35e844989bd3891817dc502302f8))

## [0.1.1](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.1.0...@spaceflow/cli@0.1.1) (2026-01-28)

### 文档更新

- **publish:** 完善发布插件README文档 ([faa57b0](https://git.bjxgj.com/xgj/spaceflow/commit/faa57b095453c00fb3c9a7704bc31b63953c0ac5))

## [0.1.0](https://git.bjxgj.com/xgj/spaceflow/compare/@spaceflow/cli@0.0.1...@spaceflow/cli@0.1.0) (2026-01-28)

### 新特性

- **core:** 添加同步解锁分支方法用于进程退出清理 ([cbec480](https://git.bjxgj.com/xgj/spaceflow/commit/cbec480511e074de3ccdc61226f3baa317cff907))

## 0.0.1 (2026-01-28)

### 其他修改

- 重置所有包版本至 0.0.0 并清理 CHANGELOG 文件 ([f7efaf9](https://git.bjxgj.com/xgj/spaceflow/commit/f7efaf967467f1272e05d645720ee63941fe79be))

---
title: "第三块 Kaggle 银牌：宝可梦卡牌 (PTCG) AI 对战模拟与 14 天闭门天梯大逆转"
published: 2026-09-08
updated: 2026-09-08
description: "复盘 Kaggle The Pokémon Company - PTCG AI Battle 竞赛：从 7 月 30 日早期提交冲进全球第 9 名的高光，到 60 张长毛巨魔控制卡组、PTCGNet3 Transformer 与 10 专家门控路由，最终在 14 天闭门循环赛中以 951.0 分斩获第 244 名银牌。"
image: "/assets/images/kaggle/pokemon-tcg-silver-certificate.jpg"
tags: ["Kaggle", "强化学习", "游戏AI", "Transformer", "比赛复盘"]
category: "Kaggle"
draft: false
lang: "zh_CN"
pinned: false
comment: true
---

## 跨界第三银：从地质、安全到游戏 AI

继 [ROGII 地质预测首银](/posts/kaggle-rogii-first-silver) 与 [AI Agent Security 攻防二银](/posts/kaggle-ai-agent-security-silver-expert) 之后，我们在 Kaggle 的第三个全新赛道——由 The Pokémon Company 官方举办的 [The Pokémon Company - PTCG AI Battle Challenge Simulation](https://www.kaggle.com/competitions/pokemon-tcg-ai-battle) 中，再次斩获一枚 **Silver Medal（银牌）**。

在全场 **6,807 支参赛队伍** 的激烈角逐中，我们团队（**A Tinkaton Is All You Need**）在 8 月封榜后锁定的终极 Agent `p46` 以 **951.0 分** 定格在 **全球第 244 名**（Top 3.58%），稳稳站在银牌线（Cutoff 924.0 分）之上。

![PTCG AI 竞赛银牌证书](/assets/images/kaggle/pokemon-tcg-silver-certificate.jpg)

这场比赛的参赛体验与以往完全不同：它没有静态的数据集与预先划分好的 Public / Private CSV，而是一个充满博弈对抗、策略迭代与戏剧性起伏的 **Kaggle 模拟竞技场（Simulation Tournament）**。

> [!NOTE]
> **队名彩蛋：从 Exfiltration 到 Tinkaton**
>
> 熟悉我们团队的朋友可能记得，上一场安全比赛我们的队名是 `Exfiltration Is All You Need`。这次来到宝可梦赛场，我们延续了这个传统，定名为 **`A Tinkaton Is All You Need`**——既幽默致敬了深度学习经典论文《Attention Is All You Need》（恰好对应我们模型底座的 Transformer 架构），又将第九世代扛锤暴力美学代表“巨锻匠（Tinkaton）”融入其中。

---

## 赛季中期高光：7 月 30 日冲进全球第 9 名的惊艳时刻

在谈最终的 14 天闭门决赛之前，必须记录一段让团队热血沸腾的难忘插曲：**这不是最终锁定的那两个提交，而是早在 7 月 30 日常规赛期的一次早期提交！**

当时我们以队伍名 `charlotte` 提交了一个新版 Agent。上线仅仅 35 分钟，这个 Agent 在天梯对决中连续击败多路强敌，积分一路飙升至 **1141.3 分，直接杀入全球排行榜第 9 名（Gold Medal 绝对头部区间）！**

![7 月 30 日常规赛中期高光：charlotte 提交冲进全球第 9 名 (1141.3 分)](/assets/images/kaggle/pokemon-tcg-leaderboard-rank-9.png)

这也解释了为什么在代码和权重库中，处处都有 `charlotte`、`charlotte-base` 和 `charlotte-espejo` 的命名痕迹——那正是 7 月底我们打出统治级表现时积累的核心骨干网络。

### 从“单兵高光”到“生态反扑”

然而，Kaggle Simulation 天梯最残酷的地方就在于 **Meta 的动态自适应**：
- 7 月 30 日的第 9 名证明了长毛巨魔控场流与基础策略的高爆发上限；
- 但随着赛程推进到 8 月，全天梯 6,000 多支队伍都在快速迭代，越来越多的对手开始针对性配置反制卡组（如针对 Munkidori 的后排强抓、多龙巴鲁托的极限提速爆发、以及清场地卡组）。单一权重模型在遭遇针对后，胜率不可避免地出现了震荡回落。
- 这次“由高处跌落”的深刻洗礼，促使我们在 8 月中旬做出了最关键的战略抉择：**放弃把全部希望押在单一模型上，必须构建一个能够识别对手并动态分流的混合专家系统（MoE）与严苛的规则安全护栏。**

---

## 真实的仿真天梯：14 天闭门决战的赛制机制

许多初次接触 Kaggle 游戏仿真类比赛的选手容易混淆排行榜上的即时分数与最终名次。这与普通表格比赛完全不同：

1. **封榜锁仓（Submission Freeze）**：在 8 月 16 日比赛提交截止后，所有团队的提交通道关闭，每个队伍仅能选择最终的 **2 个 Agent 提交** 参与最终结算。
2. **14 天闭门循环对战（Closed Evaluation Round-Robin）**：从 8 月 17 日开始，官方后台集群启动长达整整两周的持续自动化对局。所有的入围 Agent 在未知对手、无人工干预的真实环境中互相对决，依据类 TrueSkill / Elo 的动态收敛算法实时更新天梯积分（Skill Rating）。
3. **最终收官（Final Lockdown）**：北京时间 2026 年 9 月 1 日上午 07:53（UTC 8 月 31 日 23:53），所有对局正式结束，排行榜最终定格。

在这长达半个月的闭门厮杀中，环境的卡组分布极其严苛。前期强劲的卡组可能会因为被针对而在后半段遭遇断崖式暴跌；而具备强大自适应路由机制的模型，则能在千局磨砺中逐步反超。

---

## 自研遥测系统：kaggle-harvester 的实战数据揭秘

为了在 14 天的“黑盒”对战期掌握主动权，我们开发了自动化监控分析平台 **`kaggle-harvester`**，通过 Kaggle API 轮询对战回放（Replays），将 14 天内产生的所有对局持久化到本地 SQLite 数据库中，并绘制出了两个 Agent 在闭门赛期间的真实天梯积分演变轨迹：

![Pokémon TCG AI Battle 14 天天梯评分演进轨迹](/assets/images/kaggle/pokemon-tcg-rating-trajectory.png)

在整个评审期内，我们的数据库共捕获并审计了 **2,624 场真实有效对局**：

| 评估指标 | 综合统计 | p46 (最终 Silver 方案) | p31 (对照方案) |
| :--- | :--- | :--- | :--- |
| **最终天梯评分** | — | **951.0 (Rank 244 银牌)** | **897.2 (Rank 464 铜牌)** |
| **有效对局数** | 2,624 局 | 1,330 局 | 1,294 局 |
| **对战战绩** | 1,457W - 1,165L - 2T | 731W - 598L - 1T | 726W - 567L - 1T |
| **综合胜率** | **55.48%** | **55.00%** | **56.15%** |
| **先攻 (Player 0) 胜率** | **58.95%** (774/1,313) | **58.15%** (378/650) | **59.73%** (396/663) |
| **后攻 (Player 1) 胜率** | **52.02%** (683/1,311) | **51.91%** (353/680) | **52.30%** (330/631) |
| **对阵高分区 (≥900分) 胜率** | 41.24% (285/691) | 39.84% (147/369) | 42.86% (138/322) |

### 数据背后的战术洞察

1. **先后手偏差显著（First-Move Advantage）**：数据清晰展示了先攻（Player 0）具有近 **7 个百分点** 的绝对胜率优势（58.95% vs 52.02%）。在宝可梦卡牌环境下，先攻方能更快进化二阶宝可梦、先手贴能并确立场地控制。
2. **末期大逆转（The Final Sprint）**：正如轨迹图所示，对照方案 `p31` 在第 1,000 局前后曾一度触及 953 分的高点，但随后因为对抗多龙巴鲁托（Dragapult）与异形快攻时策略固化，在最后 100 局遭遇连续失分（-13.3 分），滑落至 897.2 分。
3. **`p46` 的韧性攀升**：`p46` 在经历中期的评分震荡后，在最后 130 局（Game 1201-1330）展现出了惊人的后劲，打出了 **57.7% 的高胜率（75胜 55负，净增 +48.3 分）**，在比赛终局截止前强势冲线，突破 924 分银牌线直达 951.0 分！

![最终官方排行榜锁定：第 244 名 951.0 分斩获银牌](/assets/images/kaggle/pokemon-tcg-leaderboard-rank-244.png)

---

## 60 张卡组设计：玛俐长毛巨魔控场流

在 PTCG AI 对战中，代码写得再优雅，如果卡组构筑（Deck Building）本身缺乏对抗深度，AI 也只能是“巧妇难为无米之炊”。

经过反复离线模拟，我们放弃了依赖特定神抽的纯快攻爆发流，选择了一套兼具高容错率、持续骚扰与伤害精准调度的 **玛俐长毛巨魔 ex + 猴猩（Munkidori）+ 雪妖女（Froslass）** 伤害转移控制卡组：

```text
┌─────────────────────────────────────────────────────────────┐
│                   Marnie's Grimmsnarl ex Deck               │
├──────────────────────────────┬──────────────────────────────┤
│ Core Hitters & Board (x14)   │ Trainers & Acceleration (x36)│
│ - Marnie's Impidimp x4       │ - Buddy-Buddy Poffin x4      │
│ - Marnie's Morgrem x3        │ - Poké Pad x4                │
│ - Marnie's Grimmsnarl ex x3  │ - Team Rocket's Petrel x4    │
│ - Munkidori x4 (Adrena-Brain)│ - Lillie's Determination x4  │
│ - Snorunt x2                 │ - Spikemuth Gym x4 (Stadium) │
│ - Froslass x2 (Frost Sink)   │ - Rare Candy x3              │
├──────────────────────────────┤ - Night Stretcher x3         │
│ Energy & Tech (x10)          │ - Boss's Orders x2           │
│ - Basic Darkness Energy x10  │ - Unfair Stamp x1 (ACE SPEC) │
│                              │ - Tool Scrapper x1 / Dawn x1 │
└──────────────────────────────┴──────────────────────────────┘
```

### 核心战术链条

1. **二阶主力站场**：通过 `Buddy-Buddy Poffin`（密友波芬）与 `Rare Candy`（神奇糖果）在第 2 回合快速做出 330 HP 的高坦度 `Marnie's Grimmsnarl ex`。
2. **特性伤害引擎（Froslass）**：`Froslass` 的特性“雪崩降临”可以在双方每个回合在场上所有拥有特性的宝可梦身上放置伤害指示物。面对主流的能卡充填怪或过牌引擎，对手只要铺场就会自残。
3. **精准伤害反向灌注（Munkidori）**：`Munkidori` 在附着恶能量时，可发动特性 `Adrena-Brain`（肾上腺脑），将己方场上的最多 3 个伤害指示物转移到对手任意宝可梦身上。这不仅能化解雪妖女对己方的自伤，更能越过前排肉盾，直接精确狙杀后排残血核心。
4. **致命干扰（Unfair Stamp）**：搭载神级 ACE SPEC 卡牌 `Unfair Stamp`（不公印章）。己方宝可梦一旦气绝，下回合强行令对手手牌洗回重抽 2 张，瞬间打崩对手手牌资源。

---

## 核心架构：PTCGNet3 状态与动作 Transformer

宝可梦卡牌具有庞大的组合动作空间（附能、撤退、招式、多目标检索、弃牌），且每回合玩家可选的动作分支高达数十种。传统的固定维度 MLP 无法有效表达这种变长交互。

我们设计了 **`PTCGNet3`** 深度模型，采用预归一化（Norm-First）的 4 层 Transformer Encoder 作为核心特征提取骨干网络（Hidden Dimension $d=256$, 8 Heads）：

```text
               Board State Tokens (Active / Bench / Hand)
                    │ (Card Emb 96d + Zone Emb 16d + HP/Energy)
                    ▼
┌────────────────────────────────────────────────────────┐
│               Global Game State Token [CLS]            │
│       - Turn / Prizes / Deck Counts / Hand Counts      │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│            Candidate Action Tokens (Max 48)            │
│  - Action Type / Context / Target / Attack Damage / SE │
└───────────────────┬────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│          4-Layer Transformer Encoder (d=256)           │
└───────┬──────────────┬──────────────┬──────────────────┘
        │              │              │
        ▼              ▼              ▼
  [Policy Head]   [Memb Head]    [Count Head]    [Value Head]
   (Action Logit) (Multi-Select)  (Count 1..6)   (51-Bin Distribution)
```

### 1. 多粒度 Token 输入

- **状态 Token（26 个槽位）**：包含双方的前场（Active）、后场（Bench 1-5）、以及己方手牌（最多 12 张）。每张卡牌映射为 96 维可学习向量，并融合区域特征（16 维）及实时血量、能量数、携带道具数。
- **全局标量投影**：Turn 轮次、奖赏卡差值、剩余牌库数、手牌上限与竞技场状态投射为全局标量，并加和在 `[CLS]` Token 上。
- **动作候选 Token（最多 48 个）**：每个候选合法动作被解析为动作类型、操作上下文、目标卡牌、对应招式基础伤害，以及即时计算的**弱点克制（$\times 2$）与属性抵抗（$-30$）**修正。

### 2. 多任务解码头

- **`policy_head`**：针对每个候选动作输出选择概率 Logits。
- **`memb_head`**：输出成员隶属度分数，用于支持像“夜间担架从弃牌堆多选宝可梦”或“交出多张手牌”这类复合动作。
- **`count_head`**：动态预测多选决策时的最优目标数量 $k$（$1 \le k \le 6$）。
- **`value_head`**：采用 51-bin 的分布式值函数（Two-hot / HL-Gauss 离散化），极大稳定了对局优劣势评估的梯度传播。

---

## 训练管线：行为克隆冷启动与对抗子集微调

很多朋友好奇，这 10 个专家模型的权重究竟是如何训练生成的？

在卡牌对战这种长时序不完全信息博弈中，从零开始直接跑纯强化学习（PPO / Self-Play）面临极大的采样效率陷阱。我们设计了**两阶段渐进式训练管线**：

```text
  Raw Replays (High-Elo Games)
               │
               ▼
┌──────────────────────────────┐
│ Phase 1: Behavior Cloning    │ ──► 基线策略: charlotte-base (bcpure)
│ (模仿顶尖玩家对战决策序列)   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Phase 2: Targeted Fine-Tuning│ ──► 分流生成 10 个特化 Expert Checkpoints
│ (根据对手签名卡牌切分对局集) │     (针对 Alakazam / Dragapult / Lucario 等)
└──────────────────────────────┘
```

1. **第一阶段：行为克隆（Behavior Cloning / `bcpure`）**：
   - 提取数万场高天梯分的对战日志，通过监督学习让 `PTCGNet3` 快速掌握基础卡牌联动（下怪、贴能、做场逻辑），形成基准策略模型 `charlotte-base`。
2. **第二阶段：对手定向微调（Opponent-Specific Fine-Tuning）**：
   - 依据对手的核心标志性卡牌（如胡地线 `741-743`、多龙线 `119-121`、路卡利欧 `333, 678`），从实战对局库中抽取特定的对战子集。
   - 在高难度对抗子集上施加更高的对弈奖惩权重（例如针对路卡利欧爆发，代码中记录的胜率对比达到 `88 vs 67 de bcpure`，相比原始基线大幅提升 21 个百分点！）。

---

## 终极突破：10 专家门控网络与动态 Meta 路由

在早期的 `p31` 提交中，我们仅维护了 4 个权重检查点，并将胡地（Alakazam）、多龙（Dragapult）、庆典（Festival Lead）和希罗娜烈咬陆鲨（Cynthia）等多种不同风格的对手强行塞入单个泛化模型 `_net_c`。在实战天梯中，这种“大一统”网络在面对特殊特化卡组时出现了严重的价值误判。

在终极版本 `p46` 中，我们将模型系统全面重构为 **10 专家混合对抗架构（Mixture of 10 Specialized Experts）**：

### 10 专家矩阵配置清单

| 检查点文件 | 变量代号 | 内部策略命名 | 针对环境目标 (Target Archetype) |
| :--- | :--- | :--- | :--- |
| `weights.pt` | `_net` | `base` | 默认通用兜底策略 |
| `weights2.pt` | `_net_b` | `charlotte-espejo` | **长毛巨魔镜像内战** (源自 7.30 charlotte 积累) |
| `weights3.pt` | `_net_c` | `u12k` | **胡地 / 庆典 / 希罗娜烈咬陆鲨** 针对特化 |
| `weights4.pt` | `_net_d` | `cosmoX-exotico` | **异形流派** (袋兽 / 魔幻假面喵 / 暴噬龟) |
| `weights5.pt` | `_net_e` | `sopa5-dragapult` | **多龙巴鲁托 ex** (第 6 回合及以后的中后期残局) |
| `weights6.pt` | `_net_f` | `weights6` | 备用多流派平衡检查点 |
| `weights7.pt` | `_net_g` | `ftlucario-lucario` | **超级路卡利欧 ex** 高爆发针对网络 |
| `weights8.pt` | `_net_h` | `aperturas` | **黄金前 3~5 回合** 激进抢开局做场网络 |
| `weights9.pt` | `_net_i` | `weights9` | 备用长盘消耗检查点 |
| `weights10.pt`| `_net_j` | `ftlopunny-lopunny`| **超级长耳兔 ex** 快速快攻特化 |

### 动态路由决策流

在每个对局第一回合，模型会根据已观察到的对手卡牌签名（Seen Signatures）进行实时的条件分流：

```python
# p46 核心对抗路由决策流
if _opp_seen & GRIMM_ROUTE_SIG:
    _n, _bn = _net_b, "charlotte-espejo"      # 镜像内战特化网络
elif _opp_seen & PATCH_SIG:
    _n, _bn = _net_c, "u12k-alakazam"         # 针对 Abra/Kadabra/Alakazam
elif _opp_seen & DRAG_SIG:
    if 3 <= cur.get("turn", 0) <= 5:
        _n, _bn = _net_h, "aperturas"         # 3-5 回合黄金抢节奏特化
    else:
        _n, _bn = _net_e, "sopa5-dragapult"   # 中后期控场压制
elif _opp_seen & FEST_SIG:
    _n, _bn = _net_c, "u12k-festival"         # 针对青草节拍庆典流
elif _opp_seen & CYN_SIG:
    _n, _bn = _net_c, "u12k-cynthia"          # 针对希罗娜烈咬陆鲨 ex
elif _opp_seen & LUCARIO_SIG:
    _n, _bn = _net_g, "ftlucario-lucario"     # 针对超级路卡利欧爆发流
elif _opp_seen & EXO_FAST_SIG:
    _n, _bn = _net_j, "ftlopunny-lopunny"     # 针对超级长耳兔快速爆发
elif (_opp_seen & KANGA_SIG) or (_opp_seen & MEOW_SIG) or (_opp_seen & DRED_SIG):
    _n, _bn = _net_d, "cosmoX-exotico"        # 针对袋兽/魔幻假面喵等异形卡组
elif 3 <= cur.get("turn", 0) <= 5:
    _n, _bn = _net_h, "aperturas"             # 通用前期开局策略
else:
    _n, _bn = _net, "base"                    # 基础通用网络
```

### 时序分段路由（Temporal Staged Routing）

特别值得一提的是针对天梯霸主 **多龙巴鲁托（Dragapult ex）** 的精细分工：
多龙卡组在第 3 到第 5 回合具备极强的二阶多龙做场与铺能威胁。如果使用统一模型，往往会在前期过度防守而后排失守。
`p46` 在检测到 `Dreepy` 进化链时，在第 3-5 回合直接无缝切换至激进的开局开荒专家 `_net_h (aperturas)`，全力争夺节奏；而在第 6 回合后则切换至消耗拉扯专家 `_net_e (sopa5-dragapult)`，通过长毛巨魔的高血量抵挡多龙的幽灵箭。正是这一策略，让 `p46` 在高分段对局中频频啃下硬骨头。

---

## 沙箱工程：极致轻量化与双核 CPU 毫秒级推理

许多选手在本地训练出非常庞大的巨型模型，但在提交到 Kaggle Simulation 环境后却遭遇频繁超时的惩罚。本场比赛的沙箱环境极其苛刻：

1. **无 GPU 加速，纯 CPU 运行**：线上 Agent 仅分配了双核 CPU 资源。我们在代码顶部显式设置了 `torch.set_num_threads(2)`，避免线程争抢带来的上下文开销；
2. **内存零负担（< 150MB）**：得益于 `PTCGNet3` 紧凑的参数设计（4 层，隐藏维度 256），单份权重仅有 **10.7 MB**。即使将 10 个专家网络一次性全部加载驻留内存，总内存消耗也不过约 107MB，给游戏环境留出了绝对充裕的安全内存；
3. **毫秒级前向计算（~5ms）**：单次前向传递仅耗时约 5 毫秒，整套推断（含特征编码与规则过滤）在 20 毫秒内即可完成，彻底告别超时（Timeout Kill）暴毙的尾部风险。

---

## 防暴毙安全护栏与终局证明引擎

在天梯博弈中，**“不犯低级错误”比“偶现神之一手”重要得多**。单纯依赖神经网络的概率采样，不可避免会在极端状态下产生“幻觉”——例如在明明可以直接斩杀时选择弃牌跳过回合，或者走出直接导致己方前排猝死的昏招。

我们在神经网络外层构筑了四道不可逾越的规则安全护栏（Deterministic Rule Engine）：

```text
               Observation & Action Selection
                            │
                            ▼
          ┌───────────────────────────────────┐
          │   1. Lethal Prover (_prove_win)   ├─► [Guaranteed Win Action]
          └─────────────────┬─────────────────┘
                            ▼
          ┌───────────────────────────────────┐
          │  2. Deterministic KO (_win_now)   ├─► [Instant Win Action]
          └─────────────────┬─────────────────┘
                            ▼
          ┌───────────────────────────────────┐
          │  3. Neural Routing & Top-3 Evalu  │
          │     - Anti-Lethal Pruning (v2)    │
          └─────────────────┬─────────────────┘
                            ▼
          ┌───────────────────────────────────┐
          │  4. Anti-Passivity Override       ├─► [Force Legal KO Attack]
          └───────────────────────────────────┘
```

1. **确定性致胜证明器（`_prove_win`）**：在调用神经网络之前，前置进行纯符号推导。若当前手牌与能量通过确定性组合能直接清空对手所有场上宝可梦或拿完所有奖赏卡，立即执行斩杀，绕过任何网络随机性。
2. **零随机性 KO 终结（`_win_now_pick / KO-GANADOR`）**：排除所有带有硬币翻转（Coin Flip）不确定性的招式，仅筛选伤害固定、能直接击溃对方前场且获取奖赏卡即满足胜利条件的招式。
3. **反斩杀推演（`_avoid_lethal_v2`）**：在单选动作中，不仅提取 Logit 最高的候选，而是对 Top-3 动作进行反向威胁推演。如果最高分动作在下回合会直接暴露己方残血长毛巨魔，算法将自动回退到能够保命或拉后排的次优选择。
4. **反消极法医覆盖（`_free_ko_override / Anti-pasividad`）**：这是针对天梯真实翻盘案例定制的硬规则：若神经网络输出的动作是“结束回合（Pass Turn）”，而此时场上存在任何能够直接击杀对手活跃宝可梦的合法攻击，该规则将无条件强制覆盖，执行击杀。

---

## 结语与经验复盘

从地质回归预测（ROGII）、大模型多步工具安全攻防（AI Agent Security），再到本场大型在线博弈模拟（PTCG AI Battle），三场比赛、三块银牌、三个截然不同的技术栈：

1. **卡组/业务先验是基石**：在强化学习和复杂游戏决策中，纯粹端到端训练往往难以收敛。深入理解游戏机制、构筑科学的 60 张控场卡组，构成了我们拿到 55% 基础胜率的底线。
2. **冲榜峰值与长线收敛**：7 月 30 日的单兵冲榜（第 9 名 1141.3 分）验证了攻击上限；而面对 8 月下旬 14 天闭门循环的长跑考验，唯有精细化的 MoE 门控与防暴毙规则，才能抗住环境演化，最终守住银牌。
3. **规则兜底与安全护栏不可或缺**：AI 负责复杂局面的全局启发式搜索，规则引擎负责绝对精确的逻辑推理与防暴毙拦截。这种 **“神经网络直觉 + 符号规则严谨”** 的双核架构，无论是在游戏 AI 还是当下的工业级 Agent 落地中，都是最值得信赖的工程范式。

---

## 参考资料与链接

- [Kaggle 比赛主页：The Pokémon Company - PTCG AI Battle Challenge Simulation](https://www.kaggle.com/competitions/pokemon-tcg-ai-battle)
- [上一篇复盘：第二块 Kaggle 银牌：AI Agent Security 攻防复盘与晋升 Competition Expert](/posts/kaggle-ai-agent-security-silver-expert)
- [第一篇复盘：第一次参加 Kaggle：ROGII Wellbore Geology Prediction 首获银牌](/posts/kaggle-rogii-first-silver)
- [我的 Kaggle 个人主页](https://www.kaggle.com/aurax7)
- [经典论文：Attention Is All You Need (Vaswani et al.)](https://arxiv.org/abs/1706.03762)

*本文数据与走势记录均基于团队（A Tinkaton Is All You Need）在 Kaggle 官方闭门对战期间由自研工具 `kaggle-harvester` 采集的 2,624 场真实天梯回放日志。*

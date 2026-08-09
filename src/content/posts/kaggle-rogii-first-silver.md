---
title: "第一次参加 Kaggle：ROGII Wellbore Geology Prediction 首获银牌"
published: 2026-08-09
updated: 2026-08-09
description: "记录第一次 Kaggle 竞赛，从地质轨迹预测、公开榜过拟合，到最终获得第 284 名银牌的完整复盘。"
image: "/assets/images/kaggle/rogii-silver-certificate.jpg"
tags: ["Kaggle", "机器学习", "比赛复盘"]
category: "Kaggle"
draft: false
lang: "zh_CN"
pinned: false
comment: true
---

## 第一次比赛，先拿到一块银牌

这是我第一次参加 Kaggle 竞赛，参加的是 [ROGII - Wellbore Geology Prediction](https://www.kaggle.com/competitions/rogii-wellbore-geology-prediction)。比赛要求我们根据水平井轨迹、伽马射线测井和垂直参考井数据，预测水平井后续位置的真实垂直厚度（True Vertical Thickness，简称 `TVT`）。

最终我们以 `Private Score 8.527` 排名第 `284`，在 `6125` 支队伍中获得 Silver Medal。对于第一次正式参赛来说，这个结果已经足够值得记录下来。

![ROGII 比赛银牌证书](/assets/images/kaggle/rogii-silver-certificate.jpg)

证书上的排名是最终稳定后的结果：第 284 名，共 6125 支队伍，证书颁发时间为 2026 年 8 月 6 日。

## 比赛在解决什么问题

水平井钻井有点像在地下没有地图的情况下沿着目标地层前进。钻头实际经过的岩层不能直接看见，工程师只能结合井轨迹、测井曲线和垂直参考井来判断钻头处在什么位置。

ROGII 这场比赛将问题抽象为一个回归任务。训练数据里给出了部分水平井的真实 `TVT`，测试数据则隐藏了每口井后续区间的目标值。我们需要输出如下格式的文件：

```text
id,tvt
000d7d20_1442,0.0
000d7d20_1443,0.0
```

官方评价指标是 RMSE：

$$
\mathrm{RMSE}=\sqrt{\frac{1}{n}\sum_{i=1}^{n}(y_i-\hat{y}_i)^2}
$$

分数越低越好。数据主要由三类信息组成：水平井轨迹中的 `MD`、`X`、`Y`、`Z`，地质构造面的深度信息和 `GR` 伽马射线曲线，以及每口井对应的垂直 `typewell` 参考曲线。

## 我们的解法

我们的思路不是只训练一个模型，而是先构建多个具有不同假设的轨迹，再根据已知前缀判断哪些修正值得被启用。整体流程可以概括为：

```text
基础轨迹
  -> SP45 锚点与稳健投影
  -> 预训练模型轨迹融合
  -> 同井 contact reconstruction 自验证
  -> visible-prefix calibration
  -> PF 分支保护
  -> 保守的空间 kriging 修正
  -> submission.csv 审计
```

### 1. Ridge、PF 和物理 selector 组成基础轨迹

第一层同时保留了 Ridge/PF artifact 轨迹和 physical/PF selector 轨迹。Ridge 分支更像一个稳定的统计基线，PF 分支利用测井曲线和轨迹变化对地层位置进行连续跟踪，selector 分支则根据井的特征选择更合适的粒子滤波或 beam search 配置。

我们使用 `0.30` 的 Ridge 权重和 `0.70` 的 selector 权重形成 SP45 风格锚点：

$$
T_i^{A}=0.30T_i^{ridge}+0.70T_i^{selector}
$$

之后对 `T+Z` 这个隐含的地层位置进行低阶稳健投影，在归一化测深空间中抑制局部抖动，再还原为 `TVT`。这样做的目的不是让曲线变得“更平滑”这么简单，而是让预测轨迹尽量符合地层连续变化的物理直觉。

### 2. 融合预训练模型轨迹

在基础轨迹之外，我们还接入了挂载在 Kaggle Notebook 中的预训练模型轨迹。最终采用的配置是 `vp_balanced_modelpkg_005`，投影后的 SP45 轨迹权重为 `0.40`，学习模型轨迹权重为 `0.60`：

$$
T_i^{blend}=0.40T_i^{proj}+0.60T_i^{learned}
$$

这一步让结果同时保留了规则轨迹的稳定性和学习模型对复杂局部变化的拟合能力。

### 3. 只在可验证时使用同井地质接触关系

比赛数据中有些井同时出现在训练和测试的可见部分，这给了我们一个很有价值的机会：可以利用训练井的地质构造面重建一条 contact-derived TVT 轨迹。

但同井信息不能无条件使用。我们先把重建结果插值到测试井的已知前缀，再计算前缀 RMSE。只有满足以下条件时，才允许用 contact 轨迹覆盖隐藏区间：

- 已知前缀有足够多的可比较样本；
- 训练井的物理构造面数据足够完整；
- 前缀验证 RMSE 小于 `1.0 ft`。

验证失败就保留原来的融合结果。这个门禁很重要，因为一条看起来有地质含义的轨迹，如果在已知前缀上都对不上，继续延伸到隐藏区间只会放大错误。

### 4. 使用可见前缀做局部选择

我们还把已知前缀的一部分暂时遮住，模拟“预测未来”的场景，用 holdout RMSE 比较不同候选轨迹。只有当候选方案在多个前缀截断位置上都稳定优于默认轨迹时，visible-prefix calibration 才会产生有限幅度的修正。

同时，heel GR calibration 用来校正水平井和 typewell 之间的增益、偏移差异；当 PF 和 beam search 出现两个相互竞争的地层分支时，分支 hedge 会降低对单一路径的过度承诺。

### 5. 空间修正放在最后，而且默认回退

最后加入的是一个非常保守的空间层。它使用 773 口井的 OOF 残差查找空间邻居，只在所有门禁同时满足时才添加一次 datum shift：

| 门禁 | 条件 |
| --- | ---: |
| 最近各向异性距离 | 不超过 `500` |
| 有效邻居数 | 不少于 `1.25` |
| 邻居残差离散度 | 不超过 `6.0` |
| 单井偏移绝对值 | 不超过 `1.25 ft` |

任何一项不满足，就保持 PF、模型、contact 和 visible-prefix 产生的 luck baseline，不添加空间偏移。这样可以避免空间信息替换掉已经验证过的主预测路径。

## 榜单：第 285 名变成第 284 名

在比赛刚结束、私人榜单还没有完全稳定时，页面上显示我们排在第 285 名，分数是 `8.527`，队伍一共提交了 437 次。

![提交结束时的第 285 名榜单](/assets/images/kaggle/rogii-leaderboard-rank-285.png)

之后私人排行榜稳定，排名向前移动了一位。最终页面显示我们排在第 284 名，并正式获得银牌。

![私人榜单稳定后的第 284 名](/assets/images/kaggle/rogii-leaderboard-final-rank-284.png)

这里要区分两个时间点：第 285 名是比赛结束时的过程快照，第 284 名才是最终证书和最终私人榜单确认的结果。

## 过度依赖 Public Score 的教训

这次最遗憾的地方，不是模型完全不够好，而是最后没有选择私人榜表现最好的候选版本。

提交记录页把这个选择过程保存了下来：被勾选的 `ROGII K3 V5 PathMean8 A15 v1` 对应 `Private Score 8.527`、`Public Score 5.869`；下面的 `ROGII 5863 DET GS13 A35 v1` 对应 `Private Score 7.782`、`Public Score 6.122`，但当时没有被选中。

![Kaggle 提交记录中的候选版本与分数](/assets/images/kaggle/rogii-submission-candidates.png)

这张图也说明了问题的具体发生位置：不是没有跑出更好的候选，而是在最终提交选择这一步，选择了公开榜表现更亮眼的结果。

| 候选结果 | Public Score | Private Score | 最终名次或推算名次 |
| --- | ---: | ---: | ---: |
| 实际采用的版本 | `5.869` | `8.527` | 第 `284` 名 |
| Public 更低的候选 | `5.843` | `8.824` | 约第 `415` 名 |
| Private 更低的最佳候选 | `6.122` | `7.782` | **第 `118` 名** |

公开榜的 `5.843` 看起来比 `5.869` 更好，但它在隐藏测试区间上的 `Private Score` 反而变成了 `8.824`。这说明我们在迭代过程中对 Public Score 的反馈依赖过重，可能已经对公开测试片段进行了过度适配。

真正的最佳候选是 `Private Score 7.782`。我重新拉取最终私人榜单后统计得到：共有 117 支队伍的分数严格低于 `7.782`，没有并列，因此如果当时把这份结果作为最终提交，排名会是第 `118` 名。

也就是说：

- 相比最终第 284 名，理论上可以提升 `166` 个名次；
- 相比提交结束时的第 285 名，理论上可以提升 `167` 个名次；
- 但奖牌仍然是银牌，变化主要体现在银牌区间内的名次提升。

这也是 Kaggle 中非常典型的一课：Public Score 适合快速判断方向，但不能代替本地交叉验证、整井验证和对隐藏分布的稳健性判断。尤其是时序、空间和同井数据混合的任务，公开榜上的局部规律很容易在私人测试集上失效。

## 第一次比赛的收获

第一次参赛就拿到银牌，当然还有遗憾，但我更愿意把它看成一次完整的入门经历：从理解地质预测任务、处理井轨迹和测井曲线，到构建 PF、规则轨迹、预训练模型和空间修正，最后还亲身经历了 Public/Private 分数不一致以及提交选择的重要性。

如果只看名次，第 118 名会更漂亮；但第 284 名的银牌同样是真实结果。它证明了这套方法已经具备一定竞争力，也提醒我们下一次比赛需要把“最终候选选择”当成独立的建模问题来处理，而不是简单选择公开榜分数最低的文件。

## 参考资料

- [Kaggle 竞赛页面](https://www.kaggle.com/competitions/rogii-wellbore-geology-prediction)
- [完整方案与 Notebook 记录](https://github.com/sycg767/kaggle-competitions/tree/main/rogii-wellbore-geology-prediction)
- [Kaggle 最佳候选 Notebook](https://www.kaggle.com/code/davidsarrat/rogii-5863-det-gs13-a35-v1?scriptVersionId=339157226)

本文记录的是个人参赛过程与结果复盘，分数、排名和候选方案以 Kaggle 最终私人榜单及提交记录为准。

---
title: "Cursor++：自定义 API 的快速安装与卸载"
published: 2026-08-05
description: "记录 Cursor++ 在 BYOK 场景下的安装、卸载和基础使用注意事项。"
image: ""
tags: ["Cursor","AI 工具"]
category: "工具"
draft: false
lang: "zh_CN"
pinned: false
comment: true
---

## 先记住两个命令

如果你只是想快速安装或移除 Cursor++，在终端执行下面的命令即可：

```bash
# 安装或更新到当前版本
npx @cometix/ccursor@latest install

# 卸载 Cursor++
npx @cometix/ccursor@latest uninstall
```

这两个命令建议收藏起来。以后需要更新时，可以再次执行安装命令；不再使用时执行卸载命令即可。

## Cursor++ 是什么

Cursor++ 面向 Cursor 的自定义 API，也就是常说的 BYOK（Bring Your Own Key）场景。它通过扩展方式接入 Cursor 的相关调用，让用户能够在自己的模型服务和 Cursor 工作流之间做更灵活的连接。

它更适合已经有自定义 API 服务、希望继续使用 Cursor 编辑器体验的人。具体支持范围会随版本变化，安装后应以当前版本的文档和实际日志为准。

## 使用时注意协议设置

不同模型服务对 HTTP 协议和接口形式的要求可能不同。遇到请求失败、工具调用异常或返回内容不完整时，先检查服务端支持的协议版本，确认 HTTP/1.1 或 HTTP/2 的选择与接口要求一致。

不要把 API Key 写进文章、截图或公开仓库。建议使用单独的低权限密钥，并为它设置额度和调用范围。

## 版本更新

Cursor++ 的功能仍在持续迭代。早期版本已经围绕并发子代理、递归调用限制、Agent Window 中的 MCP 工具、编辑器换行兼容和后台服务路由等问题进行过修复。

如果安装后遇到异常，可以按下面顺序排查：

1. 重新执行安装命令，确认使用的是最新版本；
2. 检查 Cursor 和 Cursor++ 的日志；
3. 核对模型接口地址、协议版本和密钥权限；
4. 仍然无法使用时执行卸载命令，恢复到未安装状态。

## 相关地址

- 项目主页：[ccursor.cometix.dev](https://ccursor.cometix.dev)
- 原始讨论：[Linux.do 相关讨论](https://linux.do/t/topic/1926833)

本文根据本地保存的讨论页面整理和改写，仅作为个人使用记录，不替代项目官方文档。

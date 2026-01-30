# koishi-plugin-vox

[![npm](https://img.shields.io/npm/v/koishi-plugin-vox?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-vox)

Vox 合成器，依赖 FFmpeg 进行音频处理。

## 简介

这是一个 Koishi 插件，用于从指定路径读取音频文件并进行拼接合成。支持将多个音频片段拼接成一个完整的语音，适用于语音合成、音效组合等场景。

## 功能特性

- 支持从多个路径扫描音频文件
- 按文件夹组织音色，每个文件夹代表一个音色
- 文件名（不含扩展名）作为触发名称
- 支持拼接多个音频片段
- 支持输出 MP3 和 SILK 格式
- 可选依赖 `koishi-plugin-silk` 插件

## 安装

在 Koishi 控制台中安装：

```bash
npm install koishi-plugin-vox
```

## 配置

在插件配置中设置以下参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `soundPath` | `string[]` | - | 用于搜索音频的绝对路径，支持搜索 mp3/wav/ogg/flac/m4a/aac 格式 |
| `audioType` | `"mp3" \| "silk"` | `"mp3"` | 最终发送的类型，QQ 及微信建议选择 SILK |

### 目录结构示例

```
/path/to/sounds/
├── voice1/
│   ├── 你好.mp3
│   ├── 世界.wav
│   └── 欢迎.ogg
├── voice2/
│   ├── 哈哈.mp3
│   └── 嘿嘿.wav
```

在这个例子中：
- `voice1` 和 `voice2` 是两个不同的音色
- `你好`、`世界`、`欢迎` 是 `voice1` 音色下的可用触发词
- `哈哈`、`嘿嘿` 是 `voice2` 音色下的可用触发词

## 使用方法

### 基本命令

```
vox <音色> <触发词1> <触发词2> ... <触发词N>
```

### 示例

假设配置了上述目录结构：

```
vox voice1 你好 世界
```

这会将 `voice1` 音色下的 `你好.mp3` 和 `世界.wav` 拼接并发送。

```
vox voice2 哈哈 嘿嘿
```

这会将 `voice2` 音色下的 `哈哈.mp3` 和 `嘿嘿.wav` 拼接并发送。

### 查看可用音色

```
vox
```

返回所有可用的音色列表。

## 依赖

### 必需依赖

- **FFmpeg**: 用于音频处理和格式转换

请确保系统已安装 FFmpeg 并可在命令行中直接调用：

```bash
ffmpeg -version
```

### 可选依赖

- **koishi-plugin-silk**: 用于支持 SILK 格式输出（适用于 QQ 和微信）

## 许可证

MIT

## 链接

- [GitHub 仓库](https://github.com/DrAbcOfficial/koishi-plugin-vox)
- [Koishi 官网](https://koishi.js.org/)

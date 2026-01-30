import { Context, h, Schema } from 'koishi'
import { readdir } from 'fs/promises'
import { extname, join } from 'path'
import { spawn } from 'child_process'
import SilkService from 'koishi-plugin-silk'

declare module 'koishi' {
  interface Context {
    silk: SilkService
  }
}

export const name = 'vox';
export const usage = '路径下的文件夹将会被认为一个音色，子文件夹内所有音频将会读取为可用音频，文件名（不含扩展名）即为触发名称。';
export const inject = {
  optional: ['silk']
}

export interface Config {
  soundPath: string[],
  audioType: "mp3" | "silk"
}

export const Config: Schema<Config> = Schema.object({
  soundPath: Schema.array(Schema.string()).description("用于搜索音频的*绝对*路径，支持搜索mp3 wav ogg flac m4a aac格式"),
  audioType: Schema.union(["mp3", "silk"]).default("mp3").description("最终发送的类型，QQ及微信选择SILK")
}).description("Vox");

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];

let voicePath : Map<string, Map<string, string>> = new Map();

async function buildVoicePath(soundPaths: string[]): Promise<void> {
  voicePath.clear();
  
  for (const basePath of soundPaths) {
    try {
      const entries = await readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) 
          continue;
        
        const voiceName = entry.name;
        const voiceDir = join(basePath, voiceName);
        const audioMap = new Map<string, string>();
        
        try {
          const files = await readdir(voiceDir, { withFileTypes: true });
          
          for (const file of files) {
            if (!file.isFile()) 
              continue;
            
            const ext = extname(file.name).toLowerCase();
            if (!AUDIO_EXTENSIONS.includes(ext)) 
              continue;
            
            const triggerName = file.name.slice(0, -ext.length);
            const fullPath = join(voiceDir, file.name);
            audioMap.set(triggerName, fullPath);
          }
          
          if (audioMap.size > 0) {
            voicePath.set(voiceName, audioMap);
          }
        } catch (err) {
          continue;
        }
      }
    } catch (err) {
      continue;
    }
  }
}
let ffmpegAvailable: boolean | null = null;
let ffmpegCheckPromise: Promise<boolean> | null = null;
async function checkFFmpeg(): Promise<boolean> {
  if (ffmpegAvailable !== null)
    return ffmpegAvailable;
  if (ffmpegCheckPromise)
    return ffmpegCheckPromise;

  ffmpegCheckPromise = new Promise((resolve) => {
    const { spawn } = require('child_process');
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, 3000);

    try {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
      });
      ffmpeg.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(code === 0);
        }
      });
    }
    catch {
      clearTimeout(timeout);
      resolve(false);
    }
  }).then(result => {
    ffmpegAvailable = result as boolean;
    return result;
  }) as Promise<boolean>;

  return ffmpegCheckPromise;
}

async function runFFmpeg(commandArgs: string[], ctx:Context): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', commandArgs);
    const chunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk) => stderrChunks.push(chunk));
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const stderrOutput = Buffer.concat(stderrChunks).toString('utf8').trim();
        ctx.logger.error('FFmpeg stderr output:', stderrOutput);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    ffmpeg.on('error', reject);
  });
}

async function concatSound(ctx: Context, input: string[], audioType: "mp3" | "silk"): Promise<{ data: Buffer, mimeType: string }> {
  let args: string[] = [];
  
  for (const inputPath of input) {
    args.push('-i', inputPath);
  }
  
  args.push('-filter_complex');
  
  const inputCount = input.length;
  let filterChain = '';
  
  for (let i = 0; i < inputCount; i++) {
    filterChain += `[${i}:0]`;
  }
  
  filterChain += `concat=n=${inputCount}:v=0:a=1[out]`;
  args.push(filterChain);
  
  args.push('-map', '[out]');
  
  if (audioType === 'silk') {
    args.push('-ar', '24000', '-ac', '1', '-f', 's16le', 'pipe:1');
    const data = await runFFmpeg(args, ctx);
    return { data, mimeType: 'audio/pcm' };
  } else {
    args.push('-f', 'mp3', 'pipe:1');
    const data = await runFFmpeg(args, ctx);
    return { data, mimeType: 'audio/mp3' };
  }
}

export function apply(ctx: Context, config: Config) {
  buildVoicePath(config.soundPath).then(() => {
    ctx.logger.debug(`Loaded ${voicePath.size} voices: ${Array.from(voicePath.keys()).join(', ')}`);
  }).catch(err => {
    ctx.logger.error('Failed to build voice path:', err);
  });

  checkFFmpeg().then(available => {
    if (!available) {
      ctx.logger.warn('FFmpeg not found! Audio processing will fail.');
    } else {
      ctx.logger.debug('FFmpeg is available.');
    }
  });

  ctx.command('vox <voice:string> <...rest:string> 合成一个vox')
    .action(async ({ session }, voice,  ...rest) => {
      if (!voice) {
        return '至少给个音色吧, 可用的音色有: ' + Array.from(voicePath.keys()).join(', ');
      }
      
      const voiceMap = voicePath.get(voice);
      if (!voiceMap) {
        return `音色 ${voice} 不存在，可用的音色有: ${Array.from(voicePath.keys()).join(', ')}`;
      }
      
      if (!rest || rest.length === 0) {
        return `至少给点东西拼接吧！`;
      }
      
      const audioPaths: string[] = [];
      for (const trigger of rest) {
        const path = voiceMap.get(trigger);
        if (path) {
          audioPaths.push(path);
        }
      }
      
      if (audioPaths.length === 0) {
        return `未找到任何音频！`;
      }

      try {
        const { data, mimeType } = await concatSound(ctx, audioPaths, config.audioType);
        
        if (config.audioType === 'silk') {
          if (ctx.silk) {
            const silkResult = await ctx.silk.encode(data, 24000);
            await session.send(h.audio(silkResult.data, 'audio/silk'));
          } else {
            return '没有安装必要的SILK插件';
          }
        } else {
          await session.send(h.audio(data, mimeType));
        }
      } catch (error) {
        ctx.logger.error('拼接音频失败:', error);
        return '拼接音频失败';
      }
    })
}

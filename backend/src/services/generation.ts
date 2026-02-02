// SUBLYM Backend - Generation Service
// Spawns Python scripts for AI generation

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { prisma } from '../db';
import { sendGenerationReadyEmail } from './brevo';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const SCRIPTS_PATH = process.env.SCRIPTS_PATH || './scripts';
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const DEFAULT_GENERATION_TIMEOUT = 25 * 60 * 1000; // 25 minutes fallback

async function getGenerationConfig(): Promise<Record<string, string>> {
  const configs = await prisma.config.findMany({
    where: { category: 'generation' },
  });
  const map: Record<string, string> = {};
  for (const c of configs) {
    map[c.key] = c.value;
  }
  return map;
}

// ============================================
// GENERATION OPTIONS
// ============================================

interface GenerationOptions {
  description: string;
  reject: string[];
  photoPaths: string[];
  subliminalText?: string;
  isPhotosOnly: boolean;
  scenesCount: number;
  keyframesCount: number;
  characterName?: string;
  characterGender?: string;
  mode?: 'scenario' | 'free_scenes' | 'scenario_pub';
  dailyContext?: string;
}

// ============================================
// START GENERATION
// ============================================

export async function startGeneration(
  dreamId: number,
  userId: number,
  traceId: string,
  options: GenerationOptions
): Promise<void> {
  // Read dynamic generation config from database
  const genConfig = await getGenerationConfig();
  const timeoutMs = parseInt(genConfig['generation_timeout_minutes'] || '25') * 60 * 1000 || DEFAULT_GENERATION_TIMEOUT;

  // Create output directory
  const outputDir = path.join(STORAGE_PATH, 'users', userId.toString(), 'dreams', dreamId.toString());
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(outputDir, 'keyframes'), { recursive: true });

  // Write generation config as JSON for the Python bridge script to read
  const pipelineConfig = {
    max_attempts: parseInt(genConfig['generation_max_attempts'] || '5'),
    max_video_attempts: parseInt(genConfig['generation_max_video_attempts'] || '4'),
    model_scenario: genConfig['generation_model_scenario'] || 'gpt-4o',
    model_image: genConfig['generation_model_image'] || 'gemini-3-pro-image-preview',
    model_video: genConfig['generation_model_video'] || 'fal-ai/minimax/hailuo-02/standard/image-to-video',
  };
  const configFile = path.join(outputDir, 'generation_config.json');
  await fs.writeFile(configFile, JSON.stringify(pipelineConfig, null, 2));

  // Initialize progress file
  const progressFile = path.join(outputDir, 'progress.json');
  await fs.writeFile(progressFile, JSON.stringify({
    progress: 0,
    step: 'starting',
    message: 'Starting generation...',
  }));

  // Update run status
  await prisma.run.update({
    where: { traceId },
    data: { status: 'generating' },
  });

  // Prepare arguments
  const args = [
    path.join(SCRIPTS_PATH, 'dream_generate.py'),
    '--dream', options.description,
    '--photos', options.photoPaths.map(p => path.join(STORAGE_PATH, p)).join(','),
    '--trace-id', traceId,
    '--output-dir', outputDir,
    '--scenes-count', options.scenesCount.toString(),
    '--keyframes-count', options.keyframesCount.toString(),
  ];

  if (options.characterName) {
    args.push('--character-name', options.characterName);
  }

  if (options.characterGender) {
    args.push('--character-gender', options.characterGender);
  }

  if (options.reject.length > 0) {
    args.push('--reject', options.reject.join(','));
  }
  
  if (options.subliminalText) {
    args.push('--subliminal', options.subliminalText);
  }
  
  if (options.isPhotosOnly) {
    args.push('--photos-only');
  }

  if (options.mode && options.mode !== 'scenario') {
    args.push('--mode', options.mode);
  }

  if (options.dailyContext) {
    args.push('--daily-context', options.dailyContext);
  }
  
  // Spawn Python process
  const pythonProcess = spawn(PYTHON_PATH, args, {
    cwd: SCRIPTS_PATH,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
  });
  
  let outputBuffer = '';
  let errorBuffer = '';
  
  // Handle stdout (progress updates)
  pythonProcess.stdout.on('data', async (data) => {
    const output = data.toString();
    outputBuffer += output;
    console.log(`[${traceId}] ${output.trim()}`);
    
    // Try to parse progress updates
    try {
      const lines = output.split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.startsWith('{')) {
          const progress = JSON.parse(line);
          if (progress.progress !== undefined) {
            await fs.writeFile(progressFile, JSON.stringify(progress));
            
            // Update run in database
            await prisma.run.update({
              where: { traceId },
              data: {
                progress: progress.progress,
                currentStep: progress.step,
                stepMessage: progress.message,
              },
            });
          }
        }
      }
    } catch {
      // Not a JSON progress update
    }
  });
  
  // Handle stderr
  pythonProcess.stderr.on('data', (data) => {
    const error = data.toString();
    errorBuffer += error;
    console.error(`[${traceId}] ERROR: ${error.trim()}`);
  });
  
  // Set timeout (dynamic from database config)
  const timeoutMinutes = Math.round(timeoutMs / 60000);
  const timeout = setTimeout(async () => {
    pythonProcess.kill('SIGKILL');
    await handleGenerationFailure(traceId, dreamId, `Generation timed out after ${timeoutMinutes} minutes`);
  }, timeoutMs);
  
  // Handle completion
  pythonProcess.on('close', async (code) => {
    clearTimeout(timeout);
    
    if (code === 0) {
      await handleGenerationSuccess(traceId, dreamId, userId, outputDir, options.isPhotosOnly);
    } else {
      const errorMessage = errorBuffer || `Process exited with code ${code}`;
      await handleGenerationFailure(traceId, dreamId, errorMessage);
    }
  });
  
  // Handle errors
  pythonProcess.on('error', async (error) => {
    clearTimeout(timeout);
    await handleGenerationFailure(traceId, dreamId, `Failed to start: ${error.message}`);
  });
}

// ============================================
// HANDLE SUCCESS
// ============================================

async function handleGenerationSuccess(
  traceId: string,
  dreamId: number,
  userId: number,
  outputDir: string,
  isPhotosOnly: boolean
): Promise<void> {
  try {
    // Read result file
    const resultFile = path.join(outputDir, 'result.json');
    const resultData = await fs.readFile(resultFile, 'utf-8').catch(() => '{}');
    const result = JSON.parse(resultData);
    
    // Determine paths
    const relativePath = `users/${userId}/dreams/${dreamId}`;
    const videoPath = isPhotosOnly ? null : `${relativePath}/final.mp4`;
    const teaserPath = `${relativePath}/teaser.jpg`;
    const keyframesZipPath = isPhotosOnly ? `${relativePath}/keyframes.zip` : null;
    
    // Create keyframes ZIP if photos only
    if (isPhotosOnly) {
      await createKeyframesZip(path.join(outputDir, 'keyframes'), path.join(outputDir, 'keyframes.zip'));
    }
    
    // Update run
    await prisma.run.update({
      where: { traceId },
      data: {
        status: 'completed',
        progress: 100,
        currentStep: 'completed',
        stepMessage: 'Generation complete',
        scenarioName: result.scenarioName || 'Dream Journey',
        scenesCount: result.scenesCount || 5,
        duration: result.duration || 30,
        videoPath,
        teaserPath,
        keyframesZipPath,
        costEur: result.costEur || null,
        costDetails: result.costDetails || null,
        completedAt: new Date(),
      },
    });
    
    // Update dream status
    await prisma.dream.update({
      where: { id: dreamId },
      data: { status: 'completed' },
    });
    
    // Send notification email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const dream = await prisma.dream.findUnique({ where: { id: dreamId } });
    
    if (user && dream) {
      await sendGenerationReadyEmail(
        user.email,
        user.firstName,
        dream.description.substring(0, 50) + '...',
        user.lang
      );
    }
    
    console.log(`[${traceId}] Generation completed successfully`);
  } catch (error) {
    console.error(`[${traceId}] Error handling success:`, error);
    await handleGenerationFailure(traceId, dreamId, 'Error processing results');
  }
}

// ============================================
// HANDLE FAILURE
// ============================================

async function handleGenerationFailure(
  traceId: string,
  dreamId: number,
  errorMessage: string
): Promise<void> {
  console.error(`[${traceId}] Generation failed: ${errorMessage}`);
  
  await prisma.run.update({
    where: { traceId },
    data: {
      status: 'failed',
      error: errorMessage,
      canRetry: true,
    },
  });
  
  await prisma.dream.update({
    where: { id: dreamId },
    data: { status: 'failed' },
  });
}

// ============================================
// CREATE KEYFRAMES ZIP
// ============================================

async function createKeyframesZip(sourceDir: string, outputPath: string): Promise<void> {
  const archiver = await import('archiver');
  const fsSync = await import('fs');
  
  return new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(outputPath);
    const archive = archiver.default('zip', { zlib: { level: 9 } });
    
    output.on('close', resolve);
    archive.on('error', reject);
    
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

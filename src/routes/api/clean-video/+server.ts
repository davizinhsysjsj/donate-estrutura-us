import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Burlador de Meta Ads / Facebook copyright detection.
 *
 * Recebe video + (opcional) imagem de capa + duracao alvo, aplica pipeline
 * pesado de transformacoes pra quebrar:
 *   - Hash de metadata (strip total)
 *   - PHash visual (crop + rescale + eq + noise + unsharp)
 *   - Hash temporal (atempo + setpts)
 *   - Audio fingerprint (resample + bitrate novo + pitch shift)
 *   - Stream signature (re-encode H264 + GOP novo)
 *
 * Estrutura final do video:
 *   [imagem 1 frame] → [video processado] → [tela preta 2s] → [imagem loop]
 *
 * Duracao final = targetDuration (default 360s = 6min)
 */

// Limite max upload: 200MB (configuravel via env)
const MAX_BYTES = 200 * 1024 * 1024;

// Timeout do processamento: 5 min
const PROCESS_TIMEOUT_MS = 5 * 60 * 1000;

function runFfmpeg(args: string[], timeoutMs = PROCESS_TIMEOUT_MS): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
		let stderr = '';
		const timer = setTimeout(() => {
			proc.kill('SIGKILL');
			reject(new Error('ffmpeg timeout'));
		}, timeoutMs);

		proc.stderr.on('data', (d) => {
			stderr += d.toString();
		});

		proc.on('close', (code) => {
			clearTimeout(timer);
			if (code === 0) resolve(stderr);
			else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
		});

		proc.on('error', (err) => {
			clearTimeout(timer);
			reject(err);
		});
	});
}

async function probeDuration(file: string): Promise<number> {
	return new Promise((resolve, reject) => {
		const proc = spawn('ffprobe', [
			'-v',
			'error',
			'-show_entries',
			'format=duration',
			'-of',
			'default=noprint_wrappers=1:nokey=1',
			file
		]);
		let out = '';
		proc.stdout.on('data', (d) => (out += d.toString()));
		proc.on('close', (code) => {
			if (code === 0) resolve(parseFloat(out.trim()) || 0);
			else reject(new Error(`ffprobe exit ${code}`));
		});
		proc.on('error', reject);
	});
}

export const POST: RequestHandler = async ({ request }) => {
	const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
	if (contentLength > MAX_BYTES) {
		throw error(413, `Arquivo muito grande. Limite: ${MAX_BYTES / 1024 / 1024}MB`);
	}

	let form: FormData;
	try {
		form = await request.formData();
	} catch (e: any) {
		throw error(400, `formdata invalido: ${e.message || e}`);
	}

	const videoFile = form.get('video') as File | null;
	const imageFile = form.get('image') as File | null;
	const targetDurationRaw = form.get('targetDuration') as string | null;
	const intensityRaw = form.get('intensity') as string | null;

	if (!videoFile || typeof videoFile === 'string') {
		throw error(400, 'video obrigatorio');
	}

	const targetDuration = Math.max(
		10,
		Math.min(3600, parseInt(targetDurationRaw || '360', 10) || 360)
	);
	const aggressive = intensityRaw === 'aggressive';

	// Workdir temporario
	const workdir = join(tmpdir(), `cleanvideo-${randomUUID()}`);
	await mkdir(workdir, { recursive: true });

	const videoIn = join(workdir, 'input.mp4');
	const imageIn = imageFile ? join(workdir, `cover.${(imageFile.name.split('.').pop() || 'jpg').toLowerCase()}`) : null;
	const videoProcessed = join(workdir, 'video-proc.mp4');
	const intro = join(workdir, 'intro.mp4');
	const blackOutro = join(workdir, 'black.mp4');
	const padOutro = join(workdir, 'pad.mp4');
	const concatList = join(workdir, 'concat.txt');
	const finalOut = join(workdir, 'final.mp4');

	try {
		// 1. Escreve uploads em disco
		await writeFile(videoIn, Buffer.from(await videoFile.arrayBuffer()));
		if (imageFile && imageIn) {
			await writeFile(imageIn, Buffer.from(await imageFile.arrayBuffer()));
		}

		// 2. Probe duracao original (pra calcular padding)
		const origDuration = await probeDuration(videoIn);
		if (!origDuration || origDuration < 0.5) {
			throw error(400, 'video invalido ou muito curto');
		}

		// 3. Processa video principal com efeitos
		// Parametros variam por intensidade
		const speedFactor = aggressive ? 1.04 : 1.02; // 4% ou 2% mais rapido
		const noiseLevel = aggressive ? 6 : 3;
		const cropPx = aggressive ? 12 : 8;
		const brightness = aggressive ? 0.03 : 0.02;
		const contrast = aggressive ? 1.05 : 1.03;
		const saturation = aggressive ? 1.08 : 1.05;
		const audioPitchSampleRate = aggressive ? 44310 : 44100; // shift levissimo
		const crf = aggressive ? 24 : 23;

		const videoFilter = [
			`crop=in_w-${cropPx}:in_h-${cropPx}`,
			`scale=1080:1920:force_original_aspect_ratio=decrease`,
			`pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black`,
			`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`,
			`noise=alls=${noiseLevel}:allf=t`,
			`unsharp=5:5:0.3:5:5:0.0`,
			`setpts=PTS/${speedFactor}`
		].join(',');

		const audioFilter = [`asetrate=${audioPitchSampleRate}`, `atempo=${speedFactor}`, `aresample=44100`].join(',');

		await runFfmpeg([
			'-y',
			'-i',
			videoIn,
			'-map_metadata',
			'-1',
			'-map_chapters',
			'-1',
			'-vf',
			videoFilter,
			'-af',
			audioFilter,
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			String(crf),
			'-g',
			'48',
			'-pix_fmt',
			'yuv420p',
			'-c:a',
			'aac',
			'-b:a',
			'96k',
			'-ar',
			'44100',
			'-movflags',
			'+faststart',
			'-metadata',
			'title=',
			'-metadata',
			'comment=',
			'-metadata',
			'encoder=',
			'-metadata',
			'creation_time=now',
			videoProcessed
		]);

		const processedDuration = await probeDuration(videoProcessed);
		const remainingTime = Math.max(0, targetDuration - processedDuration - 2); // -2s pra tela preta

		const segments: string[] = [];

		// 4. Intro: 1 frame da imagem (se fornecida) ~33ms
		if (imageIn) {
			await runFfmpeg([
				'-y',
				'-loop',
				'1',
				'-t',
				'0.04',
				'-i',
				imageIn,
				'-f',
				'lavfi',
				'-t',
				'0.04',
				'-i',
				'anullsrc=channel_layout=stereo:sample_rate=44100',
				'-vf',
				'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1',
				'-c:v',
				'libx264',
				'-preset',
				'veryfast',
				'-crf',
				'23',
				'-r',
				'30',
				'-pix_fmt',
				'yuv420p',
				'-c:a',
				'aac',
				'-b:a',
				'96k',
				'-ar',
				'44100',
				'-shortest',
				intro
			]);
			segments.push(intro);
		}

		segments.push(videoProcessed);

		// 5. Tela preta 2s
		await runFfmpeg([
			'-y',
			'-f',
			'lavfi',
			'-i',
			'color=c=black:s=1080x1920:d=2:r=30',
			'-f',
			'lavfi',
			'-t',
			'2',
			'-i',
			'anullsrc=channel_layout=stereo:sample_rate=44100',
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			'23',
			'-pix_fmt',
			'yuv420p',
			'-c:a',
			'aac',
			'-b:a',
			'96k',
			'-ar',
			'44100',
			'-shortest',
			blackOutro
		]);
		segments.push(blackOutro);

		// 6. Padding final: imagem loop (se fornecida) ou tela preta ate completar
		if (remainingTime > 0) {
			if (imageIn) {
				await runFfmpeg([
					'-y',
					'-loop',
					'1',
					'-t',
					String(remainingTime),
					'-i',
					imageIn,
					'-f',
					'lavfi',
					'-t',
					String(remainingTime),
					'-i',
					'anullsrc=channel_layout=stereo:sample_rate=44100',
					'-vf',
					'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1',
					'-c:v',
					'libx264',
					'-preset',
					'veryfast',
					'-crf',
					'28',
					'-r',
					'30',
					'-pix_fmt',
					'yuv420p',
					'-c:a',
					'aac',
					'-b:a',
					'96k',
					'-ar',
					'44100',
					'-shortest',
					padOutro
				]);
			} else {
				await runFfmpeg([
					'-y',
					'-f',
					'lavfi',
					'-i',
					`color=c=black:s=1080x1920:d=${remainingTime}:r=30`,
					'-f',
					'lavfi',
					'-t',
					String(remainingTime),
					'-i',
					'anullsrc=channel_layout=stereo:sample_rate=44100',
					'-c:v',
					'libx264',
					'-preset',
					'veryfast',
					'-crf',
					'28',
					'-pix_fmt',
					'yuv420p',
					'-c:a',
					'aac',
					'-b:a',
					'96k',
					'-ar',
					'44100',
					'-shortest',
					padOutro
				]);
			}
			segments.push(padOutro);
		}

		// 7. Concat com filtro (mais compativel que demuxer pra varios codecs)
		const concatLines = segments.map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n');
		await writeFile(concatList, concatLines);

		await runFfmpeg([
			'-y',
			'-f',
			'concat',
			'-safe',
			'0',
			'-i',
			concatList,
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			String(crf),
			'-pix_fmt',
			'yuv420p',
			'-c:a',
			'aac',
			'-b:a',
			'96k',
			'-ar',
			'44100',
			'-movflags',
			'+faststart',
			'-map_metadata',
			'-1',
			'-metadata',
			'title=',
			'-metadata',
			'comment=',
			'-metadata',
			'encoder=',
			finalOut
		]);

		// 8. Le e retorna o arquivo final
		const buf = await readFile(finalOut);
		const finalDuration = await probeDuration(finalOut);

		return new Response(buf, {
			status: 200,
			headers: {
				'content-type': 'video/mp4',
				'content-disposition': `attachment; filename="video-limpo-${Date.now()}.mp4"`,
				'x-original-duration': String(origDuration.toFixed(2)),
				'x-final-duration': String(finalDuration.toFixed(2)),
				'x-intensity': aggressive ? 'aggressive' : 'normal'
			}
		});
	} catch (e: any) {
		const msg = e?.message || String(e);
		throw error(500, `processamento falhou: ${msg.slice(0, 300)}`);
	} finally {
		// Limpa workdir
		try {
			await rm(workdir, { recursive: true, force: true });
		} catch {}
	}
};

// SvelteKit body size limit (default 512kB) — sobrescreve pra 200MB
export const config = {
	bodySize: MAX_BYTES
};

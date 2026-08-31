export const KENBURNS = {
  width: 768,
  height: 1344,
  seconds: 6,
  fps: 25,
};

export function zoompanFilter(opts = {}) {
  const width = opts.width ?? KENBURNS.width;
  const height = opts.height ?? KENBURNS.height;
  const seconds = opts.seconds ?? KENBURNS.seconds;
  const fps = opts.fps ?? KENBURNS.fps;
  const frames = seconds * fps;
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    `zoompan=z='min(zoom+0.0015,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`,
    "format=yuv420p",
  ].join(",");
}

export function kenBurnsArgs(inputImage, outputMp4, opts = {}) {
  const width = opts.width ?? KENBURNS.width;
  const height = opts.height ?? KENBURNS.height;
  const seconds = opts.seconds ?? KENBURNS.seconds;
  const fps = opts.fps ?? KENBURNS.fps;
  return [
    "-y",
    "-loop",
    "1",
    "-i",
    inputImage,
    "-vf",
    zoompanFilter({ width, height, seconds, fps }),
    "-t",
    String(seconds),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    outputMp4,
  ];
}

export function runKenBurns(inputImage, outputMp4, opts = {}) {
  const spawnFn = opts.spawn;
  if (!spawnFn) {
    throw new Error("spawn implementation required");
  }
  const args = kenBurnsArgs(inputImage, outputMp4, opts);
  return new Promise((resolve, reject) => {
    const child = spawnFn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    if (child.stderr) {
      child.stderr.on("data", (buf) => {
        stderr += buf.toString();
      });
    }
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ outputMp4, args });
      else reject(new Error(`ffmpeg exited ${code}`));
    });
  });
}

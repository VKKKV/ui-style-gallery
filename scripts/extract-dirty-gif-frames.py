#!/usr/bin/env python3
"""Extract GIF frames/durations for deterministic Three.js looping."""
from PIL import Image, ImageSequence
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
gif = Image.open(root / 'assets/yudho-dirty-pixels.gif')
out = root / 'assets/yudho-dirty-pixels-frames'
out.mkdir(exist_ok=True)
frames = []
for index, frame in enumerate(ImageSequence.Iterator(gif)):
    frame.convert('RGBA').save(out / f'frame-{index:02d}.png', optimize=True)
    frames.append({'src': f'../assets/yudho-dirty-pixels-frames/frame-{index:02d}.png', 'duration': max(20, frame.info.get('duration', gif.info.get('duration', 40)))})
(root / 'assets/yudho-dirty-pixels-frames.json').write_text(json.dumps(frames, indent=2) + '\n')
print(f'extracted {len(frames)} frames; cycle={sum(item["duration"] for item in frames)}ms')

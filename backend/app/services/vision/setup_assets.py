"""
Intelligent Transport AI — Asset Verification & Setup Script
Audits and downloads required demo assets without committing heavy binaries.
- YOLOv8n ONNX Model Weights (Ultralytics AGPL-3.0)
- Sample Traffic Assets (JPEG & MP4)
- FFmpeg / ffprobe system tool check
"""
import os
import sys
import shutil
import subprocess
import urllib.request
from pathlib import Path

MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx"
MODEL_FILENAME = "yolov8n.onnx"

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent if BACKEND_DIR.name == "backend" else BACKEND_DIR


def check_ffmpeg() -> bool:
    """Check if ffmpeg and ffprobe are available on PATH."""
    ffmpeg_bin = shutil.which("ffmpeg")
    ffprobe_bin = shutil.which("ffprobe")
    if ffmpeg_bin and ffprobe_bin:
        try:
            res = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
            version_line = res.stdout.splitlines()[0] if res.stdout else "Available"
            print(f"[Transport AI] [OK] FFmpeg found: {version_line}")
            return True
        except Exception:
            print("[Transport AI] [WARN] FFmpeg found but execution timed out.")
            return False
    else:
        print("[Transport AI] [NOTICE] FFmpeg/ffprobe not found on PATH.")
        print("                Server-side video decoding will return HTTP 503 until FFmpeg is installed.")
        print("                Installation on Windows: winget install Gyan.FFmpeg")
        print("                Installation on Linux: sudo apt-get install ffmpeg")
        return False


def verify_or_download_weights() -> str:
    """Download YOLOv8n ONNX weights if not present."""
    weights_dir = BACKEND_DIR / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    target_path = weights_dir / MODEL_FILENAME

    if target_path.exists() and target_path.stat().st_size > 10 * 1024 * 1024:
        print(f"[Transport AI] [OK] YOLOv8n ONNX weights present ({target_path.stat().st_size:,} bytes): {target_path}")
        return str(target_path)

    print(f"[Transport AI] Downloading YOLOv8n ONNX model from {MODEL_URL} ...")
    req = urllib.request.Request(MODEL_URL, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp, open(target_path, "wb") as f:
            data = resp.read()
            f.write(data)
        print(f"[Transport AI] [OK] Downloaded {len(data):,} bytes to {target_path}")
        return str(target_path)
    except Exception as e:
        print(f"[Transport AI] [ERROR] Failed to download model weights: {e}")
        print("                You can manually download yolov8n.onnx from:")
        print(f"                {MODEL_URL}")
        print(f"                and place it at: {target_path}")
        return ""


def verify_sample_assets() -> None:
    """Verify sample traffic image and video."""
    uploads_dir = BACKEND_DIR / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    img_path = uploads_dir / "sample_traffic.jpg"
    video_path = uploads_dir / "sample_traffic_video.mp4"

    if img_path.exists():
        print(f"[Transport AI] [OK] Sample traffic image present: {img_path} ({img_path.stat().st_size:,} bytes)")
    else:
        print(f"[Transport AI] [NOTICE] Sample image missing at {img_path}.")

    if video_path.exists():
        print(f"[Transport AI] [OK] Sample traffic video present: {video_path} ({video_path.stat().st_size:,} bytes)")
    else:
        print(f"[Transport AI] [NOTICE] Sample video missing at {video_path}.")
        if shutil.which("ffmpeg"):
            print("                Generating a synthetic 4-second H.264 test pattern video...")
            try:
                cmd = [
                    "ffmpeg", "-y", "-v", "error",
                    "-f", "lavfi", "-i", "testsrc=duration=4:size=800x600:rate=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    str(video_path),
                ]
                subprocess.run(cmd, check=True, timeout=15)
                print(f"[Transport AI] [OK] Generated synthetic test video at: {video_path}")
            except Exception as e:
                print(f"[Transport AI] [WARN] Could not generate synthetic video: {e}")


def main() -> None:
    print("=" * 60)
    print("Intelligent Transport AI — Asset & Runtime Verification")
    print("=" * 60)
    check_ffmpeg()
    verify_or_download_weights()
    verify_sample_assets()
    print("=" * 60)
    print("Verification complete.")


if __name__ == "__main__":
    main()

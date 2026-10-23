"""
Utility script to download pretrained YOLOv8n ONNX model weights.
Source: Official Ultralytics GitHub release asset (v8.4.0)
License: AGPL-3.0
Size: ~12.85 MB
"""
import os
import sys
import urllib.request

MODEL_URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.onnx"
DEFAULT_TARGET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "backend", "weights")
MODEL_FILENAME = "yolov8n.onnx"


def download_yolo_weights(target_dir: str = None) -> str:
    if target_dir is None:
        target_dir = os.path.join(os.getcwd(), "backend", "weights")
        if not os.path.exists(target_dir):
            target_dir = os.path.join(os.getcwd(), "weights")

    os.makedirs(target_dir, exist_ok=True)
    target_path = os.path.join(target_dir, MODEL_FILENAME)

    if os.path.exists(target_path) and os.path.getsize(target_path) > 10 * 1024 * 1024:
        print(f"[Transport AI] Model weights already exist at: {target_path} ({os.path.getsize(target_path)} bytes)")
        return target_path

    print(f"[Transport AI] Downloading {MODEL_FILENAME} from {MODEL_URL} ...")
    req = urllib.request.Request(MODEL_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(target_path, "wb") as f:
        data = resp.read()
        f.write(data)

    print(f"[Transport AI] Successfully downloaded model weights ({len(data)} bytes) to: {target_path}")
    return target_path


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    download_yolo_weights(target)

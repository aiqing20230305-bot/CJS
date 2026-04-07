#!/usr/bin/env python3
"""
滑块验证码自动识别工具
使用ddddocr识别滑块拼图的目标位置
"""

import ddddocr
import sys
import json

def solve_slider(background_path, slider_path):
    """
    识别滑块距离

    Args:
        background_path: 背景图片路径
        slider_path: 滑块图片路径

    Returns:
        滑块需要移动的距离（像素）
    """
    det = ddddocr.DdddOcr(det=False, ocr=False, show_ad=False)

    with open(background_path, 'rb') as f:
        background_bytes = f.read()
    with open(slider_path, 'rb') as f:
        slider_bytes = f.read()

    # 识别滑块匹配位置
    res = det.slide_match(slider_bytes, background_bytes, simple_target=True)
    return res

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({"success": False, "error": "Usage: captcha_solver.py <bg_path> <slider_path>"}))
        sys.exit(1)

    try:
        distance = solve_slider(sys.argv[1], sys.argv[2])
        print(json.dumps({"success": True, "distance": distance}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

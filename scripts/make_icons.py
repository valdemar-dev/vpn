import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")

def draw_shield(size, color, bg=None, radius_ratio=0.22):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    if bg:
        r = int(size * radius_ratio)
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg)
    
    s = size
    
    pts = [
        (s * 0.5, s * 0.10),
        (s * 0.88, s * 0.24),
        (s * 0.88, s * 0.52),
        (s * 0.50, s * 0.90),
        (s * 0.12, s * 0.52),
        (s * 0.12, s * 0.24),
    ]

    d.polygon(pts, fill=color)
    if size >= 48:
        d.line([(s * 0.36, s * 0.50), (s * 0.47, s * 0.61), (s * 0.66, s * 0.38)], fill=(255, 255, 255, 255), width=max(2, s // 20), joint="curve")
    return img


bg = (15, 15, 12, 255)
draw_shield(64, (179, 145, 79, 255), bg=bg).save(f"{OUT}/icon.png")
draw_shield(32, (147, 184, 165, 255), bg=bg).save(f"{OUT}/tray-connected.png")
draw_shield(32, (107, 102, 90, 255), bg=bg).save(f"{OUT}/tray-disconnected.png")
print("icons written to", OUT)
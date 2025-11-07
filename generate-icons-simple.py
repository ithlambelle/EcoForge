#!/usr/bin/env python3
"""Simple icon generator for Waterer extension"""
from PIL import Image, ImageDraw
import os

os.makedirs('icons', exist_ok=True)

def create_icon(size):
    # create image with gradient-like background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)
    
    # draw gradient effect (simplified)
    for i in range(size):
        ratio = i / size
        r = int(102 + (118 - 102) * ratio)  # 667eea to 764ba2
        g = int(126 + (75 - 126) * ratio)
        b = int(234 + (162 - 234) * ratio)
        color = (r, g, b)
        draw.line([(i, 0), (i, size)], fill=color)
    
    # water drop circle (white)
    center_x, center_y = size // 2, size // 2 - int(size * 0.1)
    radius = int(size * 0.3)
    draw.ellipse([center_x - radius, center_y - radius, 
                  center_x + radius, center_y + radius], 
                 fill=(255, 255, 255, 230))
    
    # simple W shape (drawn manually, no font needed)
    w_width = int(size * 0.4)
    w_height = int(size * 0.3)
    w_x = (size - w_width) // 2
    w_y = size // 2 + int(size * 0.05)
    
    # draw simple W
    line_width = max(2, size // 16)
    points = [
        (w_x, w_y),
        (w_x + w_width // 4, w_y - w_height),
        (w_x + w_width // 2, w_y - w_height // 2),
        (w_x + 3 * w_width // 4, w_y - w_height),
        (w_x + w_width, w_y)
    ]
    draw.line(points, fill='#667eea', width=line_width)
    
    img.save(f'icons/icon{size}.png', 'PNG')
    print(f'✓ created icon{size}.png')

if __name__ == '__main__':
    print('creating icons...')
    for size in [16, 48, 128]:
        create_icon(size)
    print('✓ all icons created successfully!')


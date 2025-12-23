#!/usr/bin/env python3
"""
Generate FocusFlow app icon
Design: Modern rounded square with focus/timer motif
"""

from PIL import Image, ImageDraw, ImageFont
import math
import os

def create_focusflow_icon(size=1024):
    """Create a modern FocusFlow icon"""
    # Create image with transparency
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Calculate dimensions
    padding = size * 0.08
    corner_radius = size * 0.22

    # Draw rounded rectangle background with gradient effect
    # Base colors - deep purple gradient
    base_color_top = (88, 28, 135)      # Purple-900
    base_color_bottom = (59, 7, 100)    # Darker purple

    # Create gradient background
    for y in range(size):
        ratio = y / size
        r = int(base_color_top[0] * (1 - ratio) + base_color_bottom[0] * ratio)
        g = int(base_color_top[1] * (1 - ratio) + base_color_bottom[1] * ratio)
        b = int(base_color_top[2] * (1 - ratio) + base_color_bottom[2] * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Create mask for rounded rectangle
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(
        [padding, padding, size - padding, size - padding],
        radius=corner_radius,
        fill=255
    )

    # Apply mask
    img.putalpha(mask)

    # Create new draw object after mask
    draw = ImageDraw.Draw(img)

    # Draw decorative elements
    center_x = size / 2
    center_y = size / 2

    # Outer glow ring (subtle)
    ring_radius = size * 0.32
    ring_width = size * 0.02
    glow_color = (167, 139, 250, 60)  # Purple-400 with low alpha
    for i in range(3):
        r = ring_radius + i * 2
        draw.ellipse(
            [center_x - r, center_y - r, center_x + r, center_y + r],
            outline=glow_color,
            width=int(ring_width)
        )

    # Main circle background
    circle_radius = size * 0.28
    circle_color = (139, 92, 246, 255)  # Purple-500
    draw.ellipse(
        [center_x - circle_radius, center_y - circle_radius,
         center_x + circle_radius, center_y + circle_radius],
        fill=circle_color
    )

    # Inner circle (darker)
    inner_radius = size * 0.24
    inner_color = (109, 40, 217, 255)  # Purple-600
    draw.ellipse(
        [center_x - inner_radius, center_y - inner_radius,
         center_x + inner_radius, center_y + inner_radius],
        fill=inner_color
    )

    # Draw timer/focus indicator - arc showing progress
    arc_radius = size * 0.21
    arc_width = size * 0.04
    arc_color = (196, 181, 253, 255)  # Purple-300

    # Draw arc (like a timer at 75%)
    bbox = [
        center_x - arc_radius,
        center_y - arc_radius,
        center_x + arc_radius,
        center_y + arc_radius
    ]
    draw.arc(bbox, start=-90, end=180, fill=arc_color, width=int(arc_width))

    # Draw "F" letter in the center
    font_size = int(size * 0.28)

    # Try to use a system font, fall back to default
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            font = ImageFont.load_default()

    letter = "F"
    letter_color = (255, 255, 255, 255)  # White

    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), letter, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    text_x = center_x - text_width / 2
    text_y = center_y - text_height / 2 - bbox[1]  # Adjust for baseline

    # Draw letter with slight shadow
    shadow_offset = size * 0.01
    shadow_color = (0, 0, 0, 80)
    draw.text((text_x + shadow_offset, text_y + shadow_offset), letter, font=font, fill=shadow_color)
    draw.text((text_x, text_y), letter, font=font, fill=letter_color)

    # Add small decorative dots (like timer markers)
    dot_radius = size * 0.015
    dot_distance = size * 0.35
    dot_color = (196, 181, 253, 180)  # Purple-300 semi-transparent

    for angle in [0, 90, 180, 270]:
        rad = math.radians(angle - 90)
        dot_x = center_x + dot_distance * math.cos(rad)
        dot_y = center_y + dot_distance * math.sin(rad)
        draw.ellipse(
            [dot_x - dot_radius, dot_y - dot_radius,
             dot_x + dot_radius, dot_y + dot_radius],
            fill=dot_color
        )

    return img


def create_icns(icon_path, output_path):
    """Create .icns file for macOS"""
    import subprocess
    import tempfile
    import shutil

    # Required sizes for icns
    sizes = [16, 32, 64, 128, 256, 512, 1024]

    # Create temporary iconset directory
    iconset_dir = tempfile.mkdtemp(suffix='.iconset')

    try:
        img = Image.open(icon_path)

        # Generate all required sizes
        for size in sizes:
            # Standard resolution
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(os.path.join(iconset_dir, f'icon_{size}x{size}.png'))

            # @2x resolution (Retina)
            if size <= 512:
                size_2x = size * 2
                resized_2x = img.resize((size_2x, size_2x), Image.Resampling.LANCZOS)
                resized_2x.save(os.path.join(iconset_dir, f'icon_{size}x{size}@2x.png'))

        # Try to use iconutil (macOS) or png2icns
        try:
            subprocess.run(['iconutil', '-c', 'icns', iconset_dir, '-o', output_path], check=True)
            print(f"Created {output_path} using iconutil")
        except (subprocess.CalledProcessError, FileNotFoundError):
            # iconutil not available, create a simple icns manually or skip
            print("iconutil not available - skipping .icns creation")
            print("The PNG icons will still work for most purposes")

    finally:
        shutil.rmtree(iconset_dir)


def main():
    # Output directory
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
    os.makedirs(output_dir, exist_ok=True)

    print("Generating FocusFlow icon...")

    # Create base icon at 1024x1024
    icon = create_focusflow_icon(1024)

    # Save main icon
    main_icon_path = os.path.join(output_dir, 'icon.png')
    icon.save(main_icon_path, 'PNG')
    print(f"Saved: {main_icon_path}")

    # Generate various sizes needed by Tauri
    sizes = [32, 128, 256, 512]
    for size in sizes:
        resized = icon.resize((size, size), Image.Resampling.LANCZOS)
        path = os.path.join(output_dir, f'{size}x{size}.png')
        resized.save(path, 'PNG')
        print(f"Saved: {path}")

    # Generate @2x versions
    for size in [128, 256]:
        size_2x = size * 2
        resized = icon.resize((size_2x, size_2x), Image.Resampling.LANCZOS)
        path = os.path.join(output_dir, f'{size}x{size}@2x.png')
        resized.save(path, 'PNG')
        print(f"Saved: {path}")

    # Try to create .icns for macOS
    icns_path = os.path.join(output_dir, 'icon.icns')
    create_icns(main_icon_path, icns_path)

    # Also create .ico for Windows
    ico_path = os.path.join(output_dir, 'icon.ico')
    icon_sizes = [16, 32, 48, 64, 128, 256]
    icons = [icon.resize((s, s), Image.Resampling.LANCZOS) for s in icon_sizes]
    icons[0].save(ico_path, format='ICO', sizes=[(s, s) for s in icon_sizes])
    print(f"Saved: {ico_path}")

    print("\nIcon generation complete!")
    print("\nGenerated files:")
    for f in os.listdir(output_dir):
        if f.endswith(('.png', '.ico', '.icns')):
            print(f"  - {f}")


if __name__ == '__main__':
    main()

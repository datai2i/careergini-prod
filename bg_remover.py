import sys
from PIL import Image

def remove_white_background(input_path, output_path, fuzz=20):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    new_data = []
    for item in data:
        # Check if pixel is close to white (255, 255, 255)
        if item[0] > 255 - fuzz and item[1] > 255 - fuzz and item[2] > 255 - fuzz:
            new_data.append((255, 255, 255, 0)) # Fully transparent
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python bg_remover.py <input.png> <output.png>")
        sys.exit(1)
        
    remove_white_background(sys.argv[1], sys.argv[2], fuzz=30)
    print("Background removed successfully.")

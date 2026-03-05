import os
import urllib.request

base_dir = "/home/ubuntu/careergini-prod/haystack-service/latex_templates/fonts"
lato_dir = os.path.join(base_dir, "lato")
raleway_dir = os.path.join(base_dir, "raleway")

os.makedirs(lato_dir, exist_ok=True)
os.makedirs(raleway_dir, exist_ok=True)

lato_fonts = [
    "Lato-Bol.ttf", "Lato-BolIta.ttf", "Lato-Hai.ttf", "Lato-HaiIta.ttf",
    "Lato-Lig.ttf", "Lato-LigIta.ttf", "Lato-Reg.ttf", "Lato-RegIta.ttf"
]
raleway_fonts = ["Raleway-ExtraLight.ttf", "Raleway-Medium.ttf"]

lato_base_url = "https://raw.githubusercontent.com/deedy/Deedy-Resume/master/fonts/lato/"
raleway_base_url = "https://raw.githubusercontent.com/deedy/Deedy-Resume/master/fonts/raleway/"

def download_font(url, filepath):
    if not os.path.exists(filepath):
        print(f"Downloading {filepath}...")
        try:
            urllib.request.urlretrieve(url, filepath)
            print("Success.")
        except Exception as e:
            print(f"Failed: {e}")
    else:
        print(f"Exists: {filepath}")

for f in lato_fonts:
    download_font(lato_base_url + f, os.path.join(lato_dir, f))

for f in raleway_fonts:
    download_font(raleway_base_url + f, os.path.join(raleway_dir, f))

print("All done.")

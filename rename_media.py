from pathlib import Path
import shutil

MEDIA_DIR = Path("media/devices")
BACKUP_DIR = Path("media/devices_backup")

BACKUP_DIR.mkdir(exist_ok=True)

files = sorted(
    [f for f in MEDIA_DIR.iterdir() if f.is_file()],
    key=lambda x: x.name
)

for index, file in enumerate(files, start=1):
    new_name = f"device_{index:03d}{file.suffix.lower()}"
    new_file = MEDIA_DIR / new_name

    # بکاپ
    shutil.copy2(file, BACKUP_DIR / file.name)

    # تغییر نام
    file.rename(new_file)

    print(f"{file.name} -> {new_name}")

print(f"\nDone: {len(files)} files renamed.")
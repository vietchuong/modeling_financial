import os
import sys

print("DEBUG: Starting script...", flush=True)

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
test_path = os.path.join(base_dir, "data", "kqkd.csv")
print(f"DEBUG: Checking file {test_path}...", flush=True)

if os.path.exists(test_path):
    print("DEBUG: File exists.", flush=True)
    try:
        with open(test_path, 'r', encoding='utf-8') as f:
            print("DEBUG: File opened.", flush=True)
            content = f.read(100)
            print(f"DEBUG: Content start: {content}", flush=True)
    except Exception as e:
        print(f"DEBUG: Error reading file: {e}", flush=True)
else:
    print("DEBUG: File NOT found.", flush=True)

print("DEBUG: Done.", flush=True)

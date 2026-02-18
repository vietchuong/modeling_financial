"""Quick verification: runs main() from run_all_valuations and saves output to results.txt"""
import sys
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, script_dir)

output_file = os.path.join(script_dir, "results.txt")

from run_all_valuations import main

with open(output_file, 'w', encoding='utf-8') as f:
    old = sys.stdout
    sys.stdout = f
    try:
        main()
    except Exception as e:
        import traceback
        f.write(f"\nERROR: {e}\n")
        traceback.print_exc(file=f)
    sys.stdout = old
